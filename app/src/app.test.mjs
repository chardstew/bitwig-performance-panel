import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { inferControlKind } from "./control-kind.mjs";
import { HOTKEY_ACTIONS, defaultHotkeys, formatHotkey, hotkeyFromEvent } from "./hotkeys.mjs";

test("offline state never substitutes fabricated project data", async () => {
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(app, /demo-state|loadDemo|OFFLINE DEMO|showing demo data/);
  assert.doesNotMatch(html, /value="120\.00"|>1\.1\.1\.00<|>4\/4</);
  assert.match(app, /render\(offlineState\(\)\)/);
});

test("app contains no external runtime dependency", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /(?:src|href)=["']https?:\/\/(?!localhost:32146\/)/);
  assert.match(html, /Performance Panel/);
});

test("published protocol documents every implemented command", async () => {
  const protocol = await readFile(new URL("../../protocol/v1.md", import.meta.url), "utf8");
  const extension = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/PerformancePanelExtension.java", import.meta.url),
    "utf8",
  );
  const actions = [...extension.matchAll(/case "([^"]+)"/g)].map((match) => match[1]);
  assert.ok(actions.length > 30);
  for (const action of actions) {
    assert.match(protocol, new RegExp(`action=${action}(?:[&\\n])`), `missing protocol command: ${action}`);
  }
  assert.match(protocol, /"mixerWidth": "half"/);
  assert.doesNotMatch(protocol, /mixerView|set-mixer-view|toggle-mixer-(?:mute|solo|arm)/);
});

