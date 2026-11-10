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

local test = require("vfox.test")

-- go.dev's answers are the files in tests/fixtures (taken on 2026-11-04, see the README there): the JSON of the two
-- current releases, go1.27.3 and go1.26.10, and the page of the archive, go1.27.2, go1.24.0 and go1.20.
local function read(name)
    local file = assert(io.open(RUNTIME.pluginDirPath .. "/tests/fixtures/" .. name, "rb"))
    local content = file:read("*a")
    file:close()
    return content
end

local JSON_URL = "https://go.dev/dl/?mode=json"
local PAGE_URL = "https://go.dev/dl/"

-- What go.dev answers, by address. A case replaces an answer to see how the plugin takes it, and an address that is
-- not here is a request the plugin must not make.
local answers = {}
-- Answers that come once each, in this order, before the answer of the address stands: a request that fails, and then
-- goes through.
local queued = {}
local function reset()
    answers = {
        [JSON_URL] = { status_code = 200, body = read("dl.json"), headers = {} },
        [PAGE_URL] = { status_code = 200, body = read("dl.html"), headers = {} },
    }
    queued = {}
end

local requested
local plugin = test.load({
    os = "linux",
    arch = "amd64",
    http = function(request)
        requested[#requested + 1] = request.url
        local answer = table.remove(queued[request.url] or {}, 1) or answers[request.url]
        if answer == nil then
            return nil, "unexpected request for " .. request.url
        end
        if answer.failure then
            return nil, answer.failure
        end
        return answer
    end,
})

-- The mirror comes from the environment: os.getenv answers for it from this variable, and for everything else as it
-- did.
local mirror
local getenv = os.getenv
os.getenv = function(name)
    if name == "VFOX_GOLANG_MIRROR" then
        return mirror
    end
    return getenv(name)
end

local function platform(osType, archType)
    RUNTIME.osType = osType
    RUNTIME.archType = archType
end

local function setup(osType, archType, value)
    reset()
    requested = {}
    mirror = value
    platform(osType, archType)
end

local function contains(text, part)
    return text:find(part, 1, true) ~= nil
end

--- How many times the plugin asked for an address.
local function asked(url)
    local times = 0
    for _, address in ipairs(requested) do
        if address == url then
            times = times + 1
        end
    end
    return times
end

--- Calls a hook that has to fail, and returns what it says.
local function failure(hook, ctx)
    local ok, err = pcall(hook, plugin, ctx)
    assert(not ok, "the hook has to fail, and returned " .. tostring(err))
    return tostring(err)
end

local cases = 0
local function case(name, run)
    local ok, err = pcall(run)
    if not ok then
        error(name .. ": " .. tostring(err), 0)
    end
    cases = cases + 1
end

local DIGESTS = {
    -- go1.27.3, from the JSON.
    stable = "65efbc80fdc1fa2cd2631cad5b481777a68e8725f34e89f50fc6ac714e379b40",
    -- go1.24.0, from the page.
    linux_amd64 = "dea9ca38a0b852a74e81c26134671af7c0fbe65d81b0dc1c5bfe22cf7d4c8858",
    linux_arm64 = "c3fa6d16ffa261091a5617145553c71d21435ce547e44cc6dfb7470865527cc7",
    windows_amd64 = "96b7280979205813759ee6947be7e3bb497da85c482711116c00522e3bb41ff1",
    windows_arm64 = "53f73450fb66075d16be9f206e9177bd972b528168271918c4747903b5596c3d",
    darwin_arm64 = "fd9cfb5dd6c75a347cfc641a253f0db1cebaca16b0dd37965351c6184ba595e4",
    -- go1.20, from the page.
    go1_20 = "5a9ebcc65c1cce56e0d2dc616aff4c4cedcfbda8cc6f0288cc08cda3b18dcbf1",
}

case("Available lists the current releases first, noted stable, and then the archive", function()
    setup("linux", "amd64")
    local listed = plugin:Available({})
    local want = {
        { "1.27.3", "stable" },
        { "1.26.10", "stable" },
        { "1.27.2", "" },
        { "1.24.0", "" },
        { "1.20", "" },
    }
    assert(#listed == #want, "listed " .. #listed .. " releases, not " .. #want)
    for i, release in ipairs(want) do
        assert(listed[i].version == release[1], i .. ": " .. tostring(listed[i].version) .. ", not " .. release[1])
        assert(listed[i].note == release[2], release[1] .. " is noted '" .. tostring(listed[i].note) .. "'")
    end
    assert(requested[1] == JSON_URL and requested[2] == PAGE_URL and #requested == 2, table.concat(requested, ", "))
end)

case("Available lists the releases of the platform, and only those with an archive", function()
    -- freebsd has none in the fixtures, and neither does a CPU of which go.dev has no archive.
    setup("freebsd", "amd64")
    assert(#plugin:Available({}) == 0)
    setup("linux", "riscv64")
    assert(#plugin:Available({}) == 0)
    -- windows and macOS have archives, and also installers and packages that must stay out.
    setup("windows", "arm64")
    assert(#plugin:Available({}) == 5)
    setup("darwin", "arm64")
    assert(#plugin:Available({}) == 5)
end)

case("PreInstall takes latest for the first release listed, with its checksum", function()
    setup("linux", "amd64")
    local release = plugin:PreInstall({ version = "latest" })
    assert(release.version == "1.27.3", release.version)
    assert(release.url == "https://go.dev/dl/go1.27.3.linux-amd64.tar.gz", release.url)
    assert(release.sha256 == DIGESTS.stable, release.sha256)
    assert(release.note == "stable", release.note)
end)

case("PreInstall finds a release of the JSON, and one of the archive, by its exact name", function()
    setup("linux", "amd64")
    local current = plugin:PreInstall({ version = "1.26.10" })
    assert(
        current.version == "1.26.10" and current.url == "https://go.dev/dl/go1.26.10.linux-amd64.tar.gz",
        current.url
    )
    assert(current.sha256 == "ccfe7ae822d2c2f41f4fe7c956199967a4dac22d0ee0d2b2bfdb440aab3b20c5", current.sha256)

    local archived = plugin:PreInstall({ version = "1.24.0" })
    assert(archived.version == "1.24.0", archived.version)
    assert(archived.url == "https://go.dev/dl/go1.24.0.linux-amd64.tar.gz", archived.url)
    assert(archived.sha256 == DIGESTS.linux_amd64, archived.sha256)
end)

case("PreInstall finds the first release of a line before 1.21 by a name without a patch number", function()
    setup("linux", "amd64")
    local release = plugin:PreInstall({ version = "1.20" })
    assert(release.url == "https://go.dev/dl/go1.20.linux-amd64.tar.gz", release.url)
    assert(release.sha256 == DIGESTS.go1_20, release.sha256)
    assert(contains(failure(plugin.PreInstall, { version = "1.20.0" }), "1.20.0"), "1.20.0 is no release")
end)

case("PreInstall picks the archive of the platform: a zip on Windows, never an installer or a package", function()
    local expected = {
        { "linux", "arm64", "go1.24.0.linux-arm64.tar.gz", DIGESTS.linux_arm64 },
        { "windows", "amd64", "go1.24.0.windows-amd64.zip", DIGESTS.windows_amd64 },
        { "windows", "arm64", "go1.24.0.windows-arm64.zip", DIGESTS.windows_arm64 },
        { "darwin", "arm64", "go1.24.0.darwin-arm64.tar.gz", DIGESTS.darwin_arm64 },
    }
    for _, want in ipairs(expected) do
        setup(want[1], want[2])
        local release = plugin:PreInstall({ version = "1.24.0" })
        assert(release.url == "https://go.dev/dl/" .. want[3], want[1] .. "/" .. want[2] .. ": " .. release.url)
        assert(release.sha256 == want[4], want[1] .. "/" .. want[2] .. ": " .. release.sha256)
    end
end)

case("VFOX_GOLANG_MIRROR replaces the address of the downloads, and nothing that is asked of go.dev", function()
    setup("linux", "amd64", "https://mirror.example/golang/")
    local stable = plugin:PreInstall({ version = "latest" })
    assert(stable.url == "https://mirror.example/golang/go1.27.3.linux-amd64.tar.gz", stable.url)
    local archived = plugin:PreInstall({ version = "1.24.0" })
    assert(archived.url == "https://mirror.example/golang/go1.24.0.linux-amd64.tar.gz", archived.url)
    -- The checksums are go.dev's, not the mirror's.
    assert(archived.sha256 == DIGESTS.linux_amd64, archived.sha256)
    for _, url in ipairs(requested) do
        assert(url == JSON_URL or url == PAGE_URL, "asked " .. url)
    end
end)

case("PreInstall fails for a release that does not exist, and says which and where", function()
    setup("linux", "amd64")
    for _, version in ipairs({ "1.99.99", "1.24", "1", "go1.24.0", "1.24.0 " }) do
        local message = failure(plugin.PreInstall, { version = version })
        assert(contains(message, version), version .. ": " .. message)
        assert(contains(message, "linux/amd64"), version .. ": " .. message)
        assert(contains(message, "vfox search golang"), version .. ": " .. message)
    end
    setup("windows", "arm64")
    assert(contains(failure(plugin.PreInstall, { version = "1.99.99" }), "windows/arm64"))
end)

case("PreInstall fails for latest where go.dev has no archive", function()
    setup("freebsd", "amd64")
    local message = failure(plugin.PreInstall, { version = "latest" })
    assert(contains(message, "latest") and contains(message, "freebsd/amd64"), message)
end)

case("A failed request is reported with the address and what went wrong", function()
    setup("linux", "amd64")
    answers[JSON_URL] = { failure = "connection refused" }
    -- vfox 1.1.0 and later mask the values of a query in the error of a request, so ?mode=json reads ?mode=xxxxx
    -- there. The address is checked without its query, which names it on every version.
    local message = failure(plugin.Available, {})
    assert(contains(message, "connection refused") and contains(message, "https://go.dev/dl/"), message)
    message = failure(plugin.PreInstall, { version = "latest" })
    assert(contains(message, "connection refused") and contains(message, "https://go.dev/dl/"), message)

    setup("linux", "amd64")
    answers[PAGE_URL] = { failure = "no route to host" }
    message = failure(plugin.Available, {})
    assert(contains(message, "no route to host") and contains(message, PAGE_URL), message)
end)

case("An answer other than 200 is reported with its status, not with a failure of the plugin's own", function()
    setup("linux", "amd64")
    answers[JSON_URL] = { status_code = 503, body = "Service Unavailable", headers = {} }
    local message = failure(plugin.Available, {})
    assert(contains(message, "503") and contains(message, JSON_URL), message)
    assert(not contains(message, "concat"), message)
    assert(contains(failure(plugin.PreInstall, { version = "1.24.0" }), "503"))

    setup("linux", "amd64")
    answers[PAGE_URL] = { status_code = 404, body = "Not Found", headers = {} }
    message = failure(plugin.Available, {})
    assert(contains(message, "404") and contains(message, PAGE_URL), message)
    assert(not contains(message, "concat"), message)
end)

-- What vfox's http module reports when the handshake takes more than the 10 seconds Go gives it: the first request
-- of `vfox install golang@1.27.3` fails like this where go.dev is reached through a proxy that is slow on its first
-- connection, and a second `vfox install` right after goes through.
local HANDSHAKE_TIMEOUT = "net/http: TLS handshake timeout"

case("A request that fails is made again, so a failure that passes the next time does not stop the command", function()
    setup("linux", "amd64")
    queued[JSON_URL] = { { failure = HANDSHAKE_TIMEOUT } }
    local release = plugin:PreInstall({ version = "1.27.3" })
    assert(release.version == "1.27.3" and release.sha256 == DIGESTS.stable, tostring(release.version))
    assert(asked(JSON_URL) == 2, "asked for the JSON " .. asked(JSON_URL) .. " times, not 2")
    assert(asked(PAGE_URL) == 1, "asked for the page " .. asked(PAGE_URL) .. " times, not 1")

    -- The same for `vfox search`.
    setup("linux", "amd64")
    queued[JSON_URL] = { { failure = HANDSHAKE_TIMEOUT } }
    assert(#plugin:Available({}) == 5)
end)

case("Each request is made again by itself, and an answer that was had is not asked for twice", function()
    setup("linux", "amd64")
    queued[PAGE_URL] = { { failure = "connection reset by peer" }, { failure = HANDSHAKE_TIMEOUT } }
    local release = plugin:PreInstall({ version = "1.24.0" })
    assert(release.version == "1.24.0" and release.sha256 == DIGESTS.linux_amd64, tostring(release.version))
    assert(asked(JSON_URL) == 1, "asked for the JSON " .. asked(JSON_URL) .. " times, not 1")
    assert(asked(PAGE_URL) == 3, "asked for the page " .. asked(PAGE_URL) .. " times, not 3")
end)

case("A server error is made again, and a status that is not one is the answer of go.dev", function()
    setup("linux", "amd64")
    queued[JSON_URL] = {
        { status_code = 502, body = "Bad Gateway", headers = {} },
        { status_code = 503, body = "Service Unavailable", headers = {} },
    }
    assert(plugin:PreInstall({ version = "latest" }).version == "1.27.3")
    assert(asked(JSON_URL) == 3, "asked for the JSON " .. asked(JSON_URL) .. " times, not 3")

    for _, status in ipairs({ 403, 404, 429 }) do
        setup("linux", "amd64")
        answers[JSON_URL] = { status_code = status, body = "no", headers = {} }
        local message = failure(plugin.Available, {})
        assert(contains(message, tostring(status)), message)
        assert(asked(JSON_URL) == 1, status .. ": asked for the JSON " .. asked(JSON_URL) .. " times, not 1")
        assert(not contains(message, "attempts"), message)
    end
end)

case("The retries end: three attempts, and the failure of the last one is reported with their number", function()
    setup("linux", "amd64")
    queued[JSON_URL] = { { failure = "first failure" }, { failure = "second failure" } }
    answers[JSON_URL] = { failure = HANDSHAKE_TIMEOUT }
    local message = failure(plugin.PreInstall, { version = "1.27.3" })
    assert(asked(JSON_URL) == 3, "asked for the JSON " .. asked(JSON_URL) .. " times, not 3")
    assert(asked(PAGE_URL) == 0, "the page is not asked for when the JSON cannot be had")
    -- The address without its query, as above: vfox 1.1.0 and later mask it in the error of a request.
    assert(contains(message, "https://go.dev/dl/") and contains(message, HANDSHAKE_TIMEOUT), message)
    assert(not contains(message, "first failure") and not contains(message, "second failure"), message)
    assert(contains(message, "after 3 attempts"), message)

    -- A status says so in the same way, and the page is no different from the JSON.
    setup("linux", "amd64")
    answers[PAGE_URL] = { status_code = 503, body = "Service Unavailable", headers = {} }
    message = failure(plugin.Available, {})
    assert(asked(PAGE_URL) == 3, "asked for the page " .. asked(PAGE_URL) .. " times, not 3")
    assert(contains(message, PAGE_URL) and contains(message, "503") and contains(message, "after 3 attempts"), message)
end)

print(cases .. " cases passed")
