# 从源码安装

[中文](install-from-source.md) | [English](../install-from-source.md)

`vfox add golang` 安装的是插件最新的发布版。想在下一个版本发布之前用上 `main`，或者试用你正在改的代码，就从源码构建插件。插件就是一个 `metadata.lua` 加上 `hooks` 和 `lib` 两个目录，vfox 可以从它们的 zip 包添加插件。

## Ubuntu 26.04

在 Bash 中执行：

```bash
sudo apt install --assume-yes git zip
git clone --depth 1 https://github.com/version-fox/vfox-golang.git
cd ./vfox-golang/
zip -qr ./golang.zip metadata.lua hooks lib
vfox add golang --source ./golang.zip
rm ./golang.zip
```

macOS 的步骤相同，系统自带 `git` 和 `zip`。

## Windows 11

这里默认已装好 PowerShell 7，在 PowerShell 7 中执行：

```powershell
winget install --id Git.Git --source winget --exact
git clone --depth 1 https://github.com/version-fox/vfox-golang.git
cd ./vfox-golang/
tar -a -cf ./golang.zip metadata.lua hooks lib
vfox add golang --source ./golang.zip
Remove-Item ./golang.zip
```

## 验证

```bash
vfox install golang@1.24.0
vfox use --global golang@1.24.0
go version
```

`go version` 会打印 `go version go1.24.0` 和平台，比如 `linux/amd64`。

## 已经添加过 golang 时

`vfox add` 会报错 `plugin named golang already exists`。你可以替换原有的插件，也可以给源码构建的版本另起一个名字，与原插件并存。

替换要先执行 `vfox remove golang`，它会连同通过这个插件装的 Go 版本一起删掉，vfox 会在确认之前先告诉你这一点。之后需要重新安装这些版本。

想两个都留着，就给新的起个别名：

```bash
vfox add golang --source ./golang.zip --alias golang-dev
vfox install golang-dev@1.24.0
vfox remove -y golang-dev            # 只删除 golang-dev 和它装的东西
```

别名有它自己的已安装版本列表，与 `golang` 的互不相干。

## 更新

拉取代码，重新打 zip 包，再添加一次。以原名添加的插件必须先删除，这会连已安装的版本一起删掉，所以经常更新时用别名更省事：

```bash
vfox remove -y golang-dev
vfox add golang --source ./golang.zip --alias golang-dev
```

开发插件请看 [development.md](development.md)。
