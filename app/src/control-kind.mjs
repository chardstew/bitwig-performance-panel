const toggleDisplays = new Set(["on", "off", "yes", "no", "enabled", "disabled", "true", "false"]);

export function inferControlKind(parameter = {}) {
  const steps = Number(parameter.steps) || 0;
  if (steps === 2) return "toggle";
  if (steps > 2) return "stepped";
  const display = String(parameter.display || "").trim().toLowerCase();
  return toggleDisplays.has(display) ? "toggle" : "continuous";
}

export function normalizeControlValue(parameter = {}, value) {
  const normalized = Math.max(0, Math.min(1, Number(value) || 0));
  const steps = Number(parameter.steps) || 0;
  return steps > 1 ? Math.round(normalized * (steps - 1)) / (steps - 1) : normalized;
}
