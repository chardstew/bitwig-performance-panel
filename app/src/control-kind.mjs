const toggleDisplays = new Set(["on", "off", "yes", "no", "enabled", "disabled", "true", "false"]);

export function inferControlKind(parameter = {}) {
  const display = String(parameter.display || "").trim().toLowerCase();
  return toggleDisplays.has(display) ? "toggle" : "continuous";
}
