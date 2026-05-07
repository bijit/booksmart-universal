#!/bin/bash
# BookSmart Extension Build Script
# Copies files to dist/ directory for loading in Chrome

echo "Building BookSmart Extension..."

# Clean dist folder
rm -rf dist/*
mkdir -p dist/icons
mkdir -p dist/lib
mkdir -p dist/utils

# Copy manifest
cp public/manifest.json dist/

# Copy icons
cp src/icons/*.png dist/icons/

# Copy config
cp src/config.js dist/

# Copy utilities
cp src/utils/*.js dist/utils/

# Copy libraries
cp src/lib/*.js dist/lib/

# Copy background script
cp src/background/background.js dist/
# Fix imports in background.js (from ../ to ./)
sed -i '' "s|'../|'./|g" dist/background.js
# Prepend polyfill import to background.js if it's a module
# For V3, we often need to include the polyfill at the top
echo "import './lib/browser-polyfill.js';" > dist/background.js.tmp
cat dist/background.js >> dist/background.js.tmp
mv dist/background.js.tmp dist/background.js

# Copy content extraction files
cp src/content-extractor.js dist/
cp src/lib/Readability.js dist/lib/

# Copy popup files
cp src/popup/popup.html dist/
cp src/popup/popup.css dist/
cp src/popup/popup.js dist/
# Fix imports in popup.js (from ../ to ./)
sed -i '' "s|'../|'./|g" dist/popup.js

echo "Build complete!"
echo ""
echo "To load the extension in Chrome:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable 'Developer mode' (top right)"
echo "3. Click 'Load unpacked'"
echo "4. Select the 'extension/dist' folder"
echo "5. Extension should now appear in your toolbar!"
