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

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream } from "node:stream/web";

/** Where the archives of Go are, which go.dev sends its downloads to. */
export const GO_DOWNLOADS = "https://dl.google.com/go/";

export interface MirrorServer {
    /** A VFOX_GOLANG_MIRROR value for the mirror that serves the archives. */
    url: string;
    /** One for the mirror that serves something else under their names. */
    tamperedUrl: string;
    /** What the mirror has been asked for, as `GET /go1.24.0.windows-amd64.zip 200`. */
    requests: string[];
    stop(): Promise<void>;
}

async function serve(request: IncomingMessage, response: ServerResponse, upstream: string, requests: string[]) {
    const path = request.url ?? "/";
    const method = request.method === "HEAD" ? "HEAD" : "GET";
    if (path.startsWith("/tampered/")) {
        response.writeHead(200, { "content-type": "application/octet-stream" });
        response.end(method === "HEAD" ? undefined : "this is not a Go toolchain\n");
        requests.push(`${method} ${path} 200`);
        return;
    }
    try {
        const answer = await fetch(new URL(path.replace(/^\/+/, ""), upstream), { method });
        const headers: Record<string, string> = {};
        const type = answer.headers.get("content-type");
        if (type !== null) {
            headers["content-type"] = type;
        }
        // The length is the file's only when the body was not encoded on its way.
        const length = answer.headers.get("content-length");
        if (length !== null && answer.headers.get("content-encoding") === null) {
            headers["content-length"] = length;
        }
        response.writeHead(answer.status, headers);
        requests.push(`${method} ${path} ${answer.status}`);
        if (answer.body === null || method === "HEAD") {
            response.end();
            return;
        }
        await pipeline(Readable.fromWeb(answer.body as ReadableStream), response);
    } catch (error) {
        requests.push(`${method} ${path} 502`);
        if (!response.headersSent) {
            response.writeHead(502);
        }
        response.end(String(error));
    }
}

/**
 * Starts a stand-in for a Go mirror on this machine, which logs what it is asked for: it serves what `upstream` has under
 * the same names, and something else under /tampered/. The tests ask the plugin to download through it, and read the log to
 * see that the download came this way. A machine without containers cannot run the one of the Linux suite (an nginx).
 */
export async function startMirrorServer(upstream: string = GO_DOWNLOADS): Promise<MirrorServer> {
    const requests: string[] = [];
    const server = createServer((request, response) => {
        void serve(request, response, upstream, requests);
    });
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    const { port } = server.address() as AddressInfo;
    return {
        url: `http://127.0.0.1:${port}/`,
        tamperedUrl: `http://127.0.0.1:${port}/tampered/`,
        requests,
        stop: () =>
            new Promise<void>((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
                server.closeAllConnections();
            }),
    };
}
