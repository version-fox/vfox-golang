PLUGIN = {}
local configured
local fakeEnv = {}
os.getenv = function(name)
    if name == "VFOX_GOLANG_GOPATH" then
        return configured
    end
    if name == "GOPATH" then
        return "/previous/sdk/packages"
    end
    return fakeEnv[name]
end
dofile("metadata.lua")
dofile("hooks/env_keys.lua")
dofile("hooks/detect.lua")

local function check(osType, value, expected, bins)
    RUNTIME = { osType = osType }
    configured = value
    local paths, gopath, goroot = {}, nil, nil
    for _, item in ipairs(PLUGIN:EnvKeys({ path = "/sdk/go" })) do
        if item.key == "PATH" then
            paths[#paths + 1] = item.value
        end
        if item.key == "GOPATH" then
            gopath = item.value
        end
        if item.key == "GOROOT" then
            goroot = item.value
        end
    end
    assert(gopath == expected, tostring(gopath))
    assert(goroot == "/sdk/go")
    assert(paths[1] == "/sdk/go/bin")
    assert(#paths == #bins + 1)
    for i, bin in ipairs(bins) do
        assert(paths[i + 1] == bin, paths[i + 1])
    end
end
check("linux", nil, "/sdk/go/packages", { "/sdk/go/packages/bin" })
check("linux", "", "/sdk/go/packages", { "/sdk/go/packages/bin" })
check("linux", "/shared/go", "/shared/go", { "/shared/go/bin" })
check("linux", "/shared/go:/other/go", "/shared/go:/other/go", { "/shared/go/bin", "/other/go/bin" })
check("windows", "C:\\Go Work;D:\\Go", "C:\\Go Work;D:\\Go", { "C:\\Go Work/bin", "D:\\Go/bin" })
print("5 GOPATH cases passed")

assert(type(PLUGIN.shadowHints) == "table" and #PLUGIN.shadowHints >= 5, "shadowHints missing")
local hintsByMatch = {}
for _, hint in ipairs(PLUGIN.shadowHints) do
    assert(type(hint.match) == "string" and hint.match ~= "", "hint match missing")
    assert(type(hint.message) == "string" and hint.message ~= "", "hint message missing")
    hintsByMatch[hint.match] = hint.message
end
assert(hintsByMatch["mise"] and hintsByMatch["mise"]:find("vfox link", 1, true), "mise hint missing")
assert(hintsByMatch["asdf"], "asdf hint missing")
assert(hintsByMatch["homebrew"], "homebrew hint missing")
print(#PLUGIN.shadowHints .. " shadowHints cases passed")

local FIX = "tests/fixtures/detect"
local fakeChildren = {
    [FIX .. "/mise/installs/go"] = { "1.21.5", "broken-noversion", "broken-nobinary" },
    [FIX .. "/asdf/installs/golang"] = { "1.22.0" },
    [FIX .. "/home/sdk"] = { "go1.22.2" },
    [FIX .. "/home/.goenv/versions"] = { "1.21.0" },
    [FIX .. "/localappdata/mise/installs/go"] = { "1.20.0" },
}
local seenCommands = {}
io.popen = function(command)
    seenCommands[#seenCommands + 1] = command
    local dir = command:match('^ls %-1 "(.-)"') or command:match('^dir /b /ad "(.-)"')
    local names = (dir and fakeChildren[dir]) or {}
    local i = 0
    return {
        lines = function()
            return function()
                i = i + 1
                return names[i]
            end
        end,
        close = function() end,
    }
end

local function indexResults(detected)
    local byVersionPath = {}
    for _, item in ipairs(detected) do
        assert(type(item.version) == "string"
            and item.version:match("^[A-Za-z0-9][A-Za-z0-9._+%-]*$")
            and item.version ~= "latest", "bad version " .. tostring(item.version))
        assert(type(item.path) == "string" and item.path ~= "", "path missing")
        assert(type(item.note) == "string" and item.note ~= "", "note missing")
        byVersionPath[item.version .. "\0" .. item.path] = true
    end
    return byVersionPath
end

RUNTIME = { osType = "linux" }
fakeEnv.HOME = FIX .. "/home"
fakeEnv.MISE_DATA_DIR = FIX .. "/mise"
fakeEnv.ASDF_DATA_DIR = FIX .. "/asdf"
fakeEnv.GOROOT = FIX .. "/official"
local detected = PLUGIN:Detect({})
local found = indexResults(detected)
local function expect(version, path)
    assert(found[version .. "\0" .. path], "missing " .. version .. " at " .. path)
end
expect("1.21.5", FIX .. "/mise/installs/go/1.21.5")
expect("1.22.0", FIX .. "/asdf/installs/golang/1.22.0/go")
expect("1.22.1", FIX .. "/official")
expect("1.22.2", FIX .. "/home/sdk/go1.22.2")
expect("1.21.0", FIX .. "/home/.goenv/versions/1.21.0")
for _, item in ipairs(detected) do
    assert(item.path:find("broken", 1, true) == nil, "broken fixture reported: " .. item.path)
end
assert(seenCommands[1]:sub(1, 7) == 'ls -1 "', "linux must list directories with ls")
print(#detected .. " linux Detect cases passed")

RUNTIME = { osType = "windows" }
fakeEnv.HOME = nil
fakeEnv.USERPROFILE = FIX .. "/winhome"
fakeEnv.GOROOT = FIX .. "/windows-goroot"
fakeEnv.LOCALAPPDATA = FIX .. "/localappdata"
local winDetected = PLUGIN:Detect({})
local winFound = indexResults(winDetected)
assert(winFound["1.22.3" .. "\0" .. FIX .. "/windows-goroot"], "windows GOROOT probe missing")
assert(winFound["1.20.0" .. "\0" .. FIX .. "/localappdata/mise/installs/go/1.20.0"],
    "windows mise scan missing")
local sawDir = false
for _, command in ipairs(seenCommands) do
    if command:sub(1, 10) == "dir /b /ad" then
        sawDir = true
    end
end
assert(sawDir, "windows must list directories with dir /b /ad")
print(#winDetected .. " windows Detect cases passed")
