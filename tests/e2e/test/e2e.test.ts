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

// The container E2E suite of the vfox golang plugin, driven by testcontainers for Node.js.
//
// It builds the image in image/Dockerfile once, then starts one long-lived container per vfox version, and a
// pair for the mirror (a Go mirror's stand-in and a container that downloads through it). Each drives
// setup -> install -> verify through exec calls, and the steps of one container run in order. See docs/e2e.md.
//
// Run it from tests/e2e:   npm test
// Scope it down while iterating:   E2E_VFOX_VERSION=latest E2E_MAX_JOBS=1 npm test

import assert from "node:assert/strict";
import { after, before, describe } from "node:test";
import { Network, type StartedNetwork } from "testcontainers";
import { baseImage, checkoutPluginVersion, goVersion, maxJobs, PLUGIN_DIR, vfoxVersions } from "../src/config.ts";
import { HELLO_GO, HELLO_MOD, helloLine } from "../src/hello.ts";
import { type BuiltImage, buildImage } from "../src/image.ts";
import { MIRROR_URL, type Mirror, startMirror, TAMPERED_MIRROR_URL } from "../src/mirror.ts";
import { archiveName, type GoArch, goVersionLine, searched, verifiedDigest } from "../src/parse.ts";
import { cleanUp, type Env } from "../src/run.ts";
import { activated, escapeRegExp, shQuote } from "../src/shell.ts";
import { MINUTE, sequence } from "../src/steps.ts";
import { Target } from "../src/target.ts";
import { addPlugin, installVfox } from "../src/vfox.ts";

const go = goVersion();

/**
 * Where vfox keeps its files in the containers of the suites of a vfox version. The space is what a home directory
 * can have (C:\Users\John Doe), and what PostInstall used to break on. The mirror suite keeps the default.
 */
const VFOX_HOME_WITH_SPACE = "/root/John Doe/.vfox";

interface Toolchain {
    version: string | undefined;
    goroot: string | undefined;
    gopath: string | undefined;
    which: string | undefined;
    path: string[];
}

/** What a shell with vfox activated makes of Go: the release, GOROOT, GOPATH, the binary and the PATH. */
async function toolchain(target: Target, env: Env = {}): Promise<Toolchain> {
    const out = await target.ok(
        activated(`go version\ngo env GOROOT\ngo env GOPATH\ncommand -v go\necho "$PATH"`),
        env,
    );
    const [version, goroot, gopath, which, path] = out.trim().split("\n");
    return { version, goroot, gopath, which, path: (path ?? "").split(":") };
}

/**
 * Puts the program in the container. A module without a go directive builds on every release, whatever
 * toolchain a newer directive would ask for.
 */
async function putHello(target: Target): Promise<void> {
    await target.container.copyContentToContainer([
        { content: HELLO_MOD, target: "/work/hello/go.mod" },
        { content: HELLO_GO, target: "/work/hello/main.go" },
    ]);
}

/** Installs the program as a command, which the shell then finds by its name, and runs it. */
const INSTALL_AND_RUN_HELLO = activated("cd /work/hello\ngo install .\nhello");

