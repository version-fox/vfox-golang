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

/** Quotes `value` as one word of a POSIX shell command. */
export function shQuote(value: string): string {
    return `'${value.replaceAll("'", `'\\''`)}'`;
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: the ESC that opens an ANSI sequence is what this matches
const ANSI_SEQUENCE = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

/** Removes the colors vfox prints. */
export function stripAnsi(text: string): string {
    return text.replace(ANSI_SEQUENCE, "");
}

/** vfox draws its download progress by rewriting one line with carriage returns. */
const PROGRESS = /^Downloading\.\.\./;

/**
 * Output as a person would read it from a log: without colors, one line per line, and without the
 * download progress, which would bury everything else.
 */
export function readable(text: string): string {
    return stripAnsi(text)
        .split(/\r\n|\r|\n/)
        .filter((line) => !PROGRESS.test(line))
        .join("\n");
}

/**
 * Prefixes `script` with the vfox setup of a shell. Every exec starts a fresh shell, so activation cannot
 * persist and has to wrap each call: `vfox use` stops with "vfox requires hook support" without it, and the
 * variables and the PATH entries of the plugin reach a shell only through it, so `go` is found only after it.
 */
export function activated(script: string): string {
    return `eval "$(vfox activate bash)"\n${script}`;
}

/** Escapes `text` for use inside a regular expression. */
export function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
