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

import { readable } from "./shell.ts";

/** The CPU names Go goes by. */
export type GoArch = "amd64" | "arm64";

/** Go's name for what `uname --machine` prints. */
export function goArch(machine: string): GoArch {
    switch (machine.trim()) {
        case "x86_64":
            return "amd64";
        case "aarch64":
        case "arm64":
            return "arm64";
        default:
            throw new Error(`the E2E tests run on amd64 and arm64, not on "${machine.trim()}"`);
    }
}

/** The operating systems Go goes by: GOOS. */
export type GoOs = "linux" | "windows" | "darwin";

/** The file go.dev serves a release of Go as, which the plugin asks vfox to download: a zip on Windows. */
export function archiveName(version: string, arch: GoArch, os: GoOs = "linux"): string {
    return `go${version}.${os}-${arch}.${os === "windows" ? "zip" : "tar.gz"}`;
}

/** What `go version` prints for a release. */
export function goVersionLine(version: string, arch: GoArch, os: GoOs = "linux"): string {
    return `go version go${version} ${os}/${arch}`;
}

export interface Listed {
    version: string;
    /** What the plugin notes about the release: `stable` for the current ones, otherwise empty. */
    note: string;
}

/** The releases `vfox search golang` lists, in the order it lists them. */
export function searched(output: string): Listed[] {
    const listed: Listed[] = [];
    for (const line of readable(output).split("\n")) {
        const match = /^\s*-\s+(\S+?)(?:\s+\((.*)\))?\s*$/.exec(line);
        if (match?.[1] !== undefined) {
            listed.push({ version: match[1], note: match[2] ?? "" });
        }
    }
    return listed;
}

/** The digest `vfox install` verified a download against, which the plugin gave it. */
export function verifiedDigest(output: string): string | undefined {
    return /Verifying checksum ([0-9a-f]+)\.\.\./.exec(readable(output))?.[1];
}