/** One container, one version of vfox: the plugin from this checkout, a real Go release, the PATH and the GOPATH. */
function vfoxSuite(vfox: string, image: () => BuiltImage): void {
    const step = sequence();
    let target: Target;
    /** Where the release is installed. */
    let sdk: string;
    /** GOROOT as the plugin exports it: the link vfox makes to the selected release, set by the step that checks it. */
    let root: string;
    const hello = (arch: GoArch) => helloLine(go, arch);

    before(
        async () => {
            target = await Target.start(image().tag, `vfox-${vfox}`, { env: { VFOX_HOME: VFOX_HOME_WITH_SPACE } });
            await installVfox(target, vfox);
            await addPlugin(target);
            sdk = `${target.home}/cache/golang/v-${go}/golang-${go}`;
        },
        { timeout: 20 * MINUTE },
    );
    after(async () => {
        await target?.stop();
    });

    step("registers the plugin from this checkout", async (t) => {
        const version = await target.ok("vfox --version");
        const info = await target.ok("vfox info golang");
        assert.match(info, /Name\s+->\s+golang/);
        assert.match(info, new RegExp(`Version\\s+->\\s+${escapeRegExp(checkoutPluginVersion())}`));
        assert.match(info, /Homepage\s+->\s+https:\/\/github\.com\/version-fox\/vfox-golang/);
        t.diagnostic(`${version.trim()} with the golang plugin ${checkoutPluginVersion()}`);
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
        // Before the plugin read the variable, it downloaded from go.dev and the install succeeded.
        const url = `https://invalid.example.invalid/${archiveName(go, target.arch)}`;
        const attempt = await target.until(
            `vfox install golang@${go} through a mirror that does not exist`,
            `vfox install golang@${go}`,
            { VFOX_GOLANG_MIRROR: "https://invalid.example.invalid/" },
            // Any other failure, such as go.dev being out of reach, is tried again.
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
            // vfox hashes the file it downloaded and fails the install if the digest differs, so an install that
            // succeeds proves the digest is the file's. Without one it prints "Checksum is not provided".
            const digest = verifiedDigest(out);
            assert.match(digest ?? "", /^[0-9a-f]{64}$/, `vfox install ${spec} verified no SHA-256 digest\n${out}`);
            t.diagnostic(`${spec} was verified against ${digest}`);
        },
        { timeout: 10 * MINUTE },
    );

    step("creates the bin directory of the default GOPATH", async () => {
        // PostInstall's shell command: `go install` would create it, but the PATH names it before then.
        await target.ok(`test -d ${shQuote(`${sdk}/packages/bin`)}`);
    });

    step("selects the release", async () => {
        const used = await target.ok(activated(`vfox use --global golang@${go}`));
        assert.match(used, new RegExp(`golang@${escapeRegExp(go)}`));
        const current = await target.ok(activated("vfox current golang"));
        assert.match(current, new RegExp(escapeRegExp(go)));
    });

    step("puts the release on the PATH, with GOROOT and the default GOPATH", async () => {
        const found = await toolchain(target);
        assert.equal(found.version, goVersionLine(go, target.arch), "the archive must be the runner's");
        // vfox links the selected release as sdks/golang under ~/.vfox, which VFOX_HOME does not move (vfox 1.0.13
        // keeps only plugin and cache there). GOROOT is that link, and it leads to the release that was installed.
        root = found.goroot ?? "";
        assert.match(root, /\/sdks\/golang$/, "GOROOT is the link of the selected release");
        assert.equal((await target.ok(`readlink -f ${shQuote(root)}`)).trim(), sdk, "GOROOT leads to the release");
        assert.equal(found.gopath, `${root}/packages`);
        assert.equal(found.which, `${root}/bin/go`);
        const bin = found.path.indexOf(`${root}/bin`);
        assert.notEqual(bin, -1, `${root}/bin is not on the PATH`);
        assert.equal(found.path[bin + 1], `${root}/packages/bin`, "the bin directory of the GOPATH follows GOROOT's");
    });

    step("compiles and runs a program, and installs a command into the GOPATH", async () => {
        await putHello(target);
        const run = await target.ok(activated("cd /work/hello\ngo run ."));
        assert.equal(run.trim(), hello(target.arch));
        const installed = await target.ok(INSTALL_AND_RUN_HELLO);
        assert.equal(installed.trim(), hello(target.arch), "the command is found on the PATH by its name");
        await target.ok(`test -x ${shQuote(`${sdk}/packages/bin/hello`)}`);
    });

    step("VFOX_GOLANG_GOPATH replaces the GOPATH and its bin directory", async () => {
        const env = { VFOX_GOLANG_GOPATH: "/shared/go" };
        const found = await toolchain(target, env);
        assert.equal(found.gopath, "/shared/go");
        assert.equal(found.goroot, root, "GOROOT stays with the release");
        assert.ok(found.path.includes("/shared/go/bin"), "the bin directory of the GOPATH is on the PATH");
        assert.ok(found.path.includes(`${root}/bin`), "the bin directory of the release is on the PATH");
        assert.ok(!found.path.includes(`${root}/packages/bin`), "the default GOPATH is no longer on the PATH");
        const installed = await target.ok(INSTALL_AND_RUN_HELLO, env);
        assert.equal(installed.trim(), hello(target.arch));
        await target.ok("test -x /shared/go/bin/hello");
    });

    step("VFOX_GOLANG_GOPATH takes several paths, and puts each bin directory on the PATH", async () => {
        const found = await toolchain(target, { VFOX_GOLANG_GOPATH: "/shared/go:/other/go" });
        assert.equal(found.gopath, "/shared/go:/other/go");
        const first = found.path.indexOf("/shared/go/bin");
        assert.notEqual(first, -1, "/shared/go/bin is not on the PATH");
        assert.equal(found.path[first + 1], "/other/go/bin");
    });

    step("does not inherit a GOPATH from the environment", async () => {
        // A GOPATH in the environment may be the previous vfox SDK's, which the new one must not keep.
        const found = await toolchain(target, { GOPATH: "/previous/sdk/packages" });
        assert.equal(found.gopath, `${root}/packages`);
        assert.ok(!found.path.includes("/previous/sdk/packages/bin"));
    });

    step("fails to install a release that does not exist, and says which and where", async () => {
        // The plugin used to return an empty result for these, and vfox then printed `Install golang@ success!`,
        // exited with 0 and installed nothing. 1.24 and 1 are no releases: go.dev names them 1.24.0 and 1.27.3.
        for (const version of ["1.99.99", "1.24", "1"]) {
            const message = `No Go release found for "${version}" on linux/${target.arch}`;
            const attempt = await target.until(
                `vfox install golang@${version} (must fail)`,
                `vfox install golang@${version}`,
                {},
                // Any other failure, such as go.dev being out of reach, is tried again.
                (run) => run.code !== 0 && run.out.includes(message),
            );
            assert.ok(attempt.ok, `vfox install golang@${version} must fail with "${message}"\n${attempt.out}`);
        }
        // Nor does the attempt leave the directory of an install without a version behind.
        await target.ok(`test ! -e ${shQuote(`${target.home}/cache/golang/v-`)}`);
    });

    step("creates the bin directory in an SDK path with a space and a quote in it", async () => {
        // PostInstall used to leave its mkdir without quotes, which made one directory out of each word.
        const path = "/work/it's John Doe/sdk";
        const input = JSON.stringify({ sdkInfo: { golang: { name: "golang", version: "1.0.0", path } } });
        // Run from a directory of its own, where the stray directories of an unquoted path would land.
        const out = await target.ok(
            [
                "set -o errexit",
                "mkdir -p /work/gap && cd /work/gap",
                `vfox plugin run ${PLUGIN_DIR} PostInstall --input ${shQuote(input)}`,
                `test -d ${shQuote(`${path}/packages/bin`)}`,
                'test -z "$(ls -A /work/gap)" || { echo "left in $PWD: $(ls -A)"; exit 1; }',
            ].join("\n"),
        );
        assert.ok(!out.includes("left in"), out);
    });
}

/** A container that downloads through a stand-in for a Go mirror: one that serves the archives, and one that does not. */
function mirrorSuite(vfox: string, image: () => BuiltImage): void {
    const step = sequence();
    let network: StartedNetwork;
    let mirror: Mirror;
    let target: Target;

    before(
        async () => {
            network = await new Network().start();
            mirror = await startMirror(network);
            target = await Target.start(image().tag, "mirror", { network });
            await installVfox(target, vfox);
            await addPlugin(target);
        },
        { timeout: 20 * MINUTE },
    );
    after(async () => {
        try {
            await cleanUp(target?.stop(), mirror?.stop());
        } finally {
            // The network can go only when nothing is on it.
            await network?.stop();
        }
    });

    step(
        "installs the newest release through the mirror",
        async (t) => {
            const listed = searched(await target.retrying("vfox search golang", "vfox search golang"));
            const newest = listed[0]?.version;
            assert.ok(newest, "vfox search golang lists no release");

            const out = await target.retrying("vfox install golang@latest", "vfox install golang@latest", {
                VFOX_GOLANG_MIRROR: MIRROR_URL,
            });
            assert.match(verifiedDigest(out) ?? "", /^[0-9a-f]{64}$/, `the download was not verified\n${out}`);

            // The archive came from the mirror, under the name go.dev gives it.
            const file = archiveName(newest, target.arch);
            const log = await mirror.accessLog();
            assert.match(
                log,
                new RegExp(`"GET /${escapeRegExp(file)} HTTP/1\\.[01]" 20[06]`),
                `the mirror was never asked for ${file}\n--- access log ---\n${log}`,
            );

            // `latest` is the newest release the search lists, and what the mirror served runs.
            await target.ok(activated(`vfox use --global golang@${newest}`));
            const found = await toolchain(target);
            assert.equal(found.version, goVersionLine(newest, target.arch));
            t.diagnostic(`golang@latest is go${newest}, downloaded through the mirror`);
        },
        { timeout: 15 * MINUTE },
    );

    step("refuses a download that does not match the checksum", async () => {
        // The mirror serves something else under the name of the archive. vfox hashes it against the checksum
        // the plugin passed from go.dev, so the plugin has to keep passing one.
        const run = await target.run(`vfox install golang@${go}`, { VFOX_GOLANG_MIRROR: TAMPERED_MIRROR_URL });
        assert.notEqual(run.code, 0, `the install must fail\n${run.out}`);
        assert.match(run.out, /Checksum error/);
        const log = await mirror.accessLog();
        assert.ok(
            log.includes(`GET /tampered/${archiveName(go, target.arch)} `),
            "the download must have gone to the mirror",
        );
    });
}

describe("vfox golang plugin", { concurrency: maxJobs() }, () => {
    let image: BuiltImage;
    const built = (): BuiltImage => image;

    before(
        async () => {
            image = await buildImage(baseImage());
        },
        { timeout: 20 * MINUTE },
    );
    after(async () => {
        await image?.remove();
    });

    // A suite takes the concurrency of the one around it unless it sets its own, and the steps of a container
    // build on each other: concurrency 1 runs them one after the other, while the suites run side by side.
    const versions = vfoxVersions();
    for (const vfox of versions) {
        describe(`vfox ${vfox}`, { concurrency: 1 }, () => vfoxSuite(vfox, built));
    }
    // One mirror test is enough: what it checks does not depend on the version of vfox, only on the first.
    describe(`mirror (vfox ${versions[0]})`, { concurrency: 1 }, () => mirrorSuite(versions[0] ?? "latest", built));
});
