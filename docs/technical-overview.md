# Technical overview

This is the short technical briefing for maintainers, contributors, and release
discussion.

## What it is

Performance Panel is a Bitwig controller extension written in Java plus a
dependency-free HTML, CSS, and JavaScript interface bundled inside the extension.
The extension opens a loopback-only HTTP server at `127.0.0.1:32146`; the browser
is a view and input surface, not a second source of project state.

## Data flow

1. Bitwig exposes selected tracks, devices, Remote Controls, transport, and mixer
   values through its public Extension API.
2. The extension normalizes that data into protocol v1 JSON.
3. The browser polls `GET /v1/state` and updates controls without rebuilding
   unchanged sections.
4. Browser actions become `POST /v1/command` requests.
5. The HTTP thread queues commands; Bitwig's controller thread validates and
   applies them on its next 50 ms bridge tick.

This separation keeps Bitwig API access on the correct thread and prevents the
browser from inventing or owning project data.

## Persistence

Pinned Remote Controls pages and mixer tracks use Bitwig pinnable cursors. Panel
layout and visibility use Bitwig document state, so they follow the project.
Navigation filters use controller preferences. Hotkeys use browser storage and
therefore belong to the local panel installation rather than the Bitwig project.

## Connection and security

- The server listens only on IPv4 loopback, not the LAN.
- Runtime use requires no account, internet connection, or separate server.
- Browser commands require the installed panel origin or the documented local
  development origin.
- Static paths are confined to bundled assets, command queries are bounded, and
  responses include restrictive browser security headers.
- A local non-browser process can still address the loopback API. This is a
  local-control boundary, not an authentication system.

## Performance model

The browser polls every 100 ms. A request marks the next state snapshot as
needed; when no panel is polling, the extension continues servicing commands but
does not repeatedly serialize the complete state. Unpinned page and mixer slots
are omitted from snapshots.

The main remaining cost is the set of Bitwig cursor objects needed to preserve
up to 32 pages and 32 mixer tracks. Release testing should compare controller
startup and steady-state CPU on empty, typical, and large projects with the panel
closed and open.

### Reference measurement

On 2026-11-18, a medium Bitwig Studio 6.1.3 project was sampled once per second
on macOS with 14 pinned pages and 16 mixer strips:

- With the controller enabled and the panel closed, steady-state CPU overlapped
  the controller-disabled baseline; no measurable closed-panel cost was found.
- Opening the dense panel added about 3.1 percentage points to the Bitwig Studio
  process and 0.4 points to the audio engine in that session.
- During a 44-second controller activation trace, Bitwig Studio averaged 29.83%
  CPU and peaked at 43.4%; the audio engine averaged 29.82% and peaked at 31.6%.
  Those peaks stayed within the controller-disabled session's observed range.

No sustained activation spike was reproduced. One-second process sampling can
miss a shorter transient, so future reports should include the project size,
panel contents, sample interval, and whether the panel was open or closed.

## Deliberate limits

- The bridge is local to the Bitwig computer.
- Touch input works through normal pointer events; there is no dedicated touch
  layout or TouchOSC network adapter yet.
- Bitwig's public API does not expose complete device-modulator enumeration and
  control data. Performance Panel does not simulate it.
- Preset browsing is not exposed in the interface until it can be implemented
  reliably with the current public API.

## Useful release description

Performance Panel turns Bitwig's existing Remote Controls into a full-window,
project-aware surface. A single controller extension hosts the interface and a
local HTTP bridge; the browser reflects Bitwig state and sends normalized control
commands back through the public Extension API.
