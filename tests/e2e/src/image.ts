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
import { randomBytes, randomUUID } from "node:crypto";
import { GenericContainer, getContainerRuntimeClient, ImageName } from "testcontainers";
import { IMAGE_CONTEXT } from "./config.ts";

/** The label the Dockerfile puts the id of its build in. */
const BUILD_LABEL = "io.github.version-fox.vfox-golang.e2e.build-id";

export interface BuiltImage {
    tag: string;
    remove(): Promise<void>;
}

/**
 * Builds image/Dockerfile on `baseImage`, under a tag of its own so that two runs on one daemon do not
 * trample each other.
 */
export async function buildImage(baseImage: string): Promise<BuiltImage> {
    const tag = `vfox-golang-e2e:${randomBytes(4).toString("hex")}`;
    const id = randomUUID();
    await GenericContainer.fromDockerfile(IMAGE_CONTEXT)
        .withBuildArgs({ BASE_IMAGE: baseImage, BUILD_ID: id })
        .build(tag, { deleteOnExit: true });

    const client = await getContainerRuntimeClient();
    const built = await client.image.inspect(ImageName.fromString(tag));
    assert.equal(
        built.Config?.Labels?.[BUILD_LABEL],
        id,
        `building ${tag} on ${baseImage} failed, but the Docker build API reports that only in its log: ` +
            "run again with DEBUG=testcontainers:build to see it",
    );

    return {
        tag,
        // The reaper removes the image when it runs. Where it does not (docs/e2e.md), the tests do.
        remove: async () => {
            await client.container.dockerode.getImage(tag).remove({ force: true });
        },
    };
}
