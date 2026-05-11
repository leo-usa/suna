#!/usr/bin/env bash
# Regenerate macOS .icns and PNG app icons from the web Dobby symbol SVG.
# Requires: rsvg-convert (brew install librsvg), macOS sips + iconutil.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/../.." && pwd)"
SVG="$REPO/apps/frontend/public/dobby-symbol.svg"
MASTER="$(mktemp /tmp/dobby-desktop-icon-XXXXXX.png)"
ICONSET="$(mktemp -d /tmp/DobbyDesktop.iconset.XXXXXX)"

cleanup() { rm -f "$MASTER"; rm -rf "$ICONSET"; }
trap cleanup EXIT

rsvg-convert -w 2048 -h 2048 "$SVG" -o "$MASTER"

mkdir -p "$ICONSET"
sips -z 16 16 "$MASTER" --out "$ICONSET/icon_16x16.png" >/dev/null
sips -z 32 32 "$MASTER" --out "$ICONSET/icon_16x16@2x.png" >/dev/null
sips -z 32 32 "$MASTER" --out "$ICONSET/icon_32x32.png" >/dev/null
sips -z 64 64 "$MASTER" --out "$ICONSET/icon_32x32@2x.png" >/dev/null
sips -z 128 128 "$MASTER" --out "$ICONSET/icon_128x128.png" >/dev/null
sips -z 256 256 "$MASTER" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
sips -z 256 256 "$MASTER" --out "$ICONSET/icon_256x256.png" >/dev/null
sips -z 512 512 "$MASTER" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
sips -z 512 512 "$MASTER" --out "$ICONSET/icon_512x512.png" >/dev/null
sips -z 1024 1024 "$MASTER" --out "$ICONSET/icon_512x512@2x.png" >/dev/null

iconutil -c icns "$ICONSET" -o "$ROOT/assets/icon.icns"
sips -z 1024 1024 "$MASTER" --out "$ROOT/assets/icon.png" >/dev/null
cp "$MASTER" "$ROOT/assets/AppIcon.png"

echo "Updated: $ROOT/assets/icon.icns, icon.png, AppIcon.png"
