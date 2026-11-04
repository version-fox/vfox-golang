-- Copyright 2026 Han Li and contributors
--
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
--   http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.

local http = require("http")
local html = require("html")
local json = require("json")
require("constants")
function getOsTypeAndArch()
    local osType = RUNTIME.osType
    local archType = RUNTIME.archType
    if RUNTIME.osType == "darwin" then
        osType = "macOS"
    elseif RUNTIME.osType == "linux" then
        osType = "Linux"
    elseif RUNTIME.osType == "windows" then
        osType = "Windows"
    end
    if RUNTIME.archType == "amd64" then
        archType = "x86-64"
    elseif RUNTIME.archType == "arm64" then
        archType = "ARM64"
    elseif RUNTIME.archType == "386" then
        archType = "x86"
    end
    return {
        osType = osType,
        archType = archType,
    }
end

--- How many times a page of go.dev is asked for before the plugin gives up on it, the first time included. The http
--- module of vfox never tries again, and ends a TLS handshake that takes more than 10 seconds. A connection that is slow
--- only the first time, as through a proxy that has yet to dial go.dev, fails the first request and lets the next one
--- through. Running the same command a second time was the retry that was needed.
local ATTEMPTS = 3

--- Fetches a page of go.dev. A request that fails, and an answer with a server error (a status of 500 or more), are
--- made again, up to ATTEMPTS times in all. There is no pause in between: vfox has no sleep for a plugin, and a failure
--- of this kind has waited a while already. Any other status is what go.dev means, so it is not made again.
--- A page that cannot be had fails with what went wrong the last time: the failure of the request, which names the
--- address, or the status that go.dev answered with. The number of attempts follows when there were more than one.
--- @param url string
--- @return string The body of the page
local function fetch(url)
    local reason
    for _ = 1, ATTEMPTS do
        local resp, err = http.get({
            url = url,
        })
        if err == nil and resp.status_code == 200 then
            return resp.body
        end
        if err ~= nil then
            reason = tostring(err)
        else
            reason = url .. " answered with status " .. tostring(resp.status_code)
        end
        if err == nil and resp.status_code < 500 then
            error("cannot list the Go releases: " .. reason, 0)
        end
    end
    error(("cannot list the Go releases: %s (after %d attempts)"):format(reason, ATTEMPTS), 0)
end

function getReleases(mirror)
    local result = {}
    local GOLANG_DOWNLOAD_URL = mirror or GOLANG_URL
    local body = json.decode(fetch(GOLANG_URL .. "?mode=json"))
    for _, info in ipairs(body) do
        local v = string.sub(info.version, 3)
        for _, file in ipairs(info.files) do
            if file.kind == "archive" and file.os == RUNTIME.osType and file.arch == RUNTIME.archType then
                table.insert(result, {
                    version = v,
                    url = GOLANG_DOWNLOAD_URL .. file.filename,
                    note = "stable",
                    sha256 = file.sha256,
                })
            end
        end
    end
    local type = getOsTypeAndArch()
    local doc = html.parse(fetch(GOLANG_URL))
    local listDoc = doc:find("div#archive")
    listDoc:find(".toggle"):each(function(i, selection)
        local versionStr = selection:attr("id")
        if versionStr ~= nil then
            selection:find("table.downloadtable tbody tr"):each(function(ti, ts)
                local td = ts:find("td")
                local filename = td:eq(0):text()
                local kind = td:eq(1):text()
                local os = td:eq(2):text()
                local arch = td:eq(3):text()
                local checksum = td:eq(5):text()
                if kind == "Archive" and os == type.osType and arch == type.archType then
                    table.insert(result, {
                        version = string.sub(versionStr, 3),
                        url = GOLANG_DOWNLOAD_URL .. filename,
                        note = "",
                        sha256 = checksum,
                    })
                end
            end)
        end
    end)
    return result
end
