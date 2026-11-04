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

--- @class EnvKeysContext
--- @field path string SDK installation directory

--- Each SDK may have different environment variable configurations.
--- This allows plugins to define custom environment variables (including PATH settings)
--- Note: Be sure to distinguish between environment variable settings for different platforms!
--- @param ctx EnvKeysContext Context information
function PLUGIN:EnvKeys(ctx)
    local mainPath = ctx.path
    -- Do not inherit GOPATH: it may have been exported by a previous vfox SDK.
    local gopath = os.getenv("VFOX_GOLANG_GOPATH")
    if gopath == nil or gopath == "" then
        gopath = mainPath .. "/packages"
    end
    local result = {
        {
            key = "GOROOT",
            value = mainPath,
        },
        {
            key = "GOPATH",
            value = gopath,
        },
        {
            key = "PATH",
            value = mainPath .. "/bin",
        },
    }
    local separator = RUNTIME.osType == "windows" and ";" or ":"
    for path in gopath:gmatch("[^" .. separator .. "]+") do
        table.insert(result, { key = "PATH", value = path:gsub("[/\\]+$", "") .. "/bin" })
    end
    return result
end
