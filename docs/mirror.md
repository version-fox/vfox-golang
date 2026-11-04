# Mirror

[中文](zh-CN/mirror.md) | [English](mirror.md)

`vfox install golang@1.24.0` downloads the archive of the release from `go.dev`. If go.dev is slow or out of reach where you are, set `VFOX_GOLANG_MIRROR` and the plugin sends the download to a mirror instead.

The value is a URL prefix. The plugin appends the name of the archive to it as it is, so the value **has to end with a `/`**. For Go 1.24.0 on Linux amd64:

| `VFOX_GOLANG_MIRROR` | vfox downloads |
| --- | --- |
| not set | `https://go.dev/dl/go1.24.0.linux-amd64.tar.gz` |
| `https://golang.google.cn/dl/` | `https://golang.google.cn/dl/go1.24.0.linux-amd64.tar.gz` |
| `https://mirrors.aliyun.com/golang/` | `https://mirrors.aliyun.com/golang/go1.24.0.linux-amd64.tar.gz` |
| `https://mirrors.aliyun.com/golang` | `https://mirrors.aliyun.com/golanggo1.24.0.linux-amd64.tar.gz` (no `/`, so a broken address) |

Any server that has the archives of go.dev under their names at the address will do. The plugin does not run any mirror and cannot vouch for them.

## Set it

In bash or zsh, for the current shell:

```bash
export VFOX_GOLANG_MIRROR=https://golang.google.cn/dl/
```

Put the same line in `~/.bashrc` or `~/.zshrc` to keep it. In PowerShell:

```powershell
$env:VFOX_GOLANG_MIRROR = "https://golang.google.cn/dl/"
```

To set it for every terminal opened afterwards:

```powershell
[Environment]::SetEnvironmentVariable('VFOX_GOLANG_MIRROR', 'https://golang.google.cn/dl/', 'User')
```

Then install as usual, `vfox install golang@1.24.0`. To go back to go.dev, unset the variable.

## What goes through the mirror

Only the download of the archive. The plugin still asks `https://go.dev/dl/` for the list of releases and for their checksums, in `vfox search` and in `vfox install` alike, so go.dev has to be reachable. If it is not, vfox needs a proxy for it, see [Network](troubleshooting.md#network).

## Checksums

vfox checks the archive against the SHA-256 that go.dev lists for it, and not against anything the mirror says. A mirror that serves a damaged file, or another file under the name of the archive, makes the install fail with `Checksum error` and leaves nothing installed. The container tests ([e2e.md](e2e.md)) serve a different file from a mirror on purpose to see this.

A mirror that cannot be reached fails with the address vfox asked for, which shows whether the variable was read:

```
failed to download golang@1.24.1 file, err:Get "https://mirror.example/go1.24.1.linux-amd64.tar.gz": ...
```

See [Troubleshooting](troubleshooting.md#messages).