test("bundled user guide explains setup, saved pages, mixer, and local connection", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const guide = await readFile(new URL("../guide.html", import.meta.url), "utf8");
  await access(new URL("../guide.css", import.meta.url));
  await access(new URL("../guide.js", import.meta.url));
  await access(new URL("../images/user-guide/simple.png", import.meta.url));
  await access(new URL("../images/user-guide/simple-w-mixer.png", import.meta.url));
  await access(new URL("../images/user-guide/simple-w-nav.png", import.meta.url));
  await access(new URL("../images/user-guide/complex-w-mixer.png", import.meta.url));
  await access(new URL("../images/user-guide/comp-no-mix.png", import.meta.url));
  await access(new URL("../images/user-guide/comp-small-mix.png", import.meta.url));
  await access(new URL("../images/user-guide/blank.png", import.meta.url));
  await access(new URL("../images/user-guide/full-main.png", import.meta.url));
  await access(new URL("../images/user-guide/settings.png", import.meta.url));
  assert.match(html, /href="http:\/\/localhost:32146\/app\/guide\.html"/);
  assert.match(html, /target="_blank" rel="noopener external"/);
  assert.match(guide, /Settings → Controllers/);
  assert.match(guide, /Drag <code>PerformancePanel\.bwextension<\/code> onto an open Bitwig Studio window/);
  assert.match(guide, /Extensions<\/code> directory for your operating system/);
  assert.match(guide, /Pin up to 32 Remote Controls pages/);
  assert.doesNotMatch(guide, /Exclusive Solo/);
  assert.match(guide, /Install page as app/);
  assert.match(guide, /<b>Recommended<\/b>/);
  assert.match(guide, /removes Chrome's toolbars and creates a standalone Performance Panel shortcut/);
  assert.match(guide, /32 REMOTE PAGES/);
  assert.match(guide, /Finally: Bitwig Remote Controls in a full-window performance surface\./);
  assert.match(guide, /LOCAL · NO ACCOUNT/);
  assert.match(guide, /Remote Control Navigator follows Bitwig's selected track and device/);
  assert.match(guide, /Use the Track and Device arrows/);
  assert.match(guide, /These are synchronized views, not copies/);
  assert.doesNotMatch(guide, /class="view-list"/);
  assert.doesNotMatch(guide, /where supported/);
  assert.match(guide, /Use Settings to arrange sections/);
  assert.match(guide, /Bitwig remains the source for track hierarchy/);
  assert.match(guide, /Existing MIDI and controller mappings carry straight through/);
  assert.match(guide, /When the active Bitwig project changes, Performance Panel follows it/);
  assert.match(guide, /Edit Hotkeys/);
  assert.match(guide, /Macro, Macro-4, Button, Buttons/);
  assert.match(guide, /Focused bug reports, Bitwig API findings, and tested implementations are welcome/);
  assert.match(guide, /https:\/\/chardstew\.com/);
  assert.match(guide, /MIT LICENSE/);
  assert.match(guide, /<h3>Simple \(no mixer\)<\/h3>/);
  assert.match(guide, /<h3>Dense \(no mixer\)<\/h3>/);
  assert.match(guide, /<h3>Dense \+ small mixer<\/h3>/);
  assert.match(guide, /<h3>Waiting for a session<\/h3>/);
  assert.match(guide, /<h3>Settings<\/h3>/);
  assert.match(guide, /<h2>Example Panel Setups<\/h2>/);
  assert.match(guide, /stays empty rather than showing placeholder data/);
  assert.match(guide, /Navigator shown, mixer hidden, and four pinned pages in Mid view \(4×2\)\./);
  assert.match(guide, /Navigator hidden, full-width mixer above, and two pinned pages in Large view \(8×1\)\./);
  assert.match(guide, /Navigator hidden, half-width mixer alongside 14 pinned pages/);
  assert.ok(guide.indexOf("simple-w-nav.png") < guide.indexOf("simple.png"));
  assert.ok(guide.indexOf("blank.png") < guide.indexOf("simple-w-nav.png"));
  assert.ok(guide.indexOf("comp-no-mix.png") < guide.indexOf("complex-w-mixer.png"));
  assert.ok(guide.indexOf("complex-w-mixer.png") < guide.indexOf("settings.png"));
  assert.ok(guide.indexOf("full-main.png") < guide.indexOf('id="start"'));
  assert.match(guide, /id="gallery-dialog"/);
  assert.match(guide, /class="gallery-open guide-overview"/);
  assert.match(guide, /no separate server, account, or internet connection/);
  assert.match(guide, /one Bitwig controller extension with a browser interface bundled inside it/);
  assert.match(guide, /serves the interface and current state over local HTTP/);
  assert.doesNotMatch(guide, /BACK TO PANEL/);
  assert.doesNotMatch(guide, /All three arrow pairs wrap/);
  assert.doesNotMatch(guide, /releases its panel slot/);
});

test("hotkey editor exposes defaults and optional panel actions", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(html, /id="hotkeys-open"[^>]*>EDIT HOTKEYS/);
  assert.match(html, /id="hotkey-dialog"/);
  assert.match(html, /Select a binding, then press key\/shortcut\. Backspace clears\./);
  assert.match(styles, /\.hotkey-dialog::backdrop/);
  assert.equal(defaultHotkeys()["play-stop"], "Space");
  assert.equal(defaultHotkeys().metronome, "C");
  assert.equal(defaultHotkeys()["previous-track"], "");
  assert.equal(HOTKEY_ACTIONS.length, 14);
  assert.ok(HOTKEY_ACTIONS.some(({ id }) => id === "toggle-transport-bar"));
  assert.ok(HOTKEY_ACTIONS.some(({ id }) => id === "toggle-remote-controls"));
  assert.ok(HOTKEY_ACTIONS.some(({ id }) => id === "toggle-mixer"));
  assert.equal(hotkeyFromEvent({ key: "z", code: "KeyZ", metaKey: true, ctrlKey: false, altKey: false, shiftKey: true }), "Mod+Shift+Z");
  assert.equal(formatHotkey("Mod+Shift+Z", true), "⌘⇧Z");
});

test("unimplemented preset browsing stays out of the interface", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const extension = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/PerformancePanelExtension.java", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(html, /id="(?:previous-preset|next-preset|preset|preset-count)"/);
  assert.doesNotMatch(app, /Preset browsing is not available yet/);
  assert.doesNotMatch(app, /command\("(?:previous|next)-preset"/);
  assert.doesNotMatch(extension, /switchToPreviousPreset|switchToNextPreset/);
});

test("navigation counts stay orange when track color is enabled", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.control-bank \.selection span em \{ color: var\(--orange\); \}/);
  assert.doesNotMatch(styles, /\.control-bank \.selection span em \{ color: var\(--live-accent\); \}/);
});

