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
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import { activated, escapeRegExp, readable, shQuote, stripAnsi } from "../src/shell.ts";

describe("shQuote", () => {
    it("wraps a value in single quotes", () => {
        assert.equal(shQuote("plain"), "'plain'");
        assert.equal(shQuote("a b"), "'a b'");
        assert.equal(shQuote(""), "''");
    });

    it("makes a single quote part of the value", () => {
        assert.equal(shQuote("it's"), `'it'\\''s'`);
    });

    it("leaves the value to the shell as it is", () => {
        const value = `a "b" $HOME \`id\` it's \\ ;`;
        assert.equal(execFileSync("bash", ["-c", `printf %s ${shQuote(value)}`], { encoding: "utf8" }), value);
    });
});

describe("stripAnsi", () => {
    it("removes colors", () => {
        assert.equal(stripAnsi("\u001b[94mgolang\u001b[0m"), "golang");
        assert.equal(
            stripAnsi("Add \u001b[92mgolang\u001b[0m plugin successfully! "),
            "Add golang plugin successfully! ",
        );
    });

    it("leaves plain text alone", () => {
        assert.equal(stripAnsi("go version go1.24.0 linux/amd64"), "go version go1.24.0 linux/amd64");
    });
});

describe("readable", () => {
    // What `vfox install` writes: the progress bar rewrites one line with carriage returns.
    const install =
        "Preinstalling golang@1.24.0...\n" +
        "Downloading...   1% [                    ] (5.7 MB/s) [0s:13s]\r" +
        "Downloading...  50% [=========>          ] (2.0 MB/s) [15s:19s]\r" +
        "Downloading... 100% [====================] (2.7 MB/s)\n" +
        "Verifying checksum dea9ca38a0b852a74e81c26134671af7c0fbe65d81b0dc1c5bfe22cf7d4c8858...\n" +
        "Install \u001b[92mgolang@1.24.0\u001b[0m success! \n";

    it("drops the download progress and the colors, and keeps the rest", () => {
        assert.equal(
            readable(install),
            "Preinstalling golang@1.24.0...\n" +
                "Verifying checksum dea9ca38a0b852a74e81c26134671af7c0fbe65d81b0dc1c5bfe22cf7d4c8858...\n" +
                "Install golang@1.24.0 success! \n",
        );
    });

    it("breaks lines at carriage returns, as a terminal shows them", () => {
        assert.equal(readable("a\rb\r\nc"), "a\nb\nc");
    });
});

describe("activated", () => {
    it("sets vfox up in the shell before the script", () => {
        assert.equal(activated("go version"), 'eval "$(vfox activate bash)"\ngo version');
    });
});

describe("escapeRegExp", () => {
    it("lets a version stand for itself in a pattern", () => {
        assert.match("golang@1.24.0 success", new RegExp(escapeRegExp("golang@1.24.0")));
        assert.doesNotMatch("golang@1x24x0", new RegExp(escapeRegExp("golang@1.24.0")));
    });
});
