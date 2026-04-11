"""
Build script: Swap icons and build APK for all 3 apps (rider, driver, car)
Usage: python scripts/build_both_apps.py
"""
import os
import shutil
import subprocess
import sys

PROJECT = r"d:\projects\taksi-iraqi\RAAN\RAAN V2 GOOGLE MAP"
RES_DIR = os.path.join(PROJECT, "android", "app", "src", "main", "res")

# Icon sources
RIDER_ICONS_SRC = r"D:\projects\taksi-iraqi\LOGOS\RAAN-ICON\android\res"
DRIVER_ICONS_SRC = os.path.join(PROJECT, "scripts", "icons-driver-black")
CAR_ICONS_SRC = os.path.join(PROJECT, "scripts", "icons-car")

MIPMAPS = ["mipmap-mdpi", "mipmap-hdpi", "mipmap-xhdpi", "mipmap-xxhdpi", "mipmap-xxxhdpi"]
ICON_FILES = ["ic_launcher.png", "ic_launcher_foreground.png", "ic_launcher_background.png", "ic_launcher_monochrome.png"]

def swap_icons(source_dir, label):
    """Copy icons from source to android res"""
    for mipmap in MIPMAPS:
        src_dir = os.path.join(source_dir, mipmap)
        dst_dir = os.path.join(RES_DIR, mipmap)
        
        if not os.path.exists(src_dir):
            continue
            
        for icon_file in ICON_FILES:
            src = os.path.join(src_dir, icon_file)
            dst = os.path.join(dst_dir, icon_file)
            if os.path.exists(src):
                shutil.copy2(src, dst)
                # Also copy ic_launcher as ic_launcher_round
                if icon_file == "ic_launcher.png":
                    round_src = os.path.join(src_dir, "ic_launcher_round.png")
                    round_dst = os.path.join(dst_dir, "ic_launcher_round.png")
                    if os.path.exists(round_src):
                        shutil.copy2(round_src, round_dst)
                    else:
                        shutil.copy2(src, round_dst)
    
    print(f"  [ICONS] {label} icons applied")

def swap_google_services(app_type):
    """Copy correct google-services.json"""
    src = os.path.join(PROJECT, "scripts", f"google-services-{app_type}.json")
    dst = os.path.join(PROJECT, "android", "app", "google-services.json")
    if os.path.exists(src):
        shutil.copy2(src, dst)
        print(f"  [FCM] google-services-{app_type}.json copied")
    else:
        print(f"  [WARN] {src} not found!")

def swap_capacitor_config(app_type):
    """Copy correct capacitor config"""
    src = os.path.join(PROJECT, f"capacitor.{app_type}.config.ts")
    dst = os.path.join(PROJECT, "capacitor.config.ts")
    if os.path.exists(src):
        shutil.copy2(src, dst)
        print(f"  [CONFIG] capacitor.{app_type}.config.ts applied")

def run(cmd, label, cwd=None):
    """Run command and check result"""
    print(f"  [BUILD] {label}...")
    work_dir = cwd or PROJECT
    result = subprocess.run(cmd, shell=True, cwd=work_dir, capture_output=True, text=True, encoding='utf-8', errors='replace')
    if result.returncode != 0:
        print(f"  [FAIL] {label}")
        print(result.stderr[-500:] if result.stderr else "no stderr")
        return False
    print(f"  [OK] {label} complete")
    return True

def copy_apk(app_name, flavor):
    """Copy built APK to builds/ dir"""
    builds_dir = os.path.join(PROJECT, "builds")
    os.makedirs(builds_dir, exist_ok=True)
    
    # Find the flavor debug APK
    apk_dir = os.path.join(PROJECT, "android", "app", "build", "outputs", "apk", flavor, "debug")
    if not os.path.exists(apk_dir):
        # fallback to generic debug folder
        apk_dir = os.path.join(PROJECT, "android", "app", "build", "outputs", "apk", "debug")
    
    if os.path.exists(apk_dir):
        for f in os.listdir(apk_dir):
            if f.endswith(".apk"):
                src = os.path.join(apk_dir, f)
                dst = os.path.join(builds_dir, f"raan-{app_name}.apk")
                shutil.copy2(src, dst)
                size_mb = os.path.getsize(dst) / (1024*1024)
                print(f"  [APK] raan-{app_name}.apk ({size_mb:.1f} MB)")
                return True
    
    print(f"  [WARN] APK not found in {apk_dir}")
    return False

def build_app(app_type, app_name, icon_src, icon_label, gradle_flavor):
    """Full build pipeline for one app"""
    print(f"\n{'='*50}")
    print(f"  Building: {app_name}")
    print(f"{'='*50}")
    
    # 1. Swap icons
    swap_icons(icon_src, icon_label)
    
    # 2. Swap google-services
    swap_google_services(app_type)
    
    # 3. Swap capacitor config
    swap_capacitor_config(app_type)
    
    # 4. Build web
    if not run(f"npm run build:{app_type}", f"Vite build ({app_type})"):
        return False
    
    # 5. Copy HTML entry point
    dist_dir = f"dist-{app_type}"
    html_src = os.path.join(PROJECT, dist_dir, f"{app_type}.html")
    html_dst = os.path.join(PROJECT, dist_dir, "index.html")
    if os.path.exists(html_src):
        shutil.copy2(html_src, html_dst)
    
    # 6. Sync with Capacitor
    if not run("npx cap sync android", "Capacitor sync"):
        return False
    
    # 7. Build APK via Gradle (specific flavor) — must run from android/ dir
    gradle_task = f"assemble{gradle_flavor.capitalize()}Debug"
    android_dir = os.path.join(PROJECT, "android")
    gradle_cmd = f"gradlew.bat {gradle_task}" if sys.platform == "win32" else f"./gradlew {gradle_task}"
    if not run(gradle_cmd, f"Gradle {gradle_task}", cwd=android_dir):
        return False
    
    # 8. Copy APK
    copy_apk(app_name, gradle_flavor)
    
    return True

if __name__ == "__main__":
    print("RAAN Build System — 3 Apps")
    print("=" * 50)
    
    results = {}
    
    # Build Rider (green icons) — flavor: rider
    results['rider'] = build_app("rider", "rider", RIDER_ICONS_SRC, "GREEN (Rider)", "rider")
    
    # Build Driver (black icons) — flavor: captain
    results['driver'] = build_app("driver", "driver", DRIVER_ICONS_SRC, "BLACK (Captain)", "captain")
    
    # Build Car (car icons) — flavor: car
    results['car'] = build_app("car", "car", CAR_ICONS_SRC, "CAR (Vehicle)", "car")
    
    # Restore rider as default
    swap_capacitor_config("rider")
    swap_google_services("rider")
    swap_icons(RIDER_ICONS_SRC, "GREEN (default)")
    
    print(f"\n{'='*50}")
    print("BUILD RESULTS:")
    for app, ok in results.items():
        status = "[OK] SUCCESS" if ok else "[XX] FAILED"
        print(f"  {app}: {status}")
    print(f"\nAPK files in: {os.path.join(PROJECT, 'builds')}")
    print(f"{'='*50}")
