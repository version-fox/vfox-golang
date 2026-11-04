# E2E

[中文](zh-CN/e2e.md) | [English](e2e.md)

The offline hook tests (`tests/*_test.lua`, run by `vfox plugin test`) run in the **Test Plugin** workflow. The end-to-end suites run against a real vfox, and the plugin installs a real Go release in them. There are two:

| Suite | Runs on | How |
| --- | --- | --- |
| the container suite, `test/e2e.test.ts` | Linux | in containers, one for each version of vfox, started by testcontainers |
| the native suite, `test/e2e.native.test.ts` | Windows (and, as a way to try it out, Linux and macOS) | on the machine itself, through PowerShell 7, for a user it makes up |

CI runs the container suite on the stock Linux runners (Docker plus Node.js from `actions/setup-node`) and the native suite on the Windows runners. Locally, the repository dev container runs the container suite.

Both are written in Node.js, the container suite with [testcontainers for Node.js](https://node.testcontainers.org/), and not in Go. This is the plugin that installs Go, and a Go toolchain on the machine that drives the tests, in the dev container or on the runner, is one more to tell from the ones the tests install: a `go` on the `PATH`, a `GOROOT` or a `GOPATH` that leaks into a test, a `go.mod` in a repository whose plugin writes `GOPATH`. The test containers have no Go in them either, and the native suite keeps the Go of its machine out of reach (see [below](#running-the-native-suite)). `go` can only come from what vfox installs.

The sections below say how to run the suites and the checks. The list of every check is at the end, under [What the suites verify](#what-the-suites-verify).

## Dev container

`.devcontainer/` opens a Linux development environment that works on all of these hosts:

| Host                  | How the dev container runs                            |
| --------------------- | ----------------------------------------------------- |
| Linux amd64 / arm64   | natively                                              |
| macOS, Windows        | Docker Desktop in Linux-container mode                |

It carries the Node.js of `tests/e2e/.node-version` (26.13.0), the Docker CLI, StyLua, lua-language-server, `license-eye`, PowerShell 7 and vfox, which runs the offline hook tests, with the versions of the tools the workflows pin the same, and it mounts the Docker socket of the host. The container suite then runs testcontainers against that daemon (Docker-out-of-Docker) and spawns the same target containers a native CI runner spawns; this is deliberately not Docker-in-Docker, so image cache and networking stay the host's. There is no Go in it. `postCreateCommand` runs `npm ci` in `tests/e2e`, so the first test run does not stop to install.

Open it with any Dev Containers spec tool, **Dev Containers: Reopen in Container** in VS Code or Cursor, or with the CLI:

```bash
devcontainer up --workspace-folder .
devcontainer exec --workspace-folder . bash
```

`TESTCONTAINERS_RYUK_DISABLED=true` is preset: Ryuk publishes a port on the host daemon and waits for the suite to dial it back, which a Docker-out-of-Docker container cannot do. The suite removes its containers and its image itself instead; what a killed run leaves behind has the name prefix `vfox-golang-e2e-` (containers) or the repository `vfox-golang-e2e` (images) and can be pruned. Rootless Docker users export `DOCKER_SOCK="$XDG_RUNTIME_DIR/docker.sock"` on the host before opening the container. The container runs as `root`, so on a Linux host with a rootful Docker the `node_modules` that `npm ci` creates in the checkout belong to root.

The dev container cannot host Windows containers, and the container suite has none: it runs on Linux. Windows is what the native suite is for.

## Environment knobs

| Variable               | Default          | Meaning                                                                       |
| ---------------------- | ---------------- | ----------------------------------------------------------------------------- |
| `E2E_VFOX_VERSION`     | `latest main`; `latest` for the native suite | Space-separated vfox versions: `latest`, `main`, or a release such as `1.0.13` |
| `E2E_GO_VERSION`       | `1.24.0`         | The Go release the plugin installs for every user                             |
| `E2E_BASE_IMAGE`       | `ubuntu:26.04`   | The image the test containers are built from. It needs apt (container suite)  |
| `E2E_PWSH`             | `pwsh` on the `PATH` | The PowerShell 7.4 or later the native suite drives vfox through          |
| `E2E_MAX_JOBS`         | `3`              | Containers, or users, that run at the same time                               |
| `E2E_RETRY_ATTEMPTS`   | `3`              | Attempts of every command that touches the network (linear 10 s backoff)      |

`latest` is the newest release of vfox, `main` its main branch, built from source in a separate `golang` container, whose binary is copied into the test containers. The native suite takes no `main`: building vfox takes a Go, which its machine has to do without. A release has to be one that has `vfox add --source`, which registers this checkout: 1.0.13 has it, 0.4.0 does not. `E2E_GO_VERSION` takes a release `vfox search golang` lists; the first release of a line before 1.21 has no patch number (`1.20`). A value that none of these accepts stops the run with a message naming the variable.

## Running the container suite

Inside the dev container, from the repository root:

```bash
cd tests/e2e
npm test
```

Scope it down while iterating the same way:

```bash
E2E_VFOX_VERSION=latest E2E_MAX_JOBS=1 npm test
```

On a native host the same commands work with two prerequisites, Docker Engine (rootful or rootless) and Node.js 24 or later (`.node-version` is what CI installs), after an `npm ci`. testcontainers finds the socket of a rootless Docker by itself (`$XDG_RUNTIME_DIR/docker.sock`); for another daemon set `DOCKER_HOST`.

The suite builds `tests/e2e/image/Dockerfile` once, starts one container per vfox version and one pair for the mirror, and runs them side by side, `E2E_MAX_JOBS` at a time. The steps of one container run in order, and once one fails the others of that container are skipped instead of failing for the same reason.

If the image does not build, the Docker build API reports it only in its log. `DEBUG=testcontainers:build npm test` prints the log, `DEBUG=testcontainers*` everything testcontainers does.

## Running the native suite

On a Windows machine, in PowerShell, from the repository root:

```powershell
cd tests/e2e
npm ci
npm run test:native
```

It needs Node.js 24 or later and PowerShell 7.4 or later (`pwsh`), and on Linux and macOS `zip` (Windows has the `tar.exe` that docs/install-from-source.md uses), nothing else: no Docker, no Go, and no Windows containers, which a Windows runner would only use to stand in for the Windows that is already there. The suite makes up a user, in a directory of its own under `RUNNER_TEMP` or the temporary directory: a home directory with a space in its name (`C:\Users\John Doe`), with vfox in `~/.vfox`, and downloads the release of vfox into it. Everything is removed afterwards; a directory that Windows will not let go of, because a process or a virus scanner still has a file of it open, is reported with its path and does not fail a run whose steps passed. Nothing of the real `~/.vfox`, the `PATH`, the registry or the Go of the machine is touched or used.

That last part is what the environment of the scripts is made for (`isolatedEnv` in `tests/e2e/src/native.ts`). The images of the GitHub runners come with Go, and with `GOROOT_*` variables and a `PATH` to go with it; a developer has the Go that vfox installed for them, and vfox hooked into their shell. The scripts get the environment of the tests without anything that begins with `GO` or `VFOX_`, without `__VFOX_*` (which tells vfox it is hooked), without `GOPATH`, and with a home directory, a temporary directory and a `PATH` of their own: vfox, PowerShell, and the directories of the system. The first step checks that no `go` is on that `PATH`.

The registry is the part no made-up home directory can keep out of reach. The suite selects the release with `vfox use --project`, from the directory its scripts run in, and never with `vfox use --global`: on Windows that also writes `Path`, `GOROOT` and `GOPATH` into the registry of the user who runs it (`HKCU\Environment`). On the machine of a developer they would stay, pointing into a directory that is gone, over the `GOROOT` and `GOPATH` they may have set. `NativeTarget` stops a script that uses vfox in the global scope before it runs (`assertNoGlobalScope` in `tests/e2e/src/native.ts`).

The native suite runs on Linux and macOS too, with a `pwsh` (name it in `E2E_PWSH` when it is not on the `PATH`; the dev container has one). That is how it is tried out where there is no Windows, but what only Windows has is not tried out that way: the zip of Go, `go.exe`, the `;` between the entries of a `PATH`, the junction that vfox makes for the release it selects, and the `mkdir` of `cmd` that `PostInstall` runs there.

## Local checks

Execute from the dev container, where everything below is preinstalled and pinned to the versions the workflows use, or provision the same tools on a host.

```bash
# Lua (.github/workflows/lint.yml).
stylua --check .
lua-language-server --check . --checklevel=Warning

# Offline hook tests (.github/workflows/hooks-test.yml).
vfox plugin test .

# License headers (.github/workflows/license.yml). `fix` writes the header into a new file.
license-eye header check
license-eye header fix

# The Node.js of the E2E suites (.github/workflows/lint.yml).
cd tests/e2e
npm run typecheck
npm run lint
npm run test:unit
```

`stylua .` formats the Lua and `npm run format` the TypeScript. Beside the helpers of the suites, `npm run test:unit` checks that the versions pinned in the workflows and in the dev container agree. With a `pwsh` at hand it also checks the quoting of the native suite against the real PowerShell, and skips that where there is none. The Lint workflow also checks the workflows themselves, and so can you, with Docker only, as you can check the license headers:

```bash
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12
docker run --rm -v "$PWD:/work" -w /work apache/skywalking-eyes:0.9.0 header check
```

The dev container has `license-eye` itself: Docker-out-of-Docker cannot mount the workspace into a container of the host's daemon.

## What the suites verify

Every vfox version runs the same flow in the container suite, in one long-lived container, driven from Node.js by exec calls, and in the native suite for one user, driven through PowerShell. The image has no Go, and the user has none on the `PATH`, so `go` can only come from what vfox installs. The container suite sets `VFOX_HOME` to a path with a space in it (`/root/John Doe/.vfox`), as a home directory can have one, and makes the directory first: vfox 1.0.13 does not make the directory that a plugin is added to when `VFOX_HOME` is not `~/.vfox`. The native suite puts the home directory in such a path.

1. vfox is installed, from the latest release or built from `main`, and this checkout is registered as the `golang` plugin the way [install-from-source.md](install-from-source.md) says. `vfox info golang` must show the name, the homepage, and the version of `metadata.lua`.
2. `vfox search golang` lists the newest release as `stable`, and `1.24.0` among the others. The first comes from `https://go.dev/dl/?mode=json`, the second from the page of the archive, so both ways the plugin finds releases run.
3. An install through a mirror that does not exist fails, and the error names the address it asked for: the mirror and the name of the archive of the platform (`go1.24.0.linux-amd64.tar.gz`, `linux-arm64` on arm64, `windows-amd64.zip` on Windows). It proves the variable is read, and that the plugin asks for the platform of the machine.
4. `vfox install golang@1.24.0` succeeds and prints `Verifying checksum` with a SHA-256 digest. vfox compares the digest with the hash of the file it downloaded and fails the install if they differ, so the install succeeding proves the digest is the file's. Without a checksum vfox prints `Checksum is not provided` instead.
5. `PostInstall` has created `packages/bin` in the release, in the path with a space.
6. After `vfox use --global` (container suite) or `vfox use --project` (native suite, see [above](#running-the-native-suite)), `vfox current golang` names the release, and a shell that activates vfox finds `go` in the `bin` of the link vfox makes for it: `~/.vfox/sdks/golang`, or `.vfox/sdks/golang` in the project. `go version` reports `go1.24.0` and the platform of the machine (`linux/amd64`, `linux/arm64`, `windows/amd64`, so the archive is the right one for it). `GOROOT` is that link, which leads to the release that was installed, `GOPATH` its `packages`, and `PATH` has `bin` of the release followed by `packages/bin`. (`VFOX_HOME` does not move `sdks`: vfox keeps it in `~/.vfox`.)
7. A program compiles and runs with `go run`, and `go install` puts it into `packages/bin`, from where the shell runs it by its name.
8. `VFOX_GOLANG_GOPATH` replaces the `GOPATH` and the `PATH` entry of `packages/bin` (`go install` then puts the program in the new `bin`), takes several paths, and a `GOPATH` in the environment, like the one of a previously selected release, is not inherited.
9. A release that does not exist (`1.99.99`, and `1.24` and `1`, which are no releases) fails to install with `No Go release found for "1.24" on linux/amd64`, and leaves no directory behind. Plugin 0.4.1 and before reported success.
10. `PostInstall` creates `packages/bin` in a path with a space and a quote in it (`/work/it's John Doe/sdk`), run through `vfox plugin run` from a directory of its own that must stay empty. Plugin 0.4.1 and before left the path without quotes, and the `mkdir` made one directory out of each word. On Windows this needs vfox 1.0.13, which is the one the native suite runs (see [Known gaps](development.md#known-gaps)).
11. A stand-in for a Go mirror serves `golang@latest`: the install succeeds and verifies the download, the log has the request for the archive of the newest release `vfox search golang` lists, and that release runs. The same stand-in serves something else under the name of the archive, and the install fails with `Checksum error`. In the container suite it is an nginx on the network of the test that proxies `dl.google.com/go`. In the native suite it is a small HTTP server in the test process, on `127.0.0.1`, that does the same.

The native suite has one step more, before the first: that no `go` is on the `PATH` before vfox is activated.

The default matrix of the container suite runs both versions of vfox on the platform of the machine, and the mirror suite once, with the first version. The native suite runs the release of vfox:

| Suite              | vfox                    | Covers                                                                        |
| ------------------ | ----------------------- | ----------------------------------------------------------------------------- |
| `vfox latest`      | the newest release      | steps 1 to 10 on the vfox people install                                      |
| `vfox main`        | the main branch         | the same, on what the next release of vfox will be (container suite only)    |
| `mirror`           | the first of the above  | step 11                                                                       |

CI runs the container suite on Ubuntu amd64 (`ubuntu-latest`) and arm64 (`ubuntu-24.04-arm`), and the native suite on Windows amd64 (`windows-latest`) and arm64 (`windows-11-arm`). macOS is not covered by CI.
