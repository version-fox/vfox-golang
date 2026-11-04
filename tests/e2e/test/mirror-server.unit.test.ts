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
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { type MirrorServer, startMirrorServer } from "../src/mirror-server.ts";

describe("startMirrorServer", () => {
    let upstream: Server;
    let mirror: MirrorServer;

    before(async () => {
        // Go's downloads, with one archive.
        upstream = createServer((request, response) => {
            if (request.url === "/go/go1.24.0.linux-amd64.tar.gz") {
                response.writeHead(200, { "content-type": "application/x-gzip", "content-length": "7" });
                response.end(request.method === "HEAD" ? undefined : "payload");
            } else {
                response.writeHead(404);
                response.end("no such file");
            }
        });
        await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
        const { port } = upstream.address() as AddressInfo;
        mirror = await startMirrorServer(`http://127.0.0.1:${port}/go/`);
    });
    after(async () => {
        await mirror.stop();
        await new Promise<void>((resolve) => {
            upstream.close(() => resolve());
            upstream.closeAllConnections();
        });
    });

    it("serves what the upstream has under the same name, and logs the request", async () => {
        const response = await fetch(`${mirror.url}go1.24.0.linux-amd64.tar.gz`);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("content-type"), "application/x-gzip");
        assert.equal(await response.text(), "payload");
        assert.ok(mirror.requests.includes("GET /go1.24.0.linux-amd64.tar.gz 200"), mirror.requests.join("\n"));
    });

    it("answers a HEAD request without a body, and passes the status of the upstream on", async () => {
        const head = await fetch(`${mirror.url}go1.24.0.linux-amd64.tar.gz`, { method: "HEAD" });
        assert.equal(head.status, 200);
        assert.equal(await head.text(), "");
        const missing = await fetch(`${mirror.url}go1.99.0.linux-amd64.tar.gz`);
        assert.equal(missing.status, 404);
        assert.ok(mirror.requests.includes("HEAD /go1.24.0.linux-amd64.tar.gz 200"));
        assert.ok(mirror.requests.includes("GET /go1.99.0.linux-amd64.tar.gz 404"));
    });

    it("serves something else under /tampered/", async () => {
        const response = await fetch(`${mirror.tamperedUrl}go1.24.0.linux-amd64.tar.gz`);
        assert.equal(response.status, 200);
        assert.equal(await response.text(), "this is not a Go toolchain\n");
        assert.ok(mirror.requests.includes("GET /tampered/go1.24.0.linux-amd64.tar.gz 200"));
    });

    it("answers 502 where the upstream cannot be reached", async () => {
        const lonely = await startMirrorServer("http://127.0.0.1:1/go/");
        try {
            const response = await fetch(`${lonely.url}go1.24.0.linux-amd64.tar.gz`);
            assert.equal(response.status, 502);
            assert.deepEqual(lonely.requests, ["GET /go1.24.0.linux-amd64.tar.gz 502"]);
        } finally {
            await lonely.stop();
        }
    });
});
