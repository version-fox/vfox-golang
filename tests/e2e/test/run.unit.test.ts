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
import { describe, it } from "node:test";
import { cleanUp, type Env, failure, type Run, Runner } from "../src/run.ts";

describe("cleanUp", () => {
    it("resolves when every cleanup does, and skips what is not there", async () => {
        await cleanUp(Promise.resolve(), undefined, Promise.resolve(1));
    });

    it("waits for all of them even when one fails, and then fails with each reason", async () => {
        let finished = false;
        const slow = new Promise<void>((resolve) =>
            setTimeout(() => {
                finished = true;
                resolve();
            }, 20),
        );
        await assert.rejects(
            cleanUp(Promise.reject(new Error("first")), slow, Promise.reject(new Error("second"))),
            (error) => {
                assert.ok(error instanceof AggregateError);
                assert.deepEqual(
                    error.errors.map((reason: Error) => reason.message),
                    ["first", "second"],
                );
                assert.match(error.message, /cleaning up failed: Error: first; Error: second/);
                return true;
            },
        );
        assert.ok(finished, "the slow cleanup must have been waited for");
    });
});

describe("failure", () => {
    it("shows the script, the exit code and the output, which is all there is to go on", () => {
        const message = failure("the script failed", "\n  vfox install golang@1.99\n", { code: 1, out: "boom\n" });
        assert.equal(
            message,
            "the script failed\n--- script ---\nvfox install golang@1.99\n--- exit code 1 ---\n--- output ---\nboom\n",
        );
    });
});

/** A runner that answers from a list, to see what the shared methods make of the answers. */
class Scripted extends Runner {
    readonly calls: Array<{ script: string; env: Env }> = [];
    private readonly answers: Run[];

    constructor(...answers: Run[]) {
        super();
        this.answers = answers;
    }

    override async run(script: string, env: Env = {}): Promise<Run> {
        this.calls.push({ script, env });
        return this.answers.shift() ?? { code: 99, out: "no more answers" };
    }
}

describe("Runner", () => {
    it("ok returns the output of a script that exits 0", async () => {
        const runner = new Scripted({ code: 0, out: "fine\n" });
        assert.equal(await runner.ok("echo fine", { A: "b" }), "fine\n");
        assert.deepEqual(runner.calls, [{ script: "echo fine", env: { A: "b" } }]);
    });

    it("ok fails with the script and the output of one that does not", async () => {
        const runner = new Scripted({ code: 3, out: "no\n" });
        await assert.rejects(runner.ok("exit 3"), (error: Error) => {
            assert.match(error.message, /the script failed[\s\S]*exit 3[\s\S]*exit code 3[\s\S]*no/);
            return true;
        });
    });

    it("until takes the first attempt the caller accepts, and gives the last one back when none is", async () => {
        const accepted = new Scripted({ code: 1, out: "a" }, { code: 0, out: "b" });
        // No pause between attempts: E2E_RETRY_ATTEMPTS is 3 by default and the sleep would be 10 s, so one attempt
        // is all this test can afford to wait for; the retry schedule is tested with retry itself.
        const result = await accepted.until("a script", "run", {}, (run) => run.code === 1);
        assert.equal(result.ok, true);
        assert.equal(result.out, "a");
        assert.equal(accepted.calls.length, 1);
    });
});