test("controls poll responsively without rebuilding unchanged controls", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  assert.doesNotMatch(html, /<b>LATENCY<\/b>/);
  assert.match(app, /const POLL_MS = 100/);
  assert.match(app, /if \(renderKey === liveRenderKey\) return/);
  assert.match(app, /if \(renderKey === savedRenderKey\) \{/);
  assert.match(app, /button\.addEventListener\("pointerdown"/);
  assert.match(app, /button\.classList\.toggle\("on", nextOn\)/);
});

test("browser controls bypass hardware takeover and write immediately", async () => {
  const extension = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/PerformancePanelExtension.java", import.meta.url),
    "utf8",
  );
  assert.match(extension, /value\(\)\.setImmediately\(clamp\(value\)\)/);
});

test("local server serves JavaScript modules with a browser-safe MIME type", async () => {
  const server = await readFile(new URL("../../scripts/serve.mjs", import.meta.url), "utf8");
  const bridge = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/BridgeServer.java", import.meta.url),
    "utf8",
  );
  assert.match(server, /"\.mjs": "text\/javascript; charset=utf-8"/);
  assert.match(server, /"\.ttf": "font\/ttf"/);
  assert.match(bridge, /endsWith\("\.ttf"\).*"font\/ttf"/);
});

test("bridge accepts only local panel command origins and names port collisions", async () => {
  const bridge = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/BridgeServer.java", import.meta.url),
    "utf8",
  );
  const extension = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/PerformancePanelExtension.java", import.meta.url),
    "utf8",
  );
  assert.match(bridge, /trustedOrigin\(exchange\)/);
  assert.match(bridge, /origin\.equals\(requestOrigin\)/);
  assert.match(bridge, /"http:\/\/127\.0\.0\.1:32147"\.equals\(requestOrigin\)/);
  assert.match(bridge, /respond\(exchange, 403,[^\n]+\{\\"error\\":\\"origin\\"\}/);
  assert.match(extension, /could not open 127\.0\.0\.1:" \+ PORT/);
});

test("control kinds are inferred generically from Bitwig display values", () => {
  assert.equal(inferControlKind({ display: "On" }), "toggle");
  assert.equal(inferControlKind({ display: "Off" }), "toggle");
  assert.equal(inferControlKind({ display: "37.6 %" }), "continuous");
});

test("saved banks expose hierarchy while navigation filters remain explicit", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const extension = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/PerformancePanelExtension.java", import.meta.url),
    "utf8",
  );
  assert.match(html, /id="include-groups"/);
  assert.match(html, />Include Group Tracks</);
  assert.match(html, />Include FX Tracks</);
  assert.match(html, />Include Master Track</);
  assert.match(app, /bank\.trackPath \|\| bank\.track/);
  assert.match(app, /set-include-groups/);
  assert.match(extension, /getBooleanSetting\("Include Group Tracks", "Navigation", true\)/);
  assert.match(extension, /getBooleanSetting\("Include FX Tracks", "Navigation", true\)/);
  assert.match(extension, /getBooleanSetting\("Include Master Track", "Navigation", true\)/);
  assert.match(extension, /!entry\.track\(\)\.isGroup\(\)\.get\(\)/);
  assert.match(extension, /case MASTER -> includeMasterTrack\.get\(\)/);
});

test("continuous controls support knob drag and keyboard input", async () => {
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(app, /knob\.addEventListener\("pointermove"/);
  assert.match(app, /knob\.addEventListener\("keydown"/);
  assert.match(app, /role="slider"/);
  assert.match(styles, /cursor: ns-resize/);
});

test("saved banks expose one persistent valid view selector with blank empty slots", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const extension = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/PerformancePanelExtension.java", import.meta.url),
    "utf8",
  );
  assert.match(html, />Pinned Page View</);
  assert.match(html, /value="linear">Large — 8×1/);
  assert.match(html, /value="grid">Mid — 4×2/);
  assert.match(html, /value="compact">Small — 4×2/);
  assert.match(html, /value="full">Full<\/option>/);
  assert.match(html, /value="half">Half<\/option>/);
  assert.match(html, /value="quarter">Quarter<\/option>/);
  assert.doesNotMatch(html, /Saved Bank Size/);
  assert.match(app, /BANK_VIEWS = new Set\(\["linear", "grid", "compact"\]\)/);
  assert.match(app, /set-bank-view/);
  assert.match(app, /remote\.exists === false \|\| \(!remote\.name && !remote\.display\)/);
  assert.match(styles, /data-bank-layout="rectangular"\]\[data-bank-size="small"\] \.saved-banks/);
  assert.match(styles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.remote\.empty \{ display: block; \}/);
  assert.match(extension, /getDocumentState\(\)\.getEnumSetting/);
  assert.match(extension, /"Linear", "Rectangular"/);
  assert.match(extension, /"Large", "Medium", "Small"/);
  assert.match(extension, /private void setBankView/);
  assert.match(extension, /private String bankView/);
  assert.match(extension, /remotePages/);
});

