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
import { containerName, NAME_PREFIX } from "../src/target.ts";

describe("containerName", () => {
    it("starts with the prefix that tells what a killed run left behind", () => {
        assert.ok(containerName("vfox-latest").startsWith(NAME_PREFIX));
        assert.match(containerName("vfox-latest"), /^vfox-golang-e2e-vfox-latest-[0-9a-f]{6}$/);
    });

    it("keeps to the characters Docker takes in a name", () => {
        assert.match(containerName("vfox 1.0.13 (main)"), /^vfox-golang-e2e-vfox-1\.0\.13--main--[0-9a-f]{6}$/);
    });

    it("is not the same for two containers of the same purpose, which may run at once", () => {
        assert.notEqual(containerName("mirror"), containerName("mirror"));
    });
});
