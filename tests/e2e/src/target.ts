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
import { randomBytes } from "node:crypto";
import { statSync } from "node:fs";
import { join } from "node:path";
import { GenericContainer, type StartedNetwork, type StartedTestContainer } from "testcontainers";
import { PLUGIN_DIR, PLUGIN_FILES, REPO_ROOT } from "./config.ts";
import { type GoArch, goArch } from "./parse.ts";
import { type Env, type Run, Runner } from "./run.ts";
import { readable } from "./shell.ts";

/** Every container the tests start carries this prefix, so what a killed run leaves behind can be pruned. */
export const NAME_PREFIX = "vfox-golang-e2e-";

/** A name no other run uses at the same time. */
export function containerName(purpose: string): string {
    return `${NAME_PREFIX}${purpose.replace(/[^a-zA-Z0-9_.-]/g, "-")}-${randomBytes(3).toString("hex")}`;
}

/** Runs `script` in a bash of its own in `container`, and returns its exit code with the combined output. */
async function execIn(container: StartedTestContainer, script: string, env: Env = {}): Promise<Run> {
    // The exec API demultiplexes the two streams on its own and does not keep their order. Joined by the
    // shell, stdout alone is the order the script wrote them in.
    const result = await container.exec(["bash", "-c", `exec 2>&1\n${script}`], { env });
    return { code: result.exitCode, out: readable(result.stdout) };
}

/** A long-lived container that the tests drive through exec calls. */
export class Target extends Runner {
    readonly container: StartedTestContainer;
    readonly arch: GoArch;
    /** Where vfox keeps its files in the container: VFOX_HOME, or ~/.vfox. */
    readonly home: string;

    private constructor(container: StartedTestContainer, arch: GoArch, home: string) {
        super();
        this.container = container;
        this.arch = arch;
        this.home = home;
    }

    /**
     * Starts a container of `image` with this checkout's plugin copied into it. `env` is set for everything that
     * runs in it, `VFOX_HOME` for one, and `network` is the one it joins.
     */
    static async start(
        image: string,
        purpose: string,
        { network, env }: { network?: StartedNetwork; env?: Env } = {},
    ): Promise<Target> {
        let container = new GenericContainer(image).withName(containerName(purpose));
        if (network !== undefined) {
            container = container.withNetwork(network);
        }
        if (env !== undefined) {
            container = container.withEnvironment(env);
        }
        const files = PLUGIN_FILES.filter((name) => statSync(join(REPO_ROOT, name)).isFile());
        const directories = PLUGIN_FILES.filter((name) => statSync(join(REPO_ROOT, name)).isDirectory());
        const started = await container
            .withCopyFilesToContainer(
                files.map((name) => ({ source: join(REPO_ROOT, name), target: `${PLUGIN_DIR}/${name}` })),
            )
            .withCopyDirectoriesToContainer(
                directories.map((name) => ({ source: join(REPO_ROOT, name), target: `${PLUGIN_DIR}/${name}` })),
            )
            .start();
        try {
            const machine = await execIn(started, "uname --machine");
            // The directory of vfox exists before vfox runs, as it does for a user who set VFOX_HOME: vfox 1.0.13 does
            // not make the directory a plugin is added to when VFOX_HOME is not its default.
            const home = await execIn(
                started,
                `mkdir -p "\${VFOX_HOME:-$HOME/.vfox}" && echo "\${VFOX_HOME:-$HOME/.vfox}"`,
            );
            assert.ok(
                machine.code === 0 && home.code === 0,
                `the container does not answer\n${machine.out}\n${home.out}`,
            );
            return new Target(started, goArch(machine.out), home.out.trim());
        } catch (error) {
            // Nobody holds the container yet to stop it.
            await started.stop();
            throw error;
        }
    }

    override run(script: string, env: Env = {}): Promise<Run> {
        return execIn(this.container, script, env);
    }

    async stop(): Promise<void> {
        await this.container.stop();
    }
}
