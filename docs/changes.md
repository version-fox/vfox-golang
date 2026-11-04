# Changes

[中文](zh-CN/changes.md) | [English](changes.md)

What changed in each release, as a user notices it. GitHub's release pages list the pull requests. The newest release at the time of writing is 0.4.1, and `main` is ahead of it by everything under "Unreleased". [install-from-source.md](install-from-source.md) gets you those changes now.

## Unreleased

- A version that is no release stops the install. `vfox install golang@1.24`, `golang@1`, and a version that go.dev never published, such as `golang@1.99.99`, fail with ``No Go release found for "1.24" on linux/amd64. `vfox search golang` lists the releases.`` and install nothing. Release 0.4.1 prints `Install golang@ success!` and exits with 0, though nothing was installed. `1.24` and `1` are no releases: the first release of the 1.24 line is `1.24.0`, and `vfox search golang` lists every name as it has to be written. See [versions.md](versions.md#naming) ([#23](https://github.com/version-fox/vfox-golang/pull/23)).
- A space in the path of a release no longer sends `PostInstall` astray, as in a home directory like `/home/John Doe` or a `VFOX_HOME` that has one. Release 0.4.1 gives `mkdir` the path without quotes, so `mkdir` makes one directory out of each word, in the wrong places, and not the `packages/bin` of the release. `go install` makes that directory when it first installs a command, so nothing else broke. Now the path is quoted. On Windows the quotes need vfox 1.0.13 or later, which gives the command to `cmd` as written ([vfox#712](https://github.com/version-fox/vfox/pull/712)). vfox 1.0.12 and before spoil them, so there a path with a space still does not get its `packages/bin`, and a path without one works as it always did. See [development.md](development.md#known-gaps) ([#23](https://github.com/version-fox/vfox-golang/pull/23)).
- When go.dev cannot be reached, or answers with a status other than 200, the error names what failed. The failure of the request reads `cannot list the Go releases: Get "https://go.dev/dl/?mode=json": ...`, and a status reads `cannot list the Go releases: https://go.dev/dl/?mode=json answered with status 503`. Release 0.4.1 begins the first with `paring release info failed.` and fails the second with `cannot perform concat operation between string and nil`, which hides the status. See [troubleshooting.md](troubleshooting.md#messages) ([#23](https://github.com/version-fox/vfox-golang/pull/23)).
- A request to go.dev that fails, or that gets a server error (a status of 500 or more), is made again, up to three attempts in all, and no longer stops the command at the first failure. Where go.dev is slow to answer the first time, for instance through a proxy that is slow to open its first connection to it, `vfox install golang@1.27.3` failed with `cannot list the Go releases: Get "https://go.dev/dl/?mode=json": net/http: TLS handshake timeout`, and running the same command again went through. vfox gives a TLS handshake 10 seconds and its http module never tries again, so the second run is now the plugin's own. When all three attempts fail, the error is the last failure followed by `(after 3 attempts)`, which takes about 30 seconds where each one waits out the handshake. Any other status, a 404 for example, is not made again. Release 0.4.1 makes each request once. See [troubleshooting.md](troubleshooting.md#slow-or-failing-requests) ([#24](https://github.com/version-fox/vfox-golang/pull/24)).
- The repository has E2E tests that install a real Go release with a real vfox: in containers on Linux (amd64 and arm64), and on the runner itself on Windows (amd64 and arm64). It also has lint, a license header check, a dev container, offline tests of every hook against saved answers of go.dev, and documentation in English and Chinese. See [e2e.md](e2e.md) and [development.md](development.md) ([#23](https://github.com/version-fox/vfox-golang/pull/23)).

## 0.4.1 (2026-09-12)

- `VFOX_GOLANG_GOPATH` replaces the GOPATH of a release with one directory, or several, that you name, and puts the `bin` of each on the `PATH` in place of `packages/bin`: `export VFOX_GOLANG_GOPATH="$HOME/go"` makes every release share one set of packages and commands. The plugin still does not read the `GOPATH` of the environment, which vfox may have exported for the release selected before. See [gopath.md](gopath.md) ([#22](https://github.com/version-fox/vfox-golang/pull/22)).
- The README names `https://golang.google.cn/dl/` as a mirror next to Aliyun's.

## 0.4.0 (2025-07-21)

- `VFOX_GOLANG_MIRROR` sends the download of an archive through a mirror, as in `VFOX_GOLANG_MIRROR=https://mirrors.aliyun.com/golang/ vfox install golang`. The list of releases and their checksums still come from go.dev. See [mirror.md](mirror.md) ([#15](https://github.com/version-fox/vfox-golang/pull/15)).

## 0.3.0 (2024-07-01)

- Every release has a GOPATH of its own, the `packages` directory in it, and `packages/bin` is on the `PATH`, so a command that `go install` puts there runs by its name. The plugin creates `packages/bin` when it installs a release. See [gopath.md](gopath.md) ([#12](https://github.com/version-fox/vfox-golang/pull/12)).

## 0.2.0 (2024-05-15)

- `GOROOT` is set to the release in use.

## 0.1.x (2024-04)

- 0.1.0 is the first release. `vfox search golang` lists the releases of go.dev, `vfox install` installs the archive for the platform and checks it against the SHA-256 that go.dev lists, and the `bin` directory of the release goes on the `PATH`.
- 0.1.1 changes the README and the version number only.
