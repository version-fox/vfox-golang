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

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export type Env = Readonly<Record<string, string | undefined>>;

/** The repository root; this file is tests/e2e/src/config.ts. */
export const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** The repository root without the slash at its end, which would make an argument of a Windows command line end in `\"`. */
export const REPO_DIR = REPO_ROOT.replace(/[\\/]+$/, "");

/** The build context of the image the tests run in. */
export const IMAGE_CONTEXT = fileURLToPath(new URL("../image/", import.meta.url));

/** What vfox adds as the plugin, from a zip of exactly these (docs/install-from-source.md). */
export const PLUGIN_FILES = ["metadata.lua", "hooks", "lib"] as const;

/** Where the tests copy the plugin to inside a container. */
export const PLUGIN_DIR = "/e2e";

/** The Docker image that builds vfox's main branch. It never runs the plugin, so no Go reaches a test container. */
export const VFOX_BUILDER_IMAGE = "golang:1.27.1";

export const DEFAULT_VFOX_VERSIONS = "latest main";
/** The tests that run on the machine itself build no vfox from source: that takes a Go, which the machine has to do without. */
export const DEFAULT_NATIVE_VFOX_VERSIONS = "latest";
export const DEFAULT_GO_VERSION = "1.24.0";
export const DEFAULT_BASE_IMAGE = "ubuntu:26.04";

/** Reads a positive integer from an environment variable, and fails loudly on anything else. */
export function positiveInteger(name: string, value: string | undefined, fallback: number): number {
    if (value === undefined || value.trim() === "") {
        return fallback;
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`${name} must be a positive integer, got "${value}"`);
    }
    return parsed;
}

/** Containers running at the same time (E2E_MAX_JOBS). */
export function maxJobs(env: Env = process.env): number {
    return positiveInteger("E2E_MAX_JOBS", env.E2E_MAX_JOBS, 3);
}

/** Attempts of a command that touches the network (E2E_RETRY_ATTEMPTS). */
export function retryAttempts(env: Env = process.env): number {
    return positiveInteger("E2E_RETRY_ATTEMPTS", env.E2E_RETRY_ATTEMPTS, 3);
}

const VFOX_VERSION = /^(latest|main|\d+\.\d+\.\d+)$/;

/** The vfox versions to run against (E2E_VFOX_VERSION): `latest`, `main` or a release such as `1.0.13`. */
export function vfoxVersions(env: Env = process.env, fallback: string = DEFAULT_VFOX_VERSIONS): string[] {
    const requested = env.E2E_VFOX_VERSION?.trim() || fallback;
    const versions = [...new Set(requested.split(/\s+/))];
    for (const version of versions) {
        if (!VFOX_VERSION.test(version)) {
            throw new Error(`E2E_VFOX_VERSION takes "latest", "main" or a release such as 1.0.13, got "${version}"`);
        }
    }
    return versions;
}

const GO_VERSION = /^\d+\.\d+(\.\d+)?$/;

/** The Go release installed through the plugin (E2E_GO_VERSION). */
export function goVersion(env: Env = process.env): string {
    const version = env.E2E_GO_VERSION?.trim() || DEFAULT_GO_VERSION;
    if (!GO_VERSION.test(version)) {
        throw new Error(`E2E_GO_VERSION takes a Go release such as 1.24.0, got "${version}"`);
    }
    return version;
}

/** The image the test containers are built from (E2E_BASE_IMAGE). It needs apt. */
export function baseImage(env: Env = process.env): string {
    return env.E2E_BASE_IMAGE?.trim() || DEFAULT_BASE_IMAGE;
}

/** The plugin version a metadata.lua declares. */
export function pluginVersion(metadata: string): string {
    const version = /^PLUGIN\.version\s*=\s*"([^"]+)"/m.exec(metadata)?.[1];
    if (version === undefined) {
        throw new Error("metadata.lua sets no PLUGIN.version");
    }
    return version;
}

/** The plugin version of this checkout, which `vfox info golang` must report. */
export function checkoutPluginVersion(): string {
    return pluginVersion(readFileSync(join(REPO_ROOT, "metadata.lua"), "utf8"));
}
