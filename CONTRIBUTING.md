# Contributing

Performance Panel is intentionally small: one Bitwig extension, one bundled web
interface, and one versioned local protocol. Contributions should preserve that
shape unless a larger change has a clear user benefit.

## Before opening a pull request

- Open an issue first for new modules, protocol changes, or behavior that alters
  project persistence.
- Keep device-specific behavior out of the bridge. Prefer optional profiles or
  generic control semantics.
- Do not fabricate Bitwig state when the public Extension API cannot provide it.
- Do not commit `build/`, `dist/`, editor state, or local Bitwig project files.

## Development setup

Requirements:

- Bitwig Studio with Extension API 20 or newer;
- JDK 21 or newer;
- Node.js 20 or newer for the test suite;
- `zip` and `curl` on `PATH`.

Run the complete check:

```sh
./scripts/test.sh
```

The build uses `BITWIG_EXTENSION_API_JAR` when supplied. Otherwise it uses the
local build cache or downloads Bitwig Extension API 21 into the ignored
`build/dependencies` directory.

For browser-only interface work:

```sh
./scripts/serve-app.sh
```

This serves the interface on port `32147` while the live Bitwig bridge remains
on `127.0.0.1:32146`. It does not replace the Bitwig extension or start a mock
bridge.

## Pull requests

Keep each pull request focused. Include:

1. the user-facing reason for the change;
2. tests for behavior or protocol changes;
3. screenshots only when layout changed;
4. documentation changes when controls, persistence, or setup changed.

Generated release archives do not belong in pull requests. Maintainers create
them with `./scripts/package.sh` after the source revision is accepted.

Maintainers use [docs/release-checklist.md](docs/release-checklist.md) for the
manual Bitwig, performance, packaging, and publication checks.
