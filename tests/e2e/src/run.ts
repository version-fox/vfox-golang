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
import { retryAttempts } from "./config.ts";
import { retry } from "./retry.ts";

export interface Run {
    /** The exit code of the script. */
    code: number;
    /** stdout and stderr in the order they were written, as `readable` shows them. */
    out: string;
}

export interface Attempt extends Run {
    /** Whether the attempt did what the caller was waiting for. */
    ok: boolean;
}

/** The environment variables of one run. The rest of the environment of the target is inherited. */
export type Env = Record<string, string>;

export function failure(what: string, script: string, run: Run): string {
    return `${what}\n--- script ---\n${script.trim()}\n--- exit code ${run.code} ---\n--- output ---\n${run.out}`;
}

/**
 * Waits for all the cleanups, even when one of them fails, and then fails with what went wrong. Whatever is
 * left over is a container, a network or a directory on the machine of the person running the tests.
 */
export async function cleanUp(...cleanups: Array<Promise<unknown> | undefined>): Promise<void> {
    const results = await Promise.allSettled(cleanups);
    const errors = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
    if (errors.length > 0) {
        throw new AggregateError(errors, `cleaning up failed: ${errors.map(String).join("; ")}`);
    }
}

/** Where the tests run scripts: a container, or this machine. What they ask of it is the same. */
export abstract class Runner {
    /** Runs `script` in a shell of its own and returns its exit code with the combined output. */
    abstract run(script: string, env?: Env): Promise<Run>;

    /** Runs `script` and fails the test unless it exits 0. */
    async ok(script: string, env: Env = {}): Promise<string> {
        const run = await this.run(script, env);
        assert.equal(run.code, 0, failure("the script failed", script, run));
        return run.out;
    }

    /**
     * Runs `script` until `accept` takes the result, trying again after a pause. The last attempt comes
     * back either way. For what touches the network, and for what has to fail in one particular way.
     */
    async until(label: string, script: string, env: Env, accept: (run: Run) => boolean): Promise<Attempt> {
        return retry(
            async () => {
                const run = await this.run(script, env);
                return { ...run, ok: accept(run) };
            },
            {
                attempts: retryAttempts(),
                onRetry: (failed, attempt) =>
                    console.error(`retrying ${label}: attempt ${failed} exited ${attempt.code}\n${attempt.out}`),
            },
        );
    }

    /** Runs `script` until it exits 0, and fails the test if it never does. */
    async retrying(label: string, script: string, env: Env = {}): Promise<string> {
        const attempt = await this.until(label, script, env, (run) => run.code === 0);
        assert.ok(attempt.ok, failure(`${label} failed after ${retryAttempts()} attempt(s)`, script, attempt));
        return attempt.out;
    }
}
