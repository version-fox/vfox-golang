# 问题排查

[中文](troubleshooting.md) | [English](../troubleshooting.md)

## 提示

| 你看到的 | 含义 |
| --- | --- |
| `install requires specifying a version for golang` | 执行了不带版本的 `vfox install golang`。照 `vfox search golang` 列出的写法写一个版本。 |
| `No Go release found for "1.24" on linux/amd64. ...` | 你写的版本不是列表里的任何一个版本。`1.24` 和 `1` 都不是版本，go.dev 从未发布过的版本也不是。请写完整的版本，见[命名](versions.md#命名)。0.4.1 及之前的插件在这里会打印 `Install golang@ success!`，却什么也没装。 |
| `plugin [PreInstall] method error: cannot list the Go releases: Get "https://go.dev/dl/?mode=json": ...` | 插件连不上 go.dev。`[Available]` 的同样报错来自 `vfox search`。镜像在这里帮不上忙，因为版本列表始终来自 go.dev。见[网络](#网络)。0.4.1 及之前的插件，提示以 `paring release info failed.` 开头。 |
| `cannot list the Go releases: https://go.dev/dl/?mode=json answered with status 503` | go.dev 有回应，但状态不是 200。过一会儿再试。0.4.1 及之前的插件没有写出状态，而是以 `cannot perform concat operation between string and nil` 失败。 |
| `failed to download golang@1.24.1 file, err:Get "<地址>": ...` | 无法从 `<地址>` 下载压缩包。用了 [`VFOX_GOLANG_MIRROR`](mirror.md) 时，地址以镜像开头；如果写成 `...golanggo1.24.1...`，说明镜像末尾少了 `/`。 |
| `Checksum error, file: ...` | 收到的文件不是 go.dev 给出 SHA-256 的那个文件。镜像或代理给了别的东西，或者下载损坏了。重新安装，并试试不用镜像。 |
| `plugin named golang already exists` | 插件已经添加过，又执行了 `vfox add golang`，见[从源码安装](install-from-source.md#已经添加过-golang-时)。 |
| `no available version` | 没有安装任何版本时执行 `vfox list golang`。 |
| `go: command not found` | vfox 没有挂载到 Shell，见它的[快速入门](https://vfox.dev/zh-hans/guides/quick-start.html)；或者没有选中任何版本，执行 `vfox use --global golang@<版本>`。 |

## 网络

插件向 `https://go.dev/dl/` 要版本列表和校验和，并从 `go.dev` 或者[镜像](mirror.md)下载压缩包。要让 vfox 的请求（包括插件的）经过代理：

```bash
vfox config proxy.url http://127.0.0.1:7890
vfox config proxy.enable true
```

`vfox config --list` 会显示这些设置，`vfox config proxy.enable false` 再把代理关掉。连不上的代理，上面那些提示里会写出它的名字（`proxyconnect tcp: dial tcp 127.0.0.1:7890: connect: connection refused`）。

## `vfox search` 显示的是旧列表

vfox 会把 `vfox search golang` 的结果缓存 12 小时。`vfox install` 不用这份列表，列表里没有的版本它也找得到。要刷新列表，删除 `~/.vfox`（或者 `VFOX_HOME`）下的 `plugin/golang/.available.cache`。

## Go 在哪里

| 什么 | 在哪里 |
| --- | --- |
| 一个版本 | `~/.vfox/cache/golang/v-1.24.0/golang-1.24.0` |
| 选中的版本 | `~/.vfox/sdks/golang`，是指向上面那个目录的链接，也是 `GOROOT` |
| 版本的包和命令 | 版本里的 `packages` 和 `packages/bin`，除非设置了 [`VFOX_GOLANG_GOPATH`](gopath.md) |
| 插件 | `~/.vfox/plugin/golang` |

`VFOX_HOME` 会移动 `plugin` 和 `cache`，也就是插件和各个版本。`sdks`（选中版本的链接所在）仍然在 `~/.vfox`，`config.yaml` 和 `tmp` 也是（vfox 1.0.13）。`VFOX_HOME` 指向的目录要在 `vfox add` 之前就存在。路径里有空格没有关系；0.4.1 及之前的插件遇到空格，会把 `packages/bin` 目录创建在错误的位置。在 Windows 上，这要 vfox 1.0.13 及以后才成立，见[已知缺陷](development.md#已知缺陷)。

想看 vfox 对 hook 做了什么，以及它吞掉的错误，用 `vfox --debug` 运行：

```bash
vfox --debug install golang@1.24.0
```
