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
local plugin = test.load()

-- The environment comes from here: os.getenv answers for VFOX_GOLANG_GOPATH from the variable the cases
-- set, and for everything else as it did.
local configured
local getenv = os.getenv
os.getenv = function(name)
    if name == "VFOX_GOLANG_GOPATH" then
        return configured
    end
    if name == "GOPATH" then
        -- What a previously selected vfox SDK exported. EnvKeys must not inherit it.
        return "/previous/sdk/packages"
    end
    return getenv(name)
end

local function check(osType, value, expected, bins)
    RUNTIME.osType = osType
    configured = value
    local paths, gopath, goroot = {}, nil, nil
    for _, item in ipairs(plugin:EnvKeys({ path = "/sdk/go" })) do
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

-- Without VFOX_GOLANG_GOPATH, or with an empty one, each version keeps its own packages.
check("linux", nil, "/sdk/go/packages", { "/sdk/go/packages/bin" })
check("linux", "", "/sdk/go/packages", { "/sdk/go/packages/bin" })
-- One path, or several: the separator is the one of the platform, and each bin directory is on the PATH.
check("linux", "/shared/go", "/shared/go", { "/shared/go/bin" })
check("linux", "/shared/go:/other/go", "/shared/go:/other/go", { "/shared/go/bin", "/other/go/bin" })
check("windows", "C:\\Go Work;D:\\Go", "C:\\Go Work;D:\\Go", { "C:\\Go Work/bin", "D:\\Go/bin" })
-- A slash at the end of a path does not double in the bin directory.
check("linux", "/shared/go/", "/shared/go/", { "/shared/go/bin" })
check("windows", "D:\\Go\\", "D:\\Go\\", { "D:\\Go/bin" })
