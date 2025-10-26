#!/usr/bin/env node
/**
 * Generate extension icons using node-canvas
 * Simple colored icons with bookmark symbol
 */

const fs = require('fs');
const path = require('path');

// Check if canvas is available
let Canvas;
try {
  Canvas = require('canvas');
} catch (e) {
  console.log('Canvas not available, creating SVG icons instead...');
  createSVGIcons();
  process.exit(0);
}

const { createCanvas } = Canvas;

function drawBookmarkIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background - Blue circle
  ctx.fillStyle = '#3B82F6';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.45, 0, Math.PI * 2);
  ctx.fill();

  // Bookmark shape - White
  ctx.fillStyle = 'white';
  const bookmarkWidth = size * 0.35;
  const bookmarkHeight = size * 0.55;
  const bookmarkX = (size - bookmarkWidth) / 2;
  const bookmarkY = size * 0.25;

  ctx.beginPath();
  ctx.moveTo(bookmarkX, bookmarkY);
  ctx.lineTo(bookmarkX + bookmarkWidth, bookmarkY);
  ctx.lineTo(bookmarkX + bookmarkWidth, bookmarkY + bookmarkHeight);
  ctx.lineTo(bookmarkX + bookmarkWidth / 2, bookmarkY + bookmarkHeight - size * 0.08);
  ctx.lineTo(bookmarkX, bookmarkY + bookmarkHeight);
  ctx.closePath();
  ctx.fill();

  return canvas;
}

function createSVGIcons() {
  const sizes = [16, 48, 128];
  sizes.forEach(size => {
    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${size/2}" cy="${size/2}" r="${size*0.45}" fill="#3B82F6"/>
  <path d="M${size*0.325} ${size*0.25}L${size*0.675} ${size*0.25}L${size*0.675} ${size*0.8}L${size*0.5} ${size*0.72}L${size*0.325} ${size*0.8}Z" fill="white"/>
</svg>`;

    fs.writeFileSync(path.join(__dirname, 'src', 'icons', `icon${size}.svg`), svg);
    console.log(`Created icon${size}.svg`);
  });
}

// Try to create PNG icons
const sizes = [16, 48, 128];

sizes.forEach(size => {
  const canvas = drawBookmarkIcon(size);
  const buffer = canvas.toBuffer('image/png');
  const outputPath = path.join(__dirname, 'src', 'icons', `icon${size}.png`);

  fs.writeFileSync(outputPath, buffer);
  console.log(`Created icon${size}.png (${size}x${size})`);
});

console.log('\nAll icons generated successfully!');
