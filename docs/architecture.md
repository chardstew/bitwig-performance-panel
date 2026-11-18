# Architecture

Performance Panel is one Bitwig controller extension with a bundled browser
interface. There is no companion application or cloud service.

## Runtime

```text
Bitwig project
    ↕ public Extension API
Java controller extension
    ↕ loopback HTTP on 127.0.0.1:32146
Bundled browser interface
```

The extension owns all Bitwig objects and project-persistent settings. It serves
the static interface, publishes a versioned JSON snapshot, and queues browser
commands for execution on Bitwig's controller thread. The browser renders only
state supplied by the extension.

## State model

- The Remote Control Navigator follows Bitwig's selected track and device.
- Four adjacent Remote Controls pages support the Navigator display.
- Up to 32 pinned pages retain independent track, device, and page cursors.
- Up to 32 mixer slots retain independent track cursors.
- Layout, visibility, labels, pinned pages, and mixer selection live in Bitwig
  document state or pinned cursor state.
- Keyboard shortcuts are browser-local because Bitwig's document settings are
  not appropriate for arbitrary key capture.

The browser polls at 100 ms. State serialization is request-driven, while queued
commands are serviced every 50 ms. Idle saved-page slots are omitted from JSON;
idle mixer slots are also omitted.

## Layout

Pinned pages use one of three project-local views:

- **Large** — 8×1 controls, one page across.
- **Mid** — 4×2 controls, two pages across.
- **Small** — 4×2 controls, four pages across.

The mixer is optional and can appear above, between, below, or alongside pinned
pages. Its module width is Full, Half, or Quarter. Sections placed alongside
pinned pages can be reordered by swapping positions.

Removing a page or mixer strip removes only that panel view. It does not delete
or alter the source track, device, or Remote Controls page in Bitwig.

## Bridge boundary

The HTTP server binds to loopback only. State is read with `GET /v1/state` and
commands are submitted with `POST /v1/command`. Commands from foreign browser
origins are rejected; query size is bounded; static assets are restricted to the
bundled `/app/` tree. See [protocol v1](../protocol/v1.md).

## Source layout

```text
app/                 browser interface and user guide
bitwig-extension/    Bitwig adapter and loopback server
docs/                implementation and API-boundary notes
protocol/            bridge contract
scripts/             build, test, development, and release tools
```

Device-specific logic and fabricated Bitwig state do not belong in the bridge.
New capabilities should be generic, backed by the public API, and added to the
protocol without breaking existing v1 clients.
