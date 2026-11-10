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
import {
    executableSuffix,
    hostArch,
    hostOs,
    normalizedPath,
    pathDelimiter,
    pathEntries,
    samePath,
    vfoxAsset,
} from "../src/host.ts";

describe("hostOs and hostArch", () => {
    it("name the machine as Go does", () => {
        assert.equal(hostOs("win32"), "windows");
        assert.equal(hostOs("linux"), "linux");
        assert.equal(hostOs("darwin"), "darwin");
        assert.equal(hostArch("x64"), "amd64");
        assert.equal(hostArch("arm64"), "arm64");
    });

    it("refuse a machine the suite has no release of vfox and Go for", () => {
        assert.throws(() => hostOs("aix"), /Windows, Linux and macOS, not on "aix"/);
        assert.throws(() => hostArch("ia32"), /amd64 and arm64, not on "ia32"/);
    });
});

describe("pathDelimiter and executableSuffix", () => {
    it("are the ones of Windows, and those of everything else", () => {
        assert.equal(pathDelimiter("windows"), ";");
        assert.equal(pathDelimiter("linux"), ":");
        assert.equal(pathDelimiter("darwin"), ":");
        assert.equal(executableSuffix("windows"), ".exe");
        assert.equal(executableSuffix("linux"), "");
    });
});

describe("vfoxAsset", () => {
    it("is a zip with vfox.exe in it on Windows, for each CPU", () => {
        assert.deepEqual(vfoxAsset("1.0.13", "windows", "amd64"), {
            file: "vfox_1.0.13_windows_x86_64.zip",
            directory: "vfox_1.0.13_windows_x86_64",
            executable: "vfox.exe",
            url: "https://github.com/version-fox/vfox/releases/download/v1.0.13/vfox_1.0.13_windows_x86_64.zip",
        });
        assert.equal(vfoxAsset("1.0.13", "windows", "arm64").file, "vfox_1.0.13_windows_aarch64.zip");
    });

    it("is a tar.gz with vfox in it elsewhere, and macOS is called macos", () => {
        assert.equal(vfoxAsset("1.0.13", "linux", "amd64").file, "vfox_1.0.13_linux_x86_64.tar.gz");
        assert.equal(vfoxAsset("1.0.13", "linux", "arm64").executable, "vfox");
        assert.equal(vfoxAsset("1.0.13", "darwin", "arm64").file, "vfox_1.0.13_macos_aarch64.tar.gz");
    });
});

describe("normalizedPath and samePath", () => {
    it("treat both slashes alike, and drop the one at the end", () => {
        assert.equal(normalizedPath("C:\\Users\\John Doe\\.vfox\\", "linux"), "C:/Users/John Doe/.vfox");
        assert.equal(normalizedPath("/a/b//", "linux"), "/a/b");
    });

    it("ignore the case of a path on Windows only", () => {
        assert.ok(samePath("C:\\Users\\RUNNER\\go/bin", "c:/users/runner/GO\\bin", "windows"));
        assert.ok(!samePath("/Home/me", "/home/me", "linux"));
    });

    it("tell two places apart", () => {
        assert.ok(!samePath("C:\\a\\b", "C:\\a\\c", "windows"));
    });
});

describe("pathEntries", () => {
    it("splits at the delimiter of the platform, and drops what is empty", () => {
        assert.deepEqual(pathEntries("C:\\Go Work;;D:\\Go\\", "windows"), ["c:/go work", "d:/go"]);
        assert.deepEqual(pathEntries("/shared/go:/other/go/", "linux"), ["/shared/go", "/other/go"]);
        assert.deepEqual(pathEntries("", "linux"), []);
    });
});
