# Troubleshooting

[中文](zh-CN/troubleshooting.md) | [English](troubleshooting.md)

## Messages

| You see | What it means |
| --- | --- |
| `install requires specifying a version for golang` | `vfox install golang` without a version. Write one, as `vfox search golang` lists it. |
| `No Go release found for "1.24" on linux/amd64. ...` | Unreleased. The version you wrote is no release in the list. `1.24` and `1` are no releases, and neither is one that go.dev never published. Write the full release, see [Naming](versions.md#naming). Release 0.4.1 and before print `Install golang@ success!` here, and install nothing. |
| `plugin [PreInstall] method error: cannot list the Go releases: Get "https://go.dev/dl/?mode=json": ...` | Unreleased. The plugin could not reach go.dev. The same error from `[Available]` comes from `vfox search`. A mirror does not help here, because the list of releases always comes from go.dev. See [Network](#network). Release 0.4.1 and before begin the message with `paring release info failed.` |
| `cannot list the Go releases: https://go.dev/dl/?mode=json answered with status 503` | Unreleased. go.dev answered, but not with status 200. Try again a little later. Release 0.4.1 and before fail with `cannot perform concat operation between string and nil` instead of naming the status. |
| `failed to download golang@1.24.1 file, err:Get "<address>": ...` | The archive could not be downloaded from `<address>`. With [`VFOX_GOLANG_MIRROR`](mirror.md) the address starts with the mirror; if it reads `...golanggo1.24.1...`, the mirror lacks the `/` at its end. |
| `Checksum error, file: ...` | The file that arrived is not the one go.dev lists the SHA-256 of. A mirror or a proxy served something else, or the download was damaged. Install again, and try without the mirror. |
| `plugin named golang already exists` | `vfox add golang` when it is added already, see [Install from source](install-from-source.md#when-golang-is-already-added). |
| `no available version` | `vfox list golang` when no release is installed. |
| `go: command not found` | vfox is not hooked into the shell, see its [quick start](https://vfox.dev/guides/quick-start.html), or no release is selected: run `vfox use --global golang@<version>`. |

## Network

The plugin asks `https://go.dev/dl/` for the list of releases and their checksums, and downloads the archive from `go.dev`, or from the [mirror](mirror.md). To send vfox's requests, the plugin's among them, through a proxy:

```bash
vfox config proxy.url http://127.0.0.1:7890
vfox config proxy.enable true
```

`vfox config --list` shows the settings, and `vfox config proxy.enable false` turns the proxy off again. A proxy that cannot be reached is named by the messages above (`proxyconnect tcp: dial tcp 127.0.0.1:7890: connect: connection refused`).

## `vfox search` shows an old list

vfox keeps the answer of `vfox search golang` for 12 hours. `vfox install` does not use that list and finds a release the list lacks. To refresh the list, delete `plugin/golang/.available.cache` under `~/.vfox` (or under `VFOX_HOME`).

## Where is Go

| What | Where |
| --- | --- |
| a release | `~/.vfox/cache/golang/v-1.24.0/golang-1.24.0` |
| the release that is selected | `~/.vfox/sdks/golang`, a link to the one above, and `GOROOT` |
| the packages and commands of the release | `packages` and `packages/bin` inside the release, unless [`VFOX_GOLANG_GOPATH`](gopath.md) is set |
| the plugin | `~/.vfox/plugin/golang` |

`VFOX_HOME` moves `plugin` and `cache`, the plugin and the releases. `sdks`, where the link of the selected release is, stays in `~/.vfox`, and so do `config.yaml` and `tmp` (vfox 1.0.13). The directory `VFOX_HOME` names has to exist before `vfox add`. Unreleased: a space in the path does no harm. Release 0.4.1 and before create the `packages/bin` directory in the wrong place for one. On Windows that holds from vfox 1.0.13 on, see [Known gaps](development.md#known-gaps).

To see what vfox does with a hook, and the errors it swallows, run it with `vfox --debug`:

```bash
vfox --debug install golang@1.24.0
```
