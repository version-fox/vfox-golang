# Development

[中文](zh-CN/development.md) | [English](development.md)

## Layout

```
metadata.lua                    plugin name, version and the address of the manifest
hooks/available.lua             vfox search
hooks/pre_install.lua           vfox install: choose the archive
hooks/post_install.lua          creates the bin directory of the GOPATH
hooks/env_keys.lua              GOROOT, GOPATH and PATH
lib/constants.lua               the address of go.dev
lib/utils.lua                   the releases that go.dev lists
Injection.lua                   type hints for what vfox injects, never loaded
tests/env_keys_test.lua         EnvKeys: GOROOT, GOPATH and PATH, with and without VFOX_GOLANG_GOPATH
tests/releases_test.lua         Available and PreInstall, against the saved answers of go.dev
tests/post_install_test.lua     the command PostInstall runs, with os.execute replaced
tests/fixtures/                 the saved answers of go.dev, see the README there
tests/e2e/                      E2E tests: containers on Linux, the machine itself on Windows, see e2e.md
.devcontainer/                  the dev container, see e2e.md
stylua.toml, .luarc.json        formatting and checking of the Lua
.licenserc.yaml                 the license header check, see below
README.md, docs/                the documentation; README_CN.md and docs/zh-CN/ are the Chinese version
opencode.jsonc                  lets OpenCode agent sessions in this repository run git push, gh pr create and gh pr comment without asking
```

vfox loads `metadata.lua`, calls a hook when a command needs it, and puts `PLUGIN` and `RUNTIME` (`osType`, `archType`, `version`) in scope. `osType` and `archType` are Go's `GOOS` and `GOARCH` of the vfox binary.

## What runs for a command

| You run | Hooks |
| --- | --- |
| `vfox search golang` | `Available`, unless vfox has an answer of the last 12 hours |
| `vfox install golang@1.24.0` | `PreInstall` returns the URL, the checksum and the name. vfox downloads, verifies and unpacks, then calls `PostInstall` |
| `vfox use golang@1.24.0` | `EnvKeys` provides the variables |
| `vfox uninstall golang@1.24.0` | none |

## How the releases are found

`getReleases` in `lib/utils.lua` makes two requests and joins the answers, the first one first:

1. `https://go.dev/dl/?mode=json` lists the current releases, with the file name and the SHA-256 of each archive. Those are noted `stable`. They come first, so `latest` is the first entry.
2. `https://go.dev/dl/` is the page of all releases. The plugin reads the tables under `div#archive` with the HTML library of vfox, and takes the rows of kind `Archive` for the operating system and the CPU of `RUNTIME`.

Both are filtered by `RUNTIME.osType` and `RUNTIME.archType`; the page names them differently (`macOS`, `x86-64`, `ARM64`), which `getOsTypeAndArch` translates. A mirror (`VFOX_GOLANG_MIRROR`) replaces only the address in front of the file name, and the two requests do not change.

`PreInstall` takes `latest`, or the entry whose version is equal to the one the user typed. It returns `version`, `url`, `note` and the `sha256` of the entry.

## Contracts

A few that cost time to find:

