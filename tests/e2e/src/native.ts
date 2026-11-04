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
import { spawn, spawnSync } from "node:child_process";
import { accessSync, constants, createWriteStream, statSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";
import { PLUGIN_FILES, REPO_DIR, retryAttempts } from "./config.ts";
import { hostArch, hostOs, pathDelimiter, vfoxAsset } from "./host.ts";
import type { GoArch, GoOs } from "./parse.ts";
import { psEncode, psQuote, psScript } from "./powershell.ts";
import { retry } from "./retry.ts";
import { type Env, type Run, Runner } from "./run.ts";
import { readable } from "./shell.ts";

/** A script that runs longer than this is stuck. */
const RUN_TIMEOUT = 15 * 60_000;

/** `vfox use` and `vfox unuse` with the flag of the global scope, in any of their spellings. */
const GLOBAL_SCOPE = /\bvfox\s+(?:use|u|unuse)\b[^\n\r;|&]*?\s(?:--global|-g)(?=[\s=]|$)/i;

/**
 * Fails for a script that selects, or unselects, a release globally. On Windows vfox then writes Path, and the variables of
 * the release (GOROOT and GOPATH), into the registry of the user (HKCU\Environment), which the home directory of a
 * made-up user does not redirect: they would stay on the machine of the person who runs the tests, pointing into a
 * directory that is gone, over the GOROOT and GOPATH they may have set. The suite selects the release for a project
 * instead, which vfox keeps in a directory of the suite.
 */
export function assertNoGlobalScope(script: string): void {
    assert.ok(
        !GLOBAL_SCOPE.test(script),
        `a script must not use vfox in the global scope: on Windows that changes the registry of the machine\n--- script ---\n${script.trim()}`,
    );
}

type Source = Readonly<Record<string, string | undefined>>;

/** The value of a variable of the environment, whatever the case of its name: Windows has no difference. */
function lookup(source: Source, name: string): string | undefined {
    const key = Object.keys(source).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
    return key === undefined ? undefined : source[key];
}

/** The directories a PowerShell and the tools of the system are found in. */
export function systemPath(os: GoOs, source: Source): string[] {
    if (os !== "windows") {
        return ["/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];
    }
    const root = lookup(source, "SystemRoot") ?? lookup(source, "windir") ?? "C:\\Windows";
    return [
        `${root}\\System32`,
        root,
        `${root}\\System32\\Wbem`,
        `${root}\\System32\\WindowsPowerShell\\v1.0`,
        `${root}\\System32\\OpenSSH`,
    ];
}

/** What is not passed on to the scripts: it either belongs to Go or vfox, or the tests set it themselves. */
const NOT_PASSED_ON =
    /^(GO.*|VFOX_.*|__VFOX_.*|HOME|USERPROFILE|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|XDG_.*|PATH|TMP|TEMP|TMPDIR)$/i;

export interface IsolatedEnvOptions {
    os: GoOs;
    /** The environment of the tests, the one to start from. */
    source: Source;
    /** The home directory of the user the scripts run as. */
    userHome: string;
    /** Where the temporary files of the scripts go. */
    tmp: string;
    /** The directories at the front of the PATH, before those of the system. */
    path: string[];
}

/**
 * The environment of the scripts: that of the tests, without anything of Go and vfox that the machine has, with a home
 * directory of their own, and with a PATH of the system and nothing else.
 *
 * The images of the GitHub runners come with Go, and with GOROOT, GOPATH and a PATH to go with them, and a person who
 * develops this plugin has one installed through vfox. A `go` of the machine in front of the one the plugin installs would
 * make the tests pass or fail for the wrong reason.
 */
export function isolatedEnv({ os, source, userHome, tmp, path }: IsolatedEnvOptions): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = {};
    for (const [name, value] of Object.entries(source)) {
        if (value !== undefined && !NOT_PASSED_ON.test(name)) {
            env[name] = value;
        }
    }
    return {
        ...env,
        HOME: userHome,
        USERPROFILE: userHome,
        APPDATA: join(userHome, "AppData", "Roaming"),
        LOCALAPPDATA: join(userHome, "AppData", "Local"),
        TMP: tmp,
        TEMP: tmp,
        TMPDIR: tmp,
        PATH: [...path, ...systemPath(os, source)].join(pathDelimiter(os)),
    };
}

/**
 * The first file called `name` in a directory of `searchPath` that can be run; on Windows with one of the suffixes of
 * PATHEXT.
 */
export function findExecutable(
    name: string,
    searchPath: string,
    os: GoOs,
    pathExt = ".COM;.EXE;.BAT;.CMD",
): string | undefined {
    const suffixes = os === "windows" ? ["", ...pathExt.split(";").filter((suffix) => suffix !== "")] : [""];
    for (const directory of searchPath.split(pathDelimiter(os))) {
        for (const suffix of suffixes) {
            if (directory === "") {
                continue;
            }
            const candidate = join(directory, name + suffix);
            try {
                accessSync(candidate, constants.X_OK);
                if (statSync(candidate).isFile()) {
                    return candidate;
                }
            } catch {
                // Not here.
            }
        }
    }
    return undefined;
}

/** PowerShell 7.4 is the first to stop a script at a native command that fails, which the prelude of the scripts relies on. */
export function powerShellIsNewEnough(version: string): boolean {
    const [major = 0, minor = 0] = version.trim().split(".").map(Number);
    return major > 7 || (major === 7 && minor >= 4);
}

/** PowerShell 7, which the scripts are written for: E2E_PWSH names it, or it is on the PATH. */
function findPowerShell(os: GoOs): string {
    const named = process.env.E2E_PWSH?.trim();
    const found = named ? named : findExecutable("pwsh", process.env.PATH ?? "", os, process.env.PATHEXT);
    assert.ok(found, "PowerShell 7 (pwsh) is needed: put it on the PATH, or name it in E2E_PWSH");
    return found;
}

/**
 * This machine, driven through PowerShell 7. For the platforms that have no Linux container: Windows, where vfox keeps its
 * files in the home directory of a user, which here is a directory of its own with a space in it (`C:\Users\John Doe`) or
 * not, and which the tests remove when they are through.
 */
export class NativeTarget extends Runner {
    readonly os: GoOs;
    readonly arch: GoArch;
    /** The directory everything of this target is in. */
    readonly root: string;
    /** The home directory of the user the scripts run as. */
    readonly userHome: string;
    /** Where vfox keeps its files: ~/.vfox. */
    readonly home: string;
    /** Where the executable of vfox is. */
    readonly bin: string;
    /**
     * The working directory of the scripts, and the project that vfox selects a release for: `vfox use --project` keeps
     * its files here, and the shells that activate vfox start here.
     */
    readonly work: string;
    private readonly pwsh: string;
    private readonly env: NodeJS.ProcessEnv;

    private constructor(init: {
        os: GoOs;
        arch: GoArch;
        root: string;
        userHome: string;
        pwsh: string;
        env: NodeJS.ProcessEnv;
    }) {
        super();
        this.os = init.os;
        this.arch = init.arch;
        this.root = init.root;
        this.userHome = init.userHome;
        this.home = join(init.userHome, ".vfox");
        this.bin = join(init.root, "bin");
        this.work = join(init.root, "work");
        this.pwsh = init.pwsh;
        this.env = init.env;
    }

    /** Makes the directories of a user, `spaced` for one whose name has a space in it. */
    static async create({ spaced }: { spaced: boolean }): Promise<NativeTarget> {
        const os = hostOs();
        const pwsh = findPowerShell(os);
        // The long form of the name: Windows runners hand out the short one (RUNNER~1), which no tool agrees on.
        const base = await realpath(process.env.RUNNER_TEMP ?? tmpdir());
        const root = await mkdtemp(join(base, "vfox-golang-e2e-"));
        try {
            const userHome = join(root, spaced ? "John Doe" : "user");
            const tmp = join(root, "tmp");
            const bin = join(root, "bin");
            for (const directory of [
                join(userHome, ".vfox"),
                join(userHome, "AppData", "Roaming"),
                join(userHome, "AppData", "Local"),
                tmp,
                bin,
                join(root, "work"),
            ]) {
                await mkdir(directory, { recursive: true });
            }
            const env = isolatedEnv({ os, source: process.env, userHome, tmp, path: [bin, dirname(pwsh)] });
            const version = spawnSync(
                pwsh,
                ["-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion.ToString()"],
                {
                    encoding: "utf8",
                    env,
                },
            ).stdout;
            assert.ok(
                powerShellIsNewEnough(version ?? ""),
                `PowerShell 7.4 or later is needed, and ${pwsh} is "${version?.trim()}"`,
            );
            return new NativeTarget({ os, arch: hostArch(), root, userHome, pwsh, env });
        } catch (error) {
            await rm(root, { recursive: true, force: true });
            throw error;
        }
    }

    /** `parts` under the root of this target. */
    path(...parts: string[]): string {
        return join(this.root, ...parts);
    }

    override async run(script: string, env: Env = {}): Promise<Run> {
        assertNoGlobalScope(script);
        return new Promise((resolve, reject) => {
            const child = spawn(
                this.pwsh,
                ["-NoProfile", "-NonInteractive", "-EncodedCommand", psEncode(psScript(script))],
                {
                    env: { ...this.env, ...env },
                    cwd: this.work,
                    windowsHide: true,
                    stdio: ["ignore", "pipe", "pipe"],
                    signal: AbortSignal.timeout(RUN_TIMEOUT),
                },
            );
            // The two streams, in the order the chunks come. The script writes both to one console, and so does a person.
            const chunks: Buffer[] = [];
            child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
            child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
            const output = () => readable(Buffer.concat(chunks).toString("utf8"));
            child.on("error", (error) => {
                if (error.name === "AbortError") {
                    resolve({ code: -1, out: `${output()}\ntimed out after ${RUN_TIMEOUT / 60_000} minutes` });
                } else {
                    reject(error);
                }
            });
            child.on("close", (code) => resolve({ code: code ?? -1, out: output() }));
        });
    }

    /** Removes everything of this target. */
    async stop(): Promise<void> {
        await removeDirectory(this.root);
    }
}

/**
 * Removes `directory` with its contents, trying again for a while, and reports what it cannot remove instead of failing:
 * Windows keeps a file that a process still has open, or that a virus scanner is reading, and a suite whose steps all
 * passed is no failure for that. The directory is in the temporary directory, where the runner, or the person who ran the
 * tests, removes it, and the message says which.
 */
export async function removeDirectory(directory: string, remove: typeof rm = rm): Promise<void> {
    try {
        await remove(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    } catch (error) {
        console.error(`could not remove ${directory}, which is left behind: ${String(error)}`);
    }
}

async function downloadTo(url: string, file: string): Promise<void> {
    const result = await retry(
        async () => {
            try {
                const response = await fetch(url);
                if (!response.ok || response.body === null) {
                    return { ok: false, why: `${url} answered with status ${response.status}` };
                }
                await pipeline(Readable.fromWeb(response.body as ReadableStream), createWriteStream(file));
                return { ok: true, why: "" };
            } catch (error) {
                return { ok: false, why: `${url}: ${String(error)}` };
            }
        },
        {
            attempts: retryAttempts(),
            onRetry: (failed, attempt) =>
                console.error(`retrying the download of ${url}: attempt ${failed}: ${attempt.why}`),
        },
    );
    assert.ok(result.ok, `downloading failed: ${result.why}`);
}

/** The release GitHub calls the latest of vfox. Its redirect says which, without the rate limit of the GitHub API. */
export async function latestVfoxVersion(): Promise<string> {
    const result = await retry(
        async () => {
            try {
                const response = await fetch("https://github.com/version-fox/vfox/releases/latest", { method: "HEAD" });
                const version = /\/releases\/tag\/v(\d+\.\d+\.\d+)$/.exec(response.url)?.[1];
                return version === undefined
                    ? { ok: false, version: "", why: `the redirect went to ${response.url}` }
                    : { ok: true, version, why: "" };
            } catch (error) {
                return { ok: false, version: "", why: String(error) };
            }
        },
        {
            attempts: retryAttempts(),
            onRetry: (failed, attempt) =>
                console.error(`retrying the lookup of the latest vfox: ${attempt.why} (${failed})`),
        },
    );
    assert.ok(result.ok, `cannot tell the latest release of vfox: ${result.why}`);
    return result.version;
}

/** Installs a release of vfox into the `bin` of the target, and returns what `vfox --version` prints. */
export async function installNativeVfox(target: NativeTarget, version: string): Promise<string> {
    // Building main takes a Go, which the machine that runs these tests has to do without (see isolatedEnv).
    assert.notEqual(
        version,
        "main",
        "vfox main is built with Go, so the native tests take a release: latest, or 1.0.13",
    );
    const resolved = version === "latest" ? await latestVfoxVersion() : version;
    const asset = vfoxAsset(resolved, target.os, target.arch);
    const archive = target.path(asset.file);
    const extracted = target.path("vfox-release");
    await downloadTo(asset.url, archive);
    await mkdir(extracted, { recursive: true });
    await target.ok(
        target.os === "windows"
            ? `Expand-Archive -LiteralPath ${psQuote(archive)} -DestinationPath ${psQuote(extracted)} -Force`
            : `tar -xzf ${psQuote(archive)} -C ${psQuote(extracted)}`,
    );
    await target.ok(
        `Copy-Item -LiteralPath ${psQuote(join(extracted, asset.directory, asset.executable))} -Destination ${psQuote(target.bin)}`,
    );
    return (await target.ok("vfox --version")).trim();
}

/** Registers this checkout as the golang plugin, the way docs/install-from-source.md says to. */
export async function addNativePlugin(target: NativeTarget): Promise<void> {
    const zip = target.path("golang.zip");
    const files = PLUGIN_FILES.join(" ");
    await target.ok(
        target.os === "windows"
            ? `tar.exe -a -cf ${psQuote(zip)} -C ${psQuote(REPO_DIR)} ${files}`
            : `Set-Location -LiteralPath ${psQuote(REPO_DIR)}\nzip -qr ${psQuote(zip)} ${files}`,
    );
    await target.ok(`vfox add golang --source ${psQuote(zip)}`);
}
