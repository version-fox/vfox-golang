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
import { chmod, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it, mock } from "node:test";
import {
    assertNoGlobalScope,
    findExecutable,
    isolatedEnv,
    powerShellIsNewEnough,
    removeDirectory,
    systemPath,
} from "../src/native.ts";

describe("systemPath", () => {
    it("is the directories of the system on Linux and macOS", () => {
        assert.deepEqual(systemPath("linux", {}), ["/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"]);
    });

    it("is under SystemRoot on Windows, whatever the case of its name", () => {
        const expected = [
            "D:\\Win\\System32",
            "D:\\Win",
            "D:\\Win\\System32\\Wbem",
            "D:\\Win\\System32\\WindowsPowerShell\\v1.0",
            "D:\\Win\\System32\\OpenSSH",
        ];
        assert.deepEqual(systemPath("windows", { SystemRoot: "D:\\Win" }), expected);
        assert.deepEqual(systemPath("windows", { SYSTEMROOT: "D:\\Win" }), expected);
        assert.equal(systemPath("windows", {})[0], "C:\\Windows\\System32");
    });
});

describe("isolatedEnv", () => {
    // What a machine with a Go and a hooked vfox has in its environment (and what a GitHub runner has of Go).
    const source = {
        GOROOT: "/home/me/.vfox/sdks/golang",
        GOPATH: "/home/me/.vfox/sdks/golang/packages",
        GOROOT_1_24_X64: "/opt/hostedtoolcache/go/1.24.0/x64",
        GOFLAGS: "-mod=mod",
        GOTOOLCHAIN: "local",
        VFOX_GOLANG_MIRROR: "https://mirrors.aliyun.com/golang/",
        VFOX_HOME: "/home/me/.vfox",
        __VFOX_PID: "624",
        __VFOX_SHELL: "bash",
        HOME: "/home/me",
        USERPROFILE: "C:\\Users\\me",
        XDG_RUNTIME_DIR: "/run/user/1000",
        PATH: "/home/me/.vfox/sdks/golang/bin:/usr/bin",
        TMPDIR: "/tmp",
        SystemRoot: "C:\\Windows",
        DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: "1",
        RUNNER_TEMP: "/home/runner/work/_temp",
        EMPTY: undefined,
    };
    const env = isolatedEnv({
        os: "linux",
        source,
        userHome: "/work/John Doe",
        tmp: "/work/tmp",
        path: ["/work/bin", "/opt/pwsh"],
    });

    it("leaves out everything of Go and vfox that the machine has", () => {
        for (const name of [
            "GOROOT",
            "GOPATH",
            "GOROOT_1_24_X64",
            "GOFLAGS",
            "GOTOOLCHAIN",
            "VFOX_GOLANG_MIRROR",
            "VFOX_HOME",
            "__VFOX_PID",
            "__VFOX_SHELL",
            "XDG_RUNTIME_DIR",
        ]) {
            assert.equal(env[name], undefined, `${name} must not get through`);
        }
    });

    it("gives the user a home directory, and a temporary directory, of their own", () => {
        assert.equal(env.HOME, "/work/John Doe");
        assert.equal(env.USERPROFILE, "/work/John Doe");
        assert.equal(env.APPDATA, join("/work/John Doe", "AppData", "Roaming"));
        assert.equal(env.LOCALAPPDATA, join("/work/John Doe", "AppData", "Local"));
        assert.equal(env.TMP, "/work/tmp");
        assert.equal(env.TEMP, "/work/tmp");
        assert.equal(env.TMPDIR, "/work/tmp");
    });

    it("has a PATH of vfox, PowerShell and the system, and no other", () => {
        assert.equal(env.PATH, "/work/bin:/opt/pwsh:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin");
    });

    it("keeps what PowerShell and the system need, and what the runner says", () => {
        assert.equal(env.DOTNET_SYSTEM_GLOBALIZATION_INVARIANT, "1");
        assert.equal(env.SystemRoot, "C:\\Windows");
        assert.equal(env.RUNNER_TEMP, "/home/runner/work/_temp");
        assert.ok(!("EMPTY" in env));
    });

    it("joins the PATH of Windows with a semicolon, and drops the variables whatever the case of their names", () => {
        const windows = isolatedEnv({
            os: "windows",
            source: { Path: "C:\\Program Files\\Go\\bin", gopath: "C:\\Users\\me\\go", SystemRoot: "C:\\Windows" },
            userHome: "C:\\t\\John Doe",
            tmp: "C:\\t\\tmp",
            path: ["C:\\t\\bin"],
        });
        assert.equal(windows.gopath, undefined);
        assert.equal(windows.Path, undefined);
        assert.ok(!String(windows.PATH).includes("Program Files"));
        assert.ok(String(windows.PATH).startsWith("C:\\t\\bin;C:\\Windows\\System32;"));
    });
});

