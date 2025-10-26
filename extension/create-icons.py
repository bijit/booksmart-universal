#!/usr/bin/env python3
"""Generate simple placeholder icons for BookSmart extension"""

from PIL import Image, ImageDraw

def create_icon(size):
    # Create a new image with blue background
    img = Image.new('RGB', (size, size), color='#3B82F6')
    draw = ImageDraw.Draw(img)

    # Draw a simple bookmark shape (rectangle with notch at bottom)
    margin = size // 4
    width = size - 2 * margin
    height = int(size * 0.6)

    # Main rectangle
    draw.rectangle(
        [margin, margin, size - margin, margin + height],
        fill='white'
    )

    # Notch at bottom (triangle)
    center_x = size // 2
    notch_height = size // 6
    draw.polygon(
        [
            (margin, margin + height),
            (center_x, margin + height + notch_height),
            (size - margin, margin + height)
        ],
        fill='#3B82F6'
    )

    return img

# Generate icons in different sizes
sizes = [16, 48, 128]
for size in sizes:
    icon = create_icon(size)
    icon.save(f'src/icons/icon{size}.png')
    print(f'Created icon{size}.png')

print('All icons created successfully!')
