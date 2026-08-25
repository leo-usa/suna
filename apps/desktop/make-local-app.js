'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const desktopDir = __dirname;
const appPath = path.join(desktopDir, 'dist', 'Dobby Local.app');
const contents = path.join(appPath, 'Contents');
const macos = path.join(contents, 'MacOS');
const resources = path.join(contents, 'Resources');
const iconSrc = path.join(desktopDir, 'assets', 'icon.icns');

fs.rmSync(appPath, { recursive: true, force: true });
fs.mkdirSync(macos, { recursive: true });
fs.mkdirSync(resources, { recursive: true });

const launcher = `#!/bin/bash
set -e
DESKTOP="${desktopDir}"
cd "$DESKTOP"
export APP_URL="\${APP_URL:-http://localhost:3000}"
ELECTRON="$DESKTOP/node_modules/.bin/electron"
if [ ! -x "$ELECTRON" ]; then
  osascript -e 'display alert "Dobby Local" message "Run npm install in apps/desktop first." as critical'
  exit 1
fi
exec "$ELECTRON" "$DESKTOP"
`;

fs.writeFileSync(path.join(macos, 'Dobby Local'), launcher, { mode: 0o755 });

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>Dobby Local</string>
  <key>CFBundleIconFile</key>
  <string>icon</string>
  <key>CFBundleIdentifier</key>
  <string>com.dobby.local-launcher</string>
  <key>CFBundleName</key>
  <string>Dobby Local</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>2.0.0</string>
  <key>CFBundleVersion</key>
  <string>2.0.0</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
`;
fs.writeFileSync(path.join(contents, 'Info.plist'), plist);
if (fs.existsSync(iconSrc)) {
  fs.copyFileSync(iconSrc, path.join(resources, 'icon.icns'));
}

try {
  execFileSync('/usr/bin/xattr', ['-cr', appPath]);
} catch (_) { /* ignore */ }

console.log(appPath);