test("actual modulator capability stays honest until Bitwig exposes it", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const extension = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/PerformancePanelExtension.java", import.meta.url),
    "utf8",
  );
  const docs = await readFile(new URL("../../docs/modulators.md", import.meta.url), "utf8");
  assert.doesNotMatch(html, /show-modulators|modulators-panel/i);
  assert.doesNotMatch(app, /renderModulators|set-modulator-remote/);
  assert.doesNotMatch(extension, /createCursorRemoteControlsPage\([^;]+"lfo"|getModulationSource/);
  assert.match(extension, /modulators.*available.*false.*items/);
  assert.match(docs, /behave like Saved Banks/);
  assert.match(docs, /stable track path/);
  assert.match(docs, /Remote Controls pages are not substitutes/);
  assert.doesNotMatch(html, /preview|coming soon/i);
  assert.doesNotMatch(styles, /modulator-grid|modulator-controls/);
});

test("retired interface paths do not remain in production code", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const extension = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/PerformancePanelExtension.java", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(styles, /section-heading|eyebrow/);
  assert.doesNotMatch(extension, /case "save-bank"|case "set-bank-layout"|case "set-bank-size"/);
});

test("the primary action uses Bitwig Remote Controls page language", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, /＋ ADD REMOTE PAGE/);
  assert.doesNotMatch(html, /(?:ADD|SAVE) BANK/);
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  assert.match(app, /command\("add-bank"\)/);
});

test("transport glyphs are optically centered and control tiles omit ordinal labels", async () => {
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(styles, /#transport-undo svg, #transport-redo svg \{ transform: translateY\(2px\); \}/);
  assert.match(styles, /body \{[^}]*cursor: default;/s);
  assert.doesNotMatch(app, /class="remote-index"/);
  assert.doesNotMatch(styles, /\.remote-index/);
});

test("transport bar exposes compact transport and editable project labels", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const extension = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/PerformancePanelExtension.java", import.meta.url),
    "utf8",
  );
  assert.match(html, /id="panel-title-setting"/);
  assert.match(html, /id="panel-subtitle-setting"/);
  assert.match(html, /id="transport-play"/);
  assert.match(html, /id="transport-tempo"/);
  assert.match(html, /id="transport-play"[^>]*>\s*<svg/);
  assert.match(html, /id="settings-toggle"[^>]*>[\s\S]*?<svg/);
  assert.match(app, /command\("transport-play"\)/);
  assert.match(app, /command\("set-tempo"/);
  assert.match(app, /command\("set-panel-title"/);
  assert.match(extension, /host\.createTransport\(\)/);
  assert.match(extension, /getStringSetting\(\s*"Panel Name"/s);
  assert.match(extension, /transport\.tempo\(\)\.setRaw/);
  assert.match(styles, /\.transport \{/);
  assert.match(styles, /grid-template-columns: minmax\(180px, 1fr\) auto minmax\(180px, 1fr\)/);
  assert.match(styles, /@media \(max-width: 680px\)/);
});

test("transport exposes undo redo and guarded keyboard shortcuts", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const extension = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/PerformancePanelExtension.java", import.meta.url),
    "utf8",
  );
  assert.match(html, /id="transport-undo"/);
  assert.match(html, /id="transport-redo"/);
  assert.match(app, /hotkeyFromEvent\(event\)/);
  assert.match(app, /runHotkey\(action\.id\)/);
  assert.match(app, /target\.matches\("input, select, textarea, button"\)/);
  assert.match(extension, /application = host\.createApplication\(\)/);
  assert.match(extension, /case "undo" -> application\.undo\(\)/);
  assert.match(extension, /case "redo" -> application\.redo\(\)/);
  assert.match(extension, /createBeatTimeFormatter\("\."\s*,\s*1,\s*1,\s*1,\s*2\)/);
  assert.match(extension, /getFormatted\(positionFormatter\)/);
});

test("the Remote Control Navigator hides as one section", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const extension = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/PerformancePanelExtension.java", import.meta.url),
    "utf8",
  );
  assert.match(html, /id="show-remote-controls"[^>]*checked/);
  assert.match(app, /controlBank\.hidden = !showRemoteControls/);
  assert.match(app, /set-show-remote-controls/);
  assert.match(app, /pendingSettings\.set\("showRemoteControls", value\)/);
  assert.match(app, /pendingSettings\.set\("includeGroups", value\)/);
  assert.match(html, /id="remote-controls-position"[\s\S]*value="top"[\s\S]*value="bottom"/);
  assert.match(app, /pendingSettings\.set\("remoteControlsPosition", position\)/);
  assert.match(app, /function layoutPanels\(\)/);
  assert.match(html, /Show Remote Control Navigator/);
  assert.match(html, /Navigator Position/);
  assert.match(html, /TRACK TYPES/);
  assert.doesNotMatch(html, /NAVIGATOR \+ MIXER ＋ ALL/);
  assert.doesNotMatch(html, />TOOLS</);
  assert.doesNotMatch(html, /<strong>Panel settings<\/strong>/);
  assert.ok(html.indexOf("PINNED PAGES") > html.indexOf("TRACK TYPES"));
  assert.match(html, /Pinned Page View/);
  assert.match(html, /class="setting-row scoped-setting"[\s\S]*id="include-groups"/);
  assert.match(html, /class="setting-row scoped-setting"[\s\S]*id="include-effect-tracks"/);
  assert.match(html, /class="setting-row scoped-setting"[\s\S]*id="include-master-track"/);
  assert.match(extension, /"Remote Controls Position", "Performance Panel", new String\[\] \{"Top", "Bottom"\}, "Top"/);
  assert.match(app, /if \(liveValue === pendingValue\) pendingSettings\.delete\(key\)/);
  assert.match(extension, /"Show Remote Controls", "Performance Panel", true/);
});

