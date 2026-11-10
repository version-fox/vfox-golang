--- !!! DO NOT EDIT OR RENAME !!!
PLUGIN = {}

--- !!! MUST BE SET !!!
--- Plugin name
PLUGIN.name = "golang"
--- Plugin version
PLUGIN.version = "0.4.1"
--- Plugin homepage
PLUGIN.homepage = "https://github.com/version-fox/vfox-golang"
--- Plugin license, please choose a correct license according to your needs.
PLUGIN.license = "Apache 2.0"
--- Plugin description
PLUGIN.description = "Golang plugin, https://go.dev/dl/"


--- !!! OPTIONAL !!!
--[[
NOTE:
    Minimum compatible vfox version.
    If the plugin is not compatible with the current vfox version,
    vfox will not load the plugin and prompt the user to upgrade vfox.
 --]]
PLUGIN.minRuntimeVersion = "0.4.0"
--[[
NOTE:
    If configured, vfox will check for updates to the plugin at this address,
    otherwise it will check for updates at the global registry.

    If you want use the global registry to distribute your plugin, you can remove this field.

    If you develop a plugin based on the template, which will automatically generate a manifest file by CI,
    you can set this address to the manifest file address, so that the plugin can be updated automatically.

 --]]
PLUGIN.manifestUrl = "https://github.com/version-fox/vfox-golang/releases/download/manifest/manifest.json"
--[[
NOTE:
    Hints shown by `vfox use` and `vfox doctor` when a command of this SDK
    (go, gofmt, ...) is shadowed by another executable earlier in PATH.
    Each entry matches part of the shadowing executable's path
    (case-insensitive) and explains how to hand `go` back to vfox or adopt
    the other installation instead. Detecting the shadowing itself is done
    by vfox; the plugin only explains the usual culprits.
    Optional: older vfox versions ignore this field.
 --]]
PLUGIN.shadowHints = {
    {
        match = "mise",
        message = "mise provides its own Go. `mise uninstall go` (or removing go from mise.toml) hands `go` back to vfox; `vfox link --detect golang` adopts mise's Go instead.",
    },
    {
        match = "asdf",
        message = "asdf provides its own Go through shims. `asdf uninstall golang` hands `go` back to vfox; `vfox link --detect golang` adopts asdf's Go instead.",
    },
    {
        match = "homebrew",
        message = "Homebrew's Go comes first. `brew uninstall go` hands `go` back to vfox; `vfox link --detect golang` adopts Homebrew's Go instead.",
    },
    {
        match = "/usr/local/bin",
        message = "Another Go in /usr/local/bin (Homebrew on Intel, or a manual symlink) comes first. Remove it, or adopt that installation with `vfox link <version> <path>`.",
    },
    {
        match = "/usr/local/go",
        message = "The official Go in /usr/local/go comes first. Remove it, or adopt it with `vfox link --detect golang`.",
    },
    {
        match = "/usr/bin",
        message = "The system package manager's Go comes first. Remove the system golang package, or adopt it with `vfox link --detect golang`.",
    },
    {
        match = "goenv",
        message = "goenv's Go comes first. `goenv uninstall <version>` hands `go` back to vfox; `vfox link --detect golang` adopts goenv's Go instead.",
    },
    {
        match = "gvm",
        message = "gvm's Go comes first. `gvm uninstall <version>` hands `go` back to vfox; `vfox link --detect golang` adopts gvm's Go instead.",
    },
    {
        match = "snap",
        message = "snap's Go comes first. `snap remove go` hands `go` back to vfox; `vfox link --detect golang` adopts snap's Go instead.",
    },
    {
        match = "scoop",
        message = "Scoop's Go comes first. `scoop uninstall go` hands `go` back to vfox; `vfox link --detect golang` adopts Scoop's Go instead.",
    },
    {
        match = "chocolatey",
        message = "Chocolatey's Go comes first. `choco uninstall golang` hands `go` back to vfox; `vfox link --detect golang` adopts it instead.",
    },
    {
        match = "program files",
        message = "A machine-wide Go under Program Files comes first. Uninstall it, or adopt it with `vfox link --detect golang`.",
    },
}
-- Some things that need user to be attention!
PLUGIN.notes = {
}
