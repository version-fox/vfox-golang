# Install from source

[中文](zh-CN/install-from-source.md) | [English](install-from-source.md)

`vfox add golang` installs the latest release of the plugin. To try `main` before its next release, or a change you are working on, build the plugin from source. A plugin is a `metadata.lua` plus the `hooks` and `lib` directories, and vfox adds one from a zip of them.

## Ubuntu 26.04

Execute in Bash,

```bash
sudo apt install --assume-yes git zip
git clone --depth 1 https://github.com/version-fox/vfox-golang.git
cd ./vfox-golang/
zip -qr ./golang.zip metadata.lua hooks lib
vfox add golang --source ./golang.zip
rm ./golang.zip
```

macOS is the same, with the `git` and `zip` that come with the system.

## Windows 11

Assume that PowerShell 7 is already installed. Execute in PowerShell 7,

```powershell
winget install --id Git.Git --source winget --exact
git clone --depth 1 https://github.com/version-fox/vfox-golang.git
cd ./vfox-golang/
tar -a -cf ./golang.zip metadata.lua hooks lib
vfox add golang --source ./golang.zip
Remove-Item ./golang.zip
```

## Check it

```bash
vfox install golang@1.24.0
vfox use --global golang@1.24.0
go version
```

`go version` prints `go version go1.24.0` and the platform, such as `linux/amd64`.

## When golang is already added

`vfox add` refuses with `plugin named golang already exists`. You can replace the plugin or add the source build next to it.

To replace it, `vfox remove golang` comes first, and it removes the releases of Go installed through the plugin as well: vfox says so before it asks. Reinstall them afterwards.

To keep both, give the new one another name:

```bash
vfox add golang --source ./golang.zip --alias golang-dev
vfox install golang-dev@1.24.0
vfox remove -y golang-dev            # removes only golang-dev and what it installed
```

The alias has its own list of installed releases, kept apart from those of `golang`.

## Updating

Pull, build the zip again and add it again. A plugin added under its own name has to be removed first, and that takes the installed releases with it, so the alias is the easier route when you update often:

```bash
vfox remove -y golang-dev
vfox add golang --source ./golang.zip --alias golang-dev
```

To work on the plugin, see [development.md](development.md).
