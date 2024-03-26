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
        osType = osType, archType = archType
    }
end

function getReleases()
    local result = {}
    local resp, err = http.get({
        url = GOLANG_URL .. "?mode=json"
    })
    if err ~= nil or resp.status_code ~= 200 then
        error("paring release info failed." .. err)
    end
    local body = json.decode(resp.body)
    for _, info in ipairs(body) do
        local v = string.sub(info.version, 3)
        for _, file in ipairs(info.files) do
            if file.kind == "archive" and file.os == RUNTIME.osType and file.arch == RUNTIME.archType then
                table.insert(result, {
                    version = v,
                    url = GOLANG_URL .. file.filename,
                    note = "stable",
                    sha256 = file.sha256,
                })
            end
        end
    end
    resp, err = http.get({
        url = GOLANG_URL
    })
    if err ~= nil or resp.status_code ~= 200 then
        error("paring release info failed." .. err)
    end
    local type = getOsTypeAndArch()
    local doc = html.parse(resp.body)
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
                        url = GOLANG_URL .. filename,
                        note = "",
                        sha256 = checksum,
                    })
                end
            end)
        end
    end)
    return result
end