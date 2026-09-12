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
