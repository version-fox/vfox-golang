/*
 * Copyright 2026 Han Li and contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// The E2E suite of the vfox golang plugin on the machine that runs it, with no container, driven through PowerShell 7.
//
// It is for Windows, where the containers of the other suite (e2e.test.ts) do not run: GitHub's Windows runners and a
// Windows machine of a developer take the place of a container. One user is made up in a directory of its own, with a
// space in the name of its home directory (C:\Users\John Doe), vfox is installed for it, and the steps run in order, as
// in a container: setup -> install -> verify. The same suite runs on Linux and macOS with a pwsh, which is how it is
// tried out where there is no Windows. See docs/e2e.md.
//
// Run it from tests/e2e:   npm run test:native
// Scope it down while iterating:   E2E_MAX_JOBS=1 npm run test:native

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { after, before, describe } from "node:test";
import {
    checkoutPluginVersion,
    DEFAULT_NATIVE_VFOX_VERSIONS,
    goVersion,
    maxJobs,
    REPO_DIR,
    vfoxVersions,
} from "../src/config.ts";
import { HELLO_GO, HELLO_MOD, helloLine } from "../src/hello.ts";
import {
    executableSuffix,
    hostArch,
    hostOs,
    normalizedPath,
    pathDelimiter,
    pathEntries,
    samePath,
} from "../src/host.ts";
import { type MirrorServer, startMirrorServer } from "../src/mirror-server.ts";
import { addNativePlugin, installNativeVfox, NativeTarget } from "../src/native.ts";
import { archiveName, goVersionLine, searched, verifiedDigest } from "../src/parse.ts";
import { psActivated, psQuote } from "../src/powershell.ts";
import { cleanUp, type Env } from "../src/run.ts";
import { escapeRegExp } from "../src/shell.ts";
import { MINUTE, sequence } from "../src/steps.ts";

const os = hostOs();
const arch = hostArch();
const go = goVersion();
const exe = executableSuffix(os);

/** A script that stops unless `path` is there. */
function mustExist(path: string, kind: "Container" | "Leaf" = "Container"): string {
    return `if (-not (Test-Path -LiteralPath ${psQuote(path)} -PathType ${kind})) { throw ${psQuote(`${path} does not exist`)} }`;
}

interface Toolchain {
    version: string | undefined;
    goroot: string;
    gopath: string;
    which: string;
    /** The entries of the PATH, normalized for comparison. */
    path: string[];
}

/** What a PowerShell with vfox activated makes of Go: the release, GOROOT, GOPATH, the binary and the PATH. */
async function toolchain(target: NativeTarget, env: Env = {}): Promise<Toolchain> {
    const out = await target.ok(
        psActivated(
            ["go version", "go env GOROOT", "go env GOPATH", "(Get-Command go).Source", "$env:PATH"].join("\n"),
        ),
        env,
    );
    const [version, goroot, gopath, which, path] = out.trim().split("\n");
    return {
        version,
        goroot: goroot ?? "",
        gopath: gopath ?? "",
        which: which ?? "",
        path: pathEntries(path ?? "", os),
    };
}

/** The directory of the program, and the script that installs it as a command, which the shell then finds by its name, and runs. */
const HELLO_DIR = (target: NativeTarget): string => join(target.work, "hello");
const installAndRunHello = (target: NativeTarget): string =>
    psActivated(`Set-Location -LiteralPath ${psQuote(HELLO_DIR(target))}\ngo install .\nhello`);

