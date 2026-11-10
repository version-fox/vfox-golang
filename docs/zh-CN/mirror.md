# 镜像

[中文](mirror.md) | [English](../mirror.md)

`vfox install golang@1.24.0` 是从 `go.dev` 下载这个版本的压缩包的。如果你那里访问 go.dev 很慢，或者连不上，就设置 `VFOX_GOLANG_MIRROR`，插件会把下载改到镜像上。

值是一个 URL 前缀。插件把压缩包的文件名原样接在它后面，所以值**必须以 `/` 结尾**。以 Linux amd64 上的 Go 1.24.0 为例：

| `VFOX_GOLANG_MIRROR` | vfox 下载的地址 |
| --- | --- |
| 没有设置 | `https://go.dev/dl/go1.24.0.linux-amd64.tar.gz` |
| `https://golang.google.cn/dl/` | `https://golang.google.cn/dl/go1.24.0.linux-amd64.tar.gz` |
| `https://mirrors.aliyun.com/golang/` | `https://mirrors.aliyun.com/golang/go1.24.0.linux-amd64.tar.gz` |
| `https://mirrors.aliyun.com/golang` | `https://mirrors.aliyun.com/golanggo1.24.0.linux-amd64.tar.gz`（少了 `/`，是个错误的地址） |

只要这个地址下按名字提供 go.dev 上的那些压缩包，任何服务器都可以。插件不运营任何镜像，也不为它们担保。

## 设置

在 bash 或 zsh 里，对当前 shell 生效：

```bash
export VFOX_GOLANG_MIRROR=https://golang.google.cn/dl/
```

把同一行加进 `~/.bashrc` 或 `~/.zshrc`，就一直生效。在 PowerShell 里：

```powershell
$env:VFOX_GOLANG_MIRROR = "https://golang.google.cn/dl/"
```

要让之后打开的每个终端都生效，执行：

```powershell
[Environment]::SetEnvironmentVariable('VFOX_GOLANG_MIRROR', 'https://golang.google.cn/dl/', 'User')
```

然后照常安装，`vfox install golang@1.24.0`。想回到 go.dev，取消设置这个变量即可。

## 哪些请求会经过镜像

只有压缩包的下载。插件仍然向 `https://go.dev/dl/` 要版本列表和校验和，`vfox search` 和 `vfox install` 都是这样，所以 go.dev 必须能连上。连不上的话，vfox 需要一个代理，见[网络](troubleshooting.md#网络)。

## 校验和

vfox 按 go.dev 列出的 SHA-256 检查压缩包，镜像说了什么不算数。镜像给出损坏的文件，或者在压缩包的名字下给了别的文件，安装会以 `Checksum error` 失败，也不会留下任何东西。容器测试（[e2e.md](e2e.md)）会故意让一个镜像给出另一个文件，来确认这一点。

连不上的镜像，会以 vfox 请求的地址失败，从中可以看出变量有没有被读到：

```
failed to download golang@1.24.1 file, err:Get "https://mirror.example/go1.24.1.linux-amd64.tar.gz": ...
```

见[问题排查](troubleshooting.md#提示)。
