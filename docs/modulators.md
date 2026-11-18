# Modulators

The target is Bitwig's actual device modulator panel: instances such as LFO,
Steps, Expressions, Delay, and macro-style modules, including each instance's
own controls and mapping state. Remote Controls pages are not substitutes.

## API 25 boundary

The public controller API can report the name of the currently active mapping
source. Its indexed `Device.getModulationSource` accessor is deprecated and is
rejected at runtime by API 25. There is no public bank that enumerates the
modulator instances attached to a device, and no public access to their panel
parameters, type, layout, waveform/step data, or add/remove/reorder operations.

Performance Panel therefore renders no synthetic Modulators section. The state
contract remains honest and invisible while unavailable:

```json
"modulators": { "available": false, "items": [] }
```

## Product model when the API exists

Modulator panels should behave like Saved Banks, not like the live master bank.
The user explicitly adds a modulator module; it retains a stable track path,
device identity, modulator-instance identity, color, order, and size while live
selection changes. Modules occupy the same responsive shelf and use the same
Linear 8×1, Grid 4×2, and Compact 4×2 density system.

Each item will need at least:

- stable track, device, and modulator instance identifiers;
- modulator display name and type;
- ordered controls with name, kind, normalized value, display value, and write;
- mapping-active and mapped-destination state;
- optional typed data for waveform, steps, envelope, or expression displays.

The compact header should contain only the module number/name, concise context,
and remove action. Track color is an optional accent. No live-selection header,
availability badge, placeholder grid, or explanatory copy belongs on the
performance surface.

## Contributor path

1. Implement a public-API provider only after Bitwig exposes instance
   enumeration and parameter access.
2. Extend `modulators.items` additively; do not reuse tagged Remote Controls.
3. Add fixture states for generic controls plus typed LFO, Steps, and envelope
   renderers.
4. Keep API limitations in this document, never as UI bloat.
