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
import { HELLO_GO, HELLO_MOD, helloLine } from "../src/hello.ts";

describe("the hello program", () => {
    it("is a module without a go directive, so that it builds on every release", () => {
        assert.equal(HELLO_MOD, "module example.com/hello\n");
        assert.ok(!HELLO_MOD.includes("go "));
    });

    it("prints the release, the system and the CPU that compiled it", () => {
        assert.match(HELLO_GO, /package main/);
        assert.match(HELLO_GO, /runtime\.Version\(\), runtime\.GOOS, runtime\.GOARCH/);
    });

    it("is what helloLine says it prints", () => {
        assert.equal(helloLine("1.24.0", "amd64"), "hello from go1.24.0 linux/amd64");
        assert.equal(helloLine("1.24.0", "arm64", "windows"), "hello from go1.24.0 windows/arm64");
    });
});
