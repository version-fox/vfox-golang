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

-- PostInstall runs a shell command, and a test run does not let a hook run one. So os.execute is replaced before the
-- plugin is loaded, by a function that keeps the command; the E2E tests (tests/e2e) run the command for real.
local commands = {}
os.execute = function(command)
    commands[#commands + 1] = command
    return 0
end

local test = require("vfox.test")
local plugin = test.load()

--- The command PostInstall runs for a release that is installed in `path`, on `osType`.
local function command(osType, path)
    RUNTIME.osType = osType
    commands = {}
    plugin:PostInstall({
        rootPath = path,
        sdkInfo = { golang = { name = "golang", version = "1.24.0", path = path } },
    })
    assert(#commands == 1, "PostInstall ran " .. #commands .. " commands, not one")
    return commands[1]
end

local cases = 0
local function check(osType, path, expected)
    local got = command(osType, path)
    assert(got == expected, osType .. " " .. path .. ":\n  expected " .. expected .. "\n  got      " .. got)
    cases = cases + 1
end

-- The bin directory of the GOPATH, inside the release. On Unix the path is quoted, so that the shell takes it as one
-- word.
check(
    "linux",
    "/home/me/.vfox/cache/golang/v-1.24.0/golang-1.24.0",
    "mkdir -p '/home/me/.vfox/cache/golang/v-1.24.0/golang-1.24.0/packages/bin'"
)
check(
    "darwin",
    "/Users/me/.vfox/cache/golang/v-1.24.0/golang-1.24.0",
    "mkdir -p '/Users/me/.vfox/cache/golang/v-1.24.0/golang-1.24.0/packages/bin'"
)

-- A space in the path used to split the command into two directories.
check("linux", "/home/John Doe/.vfox/sdk", "mkdir -p '/home/John Doe/.vfox/sdk/packages/bin'")

-- A quote in it ends the quoting, unless it is escaped. So does everything the shell would otherwise run.
check("linux", "/home/it's here/sdk", "mkdir -p '/home/it'\\''s here/sdk/packages/bin'")
check("linux", "/tmp/a;b $(id) `id` & c/sdk", "mkdir -p '/tmp/a;b $(id) `id` & c/sdk/packages/bin'")

-- On Windows a path stays as it is unless cmd would read part of it as syntax, which is how the command ran before.
-- vfox 1.0.12 and before give cmd the command with each " turned into \", which cmd misreads: a path in quotes would not
-- be the directory it names, for every Windows user of those versions and not only for those with a space in the path.
check(
    "windows",
    "C:\\Users\\me\\.vfox\\cache\\golang\\v-1.24.0\\golang-1.24.0",
    "mkdir C:\\Users\\me\\.vfox\\cache\\golang\\v-1.24.0\\golang-1.24.0\\packages\\bin"
)
check(
    "windows",
    "C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\sdk",
    "mkdir C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\sdk\\packages\\bin"
)
check("windows", "C:\\Users\\张三\\.vfox\\sdk", "mkdir C:\\Users\\张三\\.vfox\\sdk\\packages\\bin")
-- A single quote means nothing to cmd.
check("windows", "C:\\Users\\it's\\sdk", "mkdir C:\\Users\\it's\\sdk\\packages\\bin")

-- A space used to split the command into two directories here too. From vfox 1.0.13 on, the command reaches cmd as it is
-- written (version-fox/vfox#712) and the double quotes make the path one word. A path cannot hold a double quote, and
-- inside them cmd takes no escape.
check("windows", "C:\\Users\\John Doe\\.vfox\\sdk", 'mkdir "C:\\Users\\John Doe\\.vfox\\sdk\\packages\\bin"')
check("windows", "C:\\Program Files (x86)\\go", 'mkdir "C:\\Program Files (x86)\\go\\packages\\bin"')
check("windows", "C:\\Users\\it's John\\sdk", 'mkdir "C:\\Users\\it\'s John\\sdk\\packages\\bin"')

-- And so is whatever else cmd runs or splits at: an operator would start a second command.
for _, special in ipairs({ "&", "|", "<", ">", "^", "(", ")", ",", ";", "=" }) do
    local path = "C:\\Users\\a" .. special .. "b\\sdk"
    check("windows", path, 'mkdir "' .. path .. '\\packages\\bin"')
end

print(cases .. " cases passed")
