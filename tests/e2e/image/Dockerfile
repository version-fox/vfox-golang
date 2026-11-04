# Copyright 2026 Han Li and contributors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# The container the E2E tests drive (see docs/e2e.md): a Linux userland with
# what vfox and the tests need, and no Go on purpose. `go` can only come from
# what vfox installs through the plugin under test.
#
# NOTE: no heredoc here. testcontainers for Node.js builds this through the
# classic builder of the Docker API, which accepts `RUN <<EOF` but silently
# drops its body, and the build still succeeds; BuildKit is opt-in there
# (withBuildkit). The chained-`;` form below is safe on both builders.
#
# The plugin itself is not part of the image. The tests copy the checkout into
# every container, so a change to a hook never needs a rebuild.

ARG BASE_IMAGE=ubuntu:26.04
FROM ${BASE_IMAGE}

ARG BUILD_ID=unknown

ENV DEBIAN_FRONTEND=noninteractive

# curl downloads vfox, zip packs the plugin for `vfox add --source`.
RUN set -o errexit -o nounset -o xtrace; \
    apt-get update; \
    apt-get install --assume-yes --no-install-recommends \
        ca-certificates \
        curl \
        zip; \
    rm --recursive --force /var/lib/apt/lists/*

# The Docker build API reports a failed build only in its log, and the tag of an
# earlier build stays on the image. The tests compare this label with the id
# they passed to tell the two apart.
LABEL io.github.version-fox.vfox-golang.e2e.build-id="${BUILD_ID}"

# Long-lived container: the tests drive every phase through exec calls, so the
# main process just idles here.
CMD ["sleep", "infinity"]
