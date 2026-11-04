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
import { retry } from "../src/retry.ts";

/** A `sleep` that records the pauses instead of making them. */
function pauses(): { sleep: (milliseconds: number) => Promise<void>; waited: number[] } {
    const waited: number[] = [];
    return {
        waited,
        sleep: async (milliseconds) => {
            waited.push(milliseconds);
        },
    };
}

describe("retry", () => {
    it("returns the first attempt that succeeds, without a pause", async () => {
        const { sleep, waited } = pauses();
        const result = await retry(async (attempt) => ({ ok: true, attempt }), { attempts: 3, sleep });
        assert.deepEqual(result, { ok: true, attempt: 1 });
        assert.deepEqual(waited, []);
    });

    it("tries again after a failure, and stops at the first success", async () => {
        const { sleep, waited } = pauses();
        const result = await retry(async (attempt) => ({ ok: attempt === 3, attempt }), { attempts: 5, sleep });
        assert.deepEqual(result, { ok: true, attempt: 3 });
        assert.equal(waited.length, 2);
    });

    it("gives the last failure back when the attempts run out, for the caller to report", async () => {
        const { sleep, waited } = pauses();
        const result = await retry(async (attempt) => ({ ok: false, attempt }), { attempts: 3, sleep });
        assert.deepEqual(result, { ok: false, attempt: 3 });
        assert.equal(waited.length, 2, "there is no pause after the last attempt");
    });

    it("waits 10 s after the first failure, 20 s after the second, and so on", async () => {
        const { sleep, waited } = pauses();
        await retry(async () => ({ ok: false }), { attempts: 4, sleep });
        assert.deepEqual(waited, [10_000, 20_000, 30_000]);
    });

    it("takes another schedule", async () => {
        const { sleep, waited } = pauses();
        await retry(async () => ({ ok: false }), { attempts: 3, sleep, delay: () => 5 });
        assert.deepEqual(waited, [5, 5]);
    });

    it("tells onRetry about each failure that is tried again, but not the last", async () => {
        const { sleep } = pauses();
        const told: number[] = [];
        await retry(async (attempt) => ({ ok: false, attempt }), {
            attempts: 3,
            sleep,
            onRetry: (failed, result) => told.push(failed * 10 + result.attempt),
        });
        assert.deepEqual(told, [11, 22]);
    });

    it("runs once even when asked for fewer attempts", async () => {
        const { sleep, waited } = pauses();
        let runs = 0;
        await retry(
            async () => {
                runs++;
                return { ok: false };
            },
            { attempts: 0, sleep },
        );
        assert.equal(runs, 1);
        assert.deepEqual(waited, []);
    });
});
