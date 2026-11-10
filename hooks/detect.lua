-- Copyright 2026 Han Li and contributors
--
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
--   http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.

--- Finds Go installations already on this machine for `vfox link --detect`.
---
--- A result's path is the GOROOT directory, the same directory EnvKeys
--- expects as ctx.path, so `vfox link` can adopt it without downloading
--- another copy (for example the Go that mise, Homebrew or the system
--- installer put on the machine).
---
--- Identification lists directories and reads files only: the VERSION file
--- names the version and a `go` (`go.exe` on Windows) in `bin` proves it is
--- a runnable installation. Nothing inside the installations is executed.

local function onWindows()
    return RUNTIME.osType == "windows"
end

local function trim(value)
    return (value:gsub("^%s+", ""):gsub("%s+$", ""))
end

--- Lists the children of a directory as full paths. Missing or unreadable
--- directories give an empty list instead of an error.
local function listChildren(dir)
    local entries = {}
    if dir == nil or dir == "" then
        return entries
    end
    local command
    if onWindows() then
        command = 'dir /b "' .. dir:gsub('"', "") .. '" 2>nul'
    else
        command = 'ls -1 "' .. dir:gsub('"', "") .. '" 2>/dev/null'
    end
    local handle = io.popen(command)
    if handle == nil then
        return entries
    end
    for line in handle:lines() do
        line = trim(line)
        if line ~= "" and line ~= "." and line ~= ".." then
            entries[#entries + 1] = dir .. "/" .. line
        end
    end
    handle:close()
    return entries
end

--- Reads the version from a GOROOT's VERSION file ("go1.23.0" -> "1.23.0").
--- Returns nil when there is no usable version, so that directories which
--- are not Go installations (or not readable) are skipped. The name must
--- stay linkable: vfox only accepts letters, digits, '.', '_', '+' and '-'.
local function readVersionFile(dir)
    local file = io.open(dir .. "/VERSION", "r")
    if file == nil then
        return nil
    end
    local line = file:read("*l")
    file:close()
    if line == nil then
        return nil
    end
    line = trim(line):gsub("^go", "", 1)
    if line ~= "" and line ~= "latest" and line:match("^[A-Za-z0-9][A-Za-z0-9._+%-]*$") then
        return line
    end
    return nil
end

local function executableExists(dir)
    local want = "go"
    if onWindows() then
        want = "go.exe"
    end
    for _, child in ipairs(listChildren(dir .. "/bin")) do
        local name = child:match("([^/\\]+)$") or child
        if name == want then
            return true
        end
    end
    return false
end

--- If dir (or its go/ or libexec/ child) is a GOROOT, returns version, goroot.
--- The nested layouts cover asdf (<version>/go), old mise installs and
--- Homebrew Cellar entries (<version>/libexec); plain installs (mise's
--- <version>/, /usr/local/go, ...) match dir itself.
local function probeGoroot(dir)
    local candidates = { dir, dir .. "/go", dir .. "/libexec" }
    for _, candidate in ipairs(candidates) do
        local version = readVersionFile(candidate)
        if version ~= nil and executableExists(candidate) then
            return version, candidate
        end
    end
    return nil
end

function PLUGIN:Detect(ctx)
    local found = {}
    local seen = {}

    local function addOne(dir, note)
        if dir == nil or dir == "" or seen[dir] then
            return
        end
        seen[dir] = true
        local version, goroot = probeGoroot(dir)
        if version ~= nil and goroot ~= nil then
            seen[goroot] = true
            found[#found + 1] = { version = version, path = goroot, note = note }
        end
    end

    local function addChildren(parent, note, namePattern)
        for _, child in ipairs(listChildren(parent)) do
            if namePattern == nil then
                addOne(child, note)
            else
                local name = child:match("([^/\\]+)$") or child
                if name:match(namePattern) then
                    addOne(child, note)
                end
            end
        end
    end

    local home = os.getenv("HOME") or ""
    local userProfile = os.getenv("USERPROFILE") or ""
    local userHome = home
    if userHome == "" then
        userHome = userProfile
    end

    -- The toolchain selected right now. Managers such as mise export GOROOT
    -- for the Go they activated, so this finds it wherever it lives.
    addOne(os.getenv("GOROOT"), "active GOROOT from the environment")

    -- mise keeps <data>/installs/go/<version> as the GOROOT.
    local miseData = os.getenv("MISE_DATA_DIR") or ""
    if miseData == "" then
        local xdg = os.getenv("XDG_DATA_HOME") or ""
        if xdg ~= "" then
            miseData = xdg .. "/mise"
        elseif userHome ~= "" then
            miseData = userHome .. "/.local/share/mise"
        end
    end
    addChildren(miseData .. "/installs/go", "installed by mise")
    local localAppData = os.getenv("LOCALAPPDATA") or ""
    addChildren(localAppData .. "/mise/installs/go", "installed by mise")

    -- asdf keeps <data>/installs/golang/<version>/go as the GOROOT.
    local asdfData = os.getenv("ASDF_DATA_DIR") or ""
    if asdfData == "" and userHome ~= "" then
        asdfData = userHome .. "/.asdf"
    end
    addChildren(asdfData .. "/installs/golang", "installed by asdf")

    if onWindows() then
        addOne("C:/Go", "official installer in C:\\Go")
        local programFiles = os.getenv("ProgramFiles") or ""
        addOne(programFiles .. "/Go", "official installer under Program Files")
        local programFiles86 = os.getenv("ProgramFiles(x86)") or ""
        addOne(programFiles86 .. "/Go", "official installer under Program Files")
        if userHome ~= "" then
            addOne(userHome .. "/scoop/apps/go/current", "installed by Scoop")
        end
        return found
    end

    addOne("/usr/local/go", "official installer in /usr/local/go")
    addOne("/usr/lib/go", "installed by the system package manager")
    addOne("/usr/lib/golang", "installed by the system package manager")
    addOne("/opt/go", "found in /opt")
    addOne("/snap/go/current", "installed by snap")
    addOne("/opt/homebrew/opt/go/libexec", "installed by Homebrew")
    addOne("/usr/local/opt/go/libexec", "installed by Homebrew")
    if userHome ~= "" then
        addChildren(userHome .. "/.goenv/versions", "installed by goenv")
        addChildren(userHome .. "/.gvm/gos", "installed by gvm")
        addChildren(userHome .. "/sdk", "extra toolchain in ~/sdk", "^go%d")
    end
    addChildren("/opt/homebrew/Cellar/go", "installed by Homebrew")
    addChildren("/usr/local/Cellar/go", "installed by Homebrew")
    addChildren("/opt", "found in /opt", "^go")
    addChildren("/usr/lib", "installed by the system package manager", "^go%-")
    return found
end
