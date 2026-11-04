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

/**
 * A program that says which Go compiled it and for what. Its module has no go directive, so it builds on every release,
 * whatever toolchain a newer directive would ask for.
 */
export const HELLO_MOD = "module example.com/hello\n";

export const HELLO_GO = `package main

import (
\t"fmt"
\t"runtime"
)

func main() {
\tfmt.Printf("hello from %s %s/%s\\n", runtime.Version(), runtime.GOOS, runtime.GOARCH)
}
`;

/** What the program prints when release `version` of Go compiled it for `os` and `arch`. */
export function helloLine(version: string, arch: GoArch, os: GoOs = "linux"): string {
    return `hello from go${version} ${os}/${arch}`;
}
