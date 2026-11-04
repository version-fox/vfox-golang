# 版本与命名

[中文](versions.md) | [English](../versions.md)

## 搜索

`vfox search golang` 会列出 go.dev 为你的平台提供压缩包的所有版本，最新的在前：

```
Available versions:
 - 1.27.3 (stable)
 - 1.26.10 (stable)
 - 1.27.2
 - 1.27.1
 - 1.27.0
 ...
```

`(stable)` 标记 go.dev 在下载页上展示的两个受支持系列各自的最新版本。其余版本来自 go.dev 的历史版本列表，没有标注。这个列表里也有候选版本和 beta 版本（`1.27rc3`、`1.5beta2`）。

vfox 会把这个列表缓存 12 小时（`vfox config --list` 里的 `cache.availableHookDuration`），文件是 `~/.vfox` 下的 `plugin/golang/.available.cache`，所以最近几个小时发布的版本可能还不在里面。`vfox install` 自己去问 go.dev，所以照样能找到。删除这个文件，`vfox search` 就会重新去问。

## 命名

版本就是 go.dev 上的版本名去掉前面的 `go`，要写完整：

| 你写 | 你得到 |
| --- | --- |
| `latest` | 最新版，也就是 `vfox search golang` 列出的第一个 |
| `1.24.0` | Go 1.24.0 |
| `1.20` | Go 1.20：1.21 之前，每个系列的第一个版本没有补丁号，不存在 `1.20.0` |
| `1.21.0` | Go 1.21.0：从 1.21 起，第一个版本也有补丁号 |
| `1.27rc3` | 一个候选版本 |
| `1.5beta2` | 一个 beta 版本 |

插件把你写的和列表里的名字逐个字符比较。`1.24` 和 `1` 一个也匹配不上，go.dev 从未发布过的版本（`1.99.99`）也一样。这时 `vfox install` 会以 `No Go release found for "1.24" on linux/amd64` 停下，什么也不装。0.4.1 及之前的插件把这当成了成功：它们打印 `Install golang@ success!` 并以 0 退出。不写版本的 `vfox install golang` 会以 `install requires specifying a version for golang` 退出。

## 安装

```bash
vfox install golang@1.24.0
```

vfox 从 go.dev 下载压缩包，或者从 [`VFOX_GOLANG_MIRROR`](mirror.md) 指定的镜像下载，并按 go.dev 列出的 SHA-256 校验。输出里能看到摘要：

```
Verifying checksum dea9ca38a0b852a74e81c26134671af7c0fbe65d81b0dc1c5bfe22cf7d4c8858...
Unpacking ~/.vfox/cache/golang/go1.24.0.linux-amd64.tar.gz...
Install golang@1.24.0 success!
```

文件对不上时，安装会以 `Checksum error` 失败，见[问题排查](troubleshooting.md#提示)。这个版本会解压到 `~/.vfox/cache/golang/v-1.24.0/golang-1.24.0`，插件会在里面创建 `packages/bin` 目录。

## 使用

```bash
vfox use --global golang@1.24.0
vfox current golang
```

`vfox use` 还可以带 `--project` 和 `--session`，分别只对一个项目或一个 Shell 生效，见 vfox 的[核心命令](https://vfox.dev/zh-hans/usage/core-commands.html)。选中的版本会链接为 `~/.vfox/sdks/golang`，它就是 `GOROOT`，见 [GOPATH 与环境变量](gopath.md)。`go` 会出现在已经挂载了 vfox 的 Shell 的 `PATH` 里，见 vfox 的[快速入门](https://vfox.dev/zh-hans/guides/quick-start.html)。

`vfox list golang` 会列出已安装的版本，并标出当前的这个。一个也没装时，它会打印 `no available version`。

## 卸载

```bash
vfox uninstall golang@1.24.0
```

版本按 `vfox list golang` 显示的写法来写。

## 平台

插件列出的是 go.dev 为 vfox 所在平台提供压缩包的版本：Linux、macOS 和 Windows。早于某个平台的第一个版本的，不会列出。2026-11-04 那天，`vfox search golang` 列出的数量：

| 平台 | 列出的版本数 |
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

E2E 测试（[e2e.md](e2e.md)）在 Linux amd64 和 arm64 上用容器运行，在 Windows amd64 和 arm64 上直接在机器上运行。