- vfox hashes the download with the algorithm of the key the hook returns and compares the hex digest to the value as it is, so the `sha256` of go.dev goes in as it comes. Without one vfox prints `WARNING: Checksum is not provided, skip verify...` and goes on, which is why the e2e suite looks for `Verifying checksum`.
- `version` becomes the name of the install: the directory is `v-<version>` and `vfox list` shows it. Go 1.20 and before call the first release of a line `1.20`, and the plugin keeps that.
- `PreInstall` fails with an error for a version it finds no release of. An empty result would do worse: vfox 1.0.13 takes it for an install, prints `Install golang@ success!`, exits with 0 and installs nothing, which is what plugin 0.4.1 and before did.
- `EnvKeys` does not read `GOPATH` of the environment: vfox exports one for the release selected before, and reading it would keep the old packages. `VFOX_GOLANG_GOPATH` is the one input, see [gopath.md](gopath.md).
- vfox keeps the answer of `Available` for 12 hours in `plugin/golang/.available.cache`. `PreInstall` is not cached.
- A hook runs in vfox's Lua 5.1 (GopherLua). `os.execute` is there, but a test run disables it, see below.
- `PostInstall` gives the path of the release to `os.execute` as one word: in single quotes on Unix, with a quote in the path closed, escaped and opened again. On Windows the path goes in double quotes when `cmd` would read part of it as syntax, which a space is, and so are `& | < > ^ ( ) , ; =`, and stays as it is otherwise. The reason is how vfox hands the command to `cmd`. From 1.0.13 on it does so as written ([vfox#712](https://github.com/version-fox/vfox/pull/712)). Before, Go turned each `"` into `\"`, which `cmd` misreads (the change in vfox#712 says so): a path in quotes would not give the directory it names, for every Windows user of those versions and not only for those with a space in the path. That is why a path with nothing special in it stays without quotes, as it always was.

## Tests

The hook tests run offline under `vfox plugin test`, which vfox 1.0.13 and later has. It finds every `tests/**/*_test.lua` and runs each file in a VM of its own, so a new test file needs no entry anywhere:

```bash
vfox plugin test .
vfox plugin test . --file tests/releases_test.lua
```

Run it from the repository root. The Test Plugin workflow installs the release pinned in `.github/workflows/hooks-test.yml`, and the dev container carries the same one.

A test file calls `test.load()` from `vfox.test` once, and calls the real hooks through what it returns, as in `plugin:EnvKeys({ path = "/sdk/go" })`. `test.load` takes the platform (`os`, `arch`), the environment variables (`env`) and a function that answers every HTTP request (`http`); the modules in `lib` can be required after it, and `RUNTIME.osType` can be changed to try another platform. See vfox's [Test and debug a plugin](https://vfox.dev/plugins/create/testing.html). The context and the result of a hook go through the decoding vfox does, so a hook that returns a bare string where vfox wants a table fails the test.

`tests/releases_test.lua` answers the two requests of `getReleases` from `tests/fixtures`, and has a case change an answer to see how the plugin takes a failure or a status other than 200; a request it has no answer for fails the test. It also changes `os.getenv` for `VFOX_GOLANG_MIRROR`, and `RUNTIME` for the platform. The checksums it expects are go.dev's own, written into the file, so a plugin that reads the wrong cell fails.

The VM disables `os.execute` and `io.popen`, and `PostInstall` runs `mkdir`. `tests/post_install_test.lua` replaces `os.execute` before it loads the plugin, by a function that keeps the command, and checks the command for each platform, paths with a space and a quote in them included. The E2E tests run the command for real, on Linux and on Windows.

To call a single hook against the real go.dev, vfox 1.0.13 and later has `vfox plugin run`. It does not register the plugin, and `--os` and `--arch` answer for another platform:

```bash
vfox plugin run . Available --json
vfox plugin run . PreInstall --input '{"version":"1.24.0"}' --os windows --arch arm64 --json
vfox plugin run . EnvKeys --input '{"path":"/sdk/go"}' --json
```

`vfox plugin run` lets `os.execute` through, so a `PostInstall` run with a path of its own creates directories where it says. Run it from a directory you can throw away.

`vfox --debug <command>` shows what vfox does with a hook, which is how to find an error it swallows.

The lint, the E2E tests and the dev container are in [e2e.md](e2e.md).

## Known gaps

- **`VFOX_GOLANG_MIRROR` needs the `/` at its end.** The plugin appends the file name to the value as it is, so a mirror without one makes a broken address, see [mirror.md](mirror.md). Nothing in the suite checks this one.
- **On Windows, a path with a space needs vfox 1.0.13 or later.** The quotes `PostInstall` puts around it are spoiled on their way to `cmd` by vfox 1.0.12 and before (see Contracts), so the directory is not made where it should be. Nothing else breaks: `go install` makes the directory the first time it installs a command, and an entry of the `PATH` that is not there yet does no harm. The Windows E2E tests run the newest vfox only.
- **A mirror serves the archives only.** The list of releases and their checksums always come from go.dev, so a mirror does not help where go.dev is out of reach.

## License headers

Every source file starts with the Apache-2.0 header of `.licenserc.yaml` (`Copyright 2026 Han Li and contributors`), in the comment style of its language, and the License workflow fails a file without one. `license-eye header fix` writes the header into a new file. It cannot into `.gitattributes`, which takes the comment by hand. Documents (`*.md`), JSON (`package.json`, `.luarc.json`, `devcontainer.json`), `LICENSE`, the `.tool-versions` and `.node-version` files, which tools read whole, and the saved answers of go.dev in `tests/fixtures` have none, by design: `paths-ignore` in `.licenserc.yaml` lists them. `opencode.jsonc` has it, as a comment. To change the text, change `content` in `.licenserc.yaml` and the header of every file with it.

## Releasing

A maintainer publishes from **Actions → Plugin → Run workflow** on the default branch, entering a stable plugin version without the `v` prefix. The shared workflow, [plugin-manifest-action](https://github.com/version-fox/plugin-manifest-action), updates `metadata.lua`, creates the version commit and the tag, and publishes the ZIP and the manifest in this repository. No local tag or extra release token is needed. Pull requests run the checks only; PR titles no longer trigger publication.

Pushing a version tag publishes too, when `PLUGIN.version` already matches the tag. If publication fails, re-run the original failed job to resume it. The workflow follows the shared `@v1` release tool, and updating the tool does not release this plugin. See the [shared workflow documentation](https://github.com/version-fox/plugin-manifest-action) for the package contract and the requirements of a first rollout.

The package holds `metadata.lua`, `hooks/` and `lib/`, and the license. Documentation, tests, workflows and the dev container are not part of it. Because `stylua.toml` is in the repository, the shared check also runs StyLua 2.5.2 over the Lua, so format with that version before you push, see [e2e.md](e2e.md#local-checks).

### After a release

The documentation marks what is newer than the last release with "Unreleased" ("未发布" in Chinese). A change that a user notices adds its entry to [changes.md](changes.md) under "Unreleased", in both languages, in the pull request that makes it. Once the release is out:

1. Move those entries in [changes.md](changes.md) under the new version, with the date of the release, and take the remarks out, in both languages: `grep -rn -i -e unreleased -e 未发布 docs README*`. The heading "Unreleased" goes, and so does the sentence at the top of the page that says `main` is ahead of the newest release.
2. Search for the number of the previous release: a few sentences compare against it without saying "Unreleased".

## Writing the docs

English pages are in `docs/`, the Chinese ones in `docs/zh-CN/` under the same names (the Chinese README is `README_CN.md`), and each page starts with a link to the other language. A new page goes into the Documentation list of both READMEs. Nothing in CI checks the commands in them, so run what you add.
