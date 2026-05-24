/**
 * Generate flavor-specific Android icons for rider, captain, and car apps.
 * Uses the existing foreground/monochrome from main and creates
 * color-differentiated backgrounds + composited launcher icons per flavor.
 *
 * Usage: node generate-flavor-icons.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Android density → adaptive icon size + launcher icon size
const densities = {
  'mipmap-mdpi':    { adaptive: 108, launcher: 48 },
  'mipmap-hdpi':    { adaptive: 162, launcher: 72 },
  'mipmap-xhdpi':   { adaptive: 216, launcher: 96 },
  'mipmap-xxhdpi':  { adaptive: 324, launcher: 144 },
  'mipmap-xxxhdpi': { adaptive: 432, launcher: 192 },
};

// Flavor configs: background color, accent for icon circle
const flavors = {
  rider: {
    bg: '#1DB954',     // Green
    label: 'Rider',
  },
  captain: {
    bg: '#1A1A2E',     // Dark navy
    label: 'Captain',
  },
  car: {
    bg: '#FF8C00',     // Amber/Orange
    label: 'Car',
  },
};

const SRC_DIR = path.join(__dirname, 'android', 'app', 'src');
const MAIN_RES = path.join(SRC_DIR, 'main', 'res');

async function generateForFlavor(flavorName, config) {
  console.log(`\n=== Generating icons for ${flavorName} (${config.label}) ===`);

  const flavorRes = path.join(SRC_DIR, flavorName, 'res');

  for (const [densityDir, sizes] of Object.entries(densities)) {
    const outDir = path.join(flavorRes, densityDir);
    fs.mkdirSync(outDir, { recursive: true });

    const mainDensityDir = path.join(MAIN_RES, densityDir);
    const fgPath = path.join(mainDensityDir, 'ic_launcher_foreground.png');
    const monoPath = path.join(mainDensityDir, 'ic_launcher_monochrome.png');

    // 1. Generate solid background
    const bgBuffer = await sharp({
      create: {
        width: sizes.adaptive,
        height: sizes.adaptive,
        channels: 3,
        background: config.bg,
      }
    }).png().toBuffer();
    await sharp(bgBuffer).toFile(path.join(outDir, 'ic_launcher_background.png'));

    // 2. Copy foreground as-is (white RAAN logo, works on all backgrounds)
    if (fs.existsSync(fgPath)) {
      const fg = await sharp(fgPath).resize(sizes.adaptive, sizes.adaptive).png().toBuffer();
      await sharp(fg).toFile(path.join(outDir, 'ic_launcher_foreground.png'));
    }

    // 3. Copy monochrome as-is
    if (fs.existsSync(monoPath)) {
      const mono = await sharp(monoPath).resize(sizes.adaptive, sizes.adaptive).png().toBuffer();
      await sharp(mono).toFile(path.join(outDir, 'ic_launcher_monochrome.png'));
    }

    // 4. Composite launcher icon (background + foreground)
    if (fs.existsSync(fgPath)) {
      const fgResized = await sharp(fgPath).resize(sizes.launcher, sizes.launcher).png().toBuffer();
      const launcherBg = await sharp({
        create: {
          width: sizes.launcher,
          height: sizes.launcher,
          channels: 3,
          background: config.bg,
        }
      }).png().toBuffer();

      await sharp(launcherBg)
        .composite([{ input: fgResized, blend: 'over' }])
        .png()
        .toFile(path.join(outDir, 'ic_launcher.png'));

      // 5. Round icon (circular crop)
      const circleSize = sizes.launcher;
      const circleMask = Buffer.from(
        `<svg width="${circleSize}" height="${circleSize}">
          <circle cx="${circleSize/2}" cy="${circleSize/2}" r="${circleSize/2}" fill="white"/>
        </svg>`
      );

      const squareComposite = await sharp(launcherBg)
        .composite([{ input: fgResized, blend: 'over' }])
        .png()
        .toBuffer();

      await sharp(squareComposite)
        .composite([{ input: circleMask, blend: 'dest-in' }])
        .png()
        .toFile(path.join(outDir, 'ic_launcher_round.png'));
    }

    console.log(`  [OK] ${densityDir} (${sizes.launcher}px launcher, ${sizes.adaptive}px adaptive)`);
  }

  // 6. Copy anydpi-v26 adaptive icon XML
  const anydpiSrc = path.join(MAIN_RES, 'mipmap-anydpi-v26');
  const anydpiDst = path.join(flavorRes, 'mipmap-anydpi-v26');
  if (fs.existsSync(anydpiSrc)) {
    fs.mkdirSync(anydpiDst, { recursive: true });
    for (const f of fs.readdirSync(anydpiSrc)) {
      fs.copyFileSync(path.join(anydpiSrc, f), path.join(anydpiDst, f));
    }
    console.log(`  [OK] mipmap-anydpi-v26 (adaptive XML)`);
  }
}

async function main() {
  console.log('Generating flavor-specific Android icons...');
  for (const [name, config] of Object.entries(flavors)) {
    await generateForFlavor(name, config);
  }
  console.log('\nDone! All flavor icons generated.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
