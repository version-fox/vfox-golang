# 变更记录

[中文](changes.md) | [English](../changes.md)

按发布版本列出用户能感受到的变化。GitHub 的 Release 页面列出了对应的 PR。写这句话时最新的版本是 0.4.2，`main` 比它多出的都在“未发布”下面。照 [install-from-source.md](install-from-source.md) 装，就能现在用上这些变化。

## 未发布

- 别的工具装好的 Go 可以直接认领，不必再下载一份。`vfox link --detect golang` 会查找 mise、asdf、goenv、gvm、Homebrew、官方安装包、系统包管理器和 Scoop 装好的 Go，以及 `GOROOT` 当前指向的 Go，选中后注册给 vfox；整个过程不下载、不复制。以前每个安装都要拿着目录手工链接。需要 vfox 1.1.0 或更高版本，`vfox link` 从那里开始才有。见 [versions.md](versions.md#已经装好的-go)（[#26](https://github.com/version-fox/vfox-golang/pull/26)）。
- 别的的可执行文件挡住插件的 `go` 时，`vfox use` 和 `vfox doctor` 现在会说明怎么办：删掉那个 Go，或者像上面那样认领它。建议覆盖了 mise 和 asdf 的 shim、Homebrew、系统和官方安装、goenv、gvm、snap、Scoop 和 Chocolatey。以前只报告挡住了，没有针对这些安装的建议。见 [troubleshooting.md](troubleshooting.md#别的-go-排在前面)（[#26](https://github.com/version-fox/vfox-golang/pull/26)）。

## 0.4.2（2026-11-04）

- 不是版本的写法会让安装停下来。`vfox install golang@1.24`、`golang@1`，以及 go.dev 从未发布过的版本（例如 `golang@1.99.99`），都会以 ``No Go release found for "1.24" on linux/amd64. `vfox search golang` lists the releases.`` 失败，什么也不装。0.4.1 会打印 `Install golang@ success!` 并以 0 退出，尽管什么也没装。`1.24` 和 `1` 都不是版本：1.24 系列的第一个版本叫 `1.24.0`，`vfox search golang` 列出的是每个名字该怎么写。见 [versions.md](versions.md#命名)（[#23](https://github.com/version-fox/vfox-golang/pull/23)）。
- 版本目录的路径里有空格，例如家目录是 `/home/John Doe`，或者 `VFOX_HOME` 里有空格，不会再让 `PostInstall` 出错。0.4.1 把不带引号的路径交给 `mkdir`，于是每个词建出一个目录，建在错误的位置，版本里的 `packages/bin` 却没有建出来。`go install` 第一次安装命令时会自己创建这个目录，所以别的都没有坏。现在路径加了引号。在 Windows 上，这些引号需要 vfox 1.0.13 或更高版本，它把命令原样交给 `cmd`（[vfox#712](https://github.com/version-fox/vfox/pull/712)）。vfox 1.0.12 及之前会把引号弄坏，所以带空格的路径在那里仍然得不到它的 `packages/bin`，没有空格的路径则和以前一样可用。见 [development.md](development.md#已知缺陷)（[#23](https://github.com/version-fox/vfox-golang/pull/23)）。
- go.dev 连不上，或者回应的状态不是 200 时，错误会指明出了什么问题。请求失败时是 `cannot list the Go releases: Get "https://go.dev/dl/?mode=json": ...`，状态不对时是 `cannot list the Go releases: https://go.dev/dl/?mode=json answered with status 503`。0.4.1 的第一种以 `paring release info failed.` 开头，第二种则以 `cannot perform concat operation between string and nil` 失败，状态被藏了起来。见 [troubleshooting.md](troubleshooting.md#提示)（[#23](https://github.com/version-fox/vfox-golang/pull/23)）。
- 向 go.dev 发出的请求失败，或者得到服务器错误（状态为 500 及以上）时，会再发一次，一共最多三次，不再在第一次失败时就让命令停下来。go.dev 第一次回应很慢的地方，例如经过一个第一次连接 go.dev 很慢的代理，`vfox install golang@1.27.3` 会以 `cannot list the Go releases: Get "https://go.dev/dl/?mode=json": net/http: TLS handshake timeout` 失败，同一条命令再运行一次就通过了。vfox 给 TLS 握手 10 秒，它的 http 模块也从不重试，所以现在第二次运行由插件自己来做。三次都失败时，错误是最后一次的失败，后面跟着 `(after 3 attempts)`；如果每一次都等满握手的时间，这要花大约 30 秒。其他状态，例如 404，不会再试。0.4.1 对每个请求只发一次。见 [troubleshooting.md](troubleshooting.md#请求很慢或者失败)（[#24](https://github.com/version-fox/vfox-golang/pull/24)）。
- 仓库有了 E2E 测试，用真正的 vfox 安装真正的 Go 版本：Linux（amd64 和 arm64）上在容器里运行，Windows（amd64 和 arm64）上直接在 runner 上运行。还有 lint、许可证头检查、开发容器、对着保存下来的 go.dev 应答离线测试的每个 hook，以及中英文文档。见 [e2e.md](e2e.md) 和 [development.md](development.md)（[#23](https://github.com/version-fox/vfox-golang/pull/23)）。

## 0.4.1（2026-09-12）

- `VFOX_GOLANG_GOPATH` 用你指定的一个或几个目录替换版本自带的 GOPATH，并把每个目录的 `bin` 放进 `PATH`，取代 `packages/bin`：`export VFOX_GOLANG_GOPATH="$HOME/go"` 让所有版本共用同一批包和命令。插件仍然不读取环境里的 `GOPATH`，它可能是 vfox 为之前选中的版本导出的。见 [gopath.md](gopath.md)（[#22](https://github.com/version-fox/vfox-golang/pull/22)）。
- README 在阿里云之外，又把 `https://golang.google.cn/dl/` 列为镜像。

## 0.4.0（2025-07-21）

- `VFOX_GOLANG_MIRROR` 让压缩包的下载经过镜像，例如 `VFOX_GOLANG_MIRROR=https://mirrors.aliyun.com/golang/ vfox install golang`。版本列表和校验和仍然来自 go.dev。见 [mirror.md](mirror.md)（[#15](https://github.com/version-fox/vfox-golang/pull/15)）。

## 0.3.0（2024-07-01）

- 每个版本有自己的 GOPATH，也就是版本里的 `packages` 目录，`packages/bin` 在 `PATH` 里，所以 `go install` 放在那里的命令可以直接按名字运行。插件在安装版本时创建 `packages/bin`。见 [gopath.md](gopath.md)（[#12](https://github.com/version-fox/vfox-golang/pull/12)）。

## 0.2.0（2024-05-15）

- `GOROOT` 设置为正在使用的版本。

## 0.1.x（2024-04）

- 0.1.0 是第一个发布版：`vfox search golang` 列出 go.dev 的版本，`vfox install` 安装适合当前平台的压缩包，并按 go.dev 给出的 SHA-256 校验，版本的 `bin` 目录进入 `PATH`。
- 0.1.1 只改了 README 和版本号。
