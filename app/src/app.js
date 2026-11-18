import { inferControlKind, normalizeControlValue } from "./control-kind.mjs";
import { HOTKEY_ACTIONS, defaultHotkeys, formatHotkey, hotkeyFromEvent } from "./hotkeys.mjs";

const BRIDGE = location.port === "32146" ? location.origin : "http://127.0.0.1:32146";
const POLL_MS = 100;
const BANK_VIEWS = new Set(["linear", "grid", "compact"]);
const SAVED_BANK_CAPACITY = 32;
const HOTKEY_STORAGE_KEY = "performance-panel-hotkeys-v1";
const DEFAULT_SECTION_ORDER = [
  "mixer",
  ...Array.from({ length: SAVED_BANK_CAPACITY }, (_, index) => `bank:${index}`),
].join(",");

const $ = (id) => document.getElementById(id);
const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const ordinal = (index, count) => index
  ? `[${index}${count ? `/${count}` : ""}]`
  : "[—]";
const compactTrackPath = (path) => {
  const parts = String(path || "").split(/\s*\/\s*/).filter(Boolean);
  if (parts.length <= 2) return parts.join(" › ");
  return `${parts[0]} › … › ${parts.at(-1)}`;
};
let state;
let online = false;
let messageTimer;
let activeControl = null;
let bankView = "linear";
let liveRenderKey = "";
let savedRenderKey = "";
let mixerRenderKey = "";
let currentMixerWidth = "full";
let currentMixerPosition = "mid";
let currentRemoteControlsPosition = "top";
let showMixer = false;
let showTransportBar = true;
let showRemoteControls = true;
const pendingSettings = new Map();
const pendingMixerButtons = new Map();
const pendingRemoteButtons = new Map();
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
let hotkeys = loadHotkeys();
document.documentElement.dataset.bankLayout = "linear";
document.documentElement.dataset.bankSize = "large";

function loadHotkeys() {
  const defaults = defaultHotkeys();
  try {
    const saved = JSON.parse(localStorage.getItem(HOTKEY_STORAGE_KEY) || "{}");
    for (const action of HOTKEY_ACTIONS) {
      if (typeof saved[action.id] === "string") defaults[action.id] = saved[action.id];
    }
  } catch { /* Use defaults when browser storage is unavailable or invalid. */ }
  return defaults;
}

function saveHotkeys() {
  try { localStorage.setItem(HOTKEY_STORAGE_KEY, JSON.stringify(hotkeys)); } catch { /* Browser storage is optional. */ }
}

function settingValue(next, key, fallback) {
  const liveValue = next.settings?.[key];
  if (pendingSettings.has(key)) {
    const pendingValue = pendingSettings.get(key);
    if (liveValue === pendingValue) pendingSettings.delete(key);
    else return pendingValue;
  }
  return liveValue ?? fallback;
}

const offlineState = () => ({
  connected: false,
  selected: {},
  transport: {},
  remotes: [],
  remotePages: [],
  savedBankCapacity: SAVED_BANK_CAPACITY,
  savedBanks: [],
  mixer: { channels: [] },
  settings: {},
});

