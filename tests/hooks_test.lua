PLUGIN = {}
local configured
os.getenv = function(name)
    if name == "VFOX_GOLANG_GOPATH" then
        return configured
    end
    if name == "GOPATH" then
        return "/previous/sdk/packages"
    end
end
dofile("hooks/env_keys.lua")

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
