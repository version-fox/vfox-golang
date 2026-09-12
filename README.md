# vfox-golang

Golang plugin for [vfox](https://vfox.dev/) .

## Install
After install [vfox](https://vfox.dev/),install the plugin by running:
```vfox add golang```

## Install from mirror
Here's a `VFOX_GOLANG_MIRROR` env to determine where to download the `golang`

For example:
```bash
VFOX_GOLANG_MIRROR=https://mirrors.aliyun.com/golang/ vfox install golang
```

or you can use following mirror:
- https://golang.google.cn/dl/

## Shared or custom GOPATH

By default each Go version has its own `GOPATH` under its installation directory.
Set `VFOX_GOLANG_GOPATH` before activating vfox to share packages and installed
commands across Go versions:

```bash
export VFOX_GOLANG_GOPATH="$HOME/go"
```

On PowerShell, use `$env:VFOX_GOLANG_GOPATH = "$HOME\go"` before activation.
Multiple paths use `:` on Unix or `;` on Windows. Their `bin` directories are
added to PATH. Existing packages are not moved; Go creates directories as needed.
Unset this variable to restore per-version storage. The plugin deliberately does
not inherit `GOPATH`, which may point to a previously selected vfox Go version.

## Releasing this plugin

Maintainers can publish from **Actions → Plugin → Run workflow** on the default
branch by entering a stable plugin version without the `v` prefix. The shared
workflow updates `metadata.lua`, creates the version commit and tag, and publishes
the ZIP and manifest in this repository. No local tag or extra release token is
needed. Pull requests run checks only; PR titles no longer trigger publication.

Existing version-tag pushes are supported when `PLUGIN.version` already matches
the tag. If publication fails, re-run the original failed job to resume it.

The workflow follows the shared `@v1` release-tool version. Updating the tool does
not release this plugin. See the [shared workflow documentation](https://github.com/version-fox/plugin-manifest-action)
for the package contract and first-rollout requirements.
