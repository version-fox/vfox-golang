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
import { execFileSync, spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { hostOs } from "../src/host.ts";
import { findExecutable } from "../src/native.ts";
import { PS_PRELUDE, psActivated, psEncode, psQuote, psScript } from "../src/powershell.ts";

// A PowerShell 7 to check the quoting against, where the machine has one: E2E_PWSH, or pwsh on the PATH.
const pwsh = process.env.E2E_PWSH?.trim() || findExecutable("pwsh", process.env.PATH ?? "", hostOs());
const needsPwsh = pwsh === undefined ? "no pwsh on the PATH, and E2E_PWSH is not set" : false;

/** What PowerShell makes of `script` the way the tests run it: its exit code and what it prints. */
function exit(script: string): { status: number | null; stdout: string } {
    const result = spawnSync(
        pwsh ?? "pwsh",
        ["-NoProfile", "-NonInteractive", "-EncodedCommand", psEncode(psScript(script))],
        {
            encoding: "utf8",
            env: { ...process.env, DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: "1" },
        },
    );
    return { status: result.status, stdout: result.stdout };
}

/** What PowerShell prints for `script`. */
function run(script: string): string {
    return execFileSync(pwsh ?? "pwsh", ["-NoProfile", "-NonInteractive", "-EncodedCommand", psEncode(script)], {
        encoding: "utf8",
        env: { ...process.env, DOTNET_SYSTEM_GLOBALIZATION_INVARIANT: "1" },
    });
}

describe("psQuote", () => {
    it("wraps a value in single quotes, which PowerShell takes literally", () => {
        assert.equal(psQuote("plain"), "'plain'");
        assert.equal(psQuote(""), "''");
        assert.equal(psQuote("C:\\Users\\John Doe\\.vfox"), "'C:\\Users\\John Doe\\.vfox'");
        assert.equal(psQuote("$HOME `x` $(id)"), "'$HOME `x` $(id)'");
    });

    it("doubles every kind of single quote, the curly ones included", () => {
        assert.equal(psQuote("it's"), "'it''s'");
        assert.equal(psQuote("\u2018a\u2019 \u201Ab\u201B"), "'\u2018\u2018a\u2019\u2019 \u201A\u201Ab\u201B\u201B'");
    });

    it("leaves the value to PowerShell as it is", { skip: needsPwsh }, () => {
        const value = "a 'b' \u2019c\u2019 $HOME `x` $(Get-Date) \"d\" ; e # f \\ g";
        assert.equal(run(`[Console]::Out.Write(${psQuote(value)})`), value);
    });
});

describe("psEncode", () => {
    it("is the UTF-16 of the script in Base64, which is what -EncodedCommand takes", () => {
        assert.equal(psEncode("a"), "YQA=");
        assert.equal(Buffer.from(psEncode("Write-Output 'é'"), "base64").toString("utf16le"), "Write-Output 'é'");
    });

    it("carries a script with quotes and newlines through the command line", { skip: needsPwsh }, () => {
        assert.equal(run("Write-Output \"a b\"\nWrite-Output 'c'"), "a b\nc\n");
    });
});

describe("PS_PRELUDE and psActivated", () => {
    it("make a failing command stop the script", () => {
        assert.match(PS_PRELUDE, /\$ErrorActionPreference = 'Stop'/);
        assert.match(PS_PRELUDE, /\$PSNativeCommandUseErrorActionPreference = \$true/);
    });

    it("activate vfox the way its quick start does", () => {
        assert.equal(psActivated("go version"), 'Invoke-Expression "$(vfox activate pwsh)"\ngo version');
    });

    it("stops at a native command that fails, and at a command that throws", { skip: needsPwsh }, () => {
        for (const failing of ["pwsh -NoProfile -Command 'exit 3'", "Get-Command definitely-not-a-command"]) {
            const result = exit(`${failing}\nWrite-Output 'not reached'`);
            assert.notEqual(result.status, 0, failing);
            assert.ok(!result.stdout.includes("not reached"), failing);
        }
    });

    it("does not fail for a command that finds nothing and was told to go on", { skip: needsPwsh }, () => {
        assert.equal(exit("Get-Command definitely-not-a-command -ErrorAction SilentlyContinue").status, 0);
        assert.equal(exit("Write-Output 'fine'").stdout, "fine\n");
    });
});
