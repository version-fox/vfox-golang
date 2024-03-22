--- Returns some pre-installed information, such as version number, download address, local files, etc.
--- If checksum is provided, vfox will automatically check it for you.
--- @param ctx table
--- @field ctx.version string User-input version
--- @return table Version information
function PLUGIN:PreInstall(ctx)
    local version = ctx.version
    local releases = getReleases()
    if version == "latest" then
        return releases[1]
    end
    for _, release in ipairs(releases) do
        if release.version == version then
            return release
        end
    end
    return {}
end