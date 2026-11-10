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

import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { GenericContainer } from "testcontainers";
import { PLUGIN_DIR, PLUGIN_FILES, retryAttempts, VFOX_BUILDER_IMAGE } from "./config.ts";
import { retry } from "./retry.ts";
import { readable, shQuote } from "./shell.ts";
import { containerName, type Target } from "./target.ts";

/** Downloads a release of vfox into /usr/local/bin. `latest` is whichever release GitHub calls the latest. */
function downloadScript(version: string): string {
    return `
set -o errexit -o nounset -o pipefail
version=${shQuote(version)}
if [ "$version" = latest ]; then
    # The redirect of /releases/latest names the release without the rate limit of the GitHub API.
    url=$(curl --fail --silent --show-error --location --head --output /dev/null \\
        --write-out '%{url_effective}' https://github.com/version-fox/vfox/releases/latest)
    version=\${url##*/v}
fi
name="vfox_\${version}_linux_$(uname --machine)"
curl --fail --silent --show-error --location --output /tmp/vfox.tar.gz \\
    "https://github.com/version-fox/vfox/releases/download/v\${version}/\${name}.tar.gz"
tar --extract --gzip --file /tmp/vfox.tar.gz --directory /usr/local/bin --strip-components=1 "\${name}/vfox"
rm --force /tmp/vfox.tar.gz
`;
}

const MAIN_SCRIPT = `
set -o errexit -o nounset -o pipefail
rm --recursive --force /src
git clone --depth 1 https://github.com/version-fox/vfox /src
cd /src
CGO_ENABLED=0 go build -trimpath -o /out/vfox .
`;

async function collect(stream: NodeJS.ReadableStream): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

let main: Promise<Buffer> | undefined;

/**
 * The main branch of vfox as a tar holding its binary, built the first time it is asked for and then
 * shared. It is built in a container of its own: the containers that run the plugin have no Go in them,
 * so that `go` can only come from the plugin.
 */
export function vfoxMain(): Promise<Buffer> {
    main ??= buildMain();
    return main;
}

async function buildMain(): Promise<Buffer> {
    const builder = await new GenericContainer(VFOX_BUILDER_IMAGE)
        .withName(containerName("vfox-main"))
        .withCommand(["sleep", "infinity"])
        .start();
    try {
        const built = await retry(
            async () => {
                const result = await builder.exec(["bash", "-c", `exec 2>&1\n${MAIN_SCRIPT}`]);
                return { ok: result.exitCode === 0, out: readable(result.stdout) };
            },
            {
                attempts: retryAttempts(),
                onRetry: (failed, attempt) =>
                    console.error(`retrying the build of vfox main: attempt ${failed}\n${attempt.out}`),
            },
        );
        assert.ok(built.ok, `building vfox main failed\n--- output ---\n${built.out}`);
        return await collect(await builder.copyArchiveFromContainer("/out/vfox"));
    } finally {
        await builder.stop();
    }
}

/** Installs vfox, a release or the main branch, and returns what `vfox --version` prints. */
export async function installVfox(target: Target, version: string): Promise<string> {
    if (version === "main") {
        await target.container.copyArchiveToContainer(Readable.from(await vfoxMain()), "/usr/local/bin");
    } else {
        await target.retrying(`installing vfox ${version}`, downloadScript(version));
    }
    return (await target.ok("vfox --version")).trim();
}

/** Registers this checkout as the golang plugin, the way docs/install-from-source.md says to. */
export async function addPlugin(target: Target): Promise<void> {
    // errexit: the exit code of a script is the one of its last command, which must not hide a failed `vfox add`.
    await target.ok(`
set -o errexit -o nounset -o pipefail
work=$(mktemp --directory)
(cd ${PLUGIN_DIR} && zip -qr "$work/golang.zip" ${PLUGIN_FILES.join(" ")})
vfox add golang --source "$work/golang.zip"
rm --recursive --force "$work"
`);
}
