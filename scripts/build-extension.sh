#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_DIR="$(cd "$ROOT_DIR/.." && pwd)"
API_VERSION="21"
API_CACHE="$ROOT_DIR/build/dependencies/extension-api-$API_VERSION.jar"
API_URL="https://maven.bitwig.com/com/bitwig/extension-api/$API_VERSION/extension-api-$API_VERSION.jar"
API_SHA256="eef420a95b1e8c418ee23a5d3969e000413fd5c10432e53a76ede8de31238888"
BUILD_DIR="$ROOT_DIR/build/extension"
CLASSES_DIR="$BUILD_DIR/classes"
STAGING_DIR="$BUILD_DIR/staging"
OUTPUT="$BUILD_DIR/PerformancePanel.bwextension"

if [[ -n "${JAVA_HOME:-}" && -x "$JAVA_HOME/bin/javac" ]]; then
  JAVAC="$JAVA_HOME/bin/javac"
elif [[ -x "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/javac" ]]; then
  JAVAC="/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/javac"
elif command -v javac >/dev/null 2>&1; then
  JAVAC="$(command -v javac)"
else
  echo "OpenJDK 21 or newer is required. Set JAVA_HOME or add javac to PATH." >&2
  exit 1
fi

if [[ -n "${BITWIG_EXTENSION_API_JAR:-}" && -f "$BITWIG_EXTENSION_API_JAR" ]]; then
  API_JAR="$BITWIG_EXTENSION_API_JAR"
elif [[ -f "$API_CACHE" ]]; then
  API_JAR="$API_CACHE"
elif [[ -f "$WORKSPACE_DIR/extensions/chxrdmoss/.m2/com/bitwig/extension-api/$API_VERSION/extension-api-$API_VERSION.jar" ]]; then
  API_JAR="$WORKSPACE_DIR/extensions/chxrdmoss/.m2/com/bitwig/extension-api/$API_VERSION/extension-api-$API_VERSION.jar"
else
  command -v curl >/dev/null 2>&1 || { echo "curl is required to download the Bitwig Extension API." >&2; exit 1; }
  mkdir -p "$(dirname "$API_CACHE")"
  echo "Downloading Bitwig Extension API $API_VERSION..." >&2
  curl -fsSL "$API_URL" -o "$API_CACHE.tmp"
  mv "$API_CACHE.tmp" "$API_CACHE"
  API_JAR="$API_CACHE"
fi

if [[ -z "${BITWIG_EXTENSION_API_JAR:-}" ]]; then
  if command -v sha256sum >/dev/null 2>&1; then
    ACTUAL_API_SHA256="$(sha256sum "$API_JAR" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then
    ACTUAL_API_SHA256="$(shasum -a 256 "$API_JAR" | awk '{print $1}')"
  else
    echo "sha256sum or shasum is required to verify the Bitwig Extension API." >&2
    exit 1
  fi
  if [[ "$ACTUAL_API_SHA256" != "$API_SHA256" ]]; then
    echo "Bitwig Extension API $API_VERSION checksum mismatch." >&2
    exit 1
  fi
fi
if [[ "$BUILD_DIR" != "$ROOT_DIR/build/extension" ]]; then
  echo "Refusing to clean an unexpected build directory." >&2
  exit 1
fi

rm -rf "$BUILD_DIR"
mkdir -p "$CLASSES_DIR" "$STAGING_DIR"

"$JAVAC" \
  -Xlint:all \
  --release 21 \
  --add-modules jdk.httpserver \
  -cp "$API_JAR" \
  -d "$CLASSES_DIR" \
  $(find "$ROOT_DIR/bitwig-extension/src" -name '*.java' -print)

cp -R "$CLASSES_DIR/." "$STAGING_DIR/"
cp -R "$ROOT_DIR/bitwig-extension/resources/." "$STAGING_DIR/"
mkdir -p "$STAGING_DIR/app"
cp -R "$ROOT_DIR/app/." "$STAGING_DIR/app/"
rm "$STAGING_DIR/app/src/app.test.mjs"

(
  cd "$STAGING_DIR"
  zip -q -r "$OUTPUT" .
)

echo "$OUTPUT"
