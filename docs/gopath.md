# GOPATH and the environment

[中文](zh-CN/gopath.md) | [English](gopath.md)

## What the plugin sets

For the release that `vfox use` selects, the plugin provides these, with `~/.vfox/sdks/golang` the link that vfox points at the release:

| Variable | Value |
| --- | --- |
| `GOROOT` | `~/.vfox/sdks/golang` |
| `GOPATH` | `~/.vfox/sdks/golang/packages` |
| `PATH` | `~/.vfox/sdks/golang/bin`, followed by `~/.vfox/sdks/golang/packages/bin` |

The `GOPATH` is inside the release, so every release keeps its own packages and its own installed commands, and a release that is uninstalled takes them along. `go install` puts a command in `packages/bin`, which is on the `PATH`, so the shell finds it by its name. The plugin creates that directory when it installs the release, so the entry on the `PATH` exists from the start.

```
$ go env GOROOT GOPATH
/home/me/.vfox/sdks/golang
/home/me/.vfox/sdks/golang/packages
```

## One GOPATH for all releases

To keep the packages and the commands when you change the release, set `VFOX_GOLANG_GOPATH` **before vfox is activated**, in the profile of your shell above the line that activates it:

```bash
export VFOX_GOLANG_GOPATH="$HOME/go"
```

On PowerShell, set `$env:VFOX_GOLANG_GOPATH = "$HOME\go"` before activation. The variable replaces `GOPATH` and the `packages/bin` entry of the `PATH`:

| `VFOX_GOLANG_GOPATH` | `GOPATH` | Added to the `PATH`, after `bin` of the release |
| --- | --- | --- |
| not set, or empty | `~/.vfox/sdks/golang/packages` | `~/.vfox/sdks/golang/packages/bin` |
| `/home/me/go` | `/home/me/go` | `/home/me/go/bin` |
| `/home/me/go:/opt/go` | `/home/me/go:/opt/go` | `/home/me/go/bin`, then `/opt/go/bin` |

Several paths are separated by `:`, on Windows by `;`. A `/` or `\` at the end of a path is left out of its `bin` entry. `GOROOT` stays with the release.

Go puts what `go install` builds in the first path. Packages that are in the `GOPATH` of a release are not moved to the new one, and Go creates the directories as it needs them. Unset the variable and the `GOPATH` is back with each release.

## A GOPATH of the environment is not inherited

`vfox use` of another release replaces `GOPATH` in a shell where vfox has already set it for the release before. If the plugin took the `GOPATH` it finds in the environment, the new release would keep the packages directory of the old one. So it does not: the `GOPATH` is either `packages` inside the release or `VFOX_GOLANG_GOPATH`, and nothing else. A `GOPATH` that you export yourself has no effect while the plugin is in use. Use `VFOX_GOLANG_GOPATH` for it.
