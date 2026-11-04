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

import type { GoArch, GoOs } from "./parse.ts";

/** The operating system of this machine, as Go names it. */
export function hostOs(platform: NodeJS.Platform = process.platform): GoOs {
    switch (platform) {
        case "win32":
            return "windows";
        case "linux":
            return "linux";
        case "darwin":
            return "darwin";
        default:
            throw new Error(`the E2E tests run on Windows, Linux and macOS, not on "${platform}"`);
    }
}

/** The CPU of this machine, as Go names it. */
export function hostArch(arch: string = process.arch): GoArch {
    switch (arch) {
        case "x64":
            return "amd64";
        case "arm64":
            return "arm64";
        default:
            throw new Error(`the E2E tests run on amd64 and arm64, not on "${arch}"`);
    }
}

/** What separates the entries of a PATH, and of a list of GOPATHs. */
export function pathDelimiter(os: GoOs): ";" | ":" {
    return os === "windows" ? ";" : ":";
}

/** The suffix of an executable. */
export function executableSuffix(os: GoOs): ".exe" | "" {
    return os === "windows" ? ".exe" : "";
}

export interface VfoxAsset {
    /** The file the release is published as. */
    file: string;
    /** The directory in it that holds `vfox`. */
    directory: string;
    /** The name of the executable. */
    executable: string;
    url: string;
}

/** Where a release of vfox for `os` and `arch` is published, and what is in it. */
export function vfoxAsset(version: string, os: GoOs, arch: GoArch): VfoxAsset {
    const name = os === "darwin" ? "macos" : os;
    const machine = arch === "amd64" ? "x86_64" : "aarch64";
    const directory = `vfox_${version}_${name}_${machine}`;
    const file = `${directory}.${os === "windows" ? "zip" : "tar.gz"}`;
    return {
        file,
        directory,
        executable: `vfox${executableSuffix(os)}`,
        url: `https://github.com/version-fox/vfox/releases/download/v${version}/${file}`,
    };
}

/** A path as a comparison sees it: one kind of slash, none at the end, and on Windows no difference of case. */
export function normalizedPath(path: string, os: GoOs): string {
    const slashes = path.replaceAll("\\", "/").replace(/\/+$/, "");
    return os === "windows" ? slashes.toLowerCase() : slashes;
}

/** Whether two paths name the same place, as far as their spelling goes. */
export function samePath(a: string, b: string, os: GoOs): boolean {
    return normalizedPath(a, os) === normalizedPath(b, os);
}

/** The entries of a PATH or a list of GOPATHs, normalized for comparison. */
export function pathEntries(value: string, os: GoOs): string[] {
    return value
        .split(pathDelimiter(os))
        .filter((entry) => entry !== "")
        .map((entry) => normalizedPath(entry, os));
}
