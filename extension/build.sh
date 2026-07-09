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
sed -i '' "s|'\.\./|'\./|g" dist/background.js
# Prepend polyfill import to background.js if it's a module
# For V3, we often need to include the polyfill at the top
echo "import './lib/browser-polyfill.js';" > dist/background.js.tmp
cat dist/background.js >> dist/background.js.tmp
mv dist/background.js.tmp dist/background.js

# Copy content extraction files
cp src/content-extractor.js dist/
cp src/content-bridge.js dist/
cp src/search-bridge.js dist/
cp src/lib/Readability.js dist/lib/

# Copy popup files
cp src/popup/popup.html dist/
cp src/popup/popup.css dist/
cp src/popup/popup.js dist/
# Fix imports in popup.js (from ../ to ./)
sed -i '' "s|'\.\./|'\./|g" dist/popup.js

# Copy bookmarks override page
cp src/bookmarks/bookmarks.html dist/

echo "Creating Firefox specific distribution..."
rm -rf dist-firefox
cp -r dist dist-firefox

# Configure background page for Firefox MV3 compatibility (supports ES modules)
node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync('dist-firefox/manifest.json', 'utf8'));
manifest.background = { page: 'background.html' };
delete manifest.chrome_url_overrides;
fs.writeFileSync('dist-firefox/manifest.json', JSON.stringify(manifest, null, 2));
"

# Create background.html for Firefox to load background.js as a module
echo '<!DOCTYPE html><html><head><meta charset="utf-8"><script type="module" src="background.js"></script></head></html>' > dist-firefox/background.html

# Package dist.zip for Chrome Web Store
echo "Packaging dist.zip for Chrome Web Store..."
rm -f dist.zip
cd dist && zip -r ../dist.zip * > /dev/null && cd ..

# Package dist-firefox.zip for Firefox Add-ons
echo "Packaging dist-firefox.zip for Firefox Add-ons..."
rm -f dist-firefox.zip
cd dist-firefox && zip -r ../dist-firefox.zip * > /dev/null && cd ..

echo "Build and packaging complete!"
echo ""
echo "To load the extension in Chrome/Edge:"
echo "1. Enable 'Developer mode' at chrome://extensions/"
echo "2. Click 'Load unpacked' and select the 'extension/dist' folder"
echo ""
echo "To load the extension in Firefox:"
echo "1. Go to about:debugging#/runtime/this-firefox"
echo "2. Click 'Load Temporary Add-on...'"
echo "3. Select manifest.json from the 'extension/dist-firefox' folder"
