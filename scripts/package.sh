#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
VERSION="$(sed -n 's/.*VERSION = "\([^"]*\)";.*/\1/p' \
  "$ROOT_DIR/bitwig-extension/src/com/chxrd/performancepanel/PerformancePanelExtensionDefinition.java")"
[[ -n "$VERSION" ]] || { echo "Could not read extension version." >&2; exit 1; }

"$ROOT_DIR/scripts/test.sh"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/package"
cp "$ROOT_DIR/build/extension/PerformancePanel.bwextension" "$DIST_DIR/package/"
cp "$ROOT_DIR/CHANGELOG.md" "$DIST_DIR/package/"
cp "$ROOT_DIR/LICENSE" "$DIST_DIR/package/"
cp "$ROOT_DIR/README.md" "$DIST_DIR/package/"
(
  cd "$DIST_DIR/package"
  zip -q -r "$DIST_DIR/PerformancePanel-$VERSION.zip" .
)
if command -v sha256sum >/dev/null 2>&1; then
  (cd "$DIST_DIR" && sha256sum "PerformancePanel-$VERSION.zip" > "PerformancePanel-$VERSION.zip.sha256")
else
  (cd "$DIST_DIR" && shasum -a 256 "PerformancePanel-$VERSION.zip" > "PerformancePanel-$VERSION.zip.sha256")
fi
echo "$DIST_DIR/PerformancePanel-$VERSION.zip"
