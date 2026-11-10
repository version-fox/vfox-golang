# Versions and names

[中文](zh-CN/versions.md) | [English](versions.md)

## Searching

`vfox search golang` lists the releases that go.dev has an archive of for your platform, newest first:

```
Available versions:
 - 1.27.3 (stable)
 - 1.26.10 (stable)
 - 1.27.2
 - 1.27.1
 - 1.27.0
 ...
```

`(stable)` marks the newest release of each of the two lines go.dev supports, which it shows on its download page. The other releases come from go.dev's list of archived versions and carry no note. That list holds release candidates and betas (`1.27rc3`, `1.5beta2`) as well.

vfox keeps the list for 12 hours (`cache.availableHookDuration` in `vfox config --list`), in `plugin/golang/.available.cache` under `~/.vfox`, so a release from the last hours may be missing from it. `vfox install` asks go.dev itself and finds the release anyway. Delete the file to have `vfox search` ask again.

## Naming

A version is the name of the release on go.dev without the `go` in front, written in full:

| You write | You get |
| --- | --- |
| `latest` | the newest release, the first one `vfox search golang` lists |
| `1.24.0` | Go 1.24.0 |
| `1.20` | Go 1.20: the first release of a line before 1.21 has no patch number, and `1.20.0` does not exist |
| `1.21.0` | Go 1.21.0: from 1.21 on, the first release has one |
| `1.27rc3` | a release candidate |
| `1.5beta2` | a beta |

The plugin compares what you write with the names in the list, letter for letter. `1.24` and `1` match none, and neither does a release go.dev has never published (`1.99.99`). `vfox install` then stops with `No Go release found for "1.24" on linux/amd64`, and installs nothing. Release 0.4.1 and before take this for a success: they print `Install golang@ success!` and exit with 0. `vfox install golang` without a version stops with `install requires specifying a version for golang`.

## Installing

```bash
vfox install golang@1.24.0
```

vfox downloads the archive from go.dev, or from the mirror that [`VFOX_GOLANG_MIRROR`](mirror.md) names, and checks it against the SHA-256 that go.dev lists for it. Look for the digest in the output:

```
Verifying checksum dea9ca38a0b852a74e81c26134671af7c0fbe65d81b0dc1c5bfe22cf7d4c8858...
Unpacking ~/.vfox/cache/golang/go1.24.0.linux-amd64.tar.gz...
Install golang@1.24.0 success!
```

A file that does not match fails the install with `Checksum error`, see [Troubleshooting](troubleshooting.md#messages). The release is unpacked to `~/.vfox/cache/golang/v-1.24.0/golang-1.24.0`, and the plugin creates the `packages/bin` directory in it.

## Using

```bash
vfox use --global golang@1.24.0
vfox current golang
```

`vfox use` also takes `--project` and `--session` for a single project or a single shell. See vfox's [core commands](https://vfox.dev/usage/core-commands.html). The release selected is linked as `~/.vfox/sdks/golang`, which is `GOROOT`, see [GOPATH and the environment](gopath.md). `go` is on the `PATH` of a shell that vfox is hooked into, see its [quick start](https://vfox.dev/guides/quick-start.html).

`vfox list golang` shows the installed releases and marks the current one. With none installed, it prints `no available version`.

## Uninstalling

```bash
vfox uninstall golang@1.24.0
```

Write the version as `vfox list golang` shows it.

## An installation that is already there

When another tool already put a Go on the machine, adopting it beats downloading a second copy:

```bash
vfox link --detect golang
```

`Detect` looks for the installations of mise, asdf, goenv, gvm, Homebrew, the official installer, the system package manager and Scoop, and for the Go that `GOROOT` points at, and registers the one you choose. Nothing is downloaded or copied: the release stays where it is, vfox only links to it, and `vfox doctor` keeps watching it. Afterwards select it with `vfox use` as usual. Needs vfox 1.1.0 or later, which is where `vfox link` comes from.

A directory the detection does not find is adopted by hand, with the version written the way `vfox list golang` shows versions:

```bash
vfox link golang@1.23.1 /path/to/goroot
```

The directory has to be the `GOROOT`: the one with `bin/go` in it and a `VERSION` file naming the release.

## Platforms

The plugin lists the releases that go.dev has an archive of for the platform vfox runs on: Linux, macOS and Windows. A release older than the first one for a platform is not listed. On 2026-11-04 `vfox search golang` listed:

| Platform | Releases listed |
| --- | --- |
| Linux amd64 | 368 |
| Linux 386 | 368 |
| Windows amd64 | 368 |
| macOS amd64 | 355 |
| Linux s390x | 327 |
| Linux ppc64le | 326 |
| Linux arm64 | 312 |
| macOS arm64 | 187 |
| Windows arm64 | 168 |
| Linux riscv64 | 103 |
| Linux loong64 | 103 |

The E2E tests ([e2e.md](e2e.md)) run on Linux amd64 and arm64, in containers, and on Windows amd64 and arm64, on the machine itself.
