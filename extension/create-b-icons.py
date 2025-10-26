#!/usr/bin/env python3
"""Create simple BookSmart icons with 'B' letter"""

# Create simple HTML files that can be screenshot for icons
import os

def create_html_icon(size, output_file):
    html = f'''<!DOCTYPE html>
<html>
<head>
<style>
body {{
    margin: 0;
    padding: 0;
    width: {size}px;
    height: {size}px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #3B82F6;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}}
.letter {{
    color: white;
    font-size: {int(size * 0.6)}px;
    font-weight: 700;
    line-height: 1;
}}
</style>
</head>
<body>
<div class="letter">B</div>
</body>
</html>'''

    with open(output_file, 'w') as f:
        f.write(html)
    print(f"Created {output_file}")

# Create HTML templates for each size
sizes = [16, 48, 128]
for size in sizes:
    create_html_icon(size, f'icon{size}-template.html')

print("\nHTML templates created!")
print("\nTo convert to PNG, open each HTML file in Chrome and take a screenshot,")
print("or use an online HTML-to-image converter.")
print("\nAlternatively, I'll create SVG icons now...")

# Create SVG icons with 'B'
def create_svg_icon(size, output_file):
    svg = f'''<svg width="{size}" height="{size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="{size}" height="{size}" rx="{size*0.15}" fill="#3B82F6"/>
  <text x="50%" y="50%"
        dominant-baseline="central"
        text-anchor="middle"
        fill="white"
        font-family="Arial, sans-serif"
        font-size="{int(size*0.65)}"
        font-weight="bold">B</text>
</svg>'''

    with open(output_file, 'w') as f:
        f.write(svg)
    print(f"Created {output_file}")

print("\n--- Creating SVG Icons ---")
for size in sizes:
    create_svg_icon(size, f'src/icons/icon{size}.svg')

print("\nSVG icons created successfully!")
