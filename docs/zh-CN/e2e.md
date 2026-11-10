# E2E

[中文](e2e.md) | [English](../e2e.md)

离线的 hook 测试（`tests/*_test.lua`，由 `vfox plugin test` 运行）在 **Test Plugin** 工作流里运行。端到端套件针对真正的 vfox 运行，由插件在其中安装一个真正的 Go 版本。一共有两个：

| 套件 | 运行在 | 方式 |
| --- | --- | --- |
| 容器套件，`test/e2e.test.ts` | Linux | 在容器里，每个 vfox 版本一个，由 testcontainers 启动 |
| 原生套件，`test/e2e.native.test.ts` | Windows（Linux 和 macOS 上也能跑，用来试验它） | 直接在机器上，通过 PowerShell 7，为一个虚构出来的用户运行 |

CI 在官方的 Linux runner 上运行容器套件（Docker 加上 `actions/setup-node` 装的 Node.js），在 Windows runner 上运行原生套件。在本地，仓库的开发容器运行容器套件。

两个套件都是用 Node.js 写的，容器套件用的是 [testcontainers for Node.js](https://node.testcontainers.org/)，而不是 Go。这个插件是用来安装 Go 的，驱动测试的机器上（开发容器里，或者 runner 上）如果有一个 Go 工具链，就多了一个需要和测试所装的那些区分开的 Go：`PATH` 里的 `go`、漏进测试的 `GOROOT` 或 `GOPATH`，还有仓库里的 `go.mod`，而这个仓库的插件正是要写 `GOPATH` 的。测试用的容器里同样没有 Go，原生套件则把机器上的 Go 挡在门外（见[下文](#运行原生套件)）。`go` 只能来自 vfox 安装的东西。

下面各节说怎样运行套件和检查。所有检查项的清单在最后，见[套件验证什么](#套件验证什么)。

## 开发容器

`.devcontainer/` 打开一个 Linux 开发环境，下面这些主机上都能用：

| 主机 | 开发容器的运行方式 |
| --- | --- |
| Linux amd64 / arm64 | 原生 |
| macOS、Windows | Docker Desktop 的 Linux 容器模式 |

里面有 `tests/e2e/.node-version` 指定的 Node.js（26.13.0）、Docker CLI、StyLua、lua-language-server、`license-eye`、PowerShell 7 和用来运行离线 hook 测试的 vfox，工作流里固定了版本的工具，版本都与之一致，并且挂载了主机的 Docker socket。容器套件随后针对那个守护进程运行 testcontainers（Docker-out-of-Docker），启动的目标容器和原生 CI runner 启动的一样；这有意不是 Docker-in-Docker，所以镜像缓存和网络仍然是主机的。里面没有 Go。`postCreateCommand` 会在 `tests/e2e` 里执行 `npm ci`，所以第一次运行测试时不必停下来安装。

用任何支持 Dev Containers 规范的工具打开它：在 VS Code 或 Cursor 里选 **Dev Containers: Reopen in Container**，或者用命令行：

```bash
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . bash
```

`TESTCONTAINERS_RYUK_DISABLED=true` 是预设好的：Ryuk 会在主机守护进程上发布一个端口，并等待套件回连，Docker-out-of-Docker 的容器做不到这一点。套件改为自己删除它的容器和镜像；被杀掉的运行留下的东西，容器名带前缀 `vfox-golang-e2e-`，镜像的仓库名是 `vfox-golang-e2e`，可以清理掉。使用 rootless Docker 的用户，在打开容器之前先在主机上导出 `DOCKER_SOCK="$XDG_RUNTIME_DIR/docker.sock"`。容器以 `root` 运行，所以在使用 rootful Docker 的 Linux 主机上，`npm ci` 在检出目录里创建的 `node_modules` 属于 root。

开发容器无法承载 Windows 容器，容器套件里也没有：它在 Linux 上运行。Windows 由原生套件负责。

## 环境变量

| 变量 | 默认值 | 含义 |
| --- | --- | --- |
| `E2E_VFOX_VERSION` | `latest main`；原生套件是 `latest` | 以空格分隔的 vfox 版本：`latest`、`main`，或者一个发布版本，比如 `1.0.13` |
| `E2E_GO_VERSION` | `1.24.0` | 插件为每个用户安装的 Go 版本 |
| `E2E_BASE_IMAGE` | `ubuntu:26.04` | 测试容器所基于的镜像，需要有 apt（容器套件） |
| `E2E_PWSH` | `PATH` 上的 `pwsh` | 原生套件用来驱动 vfox 的 PowerShell，7.4 或更高版本 |
| `E2E_MAX_JOBS` | `3` | 同时运行的容器数，或者用户数 |
| `E2E_RETRY_ATTEMPTS` | `3` | 每个访问网络的命令的尝试次数（间隔线性递增，10 秒起） |

`latest` 是 vfox 最新的发布版，`main` 是它的主分支，在单独的 `golang` 容器里从源码构建，再把二进制文件复制进测试容器。原生套件不接受 `main`：构建 vfox 需要 Go，而它所在的机器必须没有 Go。发布版本必须有 `vfox add --source`，用它来注册这份检出：1.0.13 有，0.4.0 没有。`E2E_GO_VERSION` 要写 `vfox search golang` 列出的版本；1.21 之前，每个系列的第一个版本没有补丁号（`1.20`）。有哪个值不被接受，运行会停下来，并给出带着变量名的提示。

## 运行容器套件

在开发容器里，从仓库根目录执行：

```bash
cd tests/e2e
npm test
```

迭代时可以用同样的办法缩小范围：

```bash
E2E_VFOX_VERSION=latest E2E_MAX_JOBS=1 npm test
```

在原生主机上，同样的命令也能用，前提是两样东西：Docker Engine（rootful 或 rootless 都行）和 Node.js 24 或更高版本（CI 装的是 `.node-version` 里的那个），并先执行 `npm ci`。testcontainers 会自己找到 rootless Docker 的 socket（`$XDG_RUNTIME_DIR/docker.sock`）；别的守护进程要设置 `DOCKER_HOST`。

套件会先构建一次 `tests/e2e/image/Dockerfile`，再为每个 vfox 版本启动一个容器，为镜像测试启动一对容器，并让它们并行运行，同时最多 `E2E_MAX_JOBS` 个。同一个容器的各步骤按顺序运行，其中一步失败后，该容器的其余步骤会被跳过，而不是因为同一个原因接连失败。

镜像构建失败时，Docker 的构建 API 只会在它的日志里报告。`DEBUG=testcontainers:build npm test` 会打印这份日志，`DEBUG=testcontainers*` 则打印 testcontainers 做的所有事。

## 运行原生套件

在 Windows 机器上，在 PowerShell 里，从仓库根目录执行：

```powershell
cd tests/e2e
npm ci
npm run test:native
```

它只需要 Node.js 24 或更高版本和 PowerShell 7.4 或更高版本（`pwsh`），在 Linux 和 macOS 上还要有 `zip`（Windows 自带 install-from-source.md 里用的 `tar.exe`），不需要别的：不要 Docker，不要 Go，也不要 Windows 容器，在 Windows runner 上用它们只是替身，而真正的 Windows 就在那里。套件会在 `RUNNER_TEMP` 或临时目录下自己的一个目录里虚构出一个用户：家目录的名字里有空格（`C:\Users\John Doe`），vfox 放在 `~/.vfox`，并把 vfox 的发布版下载进去。结束后全部删除；Windows 不肯放开的目录（有进程或者杀毒软件还开着其中的文件）会连同路径一起报告出来，不会让一次所有步骤都通过的运行失败。真正的 `~/.vfox`、`PATH`、注册表和机器上的 Go，既不会被碰，也不会被用到。

最后这一点，正是脚本的环境要做到的（`tests/e2e/src/native.ts` 里的 `isolatedEnv`）。GitHub runner 的镜像自带 Go，还有与之配套的 `GOROOT_*` 变量和 `PATH`；开发者则有 vfox 为他们装的 Go，以及挂载到 Shell 里的 vfox。脚本拿到的是测试的环境，去掉了所有以 `GO` 或 `VFOX_` 开头的变量，去掉了 `__VFOX_*`（它告诉 vfox 自己已经挂载），去掉了 `GOPATH`，并有自己的家目录、临时目录和 `PATH`：vfox、PowerShell，以及系统的目录。第一步会检查这个 `PATH` 上没有 `go`。

注册表是虚构的家目录挡不住的那一部分。套件用 `vfox use --project`，在脚本运行的目录里选择版本，从不使用 `vfox use --global`：在 Windows 上，后者还会把 `Path`、`GOROOT` 和 `GOPATH` 写进运行它的那个用户的注册表（`HKCU\Environment`）。在开发者的机器上，它们会留下来，指向一个已经不存在的目录，还会盖掉开发者自己可能设置的 `GOROOT` 和 `GOPATH`。`NativeTarget` 会在运行之前拦下使用 vfox 全局作用域的脚本（`tests/e2e/src/native.ts` 里的 `assertNoGlobalScope`）。

原生套件在 Linux 和 macOS 上配合 `pwsh` 也能运行（`pwsh` 不在 `PATH` 上时，用 `E2E_PWSH` 指定；开发容器里有一个）。在没有 Windows 的地方就这样试验它，但只有 Windows 才有的东西，这样试不到：Go 的 zip 包、`go.exe`、`PATH` 各项之间的 `;`、vfox 为所选版本创建的目录联接（junction），以及 `PostInstall` 在那里运行的 `cmd` 的 `mkdir`。

## 本地检查

在开发容器里执行，下面的一切都已预装，版本和工作流用的一致；也可以在主机上准备同样的工具。

```bash
# Lua (.github/workflows/lint.yml)。
stylua --check .
lua-language-server --check . --checklevel=Warning

# 离线的 hook 测试 (.github/workflows/hooks-test.yml)。
vfox plugin test .

# 许可证头 (.github/workflows/license.yml)。`fix` 会把头写进新文件。
license-eye header check
license-eye header fix

# E2E 套件用的 Node.js (.github/workflows/lint.yml)。
cd tests/e2e
npm run typecheck
npm run lint
npm run test:unit
```

`stylua .` 会格式化 Lua，`npm run format` 会格式化 TypeScript。除了套件的辅助函数，`npm run test:unit` 还会检查工作流和开发容器里固定的版本是否一致。手边有 `pwsh` 时，它还会用真正的 PowerShell 检查原生套件的引号处理，没有就跳过。Lint 工作流也检查工作流文件本身，你只要有 Docker 也可以，许可证头也一样：

```bash
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12
docker run --rm -v "$PWD:/work" -w /work apache/skywalking-eyes:0.9.0 header check
```

开发容器里直接有 `license-eye`：Docker-out-of-Docker 无法把工作区挂载进主机守护进程的容器里。

## 套件验证什么

每个 vfox 版本都运行同样的流程：容器套件在一个长期存活的容器里，由 Node.js 通过 exec 调用来驱动；原生套件为一个用户，通过 PowerShell 来驱动。镜像里没有 Go，用户的 `PATH` 上也没有，所以 `go` 只能来自 vfox 安装的东西。容器套件把 `VFOX_HOME` 设在带空格的路径里（`/root/John Doe/.vfox`），家目录就可能有空格，并先建好这个目录：`VFOX_HOME` 不是 `~/.vfox` 时，vfox 1.0.13 不会建出添加插件的目录。原生套件则把家目录放在这样的路径里。

1. 安装 vfox，用最新的发布版，或者从 `main` 构建，再照 [install-from-source.md](install-from-source.md) 说的把这份检出注册为 `golang` 插件。`vfox info golang` 必须显示名称、主页，以及 `metadata.lua` 里的版本。
2. `vfox search golang` 把最新的版本列为 `stable`，并在其余版本里列出 `1.24.0`。前者来自 `https://go.dev/dl/?mode=json`，后者来自历史版本页面，所以插件找版本的两条路都会走一遍。
3. 通过一个不存在的镜像安装会失败，错误里要写出它请求的地址：镜像加上该平台的压缩包名（`go1.24.0.linux-amd64.tar.gz`，arm64 上是 `linux-arm64`，Windows 上是 `windows-amd64.zip`）。这证明变量被读到了，也证明插件请求的是这台机器的平台。
4. `vfox install golang@1.24.0` 成功，并打印 `Verifying checksum` 和一个 SHA-256 摘要。vfox 会把摘要与它下载的文件的哈希比较，不一致就让安装失败，所以安装成功就证明摘要是这个文件的。没有校验和时，vfox 会打印 `Checksum is not provided`。
5. `PostInstall` 已经在版本目录里创建了 `packages/bin`，在带空格的路径里。
6. `vfox use --global`（容器套件）或 `vfox use --project`（原生套件，见[上文](#运行原生套件)）之后，`vfox current golang` 写出这个版本，激活了 vfox 的 Shell 在 vfox 为它创建的链接的 `bin` 里找到 `go`：`~/.vfox/sdks/golang`，或者项目里的 `.vfox/sdks/golang`。`go version` 报告 `go1.24.0` 和这台机器的平台（`linux/amd64`、`linux/arm64`、`windows/amd64`，所以压缩包对它来说是对的）。`GOROOT` 就是那个链接，它指向安装好的那个版本，`GOPATH` 是其中的 `packages`，`PATH` 里先是版本的 `bin`，后面是 `packages/bin`。（`VFOX_HOME` 不会移动 `sdks`：vfox 把它放在 `~/.vfox`。）
7. 一个程序用 `go run` 编译并运行，`go install` 把它装进 `packages/bin`，Shell 从那里按名字运行它。
8. `VFOX_GOLANG_GOPATH` 会替换 `GOPATH` 和 `PATH` 里 `packages/bin` 那一项（`go install` 随后把程序装进新的 `bin`），也接受多个路径；环境里的 `GOPATH`，比如之前选中的版本留下的，不会被继承。
9. 不存在的版本（`1.99.99`，还有 `1.24` 和 `1`，它们都不是版本）安装失败，提示 `No Go release found for "1.24" on linux/amd64`，也不留下任何目录。0.4.1 及之前的插件会报告成功。
10. `PostInstall` 在带空格和引号的路径（`/work/it's John Doe/sdk`）里创建 `packages/bin`，通过 `vfox plugin run` 在它自己的目录里运行，那个目录必须保持为空。0.4.1 及之前的插件没有给路径加引号，`mkdir` 把每个词当成一个目录。在 Windows 上这需要 vfox 1.0.13，原生套件运行的正是它（见[已知缺陷](development.md#已知缺陷)）。
11. 一个 Go 镜像的替身提供 `golang@latest`：安装成功并校验了下载，日志里有对 `vfox search golang` 所列最新版本压缩包的请求，而且那个版本能运行。同一个替身还在压缩包的名字下给出别的东西，安装会以 `Checksum error` 失败。容器套件里，它是测试网络上的一个 nginx，代理 `dl.google.com/go`；原生套件里，它是测试进程里的一个小 HTTP 服务器，监听 `127.0.0.1`，做同样的事。

原生套件还多一步，在第一步之前：激活 vfox 之前，`PATH` 上没有 `go`。

容器套件默认的矩阵在本机的平台上运行 vfox 的两个版本，镜像套件则用第一个版本运行一次。原生套件运行 vfox 的发布版：

| 套件 | vfox | 覆盖 |
| --- | --- | --- |
| `vfox latest` | 最新的发布版 | 大家实际安装的 vfox 上的第 1 到 10 步 |
| `vfox main` | 主分支 | 同样的步骤，针对 vfox 的下一个版本会是什么样（仅容器套件） |
| `mirror` | 上面第一个 | 第 11 步 |

CI 在 Ubuntu amd64（`ubuntu-latest`）和 arm64（`ubuntu-24.04-arm`）上运行容器套件，在 Windows amd64（`windows-latest`）和 arm64（`windows-11-arm`）上运行原生套件。macOS 没有被 CI 覆盖。
