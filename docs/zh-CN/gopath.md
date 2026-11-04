# GOPATH 与环境变量

[中文](gopath.md) | [English](../gopath.md)

## 插件设置了什么

对 `vfox use` 选中的版本，插件提供下面这些，其中 `~/.vfox/sdks/golang` 是 vfox 指向该版本的链接：

| 变量 | 值 |
| --- | --- |
| `GOROOT` | `~/.vfox/sdks/golang` |
| `GOPATH` | `~/.vfox/sdks/golang/packages` |
| `PATH` | `~/.vfox/sdks/golang/bin`，后面是 `~/.vfox/sdks/golang/packages/bin` |

`GOPATH` 在版本目录里面，所以每个版本有各自的包和各自安装的命令，卸载一个版本时它们也一起被删掉。`go install` 会把命令放进 `packages/bin`，它在 `PATH` 里，所以 Shell 可以直接按名字找到。插件在安装版本时就创建这个目录，所以 `PATH` 里的这一项一开始就存在。

```
$ go env GOROOT GOPATH
/home/me/.vfox/sdks/golang
/home/me/.vfox/sdks/golang/packages
```

## 所有版本共用一个 GOPATH

想在换版本时保留包和命令，就在**激活 vfox 之前**设置 `VFOX_GOLANG_GOPATH`，写在 Shell 配置文件里激活它的那一行上面：

```bash
export VFOX_GOLANG_GOPATH="$HOME/go"
```

在 PowerShell 里，激活之前设置 `$env:VFOX_GOLANG_GOPATH = "$HOME\go"`。这个变量会替换 `GOPATH` 和 `PATH` 里 `packages/bin` 那一项：

| `VFOX_GOLANG_GOPATH` | `GOPATH` | 加进 `PATH`，排在版本的 `bin` 之后 |
| --- | --- | --- |
| 没有设置，或者为空 | `~/.vfox/sdks/golang/packages` | `~/.vfox/sdks/golang/packages/bin` |
| `/home/me/go` | `/home/me/go` | `/home/me/go/bin` |
| `/home/me/go:/opt/go` | `/home/me/go:/opt/go` | `/home/me/go/bin`，然后是 `/opt/go/bin` |

多个路径用 `:` 分隔，Windows 上用 `;`。路径末尾的 `/` 或 `\` 不会带进它的 `bin` 条目。`GOROOT` 仍然跟着版本走。

`go install` 构建的结果，Go 放在第一个路径里。某个版本的 `GOPATH` 里已有的包不会被移到新的位置，Go 会按需创建目录。取消设置这个变量，`GOPATH` 就又回到每个版本各一个。

## 不继承环境里的 GOPATH

在 vfox 已经为之前的版本设置过 `GOPATH` 的 Shell 里，对另一个版本执行 `vfox use` 会替换它。如果插件取环境里现成的 `GOPATH`，新版本就会沿用旧版本的 packages 目录。所以它不这样做：`GOPATH` 要么是版本里的 `packages`，要么是 `VFOX_GOLANG_GOPATH`，没有第三种来源。你自己导出的 `GOPATH`，在使用这个插件时不起作用，请改用 `VFOX_GOLANG_GOPATH`。
