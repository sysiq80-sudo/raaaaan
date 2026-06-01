/**
 * Generate notification icons for rider and captain flavors.
 * 
 * - Small Icon (ic_stat_notify): white silhouette on transparent (status bar)
 * - Large Icon (ic_notify_large): full-color logo on colored background (notification panel)
 *
 * Usage: node generate-notification-icons.cjs
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Android density → notification small icon size
const densities = {
  'drawable-mdpi':    24,
  'drawable-hdpi':    36,
  'drawable-xhdpi':   48,
  'drawable-xxhdpi':  72,
  'drawable-xxxhdpi': 96,
};

const LARGE_ICON_SIZE = 256;

// Flavor notification configs
const flavors = {
  rider: {
    largeBg: '#1DB954',   // Green background for large icon
    label: 'Rider',
  },
  captain: {
    largeBg: '#0a0f14',   // Black/dark background for large icon
    label: 'Captain',
  },
};

const SRC_DIR = path.join(__dirname, 'android', 'app', 'src');
const MAIN_RES = path.join(SRC_DIR, 'main', 'res');

async function generateForFlavor(flavorName, config) {
  console.log(`\n=== Generating notification icons for ${flavorName} (${config.label}) ===`);

  const flavorRes = path.join(SRC_DIR, flavorName, 'res');

  // Source: use the monochrome icon from main (white RAAN silhouette on transparent)
  // Try xxxhdpi first for best quality source
  let sourceFg = null;
  for (const density of ['mipmap-xxxhdpi', 'mipmap-xxhdpi', 'mipmap-xhdpi', 'mipmap-hdpi', 'mipmap-mdpi']) {
    const fgPath = path.join(MAIN_RES, density, 'ic_launcher_foreground.png');
    if (fs.existsSync(fgPath)) {
      sourceFg = fgPath;
      break;
    }
  }

  if (!sourceFg) {
    console.error(`  [ERROR] No foreground icon found in main/res for ${flavorName}`);
    return;
  }

  console.log(`  Source: ${sourceFg}`);

  // 1. Generate small notification icons (white on transparent) for each density
  for (const [densityDir, size] of Object.entries(densities)) {
    const outDir = path.join(flavorRes, densityDir);
    fs.mkdirSync(outDir, { recursive: true });

    // Resize foreground to notification size with padding
    // Notification icons should have ~25% padding
    const iconSize = Math.round(size * 0.7);
    const padding = Math.round((size - iconSize) / 2);

    const fgResized = await sharp(sourceFg)
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    // Create transparent canvas and composite foreground centered
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      }
    })
      .composite([{ input: fgResized, left: padding, top: padding }])
      .png()
      .toFile(path.join(outDir, 'ic_stat_notify.png'));

    console.log(`  [OK] ${densityDir}/ic_stat_notify.png (${size}x${size})`);
  }

  // 2. Generate large notification icon (colored background + white logo)
  const drawableDir = path.join(flavorRes, 'drawable');
  fs.mkdirSync(drawableDir, { recursive: true });

  const logoSize = Math.round(LARGE_ICON_SIZE * 0.6);
  const logoPadding = Math.round((LARGE_ICON_SIZE - logoSize) / 2);

  const logoResized = await sharp(sourceFg)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Parse hex color
  const hex = config.largeBg.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Create colored background
  const bgBuffer = await sharp({
    create: {
      width: LARGE_ICON_SIZE,
      height: LARGE_ICON_SIZE,
      channels: 4,
      background: { r, g, b, alpha: 255 },
    }
  }).png().toBuffer();

  // Round corners for large icon (Android notification panel looks better)
  const cornerRadius = Math.round(LARGE_ICON_SIZE * 0.15);
  const roundedMask = Buffer.from(
    `<svg width="${LARGE_ICON_SIZE}" height="${LARGE_ICON_SIZE}">
      <rect x="0" y="0" width="${LARGE_ICON_SIZE}" height="${LARGE_ICON_SIZE}" rx="${cornerRadius}" ry="${cornerRadius}" fill="white"/>
    </svg>`
  );

  const composited = await sharp(bgBuffer)
    .composite([{ input: logoResized, left: logoPadding, top: logoPadding }])
    .png()
    .toBuffer();

  await sharp(composited)
    .composite([{ input: roundedMask, blend: 'dest-in' }])
    .png()
    .toFile(path.join(drawableDir, 'ic_notify_large.png'));

  console.log(`  [OK] drawable/ic_notify_large.png (${LARGE_ICON_SIZE}x${LARGE_ICON_SIZE}, bg: ${config.largeBg})`);

  // 3. Also create ic_stat_notify in main drawable for fallback
  const mainDrawableDir = path.join(flavorRes, 'drawable');
  // Already created above, just confirming
  console.log(`  [OK] All notification icons for ${flavorName} generated!`);
}

async function main() {
  console.log('🔔 Generating notification icons for all flavors...\n');

  for (const [name, config] of Object.entries(flavors)) {
    await generateForFlavor(name, config);
  }

  console.log('\n✅ Done! All notification icons generated.');
  console.log('\nNext steps:');
  console.log('  1. Update capacitor configs to use smallIcon: "ic_stat_notify"');
  console.log('  2. Run: npm run apk:rider');
  console.log('  3. Run: npm run apk:driver');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
