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

require("utils")
require("os")

--- @class PreInstallContext
--- @field version string User-input version

--- Returns some pre-installed information, such as version number, download address, local files, etc.
--- If checksum is provided, vfox will automatically check it for you.
--- @param ctx PreInstallContext
--- @return table Version information
function PLUGIN:PreInstall(ctx)
    local version = ctx.version
    local mirror = os.getenv("VFOX_GOLANG_MIRROR")
    local releases = getReleases(mirror)
    if version == "latest" then
        if releases[1] ~= nil then
            return releases[1]
        end
    else
        for _, release in ipairs(releases) do
            if release.version == version then
                return release
            end
        end
    end
    -- Not an empty result: vfox takes it for an install, reports success and installs nothing.
    error(
        ("No Go release found for %q on %s/%s. `vfox search golang` lists the releases."):format(
            version,
            RUNTIME.osType,
            RUNTIME.archType
        ),
        0
    )
end
