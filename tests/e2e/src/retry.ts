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

export interface RetryOptions<T> {
    /** How many times to try in all, the first included. */
    attempts: number;
    /** Milliseconds to wait after the given failed attempt (1, 2, ...). Linear, 10 s per attempt, by default. */
    delay?: (failed: number) => number;
    /** Replaced in the unit tests. */
    sleep?: (milliseconds: number) => Promise<void>;
    /** Called with every result that is about to be tried again. */
    onRetry?: (failed: number, result: T) => void;
}

const linear = (failed: number): number => failed * 10_000;
const wait = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Runs `run` until it reports `ok`, or until `attempts` tries are used up. The last result comes back
 * either way, so the caller decides what a failure means and still has its output to show.
 *
 * Downloads and daemon calls flake in throwaway containers, so everything that touches the network goes
 * through here.
 */
export async function retry<T extends { ok: boolean }>(
    run: (attempt: number) => Promise<T>,
    { attempts, delay = linear, sleep = wait, onRetry }: RetryOptions<T>,
): Promise<T> {
    let result = await run(1);
    for (let attempt = 1; !result.ok && attempt < Math.max(attempts, 1); attempt++) {
        onRetry?.(attempt, result);
        await sleep(delay(attempt));
        result = await run(attempt + 1);
    }
    return result;
}
