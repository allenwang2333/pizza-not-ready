#!/bin/bash
# Builds "Pizza Ready.app" from index.html and the Swift wrapper in mac/.
set -euo pipefail
cd "$(dirname "$0")"

APP="Pizza Ready.app"
BUILD="build"
rm -rf "$APP" "$BUILD"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$BUILD"

swiftc -O -o "$APP/Contents/MacOS/PizzaReady" mac/main.swift -framework Cocoa -framework WebKit
swift mac/make-icon.swift "$BUILD/AppIcon.iconset"
iconutil -c icns "$BUILD/AppIcon.iconset" -o "$APP/Contents/Resources/AppIcon.icns"
cp index.html "$APP/Contents/Resources/"
cp -R vendor "$APP/Contents/Resources/"
cp mac/Info.plist "$APP/Contents/"
codesign --force --deep -s - "$APP"
rm -rf "$BUILD"
echo "Built: $(pwd)/$APP"
