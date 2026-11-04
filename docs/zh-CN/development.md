# 开发

[中文](development.md) | [English](../development.md)

## 目录结构

```
metadata.lua                    插件名称、版本和 manifest 的地址
hooks/available.lua             vfox search
hooks/pre_install.lua           vfox install：选出压缩包
hooks/post_install.lua          创建 GOPATH 的 bin 目录
hooks/env_keys.lua              GOROOT、GOPATH 和 PATH
lib/constants.lua               go.dev 的地址
lib/utils.lua                   go.dev 列出的版本
Injection.lua                   vfox 注入内容的类型提示，不会被加载
tests/env_keys_test.lua         EnvKeys：GOROOT、GOPATH 和 PATH，设置与不设置 VFOX_GOLANG_GOPATH
tests/releases_test.lua         Available 和 PreInstall，针对保存下来的 go.dev 的应答
tests/post_install_test.lua     PostInstall 运行的命令，os.execute 被替换掉
tests/fixtures/                 保存下来的 go.dev 的应答，见那里的 README
tests/e2e/                      E2E 测试：Linux 上用容器，Windows 上用机器本身，见 e2e.md
.devcontainer/                  开发容器，见 e2e.md
stylua.toml, .luarc.json        Lua 的格式化和检查
.licenserc.yaml                 许可证头检查，见下面
README.md, docs/                文档；README_CN.md 和 docs/zh-CN/ 是中文版
opencode.jsonc                  让本仓库里的 OpenCode 智能体会话无需确认就能执行 git push、gh pr create 和 gh pr comment
```

vfox 加载 `metadata.lua`，在命令需要时调用 hook，并提供 `PLUGIN` 和 `RUNTIME`（`osType`、`archType`、`version`）。`osType` 和 `archType` 是 vfox 可执行文件的 Go `GOOS` 和 `GOARCH`。

## 一个命令会运行什么

| 你执行 | Hook |
| --- | --- |
| `vfox search golang` | `Available`，除非 vfox 有最近 12 小时内的结果 |
| `vfox install golang@1.24.0` | `PreInstall` 返回地址、校验和和名字。vfox 下载、校验、解压，然后调用 `PostInstall` |
| `vfox use golang@1.24.0` | `EnvKeys` 提供环境变量 |
| `vfox uninstall golang@1.24.0` | 无 |

## 版本是怎么找到的

`lib/utils.lua` 里的 `getReleases` 发出两个请求，把结果拼在一起，第一个在前：

1. `https://go.dev/dl/?mode=json` 列出当前的版本，带有每个压缩包的文件名和 SHA-256。它们标为 `stable`，排在最前面，所以 `latest` 就是第一项。
2. `https://go.dev/dl/` 是全部版本的页面。插件用 vfox 的 HTML 库读取 `div#archive` 下的表格，取出类型为 `Archive`、且操作系统和 CPU 与 `RUNTIME` 一致的行。

两者都按 `RUNTIME.osType` 和 `RUNTIME.archType` 过滤；页面对它们的叫法不一样（`macOS`、`x86-64`、`ARM64`），由 `getOsTypeAndArch` 翻译。镜像（`VFOX_GOLANG_MIRROR`）只替换文件名前面的地址，两个请求不会变。

两个请求都经过 `fetch`：请求失败，或者得到 500 及以上的状态时，它会再发一次，一共最多 `ATTEMPTS`（3）次。其他不是 200 的状态直接失败，而且一个页面重试时，已经拿到的另一个页面不会重新请求。错误是最后一次的失败，尝试超过一次时后面跟着 `(after 3 attempts)`。vfox 的 http 模块不会重试，TLS 握手超过 10 秒就结束它，所以没有这一层的话，只有第一次很慢的连接（例如经过本地代理的第一个连接）就会让命令停下来，而同一条命令再运行一次就好了。

`PreInstall` 接受 `latest`，或者版本与用户输入相等的那一项。它返回 `version`、`url`、`note` 以及该项的 `sha256`。

## 约定

几条花了不少时间才弄清楚的：

