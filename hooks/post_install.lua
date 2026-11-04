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

--- Quotes `value` as one word of the command line that os.execute runs: the path of an installation may have a
--- space in it, as the home directory of a user may.
--- @param value string
--- @return string
local function quote(value)
    if RUNTIME.osType == "windows" then
        -- A path that cmd reads as it is stays as it is. vfox 1.0.12 and before give cmd the command with each " turned
        -- into \", which cmd misreads, so a path in quotes would not be the directory it names. From vfox 1.0.13 on
        -- the command reaches cmd as it is written (version-fox/vfox#712), and the quotes make a path with a space, or
        -- with an operator in it, one word. cmd takes no escape inside double quotes, and a path cannot hold one.
        if not value:find("[%s&|<>^(),;=]") then
            return value
        end
        return '"' .. value .. '"'
    end
    return "'" .. value:gsub("'", "'\\''") .. "'"
end

function PLUGIN:PostInstall(ctx)
    local sdkInfo = ctx.sdkInfo["golang"]
    local path = sdkInfo.path

    if RUNTIME.osType == "windows" then
        os.execute("mkdir " .. quote(path .. "\\packages\\bin"))
    else
        os.execute("mkdir -p " .. quote(path .. "/packages/bin"))
    end
end
