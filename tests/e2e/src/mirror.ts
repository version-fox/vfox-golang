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

import { GenericContainer, type StartedNetwork, type StartedTestContainer, Wait } from "testcontainers";
import { containerName } from "./target.ts";

const MIRROR_IMAGE = "nginx:1.31-alpine";
const ACCESS_LOG = "/var/log/nginx/mirror-access.log";

/** The name the mirror answers to on the network of the test. */
export const MIRROR_HOST = "go-mirror";

/** A VFOX_GOLANG_MIRROR value for the genuine mirror, and for the one that serves something else. */
export const MIRROR_URL = `http://${MIRROR_HOST}/`;
export const TAMPERED_MIRROR_URL = `http://${MIRROR_HOST}/tampered/`;

// The plugin appends the file name to the mirror, as it appends it to https://go.dev/dl/.
const CONFIG = `
server {
    listen 80;
    access_log ${ACCESS_LOG};

    # A mirror that serves the archives, taken from where go.dev redirects to.
    location / {
        proxy_pass https://dl.google.com/go/;
        proxy_ssl_server_name on;
        proxy_set_header Host dl.google.com;
    }

    # A mirror that serves something else under the names of the archives.
    location /tampered/ {
        default_type application/octet-stream;
        return 200 "this is not a Go toolchain\\n";
    }
}
`;

export interface Mirror {
    container: StartedTestContainer;
    /** What the mirror has been asked for, one request per line. */
    accessLog(): Promise<string>;
    stop(): Promise<void>;
}

/**
 * Starts a stand-in for a Go mirror on `network`, which logs what it is asked for. The tests ask the
 * plugin to download through it, and read the log to see that the download came this way.
 */
export async function startMirror(network: StartedNetwork): Promise<Mirror> {
    const container = await new GenericContainer(MIRROR_IMAGE)
        .withName(containerName("mirror"))
        .withNetwork(network)
        .withNetworkAliases(MIRROR_HOST)
        .withCopyContentToContainer([{ content: CONFIG, target: "/etc/nginx/conf.d/default.conf" }])
        .withWaitStrategy(Wait.forLogMessage(/start worker processes/))
        .start();
    return {
        container,
        accessLog: async () => (await container.exec(["cat", ACCESS_LOG])).stdout,
        stop: async () => {
            await container.stop();
        },
    };
}
