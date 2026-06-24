#!/usr/bin/env python3
"""Generate placeholder icons for Tauri bundling. Replace with real artwork later."""
from PIL import Image, ImageDraw, ImageFont
import os, sys

OUT = os.path.join(os.path.dirname(__file__), "..", "src-tauri", "icons")
os.makedirs(OUT, exist_ok=True)

BG = (94, 154, 255, 255)   # accent blue
FG = (255, 255, 255, 255)

def draw(size: int, label: str) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    radius = size // 6
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=BG)
    # Try a bold system font; fall back to default.
    font = None
    for candidate in [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]:
        if os.path.exists(candidate):
            font = ImageFont.truetype(candidate, size=int(size * 0.5))
            break
    if font is None:
        font = ImageFont.load_default()
    bbox = d.textbbox((0, 0), label, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    d.text(((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1]), label, fill=FG, font=font)
    return img

for name, size in [("32x32.png", 32), ("128x128.png", 128), ("128x128@2x.png", 256), ("icon.png", 512)]:
    img = draw(size, "L")
    img.save(os.path.join(OUT, name), "PNG")
    print(f"wrote {name} ({size}x{size})")