/** One user, one version of vfox: the plugin from this checkout, a real Go release, the PATH and the GOPATH. */
function vfoxSuite(vfox: string): void {
    const step = sequence();
    let target: NativeTarget;
    /** Where the release is installed. */
    let sdk: string;
    /** GOROOT as the plugin exports it: the link vfox makes to the selected release, set by the step that checks it. */
    let root: string;
    const hello = helloLine(go, arch, os);

    before(
        async () => {
            target = await NativeTarget.create({ spaced: true });
            await installNativeVfox(target, vfox);
            await addNativePlugin(target);
            sdk = join(target.home, "cache", "golang", `v-${go}`, `golang-${go}`);
            await mkdir(HELLO_DIR(target), { recursive: true });
            await writeFile(join(HELLO_DIR(target), "go.mod"), HELLO_MOD);
            await writeFile(join(HELLO_DIR(target), "main.go"), HELLO_GO);
        },
        { timeout: 20 * MINUTE },
    );
    after(async () => {
        await target?.stop();
    });

    step("starts without a Go on the PATH, so that any go the tests find is the plugin's", async () => {
        await target.ok(
            'Get-Command go -ErrorAction SilentlyContinue | ForEach-Object { throw "a go is on the PATH: $($_.Source)" }',
        );
    });

    step("registers the plugin from this checkout", async (t) => {
        const version = await target.ok("vfox --version");
        const info = await target.ok("vfox info golang");
        assert.match(info, /Name\s+->\s+golang/);
        assert.match(info, new RegExp(`Version\\s+->\\s+${escapeRegExp(checkoutPluginVersion())}`));
        assert.match(info, /Homepage\s+->\s+https:\/\/github\.com\/version-fox\/vfox-golang/);
        t.diagnostic(`${version.trim()} with the golang plugin ${checkoutPluginVersion()} on ${os}/${arch}`);
    });

    step(`lists the current releases as stable and go${go} among the archived ones`, async (t) => {
        const listed = searched(await target.retrying("vfox search golang", "vfox search golang"));
        const [newest] = listed;
        assert.equal(
            newest?.note,
            "stable",
            "the first release listed is the newest, which the plugin notes as stable",
        );
        const pinned = listed.find((release) => release.version === go);
        assert.ok(pinned, `vfox search golang lists no ${go}, out of ${listed.length} releases`);
        assert.equal(pinned.note, "", `${go} is no current release, so the plugin takes it from the archive page`);
        t.diagnostic(`${listed.length} releases, ${newest?.version} the newest`);
    });

    step("fails on a mirror that does not exist, and names the URL it asked for", async () => {
        const url = `https://invalid.example.invalid/${archiveName(go, arch, os)}`;
        const attempt = await target.until(
            `vfox install golang@${go} through a mirror that does not exist`,
            `vfox install golang@${go}`,
            { VFOX_GOLANG_MIRROR: "https://invalid.example.invalid/" },
            (run) => run.code !== 0 && run.out.includes(url),
        );
        assert.ok(attempt.ok, `vfox install must fail on the download from ${url}\n--- output ---\n${attempt.out}`);
    });

    step(
        `installs go${go} and verifies the download against a checksum`,
        async (t) => {
            const spec = `golang@${go}`;
            const out = await target.retrying(`vfox install ${spec}`, `vfox install ${spec}`);
            assert.match(out, new RegExp(`Install ${escapeRegExp(spec)} success!`));
            const digest = verifiedDigest(out);
            assert.match(digest ?? "", /^[0-9a-f]{64}$/, `vfox install ${spec} verified no SHA-256 digest\n${out}`);
            t.diagnostic(`${spec} was verified against ${digest}`);
        },
        { timeout: 15 * MINUTE },
    );

    step("creates the bin directory of the default GOPATH, in a home directory with a space in it", async () => {
        await target.ok(mustExist(join(sdk, "packages", "bin")));
    });

    step("selects the release for the project", async () => {
        // Not --global: on Windows that writes Path, GOROOT and GOPATH into the registry of the user (assertNoGlobalScope).
        const used = await target.ok(psActivated(`vfox use --project golang@${go}`));
        assert.match(used, new RegExp(`golang@${escapeRegExp(go)}`));
        const current = await target.ok(psActivated("vfox current golang"));
        assert.match(current, new RegExp(escapeRegExp(go)));
    });

    step("puts the release on the PATH, with GOROOT and the default GOPATH", async () => {
        const found = await toolchain(target);
        assert.equal(found.version, goVersionLine(go, arch, os), "the archive must be the machine's");
        root = found.goroot;
        assert.ok(
            samePath(root, join(target.work, ".vfox", "sdks", "golang"), os),
            `GOROOT is ${root}, the link of the selected release in the project`,
        );
        // GOROOT leads to the release that was installed: the file Go ships with its version says which.
        const version = await target.ok(`Get-Content -LiteralPath ${psQuote(join(root, "VERSION"))} -TotalCount 1`);
        assert.equal(version.trim(), `go${go}`);
        assert.ok(samePath(found.gopath, `${root}/packages`, os), `GOPATH is ${found.gopath}`);
        assert.ok(samePath(found.which, `${root}/bin/go${exe}`, os), `go is ${found.which}`);
        const bin = found.path.indexOf(normalizedPath(`${root}/bin`, os));
        assert.notEqual(bin, -1, `${root}/bin is not on the PATH`);
        assert.equal(
            found.path[bin + 1],
            normalizedPath(`${root}/packages/bin`, os),
            "the bin directory of the GOPATH follows GOROOT's",
        );
    });

    step("compiles and runs a program, and installs a command into the GOPATH", async () => {
        const run = await target.ok(psActivated(`Set-Location -LiteralPath ${psQuote(HELLO_DIR(target))}\ngo run .`));
        assert.equal(run.trim(), hello);
        const installed = await target.ok(installAndRunHello(target));
        assert.equal(installed.trim(), hello, "the command is found on the PATH by its name");
        await target.ok(mustExist(join(sdk, "packages", "bin", `hello${exe}`), "Leaf"));
    });

    step("VFOX_GOLANG_GOPATH replaces the GOPATH and its bin directory", async () => {
        const shared = target.path("shared go");
        const env = { VFOX_GOLANG_GOPATH: shared };
        const found = await toolchain(target, env);
        assert.ok(samePath(found.gopath, shared, os), `GOPATH is ${found.gopath}`);
        assert.ok(samePath(found.goroot, root, os), "GOROOT stays with the release");
        assert.ok(
            found.path.includes(normalizedPath(`${shared}/bin`, os)),
            "the bin directory of the GOPATH is on the PATH",
        );
        assert.ok(
            found.path.includes(normalizedPath(`${root}/bin`, os)),
            "the bin directory of the release is on the PATH",
        );
        assert.ok(
            !found.path.includes(normalizedPath(`${root}/packages/bin`, os)),
            "the default GOPATH is no longer on the PATH",
        );
        const installed = await target.ok(installAndRunHello(target), env);
        assert.equal(installed.trim(), hello);
        await target.ok(mustExist(join(shared, "bin", `hello${exe}`), "Leaf"));
    });

    step("VFOX_GOLANG_GOPATH takes several paths, and puts each bin directory on the PATH", async () => {
        const shared = target.path("shared go");
        const other = target.path("other go");
        const found = await toolchain(target, { VFOX_GOLANG_GOPATH: [shared, other].join(pathDelimiter(os)) });
        assert.deepEqual(pathEntries(found.gopath, os), [normalizedPath(shared, os), normalizedPath(other, os)]);
        const first = found.path.indexOf(normalizedPath(`${shared}/bin`, os));
        assert.notEqual(first, -1, `${shared}/bin is not on the PATH`);
        assert.equal(found.path[first + 1], normalizedPath(`${other}/bin`, os));
    });

    step("does not inherit a GOPATH from the environment", async () => {
        // A GOPATH in the environment may be the previous vfox SDK's, which the new one must not keep.
        const previous = target.path("previous", "packages");
        const found = await toolchain(target, { GOPATH: previous });
        assert.ok(samePath(found.gopath, `${root}/packages`, os), `GOPATH is ${found.gopath}`);
        assert.ok(!found.path.includes(normalizedPath(`${previous}/bin`, os)));
    });

    step("fails to install a release that does not exist, and says which and where", async () => {
        for (const version of ["1.99.99", "1.24", "1"]) {
            const message = `No Go release found for "${version}" on ${os}/${arch}`;
            const attempt = await target.until(
                `vfox install golang@${version} (must fail)`,
                `vfox install golang@${version}`,
                {},
                (run) => run.code !== 0 && run.out.includes(message),
            );
            assert.ok(attempt.ok, `vfox install golang@${version} must fail with "${message}"\n${attempt.out}`);
        }
        await target.ok(
            `if (Test-Path -LiteralPath ${psQuote(join(target.home, "cache", "golang", "v-"))}) { throw "the directory of an install without a version is there" }`,
        );
    });

    step("creates the bin directory in an SDK path with a space and a quote in it", async () => {
        // On Windows the command is the one of cmd, which takes the path in double quotes.
        const path = target.path("it's John Doe", "sdk");
        const input = target.path("post-install.json");
        await writeFile(input, JSON.stringify({ sdkInfo: { golang: { name: "golang", version: "1.0.0", path } } }));
        // Run from a directory of its own, where the stray directories of an unquoted path would land.
        const gap = target.path("gap");
        await mkdir(gap, { recursive: true });
        await target.ok(
            [
                `Set-Location -LiteralPath ${psQuote(gap)}`,
                `vfox plugin run ${psQuote(REPO_DIR)} PostInstall --input-file ${psQuote(input)}`,
                mustExist(join(path, "packages", "bin")),
                `if (@(Get-ChildItem -Force -LiteralPath ${psQuote(gap)}).Count -ne 0) { throw "the working directory is not empty" }`,
            ].join("\n"),
        );
    });
}

