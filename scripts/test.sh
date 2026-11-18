#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
"$ROOT_DIR/scripts/build-extension.sh"
zipinfo -1 "$ROOT_DIR/build/extension/PerformancePanel.bwextension" | grep -x "app/index.html" >/dev/null
zipinfo -1 "$ROOT_DIR/build/extension/PerformancePanel.bwextension" | grep -x "app/guide.html" >/dev/null
zipinfo -1 "$ROOT_DIR/build/extension/PerformancePanel.bwextension" | grep -x "app/guide.css" >/dev/null
zipinfo -1 "$ROOT_DIR/build/extension/PerformancePanel.bwextension" | grep -x "app/src/app.js" >/dev/null
zipinfo -1 "$ROOT_DIR/build/extension/PerformancePanel.bwextension" | grep -x "app/src/control-kind.mjs" >/dev/null
if zipinfo -1 "$ROOT_DIR/build/extension/PerformancePanel.bwextension" | grep -qx "app/src/app.test.mjs"; then
  echo "Test source must not be bundled in the extension." >&2
  exit 1
fi

if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/java" ]]; then
  JAVA="$JAVA_HOME/bin/java"
  JAVAC="$JAVA_HOME/bin/javac"
elif [[ -x "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/java" ]]; then
  JAVA="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/java"
  JAVAC="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/javac"
else
  JAVA="$(command -v java)"
  JAVAC="$(command -v javac)"
fi
BRIDGE_TEST_CLASSES="$ROOT_DIR/build/bridge-test-classes"
rm -rf "$BRIDGE_TEST_CLASSES"
mkdir -p "$BRIDGE_TEST_CLASSES"
"$JAVAC" -Xlint:all --release 21 --add-modules jdk.httpserver \
  -d "$BRIDGE_TEST_CLASSES" \
  "$ROOT_DIR/bitwig-extension/src/com/chxrd/performancepanel/Command.java" \
  "$ROOT_DIR/bitwig-extension/src/com/chxrd/performancepanel/BridgeServer.java" \
  "$ROOT_DIR/bitwig-extension/test/com/chxrd/performancepanel/BridgeServerTest.java"
"$JAVA" --add-modules jdk.httpserver \
  -cp "$BRIDGE_TEST_CLASSES:$ROOT_DIR/build/extension/staging" \
  com.chxrd.performancepanel.BridgeServerTest

node --test "$ROOT_DIR/app/src/app.test.mjs"