test("transport bar can collapse without hiding page and settings actions", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const extension = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/PerformancePanelExtension.java", import.meta.url),
    "utf8",
  );
  assert.match(html, /id="show-transport-bar"[^>]*checked/);
  assert.match(app, /statusbar\.append\(actions\)/);
  assert.match(app, /saveButton\.textContent = "＋ PAGE"/);
  assert.match(app, /pendingSettings\.set\("showTransportBar", value\)/);
  assert.match(styles, /\.topbar\[hidden\] \{ display: none; \}/);
  assert.match(styles, /\.statusbar \.settings-menu/);
  assert.match(extension, /"Show Transport Bar", "Performance Panel", true/);
  assert.match(extension, /case "set-show-transport-bar" -> showTransportBar\.set/);
  assert.match(extension, /json\.append\("\\\"showTransportBar\\\":"\)/);
});

test("saved-bank track paths collapse deep nesting", async () => {
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(app, /parts\.length <= 2/);
  assert.match(app, /parts\[0\].*….*parts\.at\(-1\)/);
  assert.match(app, /\.title = fullTrackPath/);
  assert.match(styles, /\.saved-bank-context \.context-track \{ flex: 0 1 auto; \}/);
  assert.match(styles, /\.saved-bank-context \{[^}]*text-align: left/);
  assert.doesNotMatch(styles, /data-bank-size="small"\] \.saved-bank-context \{\s*display: grid/);
});

test("track navigation de-duplicates overlapping Bitwig banks by channel id", async () => {
  const extension = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/PerformancePanelExtension.java", import.meta.url),
    "utf8",
  );
  assert.match(extension, /LinkedHashMap<String, TrackEntry>/);
  assert.match(extension, /"channel:" \+ channelId/);
  assert.match(extension, /trackKindPriority/);
  assert.match(extension, /return navigableTrackEntries\(\)\.size\(\)/);
  assert.match(extension, /selectedTrackEntryIndex\(navigableTrackEntries\(\)\)/);
  assert.match(extension, /for \(final TrackEntry entry : navigableTrackEntries\(\)\)/);
  assert.match(extension, /Math\.floorMod\(selectedIndex \+ direction, entries\.size\(\)\)/);
  assert.match(extension, /Math\.floorMod\(device\.position\(\)\.get\(\) \+ direction, count\)/);
});

