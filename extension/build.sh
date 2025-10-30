#!/bin/bash
# BookSmart Extension Build Script
# Copies files to dist/ directory for loading in Chrome

echo "Building BookSmart Extension..."

# Clean dist folder
rm -rf dist/*
mkdir -p dist/icons

# Copy manifest
cp public/manifest.json dist/

# Copy icons
cp src/icons/*.png dist/icons/

# Copy config
cp src/config.js dist/

# Copy background script and fix import path
cp src/background/background.js dist/
# Fix the config.js import path (from ../config.js to ./config.js)
sed -i "s|'../config.js'|'./config.js'|g" dist/background.js

# Copy popup files
cp src/popup/popup.html dist/
cp src/popup/popup.css dist/
cp src/popup/popup.js dist/

echo "Build complete!"
echo ""
echo "To load the extension in Chrome:"
echo "1. Open Chrome and go to chrome://extensions/"
echo "2. Enable 'Developer mode' (top right)"
echo "3. Click 'Load unpacked'"
echo "4. Select the 'extension/dist' folder"
echo "5. Extension should now appear in your toolbar!"
