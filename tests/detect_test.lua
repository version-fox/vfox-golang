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

-- Detect finds the Go installations that are already on the machine, for
-- `vfox link --detect golang`. The test VM disables io.popen, so the
-- directory listings come from the stub below; the VERSION files and the
-- binaries are real fixtures under tests/fixtures/detect, read through
-- RUNTIME.pluginDirPath so the test runs from any directory.

local test = require("vfox.test")
local plugin = test.load()

if plugin.Detect == nil then
    -- A vfox without `vfox link` never loads hooks/detect.lua, so there is
    -- nothing to call. The Test Plugin workflow pins a vfox that has it.
    print("SKIP: the Detect hook needs vfox 1.1.0 or later")
    return
end

local FIX = RUNTIME.pluginDirPath .. "/tests/fixtures/detect"
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

local fakeEnv = {}
local realGetenv = os.getenv
os.getenv = function(name)
    local value = fakeEnv[name]
    if value ~= nil then
        return value
    end
    return realGetenv(name)
end

local function detect()
    local found = {}
    for _, item in ipairs(plugin:Detect({})) do
        assert(
            type(item.version) == "string"
                and item.version:match("^[A-Za-z0-9][A-Za-z0-9._+%-]*$")
                and item.version ~= "latest",
            "bad version " .. tostring(item.version)
        )
        assert(type(item.path) == "string" and item.path ~= "", "path missing")
        assert(type(item.note) == "string" and item.note ~= "", "note missing")
        found[item.version .. "\0" .. item.path] = true
    end
    return found
end

local function expect(found, version, path)
    assert(found[version .. "\0" .. path], "missing " .. version .. " at " .. path)
end

RUNTIME.osType = "linux"
fakeEnv = {
    HOME = FIX .. "/home",
    MISE_DATA_DIR = FIX .. "/mise",
    ASDF_DATA_DIR = FIX .. "/asdf",
    GOROOT = FIX .. "/official",
}
local found = detect()
expect(found, "1.21.5", FIX .. "/mise/installs/go/1.21.5")
expect(found, "1.22.0", FIX .. "/asdf/installs/golang/1.22.0/go")
expect(found, "1.22.1", FIX .. "/official")
expect(found, "1.22.2", FIX .. "/home/sdk/go1.22.2")
expect(found, "1.21.0", FIX .. "/home/.goenv/versions/1.21.0")
for key in pairs(found) do
    assert(key:find("broken", 1, true) == nil, "broken fixture reported: " .. key)
end
assert(seenCommands[1]:sub(1, 7) == 'ls -1 "', "linux must list directories with ls")

RUNTIME.osType = "windows"
fakeEnv = {
    USERPROFILE = FIX .. "/winhome",
    MISE_DATA_DIR = FIX .. "/mise",
    ASDF_DATA_DIR = FIX .. "/asdf",
    GOROOT = FIX .. "/windows-goroot",
    LOCALAPPDATA = FIX .. "/localappdata",
}
local winFound = detect()
-- The Unix fixtures have bin/go but no bin/go.exe, so Windows skips them.
expect(winFound, "1.22.3", FIX .. "/windows-goroot")
expect(winFound, "1.20.0", FIX .. "/localappdata/mise/installs/go/1.20.0")
local sawDir = false
for _, command in ipairs(seenCommands) do
    if command:sub(1, 10) == "dir /b /ad" then
        sawDir = true
    end
end
assert(sawDir, "windows must list directories with dir /b /ad")

-- PLUGIN.shadowHints explains the usual culprits when another executable
-- shadows the plugin's go, for `vfox use` and `vfox doctor`.
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