test("mixer separates placement and width with persistent track channels", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const extension = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/PerformancePanelExtension.java", import.meta.url),
    "utf8",
  );
  const mixerChannel = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/MixerChannel.java", import.meta.url),
    "utf8",
  );
  assert.match(html, /id="show-mixer"/);
  assert.match(html, /id="mixer-placement"/);
  assert.match(html, /id="mixer-width"/);
  assert.match(html, />With Banks</);
  assert.match(html, /value="full">Full<\/option>/);
  assert.match(html, /value="half">Half<\/option>/);
  assert.match(html, /value="quarter">Quarter<\/option>/);
  assert.doesNotMatch(html, />Compact</);
  assert.match(app, /currentMixerPosition === "banks"/);
  assert.match(app, /currentMixerWidth/);
  assert.match(app, /section\.dataset\.sectionKey = "mixer"/);
  assert.match(app, /set-section-order/);
  assert.match(app, /updateMixerValues/);
  assert.match(extension, /case "add-mixer-track"/);
  assert.match(extension, /case "add-mixer-all"/);
  assert.match(extension, /MIXER_TRACK_COUNT = 32/);
  assert.match(extension, /available\.get\(slot\+\+\)\.pinFrom/);
  assert.doesNotMatch(extension, /entry\.kind\(\) == TrackKind\.MASTER/);
  assert.doesNotMatch(extension, /ensureMasterMixerChannel/);
  assert.doesNotMatch(extension, /MASTER_MIXER_INDEX|MIXER_CHANNEL_COUNT/);
  assert.match(extension, /interest\(track\.channelId\(\)\)/);
  assert.match(extension, /interest\(candidate\.channelId\(\)\)/);
  assert.match(extension, /showMixer\.get\(\)/);
  assert.match(mixerChannel, /createCursorTrack/);
  assert.match(mixerChannel, /addVuMeterObserver/);
  assert.match(mixerChannel, /String path\(\)/);
  assert.match(mixerChannel, /track\.solo\(\)\.toggle\(exclusive\)/);
  assert.match(html, /id="exclusive-solo"/);
  assert.match(app, /set-exclusive-solo/);
  assert.match(extension, /exclusiveSolo\.get\(\)/);
});

test("mixer channels are dense, ordered, complete, and optimistically responsive", async () => {
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const extension = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/PerformancePanelExtension.java", import.meta.url),
    "utf8",
  );
  assert.match(app, /filter\(\(channel\) => channel\.pinned && channel\.exists\)/);
  assert.match(app, /Number\(left\.master\) - Number\(right\.master\)/);
  assert.match(app, /mixer-track-number/);
  assert.match(app, /Level ·/);
  assert.match(app, /Pan ·/);
  assert.match(app, /<button class="mixer-remove"/);
  assert.doesNotMatch(app, /channel\.master \? ""/);
  assert.match(app, /bindValueControl\("\.pan-control", "pan", "set-mixer-pan", false\)/);
  assert.match(app, /pendingMixerButtons/);
  assert.match(app, /set-mixer-mute/);
  assert.match(app, /set-mixer-solo/);
  assert.match(extension, /case "set-mixer-mute"/);
  assert.match(extension, /trackNumber/);
  assert.match(extension, /field\(json, "kind", mixerTrackKind\(channel\)\)/);
  assert.match(extension, /case EFFECT -> "effect"/);
  assert.match(extension, /case MAIN -> bestMatch\.track\(\)\.isGroup\(\)\.get\(\) \? "group" : "track"/);
  assert.doesNotMatch(extension, /case "toggle-mixer-mute"/);
  assert.match(styles, /\.mute-control\.active[^}]*var\(--mute\)/s);
  assert.match(styles, /\.solo-control\.active[^}]*var\(--solo\)/s);
  assert.match(styles, /\.mixer-card \.mixer-grid \{[^}]*overflow-x: auto[^}]*overflow-y: hidden/s);
  assert.doesNotMatch(styles, /mixer-channel \.pan-control,[^}]*display: none/s);
});

test("full mixer stays mounted so polling cannot cancel pointer interactions", async () => {
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(app, /if \(panel\.previousElementSibling !== anchor\) anchor\.after\(panel\)/);
  assert.match(app, /anchor = panel/);
  assert.match(app, /\$\("mixer-grid"\)\.style\.setProperty\("--mixer-columns"/);
  assert.match(styles, /\.mixer-grid \{[^}]*flex-flow: row nowrap[^}]*overflow-x: auto/s);
  assert.doesNotMatch(app, /mixerPanel\.replaceWith/);
});

