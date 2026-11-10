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

// The tool versions are written in more than one place: the dev container installs what the workflows
// install. Each place says to keep in step with the others; this test is what notices when one is not.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { REPO_ROOT } from "../src/config.ts";
import { escapeRegExp } from "../src/shell.ts";

const DOCKERFILE = ".devcontainer/Dockerfile";
const LINT = ".github/workflows/lint.yml";
const TEST = ".github/workflows/hooks-test.yml";
const LICENSE = ".github/workflows/license.yml";
const NODE_VERSION_FILE = "tests/e2e/.node-version";

function read(file: string): string {
    return readFileSync(join(REPO_ROOT, file), "utf8");
}

/** The value `name` is set to in `file`, as `ARG name=value` in a Dockerfile or `name: value` in a workflow. */
function pinned(file: string, name: string): string {
    const pattern = new RegExp(`^\\s*(?:ARG\\s+${escapeRegExp(name)}=|${escapeRegExp(name)}:\\s+)(\\S+)\\s*$`, "m");
    const value = pattern.exec(read(file))?.[1];
    assert.ok(value, `${file} pins no ${name}`);
    return value;
}

describe("the pinned versions", () => {
    const pins: Array<[name: string, files: string[]]> = [
        ["STYLUA_VERSION", [DOCKERFILE, LINT]],
        ["LUA_LANGUAGE_SERVER_VERSION", [DOCKERFILE, LINT]],
        ["VFOX_VERSION", [DOCKERFILE, TEST]],
        ["LICENSE_EYE_VERSION", [DOCKERFILE, LICENSE]],
    ];

    for (const [name, files] of pins) {
        it(`${name} is the same in ${files.join(" and ")}`, () => {
            const versions = files.map((file) => pinned(file, name));
            assert.ok(
                versions.every((version) => version === versions[0]),
                `${name} differs: ${files.map((file, index) => `${file} has ${versions[index]}`).join(", ")}`,
            );
        });
    }

    it(`the Node.js of the dev container is the one of ${NODE_VERSION_FILE}, which CI installs`, () => {
        assert.equal(pinned(DOCKERFILE, "NODE_VERSION"), read(NODE_VERSION_FILE).trim());
    });

    it("every pinned checksum is a SHA-256", () => {
        for (const [file, name] of [
            [LINT, "STYLUA_SHA256"],
            [LINT, "LUA_LANGUAGE_SERVER_SHA256"],
            [TEST, "VFOX_SHA256"],
        ] as const) {
            assert.match(pinned(file, name), /^[0-9a-f]{64}$/, `${name} in ${file}`);
        }
    });
});
