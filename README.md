# vfox-golang

[中文](README_CN.md) | [English](README.md)

Golang plugin for [vfox](https://vfox.dev/).

It installs the releases of Go that [go.dev/dl](https://go.dev/dl/) lists for your platform, and checks each download against the SHA-256 checksum that go.dev publishes. Every release gets its own `GOROOT`, `GOPATH` and `PATH` entries.

## Install

After installing [vfox](https://github.com/version-fox/vfox), install the plugin and a release of Go, and select the release:

```bash
vfox add golang
vfox install golang@1.24.0
vfox use --global golang@1.24.0
go version
```

`go version` shows the release that is selected. For `go` to be on the `PATH`, vfox has to be hooked into your shell, see its [quick start](https://vfox.dev/guides/quick-start.html).

`vfox search golang` lists the releases that can be installed.

## Versions and names

A version is the release as go.dev names it, written in full, or `latest` for the newest one:

```bash
vfox install golang@latest        # the newest release
vfox install golang@1.24.0
vfox install golang@1.20          # the first release of a line before 1.21 has no patch number
vfox install golang@1.27rc3       # release candidates and betas are listed too
```

`1.24` or `1` is no release. Unreleased: the install stops with `No Go release found for "1.24" on linux/amd64`, where release 0.4.1 prints `Install golang@ success!` and installs nothing. Copy the version from `vfox search golang`. See [docs/versions.md](docs/versions.md) for searching, installing, using and uninstalling, and for the platforms.

## Environment

For the release that is selected the plugin sets:

| Variable | Value |
| --- | --- |
| `GOROOT` | the directory of the release |
| `GOPATH` | `packages` inside that directory, so every release keeps its own packages |
| `PATH` | `bin` of the release, and `bin` of the `GOPATH`, where `go install` puts commands |

See [docs/gopath.md](docs/gopath.md).

## Mirror

If go.dev is slow where you are, `VFOX_GOLANG_MIRROR` makes vfox download the archives from a mirror. The value is a URL prefix and has to end with a `/`:

```bash
export VFOX_GOLANG_MIRROR=https://golang.google.cn/dl/
vfox install golang@1.24.0
```

`https://mirrors.aliyun.com/golang/` works as well. Only the archive comes from the mirror. The list of releases and their checksums still come from go.dev, which vfox has to reach. See [docs/mirror.md](docs/mirror.md).

## Shared or custom GOPATH

By default each release has its own `GOPATH` under its installation directory. Set `VFOX_GOLANG_GOPATH` before activating vfox to share packages and installed commands across releases:

```bash
export VFOX_GOLANG_GOPATH="$HOME/go"
```

On PowerShell, use `$env:VFOX_GOLANG_GOPATH = "$HOME\go"` before activation. Several paths are separated by `:` on Unix or `;` on Windows, and the `bin` directory of each is added to the `PATH`. Packages that are already there are not moved; Go creates directories as it needs them. Unset the variable to return to a `GOPATH` for each release. The plugin deliberately does not inherit `GOPATH` from the environment, which may point to a previously selected vfox Go release. See [docs/gopath.md](docs/gopath.md).

## Releasing this plugin

A maintainer publishes a new version from **Actions → Plugin → Run workflow** on the default branch, entering a stable plugin version, `X.Y.Z`, without the `v` prefix. From a terminal:

```bash
gh workflow run publish.yaml --repo version-fox/vfox-golang --ref main -f version=X.Y.Z
```

The shared workflow, [plugin-manifest-action](https://github.com/version-fox/plugin-manifest-action), sets `PLUGIN.version` in `metadata.lua`, creates the version commit and the tag, and publishes the ZIP and the manifest in this repository. No local tag or extra release token is needed, and pull requests run the checks only. Once the release is out, move the "Unreleased" entries of [docs/changes.md](docs/changes.md) under the new version. See [docs/development.md](docs/development.md#releasing) for publishing by a tag, resuming a failed run, what the package holds and when `vfox add golang` serves the new version.

## Documentation

**Using the plugin**

- [Versions and names](docs/versions.md): how to write a version, and searching, installing, using, uninstalling and the platforms
- [GOPATH and the environment](docs/gopath.md): what the plugin sets, and sharing a `GOPATH` between releases
- [Mirror](docs/mirror.md): downloading through a mirror when go.dev is slow
- [Troubleshooting](docs/troubleshooting.md): the messages vfox and the plugin print, proxies and where Go is
- [Changes](docs/changes.md): what each release changed

**Working on the plugin**

- [Install from source](docs/install-from-source.md): trying `main` before the next release
- [Development](docs/development.md): how the plugin works, how to change it, the known gaps and how to release it
- [E2E tests](docs/e2e.md): the container tests for Linux, the native tests for Windows, the dev container and the local checks
