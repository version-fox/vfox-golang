# Fixtures

Offline copies of what the hooks ask go.dev for, which `tests/releases_test.lua` answers the plugin's HTTP requests with. Taken on 2026-11-04, trimmed to a few releases and platforms. The markup and the checksums are go.dev's own.

| File | From | Holds |
| --- | --- | --- |
| `dl.json` | `https://go.dev/dl/?mode=json` | the two current releases, `go1.27.3` and `go1.26.10` |
| `dl.html` | `https://go.dev/dl/` | the archive of older releases, trimmed to `div#archive` with `go1.27.2`, `go1.24.0` and `go1.20` |

Each release keeps its source archive, and its archives and installers for Linux, Windows and macOS on the CPUs the tests use: the files the plugin has to choose between.

To add a release, copy its `div.toggle` out of the page, keep the markup as it is (the plugin reads `div#archive`, `.toggle` and the cells of `table.downloadtable`), and cut the rows down. To refresh the files, take the two addresses again and check that the digests the tests name still match.
