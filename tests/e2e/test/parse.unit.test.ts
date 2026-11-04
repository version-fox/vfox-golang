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
import { archiveName, goArch, goVersionLine, searched, verifiedDigest } from "../src/parse.ts";

describe("goArch", () => {
    it("names the CPU as Go does", () => {
        assert.equal(goArch("x86_64\n"), "amd64");
        assert.equal(goArch("aarch64"), "arm64");
        assert.equal(goArch("arm64"), "arm64");
    });

    it("refuses a CPU that go.dev has no Linux release for among the runners", () => {
        assert.throws(() => goArch("riscv64"), /amd64 and arm64, not on "riscv64"/);
    });
});

describe("archiveName and goVersionLine", () => {
    it("name the file the plugin downloads and what go reports", () => {
        assert.equal(archiveName("1.24.0", "amd64"), "go1.24.0.linux-amd64.tar.gz");
        assert.equal(archiveName("1.27.3", "arm64"), "go1.27.3.linux-arm64.tar.gz");
        assert.equal(goVersionLine("1.24.0", "amd64"), "go version go1.24.0 linux/amd64");
    });

    it("know the other platforms: a zip on Windows, and the names Go gives them", () => {
        assert.equal(archiveName("1.24.0", "amd64", "windows"), "go1.24.0.windows-amd64.zip");
        assert.equal(archiveName("1.24.0", "arm64", "windows"), "go1.24.0.windows-arm64.zip");
        assert.equal(archiveName("1.24.0", "arm64", "darwin"), "go1.24.0.darwin-arm64.tar.gz");
        assert.equal(goVersionLine("1.24.0", "arm64", "windows"), "go version go1.24.0 windows/arm64");
        assert.equal(goVersionLine("1.20", "arm64", "darwin"), "go version go1.20 darwin/arm64");
    });
});

describe("searched", () => {
    // What `vfox search golang` prints without a terminal (2026-11-04).
    const output = [
        "Available versions:",
        " - 1.27.3 (stable)",
        " - 1.26.10 (stable)",
        " - 1.27.2",
        " - 1.27.1",
        " - 1.3rc2",
        " - 1.9.2rc2",
        "",
    ].join("\n");

    it("lists the releases in the order of the output, with the note of each", () => {
        assert.deepEqual(searched(output), [
            { version: "1.27.3", note: "stable" },
            { version: "1.26.10", note: "stable" },
            { version: "1.27.2", note: "" },
            { version: "1.27.1", note: "" },
            { version: "1.3rc2", note: "" },
            { version: "1.9.2rc2", note: "" },
        ]);
    });

    it("ignores the heading and the colors", () => {
        assert.deepEqual(searched("\u001b[94mAvailable versions:\u001b[0m\n - \u001b[92m1.27.3\u001b[0m (stable)\n"), [
            { version: "1.27.3", note: "stable" },
        ]);
    });

    it("lists nothing for an output without releases", () => {
        assert.deepEqual(searched("No available versions\n"), []);
    });
});

describe("verifiedDigest", () => {
    const digest = "dea9ca38a0b852a74e81c26134671af7c0fbe65d81b0dc1c5bfe22cf7d4c8858";

    it("finds the digest vfox verified the download against", () => {
        assert.equal(
            verifiedDigest(`Preinstalling golang@1.24.0...\nVerifying checksum ${digest}...\nUnpacking /x.tar.gz...\n`),
            digest,
        );
    });

    it("finds it behind the progress bar", () => {
        assert.equal(verifiedDigest(`Downloading... 100% [=====]\nVerifying checksum ${digest}...\n`), digest);
    });

    it("finds none when vfox was given no checksum", () => {
        assert.equal(verifiedDigest("WARNING: Checksum is not provided, skip verify...\n"), undefined);
    });
});