/** A user who downloads through a stand-in for a Go mirror on this machine: one that serves the archives, and one that does not. */
function mirrorSuite(vfox: string): void {
    const step = sequence();
    let target: NativeTarget;
    let mirror: MirrorServer;

    before(
        async () => {
            mirror = await startMirrorServer();
            target = await NativeTarget.create({ spaced: false });
            await installNativeVfox(target, vfox);
            await addNativePlugin(target);
        },
        { timeout: 20 * MINUTE },
    );
    after(async () => {
        await cleanUp(target?.stop(), mirror?.stop());
    });

    step(
        "installs the newest release through the mirror",
        async (t) => {
            const listed = searched(await target.retrying("vfox search golang", "vfox search golang"));
            const newest = listed[0]?.version;
            assert.ok(newest, "vfox search golang lists no release");

            const out = await target.retrying("vfox install golang@latest", "vfox install golang@latest", {
                VFOX_GOLANG_MIRROR: mirror.url,
            });
            assert.match(verifiedDigest(out) ?? "", /^[0-9a-f]{64}$/, `the download was not verified\n${out}`);

            // The archive came from the mirror, under the name go.dev gives it.
            const file = archiveName(newest, arch, os);
            assert.ok(
                mirror.requests.some((request) => new RegExp(`^GET /${escapeRegExp(file)} 20[06]$`).test(request)),
                `the mirror was never asked for ${file}\n--- requests ---\n${mirror.requests.join("\n")}`,
            );

            // `latest` is the newest release the search lists, and what the mirror served runs.
            await target.ok(psActivated(`vfox use --project golang@${newest}`));
            const found = await toolchain(target);
            assert.equal(found.version, goVersionLine(newest, arch, os));
            t.diagnostic(`golang@latest is go${newest}, downloaded through the mirror`);
        },
        { timeout: 20 * MINUTE },
    );

    step("refuses a download that does not match the checksum", async () => {
        const run = await target.run(`vfox install golang@${go}`, { VFOX_GOLANG_MIRROR: mirror.tamperedUrl });
        assert.notEqual(run.code, 0, `the install must fail\n${run.out}`);
        assert.match(run.out, /Checksum error/);
        const asked = `GET /tampered/${archiveName(go, arch, os)} 200`;
        assert.ok(
            mirror.requests.includes(asked),
            `the download must have gone to the mirror\n${mirror.requests.join("\n")}`,
        );
    });
}

describe("vfox golang plugin on this machine", { concurrency: maxJobs() }, () => {
    // A suite takes the concurrency of the one around it unless it sets its own, and the steps of a user build on each
    // other: concurrency 1 runs them one after the other, while the suites run side by side.
    const versions = vfoxVersions(process.env, DEFAULT_NATIVE_VFOX_VERSIONS);
    for (const vfox of versions) {
        describe(`vfox ${vfox}`, { concurrency: 1 }, () => vfoxSuite(vfox));
    }
    // One mirror test is enough: what it checks does not depend on the version of vfox, only on the first.
    describe(`mirror (vfox ${versions[0]})`, { concurrency: 1 }, () => mirrorSuite(versions[0] ?? "latest"));
});
