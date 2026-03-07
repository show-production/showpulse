#!/usr/bin/env python3
"""
ShowPulse Logo Pack Builder
Converts SVG source files into PNGs at standard sizes + ICO favicon.
Requires: pip install cairosvg pillow
"""

import os
import sys

try:
    import cairosvg
    from PIL import Image
except ImportError:
    print("Missing dependencies. Install with:")
    print("  pip install cairosvg pillow")
    sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(SCRIPT_DIR, "export")
os.makedirs(OUT_DIR, exist_ok=True)

# --- Configuration ---

# (svg_file, output_prefix, [(width, height), ...])
EXPORTS = [
    # Logomark (icon only)
    ("logomark.svg", "logomark", [
        (64, 54), (128, 107), (256, 213), (512, 427),
    ]),
    # Horizontal lockup (18:5 aspect)
    ("logo-horizontal.svg", "logo-horizontal", [
        (720, 200), (1440, 400), (2160, 600),
    ]),
    # Dark background lockup
    ("logo-horizontal-dark-bg.svg", "logo-horizontal-dark-bg", [
        (720, 200), (1440, 400), (2160, 600),
    ]),
    # Stacked (3:2 aspect)
    ("logo-stacked.svg", "logo-stacked", [
        (420, 280), (840, 560),
    ]),
    # Light background
    ("logo-light-bg.svg", "logo-light-bg", [
        (720, 200), (1440, 400),
    ]),
    # Mono white
    ("logo-mono-white.svg", "logo-mono-white", [
        (720, 200), (1440, 400),
    ]),
    # Mono dark
    ("logo-mono-dark.svg", "logo-mono-dark", [
        (720, 200), (1440, 400),
    ]),
]

# Favicon sizes
FAVICON_SIZES = [16, 32, 48, 64, 128, 180, 192, 512]

def export_svg(svg_path, prefix, sizes):
    """Export an SVG to multiple PNG sizes."""
    if not os.path.exists(svg_path):
        print(f"  SKIP {svg_path} (not found)")
        return

    with open(svg_path, "rb") as f:
        svg_data = f.read()

    for w, h in sizes:
        out_path = os.path.join(OUT_DIR, f"{prefix}-{w}x{h}.png")
        cairosvg.svg2png(bytestring=svg_data, write_to=out_path,
                         output_width=w, output_height=h)
        print(f"  {out_path}")


def build_favicon(svg_path):
    """Build favicon.ico (multi-size) + apple-touch-icon + PWA icons."""
    if not os.path.exists(svg_path):
        print(f"  SKIP {svg_path} (not found)")
        return

    with open(svg_path, "rb") as f:
        svg_data = f.read()

    images = {}
    for size in FAVICON_SIZES:
        out_path = os.path.join(OUT_DIR, f"favicon-{size}x{size}.png")
        cairosvg.svg2png(bytestring=svg_data, write_to=out_path,
                         output_width=size, output_height=size)
        images[size] = Image.open(out_path)
        print(f"  {out_path}")

    # Build .ico with 16, 32, 48
    ico_path = os.path.join(OUT_DIR, "favicon.ico")
    images[32].save(ico_path, format="ICO",
                    sizes=[(16, 16), (32, 32), (48, 48)],
                    append_images=[images[16], images[48]])
    print(f"  {ico_path}")

    # Apple touch icon (180x180)
    apple_path = os.path.join(OUT_DIR, "apple-touch-icon.png")
    images[180].save(apple_path)
    print(f"  {apple_path}")


def main():
    print("ShowPulse Logo Pack Builder")
    print("=" * 40)

    for svg_file, prefix, sizes in EXPORTS:
        svg_path = os.path.join(SCRIPT_DIR, svg_file)
        print(f"\n{prefix}:")
        export_svg(svg_path, prefix, sizes)

    print(f"\nfavicon:")
    build_favicon(os.path.join(SCRIPT_DIR, "favicon.svg"))

    # Copy favicon SVG to static for inline use
    import shutil
    static_dir = os.path.join(SCRIPT_DIR, "..", "static")
    if os.path.isdir(static_dir):
        shutil.copy2(
            os.path.join(SCRIPT_DIR, "favicon.svg"),
            os.path.join(static_dir, "favicon.svg")
        )
        shutil.copy2(
            os.path.join(OUT_DIR, "favicon.ico"),
            os.path.join(static_dir, "favicon.ico")
        )
        print(f"\nCopied favicon.svg and favicon.ico to static/")

    print(f"\nDone! All exports in: {OUT_DIR}")


if __name__ == "__main__":
    main()