test("bank mixer stays a single scalable row with custom channel strips", async () => {
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.doesNotMatch(app, /compactMixerPage|compactMixerCapacity|class="mixer-page"|data-action="previous-page"|data-action="next-page"/);
  assert.match(styles, /\.mixer-channel-name[^}]*writing-mode: vertical-rl/s);
  assert.match(styles, /\.volume-control::after/);
  assert.match(styles, /\.pan-control::after/);
  assert.match(styles, /\.mixer-grid[^}]*justify-content: safe center/s);
  assert.match(styles, /--mixer-strip-width: 39px/);
  assert.match(styles, /--mixer-strip-max-width: 52px/);
  assert.match(styles, /\.mixer-channel[^}]*flex: 1 0 var\(--mixer-strip-width\)[^}]*max-width: var\(--mixer-strip-max-width\)[^}]*min-width: var\(--mixer-strip-width\)/s);
  assert.match(styles, /\.mixer-strip-core[^}]*grid-template-columns: 10px 12px[^}]*justify-content: center[^}]*gap: 3px/s);
  assert.match(styles, /\.pan-control[^}]*width: 22px[^}]*justify-self: center/s);
  assert.match(styles, /\.mixer-buttons \.arm-control[^}]*grid-column: 1 \/ -1/s);
  assert.match(styles, /\.mixer-buttons \.mute-control, \.mixer-buttons \.solo-control[^}]*aspect-ratio: 1/s);
  assert.doesNotMatch(styles, /\.mixer-channel\.master[^}]*(?:margin-left|flex):/s);
  assert.match(styles, /\.mixer-channel[^}]*border-left: 2px solid var\(--channel-color\)/s);
  assert.match(app, /channel-\$\{kind\}/);
  assert.match(styles, /\.mixer-meter[^}]*position: absolute[^}]*height: calc\(var\(--level\)/s);
  assert.match(styles, /\.mixer-card\.mixer-half \{ grid-column: span 2; \}/);
  assert.match(styles, /\.mixer-card\.mixer-quarter \{ grid-column: span 1; \}/);
  assert.doesNotMatch(styles, /appearance: slider-vertical/);
});

test("status bar remains fixed and visible at the viewport bottom", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.shell \{[^}]*padding: 6px 6px 39px/s);
  assert.match(styles, /\.statusbar \{[^}]*position: fixed[^}]*bottom: 6px[^}]*width: min\(calc\(100% - 12px\), 1428px\)/s);
});

test("bank mixer actions remain clickable while its header is draggable", async () => {
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(app, /class="module-actions"/);
  assert.match(app, /draggable="false" data-action="track"/);
  assert.match(app, /event\.target\.closest\("button"\)/);
  assert.match(app, /\[sections\[sourceIndex\], sections\[targetIndex\]\] = \[sections\[targetIndex\], sections\[sourceIndex\]\]/);
  assert.match(app, /container\.replaceChildren\(\.\.\.sections\)/);
  assert.doesNotMatch(app, /insertBefore\(source, section\)/);
  assert.match(styles, /\.module-actions \{ display: flex; gap: 2px; \}/);
});

test("saved bank removal uses a normal accessible hit target", async () => {
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(app, /class="saved-bank-remove"[^>]*draggable="false"/);
  assert.match(app, /header\.querySelector\("\.saved-bank-remove"\)\.addEventListener\("click"/);
  assert.match(styles, /\.saved-bank-header button \{[^}]*min-width: 24px[^}]*min-height: 24px[^}]*touch-action: manipulation/s);
});

test("settings close on any pointer press outside the menu or toggle", async () => {
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  assert.match(app, /document\.addEventListener\("pointerdown"/);
  assert.match(app, /closest\("#settings-menu, #settings-toggle"\)/);
  assert.doesNotMatch(app, /closest\("\.top-actions"\)/);
});

test("empty saved banks stay out of the interface and startup state is not treated as live", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.doesNotMatch(html, /Save the current Remote Controls/);
  assert.doesNotMatch(app, /Save the current Remote Controls/);
  assert.match(app, /panel\.hidden = !pinned\.length/);
  assert.match(app, /live\.connected !== true/);
  assert.match(styles, /\.saved-banks-panel\[hidden\] \{ display: none; \}/);
});

