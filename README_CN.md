# vfox-golang

[中文](README_CN.md) | [English](README.md)

[vfox](https://vfox.dev/) 的 Golang 插件。

它安装 [go.dev/dl](https://go.dev/dl/) 为你的平台列出的 Go 版本，并按 go.dev 公布的 SHA-256 校验和检查每一次下载。每个版本都有各自的 `GOROOT`、`GOPATH` 和 `PATH` 条目。

## 安装

先安装 [vfox](https://github.com/version-fox/vfox)，然后安装插件和一个 Go 版本，并选中这个版本：

```bash
vfox add golang
vfox install golang@1.24.0
vfox use --global golang@1.24.0
go version
```

`go version` 会显示当前选中的版本。要让 `go` 出现在 `PATH` 里，需要先把 vfox 挂载到 Shell，见 vfox 的[快速入门](https://vfox.dev/zh-hans/guides/quick-start.html)。

`vfox search golang` 会列出可以安装的版本。

## 版本与命名

版本写成 go.dev 上的版本名，要写完整，或者写 `latest` 表示最新版：

```bash
vfox install golang@latest        # 最新版
vfox install golang@1.24.0
vfox install golang@1.20          # 1.21 之前，每个系列的第一个版本没有补丁号
vfox install golang@1.27rc3       # 候选版本和 beta 版本也在列表里
```

`1.24` 或 `1` 不是一个版本。安装会以 `No Go release found for "1.24" on linux/amd64` 停下，0.4.1 及之前的版本则打印 `Install golang@ success!`，什么也不装。请从 `vfox search golang` 里复制版本号。搜索、安装、使用、卸载以及平台的细节见 [docs/zh-CN/versions.md](docs/zh-CN/versions.md)。

## 环境变量

对选中的版本，插件会设置：

| 变量 | 值 |
| --- | --- |
| `GOROOT` | 这个版本的目录 |
| `GOPATH` | 该目录里的 `packages`，所以每个版本有各自的包 |
| `PATH` | 这个版本的 `bin`，以及 `GOPATH` 的 `bin`，`go install` 会把命令装到后者 |

详见 [docs/zh-CN/gopath.md](docs/zh-CN/gopath.md)。

## 镜像

如果你那里访问 go.dev 很慢，可以用 `VFOX_GOLANG_MIRROR` 让 vfox 从镜像下载压缩包。值是一个 URL 前缀，必须以 `/` 结尾：

```bash
export VFOX_GOLANG_MIRROR=https://golang.google.cn/dl/
vfox install golang@1.24.0
```

`https://mirrors.aliyun.com/golang/` 也可以用。只有压缩包来自镜像，版本列表和校验和仍然来自 go.dev，vfox 必须能连上它。详见 [docs/zh-CN/mirror.md](docs/zh-CN/mirror.md)。

## 共享或自定义 GOPATH

默认情况下，每个版本在自己的安装目录下有各自的 `GOPATH`。在激活 vfox 之前设置 `VFOX_GOLANG_GOPATH`，就可以让各个版本共享包和已安装的命令：

```bash
export VFOX_GOLANG_GOPATH="$HOME/go"
```

在 PowerShell 里，激活之前执行 `$env:VFOX_GOLANG_GOPATH = "$HOME\go"`。多个路径在 Unix 上用 `:` 分隔，在 Windows 上用 `;` 分隔，每个路径的 `bin` 目录都会加进 `PATH`。已有的包不会被移动，Go 会按需创建目录。取消设置这个变量，就回到每个版本一个 `GOPATH`。插件有意不继承环境里的 `GOPATH`，因为它可能指向之前选中的某个 vfox Go 版本。详见 [docs/zh-CN/gopath.md](docs/zh-CN/gopath.md)。

## 已经装好的 Go

如果别的工具已经在这台机器上装了 Go，`vfox link --detect golang` 可以直接认领它，而不必再下载一份。`vfox use` 之后 `go` 不是 vfox 的时，`vfox doctor` 会指出是哪个可执行文件挡在前面，以及怎么办。见 [docs/zh-CN/versions.md](docs/zh-CN/versions.md#已经装好的-go) 和 [docs/zh-CN/troubleshooting.md](docs/zh-CN/troubleshooting.md#别的-go-排在前面)。

## 发布这个插件

维护者在默认分支上从 **Actions → Plugin → Run workflow** 发布新版本，输入不带 `v` 前缀的稳定插件版本 `X.Y.Z`。也可以在终端里发起：

```bash
gh workflow run publish.yaml --repo version-fox/vfox-golang --ref main -f version=X.Y.Z
```

共享工作流 [plugin-manifest-action](https://github.com/version-fox/plugin-manifest-action) 会更新 `metadata.lua` 里的 `PLUGIN.version`，创建版本提交和 tag，并在本仓库发布 ZIP 和 manifest。不需要本地 tag，也不需要额外的发布令牌；Pull request 只运行检查。版本发布之后，把 [docs/zh-CN/changes.md](docs/zh-CN/changes.md) 里“未发布”下面的条目移到新版本下面。用 tag 发布、失败后续上、包里有什么，以及 `vfox add golang` 什么时候能装到新版本，见 [docs/zh-CN/development.md](docs/zh-CN/development.md#发布)。

## 文档

**使用插件**

- [版本与命名](docs/zh-CN/versions.md)：怎样写版本，以及搜索、安装、使用、卸载和平台
- [GOPATH 与环境变量](docs/zh-CN/gopath.md)：插件设置了什么，以及在各个版本之间共享 `GOPATH`
- [镜像](docs/zh-CN/mirror.md)：go.dev 很慢时让下载经过镜像
- [问题排查](docs/zh-CN/troubleshooting.md)：vfox 和插件的各种提示、代理设置和 Go 的位置
- [变更记录](docs/zh-CN/changes.md)：每个版本改了什么

**参与开发**

- [从源码安装](docs/zh-CN/install-from-source.md)：在下一个版本发布之前用上 `main`
- [开发](docs/zh-CN/development.md)：插件的工作方式、修改方法、已知缺陷和发布流程
- [E2E 测试](docs/zh-CN/e2e.md)：Linux 的容器测试、Windows 的原生测试、开发容器和本地检查
