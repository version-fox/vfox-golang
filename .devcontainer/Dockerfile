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

# The repository dev container (see docs/e2e.md): a Linux userland that is
# identical on every host platform — Linux amd64/arm64 natively, Windows and
# macOS through Docker Desktop's Linux-container mode. It carries the Node.js
# the E2E tests need, at the version CI installs, plus the Lua tooling pinned
# in the lint workflow, the vfox release that runs the hook tests (vfox plugin
# test) in the test workflow, the license-eye of the license workflow, and the
# PowerShell 7 that the native E2E suite drives vfox through (the Windows runners
# have their own; here it is what lets that suite run, and be tried out, on Linux).
#
# There is no Go in it, on purpose. This is the plugin that installs Go, and
# the tests must find every Go through the plugin alone: a toolchain of the
# dev container, or of the host, on the PATH or in GOROOT and GOPATH, is the
# conflict the tests are written in Node.js to avoid.
#
# The tests drive testcontainers against the host daemon through the socket
# mounted by devcontainer.json (Docker-out-of-Docker), so the target
# containers are spawned exactly as a native CI runner spawns them.
#
# The image is multi-arch (linux/amd64 and linux/arm64); the downloads below
# select their asset per target arch.

# Keep NODE_VERSION in step with tests/e2e/.node-version, which the lint and E2E
# workflows install. LICENSE_EYE_VERSION is the image license-eye is copied out
# of, the one .github/workflows/license.yml runs; it has no Go, no checksum to
# pin and the right build for either architecture.
ARG NODE_VERSION=26.13.0
ARG LICENSE_EYE_VERSION=0.9.0
FROM apache/skywalking-eyes:${LICENSE_EYE_VERSION} AS license-eye
FROM node:${NODE_VERSION}-trixie-slim

# Docker CLI (client only): drives the host daemon from the shell, the same
# daemon the tests drive through testcontainers.
COPY --from=docker:29-cli /usr/local/bin/docker /usr/local/bin/docker

# The license header check (`license-eye header check`, and `header fix` to write
# the header into a new file). Docker-out-of-Docker cannot mount the workspace into
# a container of the host's daemon, so the check runs here and not through docker.
COPY --from=license-eye /bin/license-eye /usr/local/bin/license-eye

# Keep the tool versions below in step with .github/workflows/lint.yml
# (STYLUA_VERSION, LUA_LANGUAGE_SERVER_VERSION) and hooks-test.yml (VFOX_VERSION).
# tests/e2e/test/versions.unit.test.ts fails when they differ, LICENSE_EYE_VERSION
# above included.
ARG STYLUA_VERSION=2.5.2
ARG LUA_LANGUAGE_SERVER_VERSION=3.19.1
ARG VFOX_VERSION=1.1.0
ARG PWSH_VERSION=7.6.9

# PowerShell runs without the ICU libraries, and does not phone home.
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=1 \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    POWERSHELL_TELEMETRY_OPTOUT=1

# Heredocs need BuildKit, which the dev container tooling uses by default. The
# E2E target Dockerfile (tests/e2e/image/Dockerfile) stays on the chained-`;`
# form: testcontainers for Node.js builds it through the classic builder, which
# silently drops the body of a heredoc.
RUN <<EOF
set -o errexit -o nounset -o xtrace
apt-get update
apt-get install --assume-yes --no-install-recommends \
    ca-certificates \
    curl \
    git \
    openssh-client \
    unzip \
    zip
rm --recursive --force /var/lib/apt/lists/*
case "$(dpkg --print-architecture)" in
    amd64) stylua_asset=stylua-linux-x86_64.zip; luals_asset="lua-language-server-${LUA_LANGUAGE_SERVER_VERSION}-linux-x64.tar.gz"; vfox_dir="vfox_${VFOX_VERSION}_linux_x86_64"; pwsh_asset="powershell-${PWSH_VERSION}-linux-x64.tar.gz" ;;
    arm64) stylua_asset=stylua-linux-aarch64.zip; luals_asset="lua-language-server-${LUA_LANGUAGE_SERVER_VERSION}-linux-arm64.tar.gz"; vfox_dir="vfox_${VFOX_VERSION}_linux_aarch64"; pwsh_asset="powershell-${PWSH_VERSION}-linux-arm64.tar.gz" ;;
    *) echo "FAIL unsupported architecture $(dpkg --print-architecture)" >&2; exit 1 ;;
esac
curl --fail --silent --show-error --location --output /tmp/stylua.zip \
    "https://github.com/JohnnyMorganz/StyLua/releases/download/v${STYLUA_VERSION}/${stylua_asset}"
unzip -q /tmp/stylua.zip -d /usr/local/bin
rm --force /tmp/stylua.zip
curl --fail --silent --show-error --location --output /tmp/luals.tar.gz \
    "https://github.com/LuaLS/lua-language-server/releases/download/${LUA_LANGUAGE_SERVER_VERSION}/${luals_asset}"
mkdir --parents /opt/lua-language-server
tar --extract --gzip --file /tmp/luals.tar.gz --directory /opt/lua-language-server
rm --force /tmp/luals.tar.gz
ln --symbolic /opt/lua-language-server/bin/lua-language-server /usr/local/bin/lua-language-server
curl --fail --silent --show-error --location --output /tmp/vfox.tar.gz \
    "https://github.com/version-fox/vfox/releases/download/v${VFOX_VERSION}/${vfox_dir}.tar.gz"
tar --extract --gzip --file /tmp/vfox.tar.gz --directory /usr/local/bin --strip-components=1 "${vfox_dir}/vfox"
rm --force /tmp/vfox.tar.gz
curl --fail --silent --show-error --location --output /tmp/pwsh.tar.gz \
    "https://github.com/PowerShell/PowerShell/releases/download/v${PWSH_VERSION}/${pwsh_asset}"
mkdir --parents /opt/microsoft/powershell/7
tar --extract --gzip --file /tmp/pwsh.tar.gz --directory /opt/microsoft/powershell/7
chmod +x /opt/microsoft/powershell/7/pwsh
ln --symbolic /opt/microsoft/powershell/7/pwsh /usr/local/bin/pwsh
rm --force /tmp/pwsh.tar.gz
stylua --version
lua-language-server --version
vfox --version
pwsh --version
EOF