test("the bridge survives partially populated Bitwig cursors", async () => {
  const extension = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/PerformancePanelExtension.java", import.meta.url),
    "utf8",
  );
  const savedBank = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/SavedRemoteBank.java", import.meta.url),
    "utf8",
  );
  assert.match(extension, /private void refreshState\(\)/);
  assert.match(extension, /catch \(final RuntimeException error\)/);
  assert.match(extension, /selectedTrackColor == null \? ""/);
  assert.match(savedBank, /color == null \? "" : color\.toHex\(\)/);
});

test("navigation filters include master without coupling it to the mixer", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const extension = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/PerformancePanelExtension.java", import.meta.url),
    "utf8",
  );
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.ok(html.indexOf('id="panel-title-setting"') > html.indexOf('id="mixer-width"'));
  assert.match(html, /id="include-master-track"[^>]*checked/);
  assert.match(app, /pendingSettings\.set\("includeMasterTrack", value\)/);
  assert.match(extension, /case MASTER -> includeMasterTrack\.get\(\)/);
  assert.doesNotMatch(extension, /includeMasterTrack[^\n]*mixerChannels/);
  assert.ok(html.indexOf('id="panel-subtitle-setting"') > html.indexOf('id="panel-title-setting"'));
  assert.match(styles, /\.setting-row\.text-setting \{ cursor: default; \}/);
  assert.doesNotMatch(styles, /\.setting-row\.text-setting \{ display: grid/);
});

test("saved remote pages scale to 32 without serializing idle slots", async () => {
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const extension = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/PerformancePanelExtension.java", import.meta.url),
    "utf8",
  );
  const savedBank = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/SavedRemoteBank.java", import.meta.url),
    "utf8",
  );
  assert.match(extension, /SAVED_BANK_COUNT = 32/);
  assert.match(extension, /if \(!bank\.isPinned\(\)\) continue/);
  assert.match(extension, /if \(!channel\.isPinned\(\)\) continue/);
  assert.match(extension, /savedBankCapacity/);
  assert.match(savedBank, /PAGE_STACK_COUNT = 1/);
  assert.match(app, /SAVED_BANK_CAPACITY = 32/);
  assert.match(app, /All \$\{capacity\} saved page slots are in use/);
  assert.match(app, /updateSavedBankValues\(pinned\)/);
  assert.match(extension, /public void flush\(\) \{\s*\/\/ Browser state and queued commands are serviced by bridgeTick\./s);
  assert.match(extension, /scheduleTask\(this::bridgeTick, 50\)/);
  assert.match(extension, /if \(server\.consumeStateRequest\(\)\) refreshState\(\)/);
});

test("the bundled Bitwig font pairing is local and licensed", async () => {
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(styles, /font-family: "Lato"/);
  assert.match(styles, /font-family: "Source Code Pro"/);
  for (const file of [
    "Lato-Regular.ttf",
    "Lato-Medium.ttf",
    "Lato-Semibold.ttf",
    "SourceCodePro-Regular.ttf",
    "LICENSE.txt",
    "OFL.txt",
  ]) {
    await access(new URL(`../fonts/${file}`, import.meta.url));
  }
});

test("saved banks use contained responsive headers and optional project track colors", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  const extension = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/PerformancePanelExtension.java", import.meta.url),
    "utf8",
  );
  const savedBank = await readFile(
    new URL("../../bitwig-extension/src/com/chxrd/performancepanel/SavedRemoteBank.java", import.meta.url),
    "utf8",
  );
  assert.match(html, /id="use-track-color"/);
  assert.doesNotMatch(html, /<small>/);
  assert.match(app, /set-use-track-color/);
  assert.match(app, /--bank-accent/);
  assert.match(app, /--live-accent/);
  assert.match(app, /has-redundant-device/);
  assert.match(styles, /\.saved-banks \{[^}]*gap: 6px/s);
  assert.match(styles, /\.saved-bank \{[^}]*overflow: hidden/s);
  assert.match(styles, /not\(\[data-bank-size="large"\]\) \.saved-bank-context b \{ display: none; \}/);
  assert.match(extension, /getDocumentState\(\)\.getBooleanSetting\(\s*"Use Track Color"/s);
  assert.match(extension, /field\(json, "trackColor", selectedTrackColor == null \? "" : selectedTrackColor\.toHex\(\)\)/);
  assert.match(savedBank, /track\.color\(\)/);
});
