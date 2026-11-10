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

/**
 * Quotes `value` as a literal string of PowerShell. Besides the apostrophe, PowerShell takes the curly single
 * quotes for quotes too, and a quote is doubled to stand for itself.
 */
export function psQuote(value: string): string {
    return `'${value.replace(/['‘’‚‛]/g, "$&$&")}'`;
}

/** `script` as PowerShell takes it with -EncodedCommand: UTF-16 in Base64, which needs no quoting on any command line. */
export function psEncode(script: string): string {
    return Buffer.from(script, "utf16le").toString("base64");
}

/**
 * What every script starts with. A failing command stops the script, as `set -o errexit` does in bash, native
 * commands included (PowerShell 7.4 and later); the progress bar of a download is not drawn; and the output is UTF-8.
 */
export const PS_PRELUDE = [
    "$ErrorActionPreference = 'Stop'",
    "$PSNativeCommandUseErrorActionPreference = $true",
    "$ProgressPreference = 'SilentlyContinue'",
    "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)",
    "",
].join("\n");

/**
 * The whole of what is run for `script`. It fails only by a terminating error, which the prelude makes of a failing
 * command; the exit code of PowerShell is otherwise that of the last statement, and a `Get-Command` that finds nothing
 * leaves 1 behind however silently it was told to continue.
 */
export function psScript(script: string): string {
    return `${PS_PRELUDE}${script}\nexit 0\n`;
}

/**
 * Prefixes `script` with the vfox setup of a PowerShell, the line vfox's quick start has users put in their
 * profile. Every run starts a PowerShell of its own, so it has to wrap each call.
 */
export function psActivated(script: string): string {
    return `Invoke-Expression "$(vfox activate pwsh)"\n${script}`;
}
