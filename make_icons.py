import os
import struct
import io
import math
from PIL import Image, ImageDraw, ImageFilter

def create_apex_icon(size=1024):
    render_size = size * 2
    padding = render_size * 0.08
    box = [padding, padding, render_size - padding, render_size - padding]
    corner_radius = render_size * 0.22

    # Base squircle mask
    mask = Image.new("L", (render_size, render_size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle(box, radius=corner_radius, fill=255)

    # Base gradient image: Deep obsidian/slate (#161622 -> #09090e)
    base_layer = Image.new("RGBA", (render_size, render_size), (0, 0, 0, 0))
    for y in range(int(box[1]), int(box[3])):
        progress = (y - box[1]) / (box[3] - box[1])
        r = int(24 - 15 * progress)
        g = int(25 - 16 * progress)
        b = int(36 - 22 * progress)
        for x in range(int(box[0]), int(box[2])):
            base_layer.putpixel((x, y), (r, g, b, 255))
    base_layer.putalpha(mask)

    # Subtle inner glow / radial light at top
    glow = Image.new("RGBA", (render_size, render_size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_cx, glow_cy = render_size * 0.5, render_size * 0.28
    glow_radius = render_size * 0.45
    for i in range(int(glow_radius), 0, -8):
        alpha = int(30 * (1 - (i / glow_radius)))
        glow_draw.ellipse(
            [glow_cx - i, glow_cy - i * 0.6, glow_cx + i, glow_cy + i * 0.6],
            fill=(99, 102, 241, alpha)
        )
    base_layer = Image.alpha_composite(base_layer, Image.composite(glow, Image.new("RGBA", (render_size, render_size), (0,0,0,0)), mask))

    # Squircle border stroke
    border = Image.new("RGBA", (render_size, render_size), (0, 0, 0, 0))
    border_draw = ImageDraw.Draw(border)
    border_draw.rounded_rectangle(
        box,
        radius=corner_radius,
        outline=(50, 50, 68, 220),
        width=int(render_size * 0.008)
    )

    # Main Apex Emblem
    cx = render_size * 0.5
    cy = render_size * 0.51
    scale = render_size * 0.38

    left_facet = [
        (cx, cy - scale * 0.85),
        (cx - scale * 0.72, cy + scale * 0.55),
        (cx - scale * 0.38, cy + scale * 0.55),
        (cx - scale * 0.06, cy - scale * 0.15),
    ]

    right_facet = [
        (cx, cy - scale * 0.85),
        (cx + scale * 0.72, cy + scale * 0.55),
        (cx + scale * 0.38, cy + scale * 0.55),
        (cx + scale * 0.06, cy - scale * 0.15),
    ]

    center_diamond = [
        (cx, cy - scale * 0.52),
        (cx + scale * 0.26, cy + scale * 0.10),
        (cx, cy + scale * 0.55),
        (cx - scale * 0.26, cy + scale * 0.10),
    ]

    inner_core = [
        (cx, cy - scale * 0.28),
        (cx + scale * 0.16, cy + scale * 0.10),
        (cx, cy + scale * 0.36),
        (cx - scale * 0.16, cy + scale * 0.10),
    ]

    # Ambient drop shadow
    shadow = Image.new("RGBA", (render_size, render_size), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    s_draw.polygon(left_facet, fill=(0, 0, 0, 180))
    s_draw.polygon(right_facet, fill=(0, 0, 0, 180))
    s_draw.polygon(center_diamond, fill=(0, 0, 0, 200))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=render_size * 0.025))

    # Left Wing (Cyan -> Blue)
    wing_left_mask = Image.new("L", (render_size, render_size), 0)
    ImageDraw.Draw(wing_left_mask).polygon(left_facet, fill=255)
    wl_grad = Image.new("RGBA", (render_size, render_size), (0, 0, 0, 0))
    wl_gdraw = ImageDraw.Draw(wl_grad)
    for y_i in range(int(cy - scale), int(cy + scale)):
        prog = max(0.0, min(1.0, (y_i - (cy - scale)) / (2 * scale)))
        r = int(56 - 50 * prog)
        g = int(189 - 60 * prog)
        b = int(248 - 50 * prog)
        wl_gdraw.line([(0, y_i), (render_size, y_i)], fill=(r, g, b, 255))
    wing_left = Image.composite(wl_grad, Image.new("RGBA", (render_size, render_size), (0,0,0,0)), wing_left_mask)

    # Right Wing (Indigo -> Purple)
    wing_right_mask = Image.new("L", (render_size, render_size), 0)
    ImageDraw.Draw(wing_right_mask).polygon(right_facet, fill=255)
    wr_grad = Image.new("RGBA", (render_size, render_size), (0, 0, 0, 0))
    wr_gdraw = ImageDraw.Draw(wr_grad)
    for y_i in range(int(cy - scale), int(cy + scale)):
        prog = max(0.0, min(1.0, (y_i - (cy - scale)) / (2 * scale)))
        r = int(129 + 18 * prog)
        g = int(140 - 89 * prog)
        b = int(248 - 14 * prog)
        wr_gdraw.line([(0, y_i), (render_size, y_i)], fill=(r, g, b, 255))
    wing_right = Image.composite(wr_grad, Image.new("RGBA", (render_size, render_size), (0,0,0,0)), wing_right_mask)

    # Center Diamond Prism (Icy White -> Sky Cyan)
    core_mask = Image.new("L", (render_size, render_size), 0)
    ImageDraw.Draw(core_mask).polygon(center_diamond, fill=255)
    cd_grad = Image.new("RGBA", (render_size, render_size), (0, 0, 0, 0))
    cd_gdraw = ImageDraw.Draw(cd_grad)
    for y_i in range(int(cy - scale * 0.6), int(cy + scale * 0.6)):
        prog = max(0.0, min(1.0, (y_i - (cy - scale * 0.6)) / (1.2 * scale)))
        r = int(255 - 70 * prog)
        g = int(255 - 30 * prog)
        b = int(255)
        cd_gdraw.line([(0, y_i), (render_size, y_i)], fill=(r, g, b, 255))
    core_img = Image.composite(cd_grad, Image.new("RGBA", (render_size, render_size), (0,0,0,0)), core_mask)

    # Inner Gem Cutout
    inner_img = Image.new("RGBA", (render_size, render_size), (0, 0, 0, 0))
    ImageDraw.Draw(inner_img).polygon(inner_core, fill=(15, 15, 22, 235))

    # Core Glow
    core_glow = Image.new("RGBA", (render_size, render_size), (0, 0, 0, 0))
    ImageDraw.Draw(core_glow).ellipse(
        [cx - scale * 0.35, cy - scale * 0.35, cx + scale * 0.35, cy + scale * 0.35],
        fill=(56, 189, 248, 100)
    )
    core_glow = core_glow.filter(ImageFilter.GaussianBlur(radius=render_size * 0.035))

    # Composite everything
    combined = Image.alpha_composite(base_layer, border)
    combined = Image.alpha_composite(combined, shadow)
    combined = Image.alpha_composite(combined, core_glow)
    combined = Image.alpha_composite(combined, wing_left)
    combined = Image.alpha_composite(combined, wing_right)
    combined = Image.alpha_composite(combined, core_img)
    combined = Image.alpha_composite(combined, inner_img)

    return combined.resize((size, size), Image.Resampling.LANCZOS)

def make_icns(png_images_by_type):
    chunks = bytearray()
    for tag, data in png_images_by_type.items():
        tag_bytes = tag.encode("ascii")
        length = len(data) + 8
        chunks.extend(tag_bytes + struct.pack(">I", length) + data)
    
    total_size = len(chunks) + 8
    return b"icns" + struct.pack(">I", total_size) + chunks

def generate_svg():
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#181824"/>
      <stop offset="100%" stop-color="#09090d"/>
    </linearGradient>
    <linearGradient id="cyanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
    <linearGradient id="indigoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="50%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#9333ea"/>
    </linearGradient>
    <linearGradient id="coreGrad" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#bae6fd"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Squircle Base -->
  <rect x="36" y="36" width="440" height="440" rx="96" fill="url(#bgGrad)"/>
  <rect x="36" y="36" width="440" height="440" rx="96" stroke="#2e2e42" stroke-width="3"/>
  <rect x="38" y="38" width="436" height="436" rx="94" stroke="#ffffff" stroke-opacity="0.08" stroke-width="1.5"/>

  <!-- Center Glow -->
  <circle cx="256" cy="256" r="110" fill="#38bdf8" fill-opacity="0.12" filter="url(#glow)"/>

  <g filter="url(#dropShadow)">
    <!-- Left Wing (Cyan/Teal) -->
    <path d="M 256 126 L 138 350 L 196 350 L 244 246 Z" fill="url(#cyanGrad)"/>

    <!-- Right Wing (Indigo/Violet) -->
    <path d="M 256 126 L 374 350 L 316 350 L 268 246 Z" fill="url(#indigoGrad)"/>

    <!-- Center Diamond Core -->
    <path d="M 256 170 L 302 278 L 256 356 L 210 278 Z" fill="url(#coreGrad)"/>

    <!-- Inner Key Cutout -->
    <path d="M 256 216 L 284 278 L 256 322 L 228 278 Z" fill="#0f0f16"/>
  </g>
</svg>'''

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    icons_dir = os.path.join(base_dir, "src-tauri", "icons")
    public_dir = os.path.join(base_dir, "public")
    src_assets_dir = os.path.join(base_dir, "src", "assets")
    os.makedirs(icons_dir, exist_ok=True)
    os.makedirs(public_dir, exist_ok=True)
    os.makedirs(src_assets_dir, exist_ok=True)

    print("Rendering ApexJournal icons...")
    icon_1024 = create_apex_icon(1024)
    icon_512 = icon_1024.resize((512, 512), Image.Resampling.LANCZOS)
    icon_256 = icon_1024.resize((256, 256), Image.Resampling.LANCZOS)
    icon_128 = icon_1024.resize((128, 128), Image.Resampling.LANCZOS)
    icon_64 = icon_1024.resize((64, 64), Image.Resampling.LANCZOS)
    icon_32 = icon_1024.resize((32, 32), Image.Resampling.LANCZOS)
    icon_16 = icon_1024.resize((16, 16), Image.Resampling.LANCZOS)

    icon_512.save(os.path.join(icons_dir, "icon.png"), format="PNG")
    icon_1024.save(os.path.join(icons_dir, "1024x1024.png"), format="PNG")
    icon_512.save(os.path.join(icons_dir, "512x512.png"), format="PNG")
    icon_256.save(os.path.join(icons_dir, "128x128@2x.png"), format="PNG")
    icon_128.save(os.path.join(icons_dir, "128x128.png"), format="PNG")
    icon_64.save(os.path.join(icons_dir, "64x64.png"), format="PNG")
    icon_64.save(os.path.join(icons_dir, "32x32@2x.png"), format="PNG")
    icon_32.save(os.path.join(icons_dir, "32x32.png"), format="PNG")

    icon_256.save(os.path.join(public_dir, "icon.png"), format="PNG")
    icon_32.save(os.path.join(public_dir, "favicon.png"), format="PNG")

    icon_1024.save(
        os.path.join(icons_dir, "icon.ico"),
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    )
    icon_1024.save(
        os.path.join(public_dir, "favicon.ico"),
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)]
    )

    def get_png_bytes(img):
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    icns_map = {
        "icp4": get_png_bytes(icon_16),
        "icp5": get_png_bytes(icon_32),
        "icp6": get_png_bytes(icon_64),
        "ic07": get_png_bytes(icon_128),
        "ic08": get_png_bytes(icon_256),
        "ic09": get_png_bytes(icon_512),
        "ic10": get_png_bytes(icon_1024),
    }
    icns_data = make_icns(icns_map)
    with open(os.path.join(icons_dir, "icon.icns"), "wb") as f:
        f.write(icns_data)

    svg_content = generate_svg()
    with open(os.path.join(public_dir, "logo.svg"), "w") as f:
        f.write(svg_content)
    with open(os.path.join(src_assets_dir, "logo.svg"), "w") as f:
        f.write(svg_content)

    print("Icons successfully created.")

if __name__ == "__main__":
    main()