describe("findExecutable", () => {
    let directory: string;
    before(async () => {
        directory = await mkdtemp(join(tmpdir(), "find-executable-"));
        await mkdir(join(directory, "first"));
        await mkdir(join(directory, "second"));
        await mkdir(join(directory, "first", "folder"));
        await writeFile(join(directory, "second", "tool"), "#!/bin/sh\n");
        await chmod(join(directory, "second", "tool"), 0o755);
        await writeFile(join(directory, "first", "plain"), "not executable\n");
        await chmod(join(directory, "first", "plain"), 0o644);
        await writeFile(join(directory, "second", "tool2.EXE"), "MZ");
        await chmod(join(directory, "second", "tool2.EXE"), 0o755);
    });
    after(async () => {
        await rm(directory, { recursive: true, force: true });
    });

    it("finds the file in the first directory that has it", () => {
        const searchPath = [join(directory, "first"), join(directory, "second")].join(":");
        assert.equal(findExecutable("tool", searchPath, "linux"), join(directory, "second", "tool"));
    });

    it("passes over what cannot be run, and what is a directory", () => {
        const searchPath = [join(directory, "first"), join(directory, "second")].join(":");
        assert.equal(findExecutable("plain", searchPath, "linux"), undefined);
        assert.equal(findExecutable("folder", searchPath, "linux"), undefined);
        assert.equal(findExecutable("missing", searchPath, "linux"), undefined);
        assert.equal(findExecutable("tool", "", "linux"), undefined);
    });

    it("tries the suffixes of PATHEXT on Windows", () => {
        const searchPath = join(directory, "second");
        assert.equal(
            findExecutable("tool2", searchPath, "windows", ".COM;.EXE"),
            join(directory, "second", "tool2.EXE"),
        );
        assert.equal(findExecutable("tool2", searchPath, "linux"), undefined);
    });
});

describe("powerShellIsNewEnough", () => {
    it("wants 7.4, the first PowerShell that stops a script at a native command that fails", () => {
        for (const version of ["7.4.0", "7.5.1", "7.6.9\n", "8.0.0"]) {
            assert.ok(powerShellIsNewEnough(version), version);
        }
        for (const version of ["7.3.12", "7.0.0", "5.1.26100.1", "", "not a version"]) {
            assert.ok(!powerShellIsNewEnough(version), version);
        }
    });
});

describe("assertNoGlobalScope", () => {
    it("lets a script select a release for the session or a project, and look at it", () => {
        for (const script of [
            "vfox use golang@1.24.0",
            "vfox use --project golang@1.24.0",
            "vfox use -p golang@1.24.0",
            "vfox use --session golang@1.24.0",
            "vfox current golang",
            "vfox install golang@1.24.0",
            'Invoke-Expression "$(vfox activate pwsh)"\nvfox use --project golang@1.24.0\ngo version',
        ]) {
            assert.doesNotThrow(() => assertNoGlobalScope(script), script);
        }
    });

    it("stops a script that uses vfox in the global scope, which writes the registry on Windows", () => {
        for (const script of [
            "vfox use --global golang@1.24.0",
            "vfox use -g golang@1.24.0",
            "vfox use golang@1.24.0 --global",
            "vfox use --global=true golang@1.24.0",
            "vfox u -g golang@1.24.0",
            "vfox unuse --global golang",
            "VFOX USE --GLOBAL golang@1.24.0",
            'Invoke-Expression "$(vfox activate pwsh)"\nvfox use -g golang@1.24.0',
            "Set-Location x; vfox use --global golang@1.24.0",
            "cd x && vfox use -g golang@1.24.0",
        ]) {
            assert.throws(() => assertNoGlobalScope(script), /global scope.*registry/s, script);
        }
    });

    it("says which script it stopped", () => {
        assert.throws(
            () => assertNoGlobalScope("vfox use -g golang@1.24.0"),
            /--- script ---\nvfox use -g golang@1.24.0/,
        );
    });
});

describe("removeDirectory", () => {
    it("removes a directory with what is in it, and one that is not there", async () => {
        const directory = await mkdtemp(join(tmpdir(), "remove-directory-"));
        await mkdir(join(directory, "a", "b"), { recursive: true });
        await writeFile(join(directory, "a", "b", "file"), "x");
        await removeDirectory(directory);
        await assert.rejects(stat(directory), { code: "ENOENT" });
        await removeDirectory(directory);
    });

    it("reports a directory it cannot remove, and does not fail", async () => {
        const report = mock.method(console, "error", () => {});
        try {
            const refusing = (async () => {
                throw new Error("EBUSY: resource busy or locked");
            }) as typeof rm;
            await removeDirectory("/tmp/vfox-golang-e2e-left", refusing);
            assert.equal(report.mock.callCount(), 1);
            assert.match(
                String(report.mock.calls[0]?.arguments[0]),
                /could not remove \/tmp\/vfox-golang-e2e-left.*EBUSY/,
            );
        } finally {
            report.mock.restore();
        }
    });

    it("tries again for a while before it gives up", async () => {
        let options: unknown;
        const remove = (async (_path: unknown, given: unknown) => {
            options = given;
        }) as typeof rm;
        await removeDirectory("/tmp/anywhere", remove);
        assert.deepEqual(options, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    });
});
