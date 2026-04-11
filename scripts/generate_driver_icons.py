"""
Generate driver (captain) app icons with BLACK background
Uses the same foreground (RAAN logo) from the green rider icon
but replaces the green background with black (#1a1a2e)
"""
from PIL import Image, ImageDraw
import os
import shutil

ICON_SRC = r"D:\projects\taksi-iraqi\LOGOS\RAAN-ICON\android\res"
PROJECT_RES = r"d:\projects\taksi-iraqi\RAAN\RAAN V2 GOOGLE MAP\android\app\src\main\res"
DRIVER_ICONS_DIR = r"d:\projects\taksi-iraqi\RAAN\RAAN V2 GOOGLE MAP\scripts\icons-driver-black"

# Android mipmap sizes
SIZES = {
    "mipmap-mdpi":    {"icon": 48,  "adaptive": 108},
    "mipmap-hdpi":    {"icon": 72,  "adaptive": 162},
    "mipmap-xhdpi":   {"icon": 96,  "adaptive": 216},
    "mipmap-xxhdpi":  {"icon": 144, "adaptive": 324},
    "mipmap-xxxhdpi": {"icon": 192, "adaptive": 432},
}

# Driver colors - dark/black theme
BG_COLOR = (26, 26, 46)  # #1a1a2e — أسود مزرق داكن (Dark Navy)

def create_black_background(size, output_path):
    """Create a solid black background image"""
    img = Image.new("RGBA", (size, size), (*BG_COLOR, 255))
    img.save(output_path, "PNG")

def create_composite_icon(fg_path, size, output_path):
    """Composite the white foreground onto black background"""
    # Create black background
    bg = Image.new("RGBA", (size, size), (*BG_COLOR, 255))
    
    # Open foreground
    fg = Image.open(fg_path).convert("RGBA")
    fg = fg.resize((size, size), Image.LANCZOS)
    
    # Composite
    bg.paste(fg, (0, 0), fg)
    bg.save(output_path, "PNG")

def main():
    os.makedirs(DRIVER_ICONS_DIR, exist_ok=True)
    
    for mipmap, dims in SIZES.items():
        out_dir = os.path.join(DRIVER_ICONS_DIR, mipmap)
        os.makedirs(out_dir, exist_ok=True)
        
        adaptive_size = dims["adaptive"]
        icon_size = dims["icon"]
        
        fg_path = os.path.join(ICON_SRC, mipmap, "ic_launcher_foreground.png")
        
        if not os.path.exists(fg_path):
            print(f"⚠️ Missing: {fg_path}")
            continue
        
        # 1. Create black background
        bg_path = os.path.join(out_dir, "ic_launcher_background.png")
        create_black_background(adaptive_size, bg_path)
        print(f"  [OK] {mipmap}/ic_launcher_background.png ({adaptive_size}x{adaptive_size})")
        
        # 2. Copy foreground as-is (white RAAN logo on transparent)
        fg_dest = os.path.join(out_dir, "ic_launcher_foreground.png")
        shutil.copy2(fg_path, fg_dest)
        print(f"  [OK] {mipmap}/ic_launcher_foreground.png (copied)")
        
        # 3. Create composite ic_launcher (for legacy launchers)
        launcher_path = os.path.join(out_dir, "ic_launcher.png")
        create_composite_icon(fg_path, icon_size, launcher_path)
        print(f"  [OK] {mipmap}/ic_launcher.png ({icon_size}x{icon_size})")
        
        # 4. Copy monochrome if exists
        mono_src = os.path.join(ICON_SRC, mipmap, "ic_launcher_monochrome.png")
        if os.path.exists(mono_src):
            shutil.copy2(mono_src, os.path.join(out_dir, "ic_launcher_monochrome.png"))
    
    print(f"\nDriver (black) icons generated in: {DRIVER_ICONS_DIR}")

if __name__ == "__main__":
    main()
