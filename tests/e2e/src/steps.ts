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

import { it, type TestContext, type TestOptions } from "node:test";

export const MINUTE = 60_000;

/**
 * `it` for steps that build on each other: once one fails, the rest are skipped rather than fail for the same
 * reason. A step that takes longer than ten minutes, unless it says it may, is stuck.
 */
export function sequence(): (title: string, step: (t: TestContext) => Promise<void>, options?: TestOptions) => void {
    let failed = false;
    return (title, step, options = {}) => {
        it(title, { timeout: 10 * MINUTE, ...options }, async (t) => {
            if (failed) {
                t.skip("an earlier step failed");
                return;
            }
            try {
                await step(t);
            } catch (error) {
                failed = true;
                throw error;
            }
        });
    };
}
