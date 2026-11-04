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
    baseImage,
    checkoutPluginVersion,
    DEFAULT_BASE_IMAGE,
    DEFAULT_GO_VERSION,
    DEFAULT_NATIVE_VFOX_VERSIONS,
    goVersion,
    maxJobs,
    pluginVersion,
    positiveInteger,
    retryAttempts,
    vfoxVersions,
} from "../src/config.ts";

describe("positiveInteger", () => {
    it("falls back when the variable is unset or blank", () => {
        assert.equal(positiveInteger("E2E_MAX_JOBS", undefined, 3), 3);
        assert.equal(positiveInteger("E2E_MAX_JOBS", "", 3), 3);
        assert.equal(positiveInteger("E2E_MAX_JOBS", "  ", 3), 3);
    });

    it("reads a positive integer", () => {
        assert.equal(positiveInteger("E2E_MAX_JOBS", "1", 3), 1);
        assert.equal(positiveInteger("E2E_MAX_JOBS", " 12 ", 3), 12);
    });

    it("rejects anything else by name instead of running with a surprise", () => {
        for (const value of ["0", "-1", "1.5", "two", "3x"]) {
            assert.throws(() => positiveInteger("E2E_MAX_JOBS", value, 3), /E2E_MAX_JOBS must be a positive integer/);
        }
    });
});

describe("the knobs", () => {
    it("default to 3 containers at a time and 3 attempts", () => {
        assert.equal(maxJobs({}), 3);
        assert.equal(retryAttempts({}), 3);
    });

    it("read E2E_MAX_JOBS and E2E_RETRY_ATTEMPTS", () => {
        assert.equal(maxJobs({ E2E_MAX_JOBS: "1" }), 1);
        assert.equal(retryAttempts({ E2E_RETRY_ATTEMPTS: "5" }), 5);
    });

    it("default to Ubuntu and the pinned Go release", () => {
        assert.equal(baseImage({}), DEFAULT_BASE_IMAGE);
        assert.equal(goVersion({}), DEFAULT_GO_VERSION);
    });

    it("read E2E_BASE_IMAGE and E2E_GO_VERSION", () => {
        assert.equal(baseImage({ E2E_BASE_IMAGE: "debian:trixie" }), "debian:trixie");
        assert.equal(goVersion({ E2E_GO_VERSION: "1.21" }), "1.21");
        assert.equal(goVersion({ E2E_GO_VERSION: " 1.26.10 " }), "1.26.10");
    });

    it("refuse a Go version that go.dev has no release of", () => {
        for (const value of ["latest", "go1.24.0", "1.24.0rc1", "1"]) {
            assert.throws(() => goVersion({ E2E_GO_VERSION: value }), /E2E_GO_VERSION takes a Go release/);
        }
    });
});

describe("vfoxVersions", () => {
    it("runs the latest release and the main branch by default", () => {
        assert.deepEqual(vfoxVersions({}), ["latest", "main"]);
        assert.deepEqual(vfoxVersions({ E2E_VFOX_VERSION: "" }), ["latest", "main"]);
    });

    it("takes space-separated versions, each once", () => {
        assert.deepEqual(vfoxVersions({ E2E_VFOX_VERSION: "main  1.0.13 main" }), ["main", "1.0.13"]);
        assert.deepEqual(vfoxVersions({ E2E_VFOX_VERSION: "latest" }), ["latest"]);
    });

    it("takes the fallback of the tests that run on the machine itself, which build no vfox", () => {
        assert.deepEqual(vfoxVersions({}, DEFAULT_NATIVE_VFOX_VERSIONS), ["latest"]);
        assert.deepEqual(vfoxVersions({ E2E_VFOX_VERSION: "1.0.13" }, DEFAULT_NATIVE_VFOX_VERSIONS), ["1.0.13"]);
    });

    it("refuses what is neither a channel nor a release", () => {
        for (const value of ["stable", "v1.0.13", "1.0", "latest,main"]) {
            assert.throws(() => vfoxVersions({ E2E_VFOX_VERSION: value }), /E2E_VFOX_VERSION takes/);
        }
    });
});

describe("pluginVersion", () => {
    it("reads the version metadata.lua declares", () => {
        const metadata = 'PLUGIN = {}\n--- Plugin version\nPLUGIN.version = "0.4.1"\nPLUGIN.homepage = "https://x"\n';
        assert.equal(pluginVersion(metadata), "0.4.1");
    });

    it("fails on a metadata.lua without one", () => {
        assert.throws(() => pluginVersion("PLUGIN = {}\n-- PLUGIN.version = nil\n"), /sets no PLUGIN.version/);
    });

    it("reads the one of this checkout", () => {
        assert.match(checkoutPluginVersion(), /^\d+\.\d+\.\d+$/);
    });
});
