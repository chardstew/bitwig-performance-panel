#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="$ROOT_DIR/build/extension/PerformancePanel.bwextension"
case "$(uname -s)" in
  Darwin) TARGET_DIR="$HOME/Documents/Bitwig Studio/Extensions/Performance Panel" ;;
  Linux) TARGET_DIR="$HOME/Bitwig Studio/Extensions/Performance Panel" ;;
  MINGW*|MSYS*|CYGWIN*) TARGET_DIR="${USERPROFILE:-$HOME}/Documents/Bitwig Studio/Extensions/Performance Panel" ;;
  *) echo "Unsupported platform. Drag the built .bwextension file into Bitwig Studio." >&2; exit 1 ;;
esac
TARGET="$TARGET_DIR/PerformancePanel.bwextension"
TEMP_TARGET="$TARGET_DIR/.PerformancePanel.bwextension.$$.tmp"

"$ROOT_DIR/scripts/build-extension.sh" >/dev/null
mkdir -p "$TARGET_DIR"
trap 'rm -f "$TEMP_TARGET"' EXIT
cp "$SOURCE" "$TEMP_TARGET"
mv -f "$TEMP_TARGET" "$TARGET"
trap - EXIT
echo "$TARGET"
