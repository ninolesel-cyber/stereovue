#!/bin/bash
# Usage: build-native.sh <project-dir-with-.output> <dest.app>
set -euo pipefail
SRC="$1"; DEST="$2"; HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
rm -rf "$DEST"
mkdir -p "$DEST/Contents/MacOS" "$DEST/Contents/Resources/server"
swiftc -O -target arm64-apple-macos12.0 -o "$DEST/Contents/MacOS/Stereo Vue" "$HERE/main.swift" \
  -framework AppKit -framework WebKit
cp -R "$SRC/.output/." "$DEST/Contents/Resources/server/"
lipo /usr/local/bin/node -thin arm64 -output "$DEST/Contents/Resources/node"
chmod +x "$DEST/Contents/Resources/node"
LOGO="$SRC/public/stereo-vue-logo.jpg"
IS="$WORK/icon.iconset"; mkdir -p "$IS"
sips -c 675 675 "$LOGO" --out "$WORK/sq.jpg" >/dev/null
for s in 16 32 128 256 512; do
  sips -s format png -z $s $s "$WORK/sq.jpg" --out "$IS/icon_${s}x${s}.png" >/dev/null
  sips -s format png -z $((s*2)) $((s*2)) "$WORK/sq.jpg" --out "$IS/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$IS" -o "$DEST/Contents/Resources/AppIcon.icns"
cat > "$DEST/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Stereo Vue</string>
  <key>CFBundleDisplayName</key><string>Stereo Vue</string>
  <key>CFBundleIdentifier</key><string>art.ninography.stereovue</string>
  <key>CFBundleExecutable</key><string>Stereo Vue</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.1</string>
  <key>CFBundleVersion</key><string>3</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.photography</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSCameraUsageDescription</key><string>Stereo Vue uses the camera to take a photograph for the stereoscope.</string>
  <key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
  <key>NSHumanReadableCopyright</key><string>After Wheatstone's stereoscope, MDCCCXXXII.</string>
</dict></plist>
PLIST
codesign --force --deep --sign - "$DEST"
xattr -cr "$DEST"
rm -rf "$WORK"
echo "Built $DEST"