- vfox 用 hook 返回的键所对应的算法对下载的文件做哈希，并把十六进制摘要与值原样比较，所以 go.dev 的 `sha256` 原样放进去。没有校验和时，vfox 会打印 `WARNING: Checksum is not provided, skip verify...` 然后继续，所以 e2e 套件要找的是 `Verifying checksum`。
- `version` 会成为安装的名字：目录是 `v-<version>`，`vfox list` 也显示它。Go 1.20 及更早的版本把一个系列的第一个版本叫 `1.20`，插件照原样保留。
- 找不到版本时，`PreInstall` 要用 error 报错。返回空结果更糟：vfox 1.0.13 会把它当成一次安装，打印 `Install golang@ success!`、以 0 退出，却什么也没装，0.4.1 及之前的插件就是这样。
- `EnvKeys` 不读环境里的 `GOPATH`：vfox 会为之前选中的版本导出一个，读它就会沿用旧的包。唯一的输入是 `VFOX_GOLANG_GOPATH`，见 [gopath.md](gopath.md)。
- vfox 把 `Available` 的结果缓存 12 小时，存在 `plugin/golang/.available.cache`。`PreInstall` 不缓存。
- hook 运行在 vfox 的 Lua 5.1（GopherLua）里。`os.execute` 是有的，但测试运行时会禁用它，见下面。
- `PostInstall` 把版本目录的路径作为一个词交给 `os.execute`：Unix 上放在单引号里，路径里的引号会先关闭、转义、再重新打开。Windows 上，只要 `cmd` 会把路径的一部分当成语法，就放在双引号里，空格算，`& | < > ^ ( ) , ; =` 也算；否则保持原样。原因在于 vfox 怎样把命令交给 `cmd`：1.0.13 起原样交给它（[vfox#712](https://github.com/version-fox/vfox/pull/712)）；在那之前，Go 会把每个 `"` 变成 `\"`，`cmd` 会读错它（vfox#712 的修改里就是这么说的）：加了引号的路径得不到它所指的目录，这些版本的所有 Windows 用户都会这样，而不只是路径里有空格的那些。所以没有任何特殊字符的路径一直不加引号，和以前一样。

## 测试

hook 测试在 `vfox plugin test` 下离线运行，vfox 1.0.13 及以后才有。它会找出所有 `tests/**/*_test.lua`，每个文件在各自的 VM 里运行，所以新增一个测试文件不需要在任何地方登记：

```bash
vfox plugin test .
vfox plugin test . --file tests/releases_test.lua
```

在仓库根目录运行。Test Plugin 工作流会安装 `.github/workflows/hooks-test.yml` 里固定的版本，开发容器里装的是同一个。

测试文件调用一次 `vfox.test` 的 `test.load()`，再通过它返回的对象调用真正的 hook，比如 `plugin:EnvKeys({ path = "/sdk/go" })`。`test.load` 接受平台（`os`、`arch`）、环境变量（`env`）和一个应答所有 HTTP 请求的函数（`http`）；之后可以 `require` `lib` 里的模块，也可以改 `RUNTIME.osType` 来试别的平台。见 vfox 的[测试与调试插件](https://vfox.dev/zh-hans/plugins/create/testing.html)。hook 的上下文和结果都会经过 vfox 的解码，所以 hook 在 vfox 想要 table 的地方返回了一个字符串，测试会失败。

`tests/releases_test.lua` 用 `tests/fixtures` 里的文件应答 `getReleases` 的两个请求，并让某些用例改掉一个应答，来看插件怎样对待失败或者非 200 的状态，或者排好一些只给一次的应答（先于固定的应答），也就是先失败、再通过的请求，来看它是否会再请求、请求几次；它没有应答的请求会让测试失败。它还会替 `VFOX_GOLANG_MIRROR` 改写 `os.getenv`，替平台改写 `RUNTIME`。它期望的校验和是 go.dev 自己的，写在文件里，所以插件读错了单元格就会失败。

VM 禁用了 `os.execute` 和 `io.popen`，而 `PostInstall` 要运行 `mkdir`。`tests/post_install_test.lua` 在加载插件之前替换 `os.execute`，换成一个把命令记下来的函数，再按平台检查这条命令，包括路径里带空格和引号的情形。E2E 测试会在 Linux 和 Windows 上真正运行这条命令。

想对真正的 go.dev 调用单个 hook，vfox 1.0.13 及以后有 `vfox plugin run`。它不会注册插件，`--os` 和 `--arch` 可以替别的平台作答：

```bash
vfox plugin run . Available --json
vfox plugin run . PreInstall --input '{"version":"1.24.0"}' --os windows --arch arm64 --json
vfox plugin run . EnvKeys --input '{"path":"/sdk/go"}' --json
```

`vfox plugin run` 允许 `os.execute` 通过，所以用自己的路径去运行 `PostInstall`，会在它说的地方创建目录。请在可以随手删掉的目录里运行。

`vfox --debug <命令>` 会显示 vfox 对 hook 做了什么，被它吞掉的错误就是这样找到的。

Lint、E2E 测试和开发容器见 [e2e.md](e2e.md)。

## 已知缺陷

- **`VFOX_GOLANG_MIRROR` 末尾需要 `/`。** 插件把文件名原样接在值后面，所以没有 `/` 的镜像会得到一个错误的地址，见 [mirror.md](mirror.md)。套件里没有检查这一条。
- **在 Windows 上，带空格的路径需要 vfox 1.0.13 或更高版本。** `PostInstall` 给路径加的引号，在 vfox 1.0.12 及之前会在送往 `cmd` 的路上被弄坏（见“约定”），所以目录建不到它该在的地方。别的都不受影响：`go install` 第一次安装命令时会自己创建这个目录，`PATH` 里暂时还不存在的一项也没有害处。Windows 的 E2E 测试只运行最新的 vfox。
- **镜像只提供压缩包。** 版本列表和校验和始终来自 go.dev，所以 go.dev 连不上的地方，镜像也帮不上忙。
- **同一个请求的几次尝试之间不停顿。** vfox 没给插件提供 sleep，`os.execute("sleep ...")` 又是 Unix 的命令。等满了 10 秒握手的失败已经停顿得够久了，但需要一会儿才能恢复的服务器错误，可能一瞬间就用完三次。测试套件只对着保存下来的应答检查重试，没有哪个测试让真实的请求失败。手动试的话，vfox 的 http 模块会走 `HTTPS_PROXY` 指定的代理，所以一个第一条隧道永远不应答的代理，就能复现第一次连接很慢的情形。

## 许可证头

每个源文件都以 `.licenserc.yaml` 里的 Apache-2.0 头开始（`Copyright 2026 Han Li and contributors`），用该语言的注释风格，License 工作流会让没有头的文件失败。`license-eye header fix` 会把头写进新文件，只有 `.gitattributes` 它写不了，那个注释要手写。文档（`*.md`）、JSON（`package.json`、`.luarc.json`、`devcontainer.json`）、`LICENSE`、工具会整个读取的 `.tool-versions` 和 `.node-version` 文件，以及 `tests/fixtures` 里保存下来的 go.dev 的应答，有意不带头：`.licenserc.yaml` 里的 `paths-ignore` 列出了它们。`opencode.jsonc` 带头，写成注释。要改文字，就一起改 `.licenserc.yaml` 里的 `content` 和每个文件的头。

## 发布

维护者在默认分支上从 **Actions → Plugin → Run workflow** 发布，输入不带 `v` 前缀的稳定插件版本。共享工作流 [plugin-manifest-action](https://github.com/version-fox/plugin-manifest-action) 会更新 `metadata.lua`，创建版本提交和 tag，并在本仓库发布 ZIP 和 manifest。不需要本地 tag，也不需要额外的发布令牌。Pull request 只运行检查；PR 标题不再触发发布。

推送版本 tag 同样会发布，前提是 `PLUGIN.version` 已经与 tag 一致。发布失败时，重新运行最初失败的那个任务即可续上。工作流跟随共享的 `@v1` 发布工具，更新这个工具不会发布本插件。包的约定和首次接入的要求，见[共享工作流文档](https://github.com/version-fox/plugin-manifest-action)。

包里有 `metadata.lua`、`hooks/`、`lib/` 和许可证。文档、测试、工作流和开发容器都不在其中。因为仓库里有 `stylua.toml`，共享检查还会用 StyLua 2.5.2 检查 Lua，所以推送之前请用这个版本格式化，见 [e2e.md](e2e.md#本地检查)。

### 发布之后

文档里用“未发布”（英文是“Unreleased”）标记比最新发布版更新的内容。用户能感受到的变化，要在做出这个变化的 PR 里，把条目写进 [changes.md](changes.md) 的“未发布”下面，两种语言都要写。发布完成后：

1. 把 [changes.md](changes.md) 里的这些条目移到新版本下面，写上发布日期，并去掉这些标注，两种语言都要处理：`grep -rn -i -e unreleased -e 未发布 docs README*`。“未发布”这个标题要去掉，页首那句说 `main` 领先于最新发布版的话也一起去掉。
2. 上一个发布版的版本号也要搜一遍：有几句话是拿它做对比的，没有写“未发布”。

## 编写文档

英文页面在 `docs/`，中文页面在 `docs/zh-CN/`，文件名相同（中文 README 是 `README_CN.md`），每个页面的开头都有指向另一种语言的链接。新增页面要加进两个 README 的文档列表。CI 不会检查文档里的命令，所以请把你加的命令跑一遍。
