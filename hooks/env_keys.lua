--- Each SDK may have different environment variable configurations.
--- This allows plugins to define custom environment variables (including PATH settings)
--- Note: Be sure to distinguish between environment variable settings for different platforms!
--- @param ctx table Context information
--- @field ctx.path string SDK installation directory
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
