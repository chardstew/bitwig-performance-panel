export const HOTKEY_ACTIONS = Object.freeze([
  { id: "play-stop", label: "Play / Stop", defaultBinding: "Space" },
  { id: "metronome", label: "Metronome", defaultBinding: "C" },
  { id: "undo", label: "Undo", defaultBinding: "Mod+Z" },
  { id: "redo", label: "Redo", defaultBinding: "Mod+Shift+Z" },
  { id: "previous-track", label: "Previous Track", defaultBinding: "" },
  { id: "next-track", label: "Next Track", defaultBinding: "" },
  { id: "previous-device", label: "Previous Device", defaultBinding: "" },
  { id: "next-device", label: "Next Device", defaultBinding: "" },
  { id: "previous-page", label: "Previous Remote Page", defaultBinding: "" },
  { id: "next-page", label: "Next Remote Page", defaultBinding: "" },
  { id: "toggle-remote-source", label: "Switch Device / Project Remotes", defaultBinding: "" },
  { id: "add-bank", label: "Add Remote Page", defaultBinding: "" },
  { id: "toggle-transport-bar", label: "Show / Hide Transport Bar", defaultBinding: "" },
  { id: "toggle-remote-controls", label: "Show / Hide Navigator", defaultBinding: "" },
  { id: "toggle-mixer", label: "Show / Hide Mixer", defaultBinding: "" },
]);

export const defaultHotkeys = () => Object.fromEntries(
  HOTKEY_ACTIONS.map(({ id, defaultBinding }) => [id, defaultBinding]),
);

export function hotkeyFromEvent(event) {
  if (["Meta", "Control", "Alt", "Shift"].includes(event.key)) return "";
  let key = event.code || event.key;
  if (key === "Space") key = "Space";
  else if (/^Key[A-Z]$/.test(key)) key = key.slice(3);
  else if (/^Digit[0-9]$/.test(key)) key = key.slice(5);
  else if (!/^(Arrow(?:Up|Right|Down|Left)|PageUp|PageDown|Home|End|Enter)$/.test(key)) return "";
  const parts = [];
  if (event.metaKey || event.ctrlKey) parts.push("Mod");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  parts.push(key);
  return parts.join("+");
}

export function formatHotkey(binding, isMac = false) {
  if (!binding) return "Not set";
  const names = isMac
    ? { Mod: "⌘", Alt: "⌥", Shift: "⇧", Space: "Space" }
    : { Mod: "Ctrl", Alt: "Alt", Shift: "Shift", Space: "Space" };
  return binding.split("+").map((part) => names[part] || part.replace("Arrow", "")).join(isMac ? "" : "+");
}