async function getLiveState() {
  const response = await fetch(`${BRIDGE}/v1/state`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Bridge returned ${response.status}`);
  const live = await response.json();
  if (live.connected !== true) throw new Error("Bridge is not ready");
  return live;
}

async function command(action, values = {}) {
  if (!online) {
    showMessage("Bitwig is offline.");
    return;
  }
  const query = new URLSearchParams({ action, ...values });
  const response = await fetch(`${BRIDGE}/v1/command?${query}`, { method: "POST" });
  if (!response.ok) throw new Error(`Command returned ${response.status}`);
}

function showMessage(text) {
  $("message").textContent = text;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    messageTimer = null;
    $("message").textContent = online ? "● BITWIG CONNECTED" : "● OFFLINE";
  }, 3200);
}

function renderHeader(next) {
  const selection = next.selected || {};
  const useTrackColor = next.settings?.useTrackColor === true;
  const panelTitle = next.settings?.panelTitle ?? "Performance Panel";
  const panelSubtitle = next.settings?.panelSubtitle ?? "BITWIG PERFORMANCE SURFACE";
  $("panel-title").textContent = panelTitle;
  $("panel-subtitle").textContent = panelSubtitle;
  if (document.activeElement !== $("panel-title-setting")) $("panel-title-setting").value = panelTitle;
  if (document.activeElement !== $("panel-subtitle-setting")) $("panel-subtitle-setting").value = panelSubtitle;
  $("track").textContent = selection.track || "—";
  $("device").textContent = selection.device || "—";
  $("page").textContent = selection.page || "—";
  $("track-count").textContent = ordinal(selection.trackIndex, selection.trackCount);
  $("device-count").textContent = ordinal(selection.deviceIndex, selection.deviceCount);
  $("page-count").textContent = ordinal(selection.pageIndex, selection.pageCount);
  $("include-groups").checked = settingValue(next, "includeGroups", true);
  $("include-effect-tracks").checked = settingValue(next, "includeEffectTracks", true);
  $("include-master-track").checked = settingValue(next, "includeMasterTrack", true);
  $("use-track-color").checked = useTrackColor;
  showTransportBar = settingValue(next, "showTransportBar", true);
  $("show-transport-bar").checked = showTransportBar;
  layoutTransportBar();
  showRemoteControls = settingValue(next, "showRemoteControls", true);
  $("show-remote-controls").checked = showRemoteControls;
  const controlBank = document.querySelector(".control-bank");
  controlBank.hidden = !showRemoteControls;
  currentRemoteControlsPosition = settingValue(next, "remoteControlsPosition", "top");
  $("remote-controls-position").value = currentRemoteControlsPosition;
  showMixer = settingValue(next, "showMixer", false);
  currentMixerWidth = settingValue(next, "mixerWidth", "full");
  currentMixerPosition = settingValue(next, "mixerPosition", "mid");
  $("show-mixer").checked = showMixer;
  $("exclusive-solo").checked = settingValue(next, "exclusiveSolo", false);
  $("mixer-placement").value = currentMixerPosition;
  $("mixer-width").value = currentMixerWidth;
  if (useTrackColor && selection.trackColor) {
    controlBank.style.setProperty("--live-accent", selection.trackColor);
  } else {
    controlBank.style.removeProperty("--live-accent");
  }
  const legacyView = next.settings?.bankLayout === "rectangular"
    ? next.settings?.bankSize === "small" ? "compact" : "grid"
    : "linear";
  bankView = BANK_VIEWS.has(next.settings?.bankView) ? next.settings.bankView : legacyView;
  document.documentElement.dataset.bankLayout = bankView === "linear" ? "linear" : "rectangular";
  document.documentElement.dataset.bankSize = bankView === "linear"
    ? "large"
    : bankView === "grid" ? "medium" : "small";
  $("bank-view").value = bankView;
  $("host").textContent = `${next.host?.product || "—"} ${next.host?.version || ""}`.trim();
  $("api").textContent = next.host?.api ?? "—";
  $("updated").textContent = new Date().toLocaleTimeString();

  if (!messageTimer) $("message").textContent = online ? "● BITWIG CONNECTED" : "● OFFLINE";
}

function layoutTransportBar() {
  const topbar = document.querySelector(".topbar");
  const statusbar = document.querySelector(".statusbar");
  const actions = document.querySelector(".top-actions");
  const saveButton = $("save-bank");
  topbar.hidden = !showTransportBar;
  if (showTransportBar) {
    if (actions.parentElement !== topbar) topbar.append(actions);
    saveButton.textContent = "＋ ADD REMOTE PAGE";
  } else {
    if (actions.parentElement !== statusbar) statusbar.append(actions);
    saveButton.textContent = "＋ PAGE";
  }
}

function renderTransport(transport = {}) {
  $("transport-play").classList.toggle("active", transport.playing === true);
  $("transport-record").classList.toggle("active", transport.recording === true);
  $("transport-loop").classList.toggle("active", transport.loop === true);
  $("transport-metronome").classList.toggle("active", transport.metronome === true);
  if (document.activeElement !== $("transport-tempo")) {
    const tempo = Number(transport.tempo);
    $("transport-tempo").value = Number.isFinite(tempo) && tempo > 0 ? tempo.toFixed(2) : "";
  }
  $("transport-position").textContent = transport.position || "—";
  $("transport-signature").textContent = transport.timeSignature || "—";
}

function makeRemote(remote, {
  bank = null,
  page = 0,
  pageName = "",
} = {}) {
  const article = document.createElement("article");
  const value = normalizeControlValue(remote, remote.value);
  const kind = inferControlKind(remote);
  const controlKey = bank === null
    ? `live:${page}:${remote.index}` : `bank:${bank}:${page}:${remote.index}`;
  const sendValue = (nextValue) => bank === null
      ? command("set-remote", { page, index: remote.index, value: nextValue })
      : command("set-bank-remote", { bank, page, index: remote.index, value: nextValue });
  article.className = `remote ${kind}`;
  article.title = pageName;
  article.dataset.remoteIndex = String(remote.index);
  article.dataset.remotePage = String(page);
  article.dataset.controlKey = controlKey;
  const empty = remote.exists === false || (!remote.name && !remote.display);
  if (empty) {
    article.classList.add("empty");
    return article;
  }
  if (kind === "toggle") {
    const { value: on, pending } = resolvedRemoteToggle(controlKey, value >= 0.5);
    article.innerHTML = `
      <button class="toggle-control ${on ? "on" : ""}" type="button">${on ? "ON" : "OFF"}</button>
      <label></label>
      <output></output>
    `;
    article.querySelector("label").textContent = remote.name || "Unassigned";
    article.querySelector("output").textContent = pending ? (on ? "On" : "Off") : (remote.display || "—");
    const button = article.querySelector(".toggle-control");
    button.title = `${remote.name || "Remote control"} · ${remote.display || (value >= 0.5 ? "On" : "Off")}`;
    button.addEventListener("pointerdown", () => { activeControl = controlKey; });
    button.addEventListener("pointerup", () => {
      setTimeout(() => { if (activeControl === controlKey) activeControl = null; }, 0);
    });
    button.addEventListener("pointercancel", () => { activeControl = null; });
    button.addEventListener("click", () => {
      const nextOn = !button.classList.contains("on");
      button.classList.toggle("on", nextOn);
      button.textContent = nextOn ? "ON" : "OFF";
      button.title = `${remote.name || "Remote control"} · ${nextOn ? "On" : "Off"}`;
      article.querySelector("output").textContent = nextOn ? "On" : "Off";
      pendingRemoteButtons.set(controlKey, { value: nextOn, expires: performance.now() + 1200 });
      sendValue(nextOn ? 1 : 0);
      activeControl = null;
    });
    return article;
  }
  article.innerHTML = `
    <div class="knob" role="slider" tabindex="0" aria-label="Remote control" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(value * 100)}" style="--value:${value}"></div>
    <label></label>
    <output></output>
    <input type="range" min="0" max="1" step="${Number(remote.steps) > 1 ? 1 / (Number(remote.steps) - 1) : 0.001}" value="${value}" aria-label="Remote control">
  `;
  article.querySelector("label").textContent = remote.name || "Unassigned";
  article.querySelector("output").textContent = remote.display || "—";
  const knob = article.querySelector(".knob");
  knob.setAttribute("aria-label", remote.name || "Remote control");
  knob.title = `${remote.name || "Remote control"} · ${remote.display || "—"}`;
  const input = article.querySelector("input");
  const output = article.querySelector("output");
  const updateVisual = (nextValue) => {
    const normalized = normalizeControlValue(remote, nextValue);
    knob.style.setProperty("--value", normalized);
    knob.setAttribute("aria-valuenow", String(Math.round(normalized * 100)));
    input.value = String(normalized);
    output.textContent = `${Math.round(normalized * 1000) / 10} %`;
    return normalized;
  };

  let dragStartY = 0;
  let dragStartValue = value;
  let dragValue = value;
  let lastDragSend = 0;
  knob.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    activeControl = controlKey;
    dragStartY = event.clientY;
    dragStartValue = clamp(input.value);
    dragValue = dragStartValue;
    knob.setPointerCapture?.(event.pointerId);
    knob.focus();
  });
  knob.addEventListener("pointermove", (event) => {
    if (activeControl !== controlKey || !knob.hasPointerCapture?.(event.pointerId)) return;
    dragValue = updateVisual(dragStartValue + (dragStartY - event.clientY) / 140);
    if (event.timeStamp - lastDragSend > 24) {
      sendValue(dragValue);
      lastDragSend = event.timeStamp;
    }
  });
  const finishKnobDrag = (event) => {
    if (activeControl !== controlKey) return;
    knob.releasePointerCapture?.(event.pointerId);
    sendValue(dragValue);
    activeControl = null;
  };
  knob.addEventListener("pointerup", finishKnobDrag);
  knob.addEventListener("pointercancel", () => { activeControl = null; });
  knob.addEventListener("keydown", (event) => {
    const discreteIncrement = Number(remote.steps) > 1 ? 1 / (Number(remote.steps) - 1) : 0.01;
    const increments = {
      ArrowUp: discreteIncrement,
      ArrowRight: discreteIncrement,
      ArrowDown: -discreteIncrement,
      ArrowLeft: -discreteIncrement,
      PageUp: Math.max(0.1, discreteIncrement),
      PageDown: -Math.max(0.1, discreteIncrement),
    };
    let nextValue;
    if (event.key === "Home") nextValue = 0;
    else if (event.key === "End") nextValue = 1;
    else if (event.key in increments) nextValue = clamp(Number(input.value) + increments[event.key]);
    else return;
    event.preventDefault();
    sendValue(updateVisual(nextValue));
  });

  input.addEventListener("pointerdown", (event) => {
    activeControl = controlKey;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  });
  input.addEventListener("input", () => {
    updateVisual(input.value);
  });
  input.addEventListener("change", () => sendValue(normalizeControlValue(remote, input.value)));
  input.addEventListener("pointerup", () => {
    activeControl = null;
  });
  input.addEventListener("pointercancel", () => { activeControl = null; });
  return article;
}

function controlsForBank(source = {}) {
  const remotePage = source.remotePages?.find((candidate) => candidate.offset === 0);
  const remotes = remotePage?.available !== false
    ? remotePage?.remotes || source.remotes || []
    : [];
  const controls = [];
  for (let control = 0; control < 8; control += 1) {
    controls.push({
      remote: remotes[control] || { index: control, exists: false, name: "", display: "", value: 0 },
      page: 0,
      pageName: remotePage?.name || source.page || "",
    });
  }
  return controls;
}

function remoteStructure({ remote, page, pageName }) {
  return {
    index: remote.index,
    page,
    pageName,
    name: remote.name,
    exists: remote.exists,
    kind: inferControlKind(remote),
    steps: Number(remote.steps) || 0,
  };
}

function resolvedRemoteToggle(controlKey, liveValue) {
  const pending = pendingRemoteButtons.get(controlKey);
  if (!pending) return { value: liveValue, pending: false };
  if (liveValue === pending.value || performance.now() >= pending.expires) {
    pendingRemoteButtons.delete(controlKey);
    return { value: liveValue, pending: false };
  }
  return { value: pending.value, pending: true };
}

function updateRemoteArticle(article, remote) {
  if (!article) return;
  const output = article.querySelector("output");
  if (article.classList.contains("toggle")) {
    const liveOn = clamp(remote.value) >= 0.5;
    const controlKey = article.dataset.controlKey;
    const { value: on, pending } = resolvedRemoteToggle(controlKey, liveOn);
    const button = article.querySelector(".toggle-control");
    button?.classList.toggle("on", on);
    if (button) {
      button.textContent = on ? "ON" : "OFF";
      button.title = `${remote.name || "Remote control"} · ${pending ? (on ? "On" : "Off") : (remote.display || "—")}`;
    }
    if (output) output.textContent = pending ? (on ? "On" : "Off") : (remote.display || "—");
  } else {
    const value = normalizeControlValue(remote, remote.value);
    const knob = article.querySelector(".knob");
    const input = article.querySelector('input[type="range"]');
    knob?.style.setProperty("--value", value);
    knob?.setAttribute("aria-valuenow", String(Math.round(value * 100)));
    if (knob) knob.title = `${remote.name || "Remote control"} · ${remote.display || "—"}`;
    if (input) input.value = String(value);
  }
  if (output && !article.classList.contains("toggle")) output.textContent = remote.display || "—";
}

function updateSavedBankValues(banks = []) {
  const rows = new Map(
    [...$("saved-banks").children]
      .filter((row) => row.dataset.sectionKey?.startsWith("bank:"))
      .map((row) => [Number(row.dataset.sectionKey.slice(5)), row]),
  );
  banks.forEach((bank) => {
    const row = rows.get(bank.index);
    controlsForBank(bank).forEach(({ remote, page }) => {
      const article = row?.querySelector(
        `.remote[data-remote-index="${remote.index}"][data-remote-page="${page}"]`,
      );
      updateRemoteArticle(article, remote);
    });
  });
}

function renderRemotes(remotes = []) {
  if (activeControl?.startsWith("live:")) return;
  const source = {
    remotes,
    remotePages: state?.remotePages,
    page: state?.selected?.page,
  };
  const controls = controlsForBank(source);
  const renderKey = JSON.stringify(controls.map(remoteStructure));
  if (renderKey === liveRenderKey) {
    controls.forEach(({ remote, page }) => {
      const article = $("remotes").querySelector(
        `.remote[data-remote-index="${remote.index}"][data-remote-page="${page}"]`,
      );
      updateRemoteArticle(article, remote);
    });
    return;
  }
  liveRenderKey = renderKey;
  const grid = $("remotes");
  grid.replaceChildren(...controls.map(({ remote, ...options }) => makeRemote(remote, options)));
}

function renderSavedBanks(banks = []) {
  if (activeControl?.startsWith("bank:") || activeControl?.startsWith("mixer:")) return;
  const pinned = banks.filter((bank) => bank.pinned);
  const compactMixer = showMixer && currentMixerPosition === "banks";
  const sectionOrder = settingValue(
    state,
    "sectionOrder",
    DEFAULT_SECTION_ORDER,
  );
  const mixerStructure = (state?.mixer?.channels || []).map(({ index, pinned, exists, name, path, color, kind, trackNumber, master }) => (
    { index, pinned, exists, name, path, color, kind, trackNumber, master }
  ));
  const renderKey = JSON.stringify({
    pinned: pinned.map((bank) => ({
      index: bank.index,
      exists: bank.exists,
      track: bank.track,
      trackPath: bank.trackPath,
      trackColor: bank.trackColor,
      device: bank.device,
      page: bank.page,
      pageIndex: bank.pageIndex,
      pageCount: bank.pageCount,
      controls: controlsForBank(bank).map(remoteStructure),
    })),
    compactMixer,
    mixer: compactMixer ? mixerStructure : null,
    sectionOrder,
    useTrackColor: state?.settings?.useTrackColor === true,
  });
  if (renderKey === savedRenderKey) {
    updateSavedBankValues(pinned);
    if (compactMixer) updateMixerValues($("saved-banks"), state?.mixer?.channels || []);
    return;
  }
  savedRenderKey = renderKey;
  const panel = document.querySelector(".saved-banks-panel");
  panel.hidden = !pinned.length && !compactMixer;
  if (!pinned.length && !compactMixer) {
    $("saved-banks").replaceChildren();
    return;
  }
  const sections = pinned.map((bank) => {
    const row = document.createElement("article");
    row.className = "saved-bank";
    row.dataset.sectionKey = `bank:${bank.index}`;
    if (state?.settings?.useTrackColor && bank.trackColor) {
      row.style.setProperty("--bank-accent", bank.trackColor);
    }
    const header = document.createElement("div");
    header.className = "saved-bank-header";
    header.innerHTML = `
      <span class="saved-bank-id"><span class="saved-bank-word">BANK </span>${String(bank.index + 1).padStart(2, "0")}</span>
      <div class="saved-bank-context">
        <span class="context-track"><b>TRACK:</b> <strong data-field="track"></strong></span>
        <span class="context-device"><b>DEVICE:</b> <strong data-field="device"></strong></span>
        <span class="context-page"><b>PAGE:</b> <strong data-field="page"></strong></span>
      </div>
      <button class="saved-bank-remove" type="button" draggable="false" aria-label="Remove saved page" title="Remove saved page"><span class="remove-long">REMOVE</span><span class="remove-short" aria-hidden="true">×</span></button>
    `;
    const fullTrackPath = bank.trackPath || bank.track || "Unavailable";
    header.querySelector('[data-field="track"]').textContent = compactTrackPath(fullTrackPath);
    header.querySelector('[data-field="track"]').title = fullTrackPath;
    header.querySelector('[data-field="device"]').textContent = bank.exists ? bank.device || "—" : "Unavailable";
    header.querySelector('[data-field="page"]').textContent = bank.exists
      ? `${bank.page || "—"} ${ordinal(bank.pageIndex, bank.pageCount)}`
      : "Unavailable";
    if (bank.exists && bank.track && bank.device
        && bank.track.trim().toLocaleLowerCase() === bank.device.trim().toLocaleLowerCase()) {
      header.querySelector(".saved-bank-context").classList.add("has-redundant-device");
      header.querySelector(".context-device").classList.add("redundant");
    }
    header.querySelector(".saved-bank-remove").addEventListener("click", () => {
      command("release-bank", { bank: bank.index });
      showMessage(`Removed page ${bank.index + 1}`);
    });
    const controls = document.createElement("div");
    controls.className = "saved-bank-controls";
    if (bank.exists) controls.replaceChildren(...controlsForBank(bank).map(({ remote, ...options }) => (
      makeRemote(remote, { ...options, bank: bank.index })
    )));
    row.append(header, controls);
    attachSectionDrag(row, header);
    return row;
  });
  if (compactMixer) sections.push(makeMixerSection(true));
  const order = sectionOrder.split(",");
  sections.sort((a, b) => {
    const left = order.indexOf(a.dataset.sectionKey);
    const right = order.indexOf(b.dataset.sectionKey);
    return (left < 0 ? 999 : left) - (right < 0 ? 999 : right);
  });
  $("saved-banks").replaceChildren(...sections);
  if (compactMixer) updateMixerValues($("saved-banks"), state?.mixer?.channels || []);
}

function mixerChannelsForRender(channels = []) {
  return channels
    .filter((channel) => channel.pinned && channel.exists)
    .sort((left, right) => Number(left.master) - Number(right.master) || left.index - right.index);
}

function makeMixerChannel(channel, compact) {
  const article = document.createElement("article");
  const kind = ["group", "effect", "master"].includes(channel?.kind) ? channel.kind : "track";
  article.className = `mixer-channel${compact ? " compact" : ""} channel-${kind}`;
  article.dataset.index = String(channel?.index ?? 0);
  if (!channel?.pinned || !channel?.exists) {
    article.classList.add("empty");
    return article;
  }
  article.style.setProperty("--channel-color", channel.color || "var(--orange)");
  article.innerHTML = `
    <button class="mixer-remove" type="button" aria-label="Remove mixer track">×</button>
    <div class="pan-control" role="slider" tabindex="0" aria-label="Pan" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(clamp(channel.pan) * 100)}" style="--value:${clamp(channel.pan)}"></div>
    <span class="mixer-track-number"></span>
    <div class="mixer-strip-core">
      <span class="mixer-channel-name"></span>
      <div class="volume-control" role="slider" tabindex="0" aria-label="Volume" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(clamp(channel.volume) * 100)}" style="--value:${clamp(channel.volume)}">
        <div class="mixer-meter" style="--level:${clamp(channel.meter)}"></div>
      </div>
    </div>
    <div class="mixer-buttons">
      <button class="mute-control ${channel.mute ? "active" : ""}" type="button" aria-label="Mute">M</button>
      <button class="solo-control ${channel.solo ? "active" : ""}" type="button" aria-label="Solo">S</button>
      <button class="arm-control ${channel.arm ? "active" : ""}" type="button" aria-label="Record arm">R</button>
    </div>
  `;
  const name = article.querySelector(".mixer-channel-name");
  name.textContent = channel.name || "Unavailable";
  name.title = channel.path || channel.name || "";
  const trackLabel = channel.name || "track";
  const trackNumber = article.querySelector(".mixer-track-number");
  trackNumber.textContent = channel.trackNumber > 0 ? String(channel.trackNumber).padStart(2, "0") : "—";
  trackNumber.title = channel.trackNumber > 0 ? `Track ${channel.trackNumber}` : "Track number unavailable";
  const remove = article.querySelector(".mixer-remove");
  remove.setAttribute("aria-label", `Remove ${trackLabel} from mixer`);
  remove.title = `Remove ${trackLabel} from mixer`;
  const volume = article.querySelector(".volume-control");
  const pan = article.querySelector(".pan-control");
  volume.title = `Level · ${channel.volumeDisplay || "—"}`;
  pan.title = `Pan · ${channel.panDisplay || "—"}`;
  article.querySelector(".mute-control").title = "Mute";
  article.querySelector(".solo-control").title = "Solo";
  article.querySelector(".arm-control").title = "Record arm";
  const bindValueControl = (selector, field, action, absolute) => {
    const control = article.querySelector(selector);
    let startY = 0;
    let startValue = clamp(channel[field]);
    const send = (value) => {
      const next = clamp(value);
      control.style.setProperty("--value", next);
      control.setAttribute("aria-valuenow", String(Math.round(next * 100)));
      command(action, { index: channel.index, value: next });
    };
    control.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      activeControl = `mixer:${channel.index}`;
      startY = event.clientY;
      startValue = Number(control.style.getPropertyValue("--value")) || 0;
      control.setPointerCapture(event.pointerId);
      if (absolute) {
        const bounds = control.getBoundingClientRect();
        send((bounds.bottom - event.clientY) / bounds.height);
      }
    });
    control.addEventListener("pointermove", (event) => {
      if (activeControl !== `mixer:${channel.index}` || !control.hasPointerCapture(event.pointerId)) return;
      if (absolute) {
        const bounds = control.getBoundingClientRect();
        send((bounds.bottom - event.clientY) / bounds.height);
      } else {
        send(startValue + (startY - event.clientY) / 120);
      }
    });
    const release = (event) => {
      if (control.hasPointerCapture?.(event.pointerId)) control.releasePointerCapture(event.pointerId);
      activeControl = null;
    };
    control.addEventListener("pointerup", release);
    control.addEventListener("pointercancel", release);
    control.addEventListener("keydown", (event) => {
      if (!["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === "ArrowUp" || event.key === "ArrowRight" ? 1 : -1;
      send((Number(control.style.getPropertyValue("--value")) || 0) + direction * 0.01);
    });
  };
  bindValueControl(".volume-control", "volume", "set-mixer-volume", true);
  bindValueControl(".pan-control", "pan", "set-mixer-pan", false);
  const bindToggle = (selector, field, action) => {
    const button = article.querySelector(selector);
    button.addEventListener("click", () => {
      const value = !button.classList.contains("active");
      button.classList.toggle("active", value);
      pendingMixerButtons.set(`${channel.index}:${field}`, { value, expires: performance.now() + 1200 });
      command(action, { index: channel.index, value: value ? 1 : 0 });
    });
  };
  bindToggle(".mute-control", "mute", "set-mixer-mute");
  bindToggle(".solo-control", "solo", "set-mixer-solo");
  bindToggle(".arm-control", "arm", "set-mixer-arm");
  article.querySelector(".mixer-remove")?.addEventListener("click", () => command("release-mixer-track", { index: channel.index }));
  return article;
}

function updateMixerValues(container, channels) {
  for (const channel of channels) {
    const article = container.querySelector(`.mixer-channel[data-index="${channel.index}"]`);
    if (!article || !channel.pinned || !channel.exists) continue;
    article.querySelector(".mixer-meter")?.style.setProperty("--level", clamp(channel.meter));
    const volume = article.querySelector(".volume-control");
    const pan = article.querySelector(".pan-control");
    if (volume) volume.title = `Level · ${channel.volumeDisplay || "—"}`;
    if (pan) pan.title = `Pan · ${channel.panDisplay || "—"}`;
    if (activeControl !== `mixer:${channel.index}`) {
      if (volume) volume.style.setProperty("--value", clamp(channel.volume));
      if (pan) pan.style.setProperty("--value", clamp(channel.pan));
    }
    for (const [field, selector] of [["mute", ".mute-control"], ["solo", ".solo-control"], ["arm", ".arm-control"]]) {
      const key = `${channel.index}:${field}`;
      const pending = pendingMixerButtons.get(key);
      if (pending && channel[field] === pending.value) pendingMixerButtons.delete(key);
      const value = pending && performance.now() < pending.expires ? pending.value : channel[field] === true;
      if (pending && performance.now() >= pending.expires) pendingMixerButtons.delete(key);
      article.querySelector(selector)?.classList.toggle("active", value);
    }
  }
}

function makeMixerSection(compact) {
  const section = document.createElement(compact ? "article" : "div");
  section.className = compact ? `saved-bank mixer-card mixer-${currentMixerWidth}` : "mixer-content";
  section.dataset.sectionKey = "mixer";
  const header = document.createElement("div");
  header.className = "module-header";
  header.innerHTML = `<strong>MIXER</strong><div class="module-actions"><button type="button" draggable="false" data-action="track" title="Add selected track">＋ TRACK</button><button type="button" draggable="false" data-action="all" title="Add all tracks">＋ ALL</button></div>`;
  header.querySelector('[data-action="track"]').addEventListener("click", () => command("add-mixer-track"));
  header.querySelector('[data-action="all"]').addEventListener("click", () => command("add-mixer-all"));
  const grid = document.createElement("div");
  grid.className = "mixer-grid strips";
  const visibleChannels = mixerChannelsForRender(state?.mixer?.channels);
  grid.style.setProperty("--mixer-columns", Math.max(1, visibleChannels.length));
  grid.replaceChildren(...visibleChannels.map((channel) => makeMixerChannel(channel, compact)));
  section.append(header, grid);
  if (compact) attachSectionDrag(section, header);
  return section;
}

function attachSectionDrag(section, header) {
  header.draggable = true;
  header.addEventListener("dragstart", (event) => {
    if (event.target.closest("button")) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData("text/plain", section.dataset.sectionKey);
    event.dataTransfer.effectAllowed = "move";
  });
  section.addEventListener("dragover", (event) => {
    event.preventDefault();
    section.classList.add("drag-over");
  });
  section.addEventListener("dragleave", () => section.classList.remove("drag-over"));
  section.addEventListener("drop", (event) => {
    event.preventDefault();
    section.classList.remove("drag-over");
    const sourceKey = event.dataTransfer.getData("text/plain");
    const container = $("saved-banks");
    const sections = [...container.children];
    const source = sections.find((item) => item.dataset.sectionKey === sourceKey);
    if (!source || source === section) return;
    const sourceIndex = sections.indexOf(source);
    const targetIndex = sections.indexOf(section);
    [sections[sourceIndex], sections[targetIndex]] = [sections[targetIndex], sections[sourceIndex]];
    container.replaceChildren(...sections);
    const order = sections.map((item) => item.dataset.sectionKey).join(",");
    pendingSettings.set("sectionOrder", order);
    command("set-section-order", { text: order });
  });
}

function renderMixer(mixer = {}) {
  const panel = $("mixer-panel");
  const full = showMixer && currentMixerPosition !== "banks";
  panel.hidden = !full;
  if (!full) return;
  panel.classList.toggle("mixer-half", currentMixerWidth === "half");
  panel.classList.toggle("mixer-quarter", currentMixerWidth === "quarter");
  const visibleChannels = mixerChannelsForRender(mixer.channels);
  $("mixer-grid").style.setProperty("--mixer-columns", Math.max(1, visibleChannels.length));
  const structureKey = JSON.stringify(visibleChannels.map(
    ({ index, pinned, exists, name, path, color, kind, trackNumber, master }) => (
      { index, pinned, exists, name, path, color, kind, trackNumber, master }
    ),
  ));
  if (structureKey !== mixerRenderKey && !activeControl?.startsWith("mixer:")) {
    mixerRenderKey = structureKey;
    $("mixer-grid").replaceChildren(...visibleChannels.map((channel) => makeMixerChannel(channel, false)));
  }
  updateMixerValues($("mixer-grid"), mixer.channels || []);
}

function layoutPanels() {
  const controlBank = document.querySelector(".control-bank");
  const mixerPanel = $("mixer-panel");
  const savedBanksPanel = document.querySelector(".saved-banks-panel");
  const panels = [];
  if (currentMixerPosition === "top") panels.push(mixerPanel);
  if (currentRemoteControlsPosition === "top") panels.push(controlBank);
  if (currentMixerPosition === "mid") panels.push(mixerPanel);
  panels.push(savedBanksPanel);
  if (currentRemoteControlsPosition === "bottom") panels.push(controlBank);
  if (currentMixerPosition === "bottom" || currentMixerPosition === "banks") panels.push(mixerPanel);
  let anchor = document.querySelector(".topbar");
  panels.forEach((panel) => {
    if (panel.previousElementSibling !== anchor) anchor.after(panel);
    anchor = panel;
  });
}

function render(next) {
  state = next;
  renderHeader(next);
  renderTransport(next.transport);
  renderRemotes(next.remotes);
  renderMixer(next.mixer);
  renderSavedBanks(next.savedBanks);
  layoutPanels();
}

async function poll() {
  try {
    const live = await getLiveState();
    online = true;
    render(live);
  } catch (error) {
    if (online || !state) {
      online = false;
      render(offlineState());
    }
  } finally {
    setTimeout(poll, POLL_MS);
  }
}

$("previous-page").addEventListener("click", () => command("previous-page"));
$("next-page").addEventListener("click", () => command("next-page"));
$("previous-track").addEventListener("click", () => command("previous-track"));
$("next-track").addEventListener("click", () => command("next-track"));
$("previous-device").addEventListener("click", () => command("previous-device"));
$("next-device").addEventListener("click", () => command("next-device"));
function addCurrentRemotePage() {
  const banks = state?.savedBanks || [];
  const capacity = state?.savedBankCapacity || SAVED_BANK_CAPACITY;
  if (banks.filter((bank) => bank.pinned).length >= capacity) {
    showMessage(`All ${capacity} saved page slots are in use. Remove one first.`);
    return;
  }
  command("add-bank");
}

function runHotkey(action) {
  const actions = {
    "play-stop": () => command(state?.transport?.playing ? "transport-stop" : "transport-play"),
    metronome: () => command("transport-metronome"),
    undo: () => command("undo"),
    redo: () => command("redo"),
    "previous-track": () => command("previous-track"),
    "next-track": () => command("next-track"),
    "previous-device": () => command("previous-device"),
    "next-device": () => command("next-device"),
    "previous-page": () => command("previous-page"),
    "next-page": () => command("next-page"),
    "add-bank": addCurrentRemotePage,
    "toggle-transport-bar": () => setTransportBarVisibility(!showTransportBar),
    "toggle-remote-controls": () => setRemoteControlsVisibility(!showRemoteControls),
    "toggle-mixer": () => setMixerVisibility(!showMixer),
  };
  actions[action]?.();
}

function setTransportBarVisibility(value) {
  pendingSettings.set("showTransportBar", value);
  showTransportBar = value;
  $("show-transport-bar").checked = value;
  layoutTransportBar();
  command("set-show-transport-bar", { value: value ? 1 : 0 });
}

function setRemoteControlsVisibility(value) {
  pendingSettings.set("showRemoteControls", value);
  showRemoteControls = value;
  $("show-remote-controls").checked = value;
  document.querySelector(".control-bank").hidden = !value;
  command("set-show-remote-controls", { value: value ? 1 : 0 });
}

function setMixerVisibility(value) {
  pendingSettings.set("showMixer", value);
  showMixer = value;
  $("show-mixer").checked = value;
  renderMixer(state?.mixer);
  savedRenderKey = "";
  renderSavedBanks(state?.savedBanks);
  layoutPanels();
  command("set-show-mixer", { value: value ? 1 : 0 });
}

function setHotkey(actionId, binding) {
  if (binding) {
    for (const action of HOTKEY_ACTIONS) {
      if (action.id !== actionId && hotkeys[action.id] === binding) hotkeys[action.id] = "";
    }
  }
  hotkeys[actionId] = binding;
  saveHotkeys();
  renderHotkeys();
}

function renderHotkeys() {
  const list = $("hotkey-list");
  list.replaceChildren(...HOTKEY_ACTIONS.map((action) => {
    const row = document.createElement("div");
    row.className = "hotkey-row";
    const label = document.createElement("span");
    label.textContent = action.label;
    const binding = document.createElement("button");
    binding.type = "button";
    binding.className = `hotkey-binding${hotkeys[action.id] ? "" : " unset"}`;
    binding.textContent = formatHotkey(hotkeys[action.id], isMac);
    binding.setAttribute("aria-label", `${action.label} hotkey`);
    binding.addEventListener("click", () => {
      binding.classList.add("listening");
      binding.textContent = "PRESS KEYS";
    });
    binding.addEventListener("blur", () => {
      if (!binding.isConnected) return;
      binding.classList.remove("listening");
      binding.textContent = formatHotkey(hotkeys[action.id], isMac);
    });
    binding.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        binding.blur();
        return;
      }
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        setHotkey(action.id, "");
        return;
      }
      if (event.key === "Tab") return;
      const nextBinding = hotkeyFromEvent(event);
      if (!nextBinding) return;
      event.preventDefault();
      setHotkey(action.id, nextBinding);
    });
    row.append(label, binding);
    return row;
  }));
}

$("save-bank").addEventListener("click", addCurrentRemotePage);
$("settings-toggle").addEventListener("click", () => {
  const menu = $("settings-menu");
  const open = menu.hidden;
  menu.hidden = !open;
  $("settings-toggle").setAttribute("aria-expanded", String(open));
});
$("hotkeys-open").addEventListener("click", () => {
  $("settings-menu").hidden = true;
  $("settings-toggle").setAttribute("aria-expanded", "false");
  renderHotkeys();
  $("hotkey-dialog").showModal();
});
$("hotkeys-close").addEventListener("click", () => $("hotkey-dialog").close());
$("hotkeys-done").addEventListener("click", () => $("hotkey-dialog").close());
$("hotkeys-reset").addEventListener("click", () => {
  hotkeys = defaultHotkeys();
  saveHotkeys();
  renderHotkeys();
});
$("hotkey-dialog").addEventListener("click", (event) => {
  if (event.target === $("hotkey-dialog")) $("hotkey-dialog").close();
});
$("bank-view").addEventListener("change", (event) => {
  bankView = event.currentTarget.value;
  document.documentElement.dataset.bankLayout = bankView === "linear" ? "linear" : "rectangular";
  document.documentElement.dataset.bankSize = bankView === "linear"
    ? "large"
    : bankView === "grid" ? "medium" : "small";
  command("set-bank-view", { value: ["linear", "grid", "compact"].indexOf(bankView) });
});
$("panel-title-setting").addEventListener("change", (event) => {
  command("set-panel-title", { text: event.currentTarget.value });
});
$("panel-subtitle-setting").addEventListener("change", (event) => {
  command("set-panel-subtitle", { text: event.currentTarget.value });
});
$("transport-play").addEventListener("click", () => command("transport-play"));
$("transport-stop").addEventListener("click", () => command("transport-stop"));
$("transport-undo").addEventListener("click", () => command("undo"));
$("transport-redo").addEventListener("click", () => command("redo"));
$("transport-record").addEventListener("click", () => command("transport-record"));
$("transport-loop").addEventListener("click", () => command("transport-loop"));
$("transport-metronome").addEventListener("click", () => command("transport-metronome"));
$("transport-tempo").addEventListener("change", (event) => {
  command("set-tempo", { value: event.currentTarget.value });
});
$("use-track-color").addEventListener("change", (event) => {
  command("set-use-track-color", { value: event.currentTarget.checked ? 1 : 0 });
});
$("show-transport-bar").addEventListener("change", (event) => {
  setTransportBarVisibility(event.currentTarget.checked);
});
$("show-remote-controls").addEventListener("change", (event) => {
  setRemoteControlsVisibility(event.currentTarget.checked);
});
$("remote-controls-position").addEventListener("change", (event) => {
  const position = event.currentTarget.value;
  pendingSettings.set("remoteControlsPosition", position);
  currentRemoteControlsPosition = position;
  layoutPanels();
  command("set-remote-controls-position", { value: position === "bottom" ? 1 : 0 });
});
$("show-mixer").addEventListener("change", (event) => {
  setMixerVisibility(event.currentTarget.checked);
});
$("mixer-placement").addEventListener("change", (event) => {
  const position = event.currentTarget.value;
  pendingSettings.set("mixerPosition", position);
  currentMixerPosition = position;
  mixerRenderKey = "";
  savedRenderKey = "";
  renderMixer(state?.mixer);
  renderSavedBanks(state?.savedBanks);
  layoutPanels();
  command("set-mixer-position", { value: ["top", "mid", "bottom", "banks"].indexOf(position) });
});
$("mixer-width").addEventListener("change", (event) => {
  const width = event.currentTarget.value;
  pendingSettings.set("mixerWidth", width);
  currentMixerWidth = width;
  mixerRenderKey = "";
  savedRenderKey = "";
  renderMixer(state?.mixer);
  renderSavedBanks(state?.savedBanks);
  command("set-mixer-width", { value: ["full", "half", "quarter"].indexOf(width) });
});
$("mixer-add-track").addEventListener("click", () => command("add-mixer-track"));
$("mixer-add-all").addEventListener("click", () => command("add-mixer-all"));
$("exclusive-solo").addEventListener("change", (event) => {
  const value = event.currentTarget.checked;
  pendingSettings.set("exclusiveSolo", value);
  command("set-exclusive-solo", { value: value ? 1 : 0 });
});
$("include-groups").addEventListener("change", (event) => {
  const value = event.currentTarget.checked;
  pendingSettings.set("includeGroups", value);
  command("set-include-groups", { value: value ? 1 : 0 });
});
$("include-effect-tracks").addEventListener("change", (event) => {
  const value = event.currentTarget.checked;
  pendingSettings.set("includeEffectTracks", value);
  command("set-include-effect-tracks", { value: value ? 1 : 0 });
});
$("include-master-track").addEventListener("change", (event) => {
  const value = event.currentTarget.checked;
  pendingSettings.set("includeMasterTrack", value);
  command("set-include-master-track", { value: value ? 1 : 0 });
});
document.addEventListener("pointerdown", (event) => {
  if ($("settings-menu").hidden) return;
  if (event.target.closest("#settings-menu, #settings-toggle")) return;
  $("settings-menu").hidden = true;
  $("settings-toggle").setAttribute("aria-expanded", "false");
});
document.addEventListener("keydown", (event) => {
  const target = event.target;
  if (target instanceof HTMLElement
      && (target.matches("input, select, textarea, button") || target.isContentEditable)) return;
  if (event.repeat || $("hotkey-dialog").open) return;
  const binding = hotkeyFromEvent(event);
  const action = HOTKEY_ACTIONS.find(({ id }) => hotkeys[id] && hotkeys[id] === binding);
  if (!action) return;
  event.preventDefault();
  runHotkey(action.id);
});
window.addEventListener("resize", () => {
  if (currentMixerPosition !== "banks") return;
  savedRenderKey = "";
  renderSavedBanks(state?.savedBanks);
});
poll();

export { clamp };
