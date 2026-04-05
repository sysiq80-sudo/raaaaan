/**
 * سكريبت توليد أيقونات أندرويد لتطبيقات ران الثلاثة
 * يولد ic_launcher, ic_launcher_round, ic_launcher_foreground, ic_launcher_background
 * لكل كثافات الشاشة (mdpi → xxxhdpi)
 * 
 * الاستخدام: node scripts/generate-icons.mjs
 */
import sharp from 'sharp';
import { mkdirSync, existsSync, copyFileSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');
const LOGOS_DIR = resolve(ROOT, '..', '..', 'taxi iraq RAAN', 'LOGOS');

// مصادر الشعارات
const SOURCES = {
  rider: join(LOGOS_DIR, 'RAAN-ICON', 'android', 'play_store_512.png'),   // أخضر
  driver: join(LOGOS_DIR, 'Captin Logo.png'),                              // أزرق داكن
  car: join(LOGOS_DIR, 'RAAN-ICON', 'android', 'play_store_512.png'),     // أخضر (نفس الراكب)
};

// مقاسات أندرويد
const DENSITIES = {
  'mipmap-ldpi':    { icon: 36,  foreground: 81 },
  'mipmap-mdpi':    { icon: 48,  foreground: 108 },
  'mipmap-hdpi':    { icon: 72,  foreground: 162 },
  'mipmap-xhdpi':   { icon: 96,  foreground: 216 },
  'mipmap-xxhdpi':  { icon: 144, foreground: 324 },
  'mipmap-xxxhdpi': { icon: 192, foreground: 432 },
};

// ألوان الخلفية لكل تطبيق
const BG_COLORS = {
  rider: '#2dd4a8',   // أخضر ران
  driver: '#1a2234',  // أزرق داكن
  car: '#2dd4a8',     // أخضر ران
};

async function generateIcons(appType, sourceFile) {
  const outDir = join(ROOT, 'scripts', `icons-${appType}`);
  console.log(`\n🎨 [${appType.toUpperCase()}] Generating icons from: ${sourceFile}`);

  for (const [density, sizes] of Object.entries(DENSITIES)) {
    const dir = join(outDir, density);
    mkdirSync(dir, { recursive: true });

    // 1. ic_launcher.png — أيقونة عادية مربعة مع حواف مستديرة
    await sharp(sourceFile)
      .resize(sizes.icon, sizes.icon, { fit: 'cover' })
      .png()
      .toFile(join(dir, 'ic_launcher.png'));

    // 2. ic_launcher_round.png — أيقونة دائرية
    const roundMask = Buffer.from(
      `<svg width="${sizes.icon}" height="${sizes.icon}">
        <circle cx="${sizes.icon/2}" cy="${sizes.icon/2}" r="${sizes.icon/2}" fill="white"/>
      </svg>`
    );
    await sharp(sourceFile)
      .resize(sizes.icon, sizes.icon, { fit: 'cover' })
      .composite([{ input: roundMask, blend: 'dest-in' }])
      .png()
      .toFile(join(dir, 'ic_launcher_round.png'));

    // 3. ic_launcher_foreground.png — للأيقونات التكيفية (Adaptive Icons)
    // الشعار في المنتصف مع padding (safe zone = 66/108 من الحجم الكلي)
    const fgSize = sizes.foreground;
    const logoSize = Math.round(fgSize * 0.55); // حجم الشعار داخل الـ foreground
    const padding = Math.round((fgSize - logoSize) / 2);
    
    const logoBuf = await sharp(sourceFile)
      .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    await sharp({ create: { width: fgSize, height: fgSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: logoBuf, left: padding, top: padding }])
      .png()
      .toFile(join(dir, 'ic_launcher_foreground.png'));

    // 4. ic_launcher_background.png — خلفية بلون واحد
    const bgColor = BG_COLORS[appType];
    const [r, g, b] = hexToRgb(bgColor);
    await sharp({ create: { width: fgSize, height: fgSize, channels: 3, background: { r, g, b } } })
      .png()
      .toFile(join(dir, 'ic_launcher_background.png'));
  }

  // 5. أيقونة Play Store (512x512)
  const storeDir = join(outDir, 'playstore');
  mkdirSync(storeDir, { recursive: true });
  await sharp(sourceFile)
    .resize(512, 512, { fit: 'cover' })
    .png()
    .toFile(join(storeDir, 'play_store_512.png'));

  console.log(`   ✅ [${appType.toUpperCase()}] Done — ${Object.keys(DENSITIES).length} densities + Play Store icon`);
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [0, 0, 0];
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  🚗 RAAN Android Icon Generator');
  console.log('═══════════════════════════════════════════');

  for (const [appType, source] of Object.entries(SOURCES)) {
    if (!existsSync(source)) {
      console.error(`❌ Source not found: ${source}`);
      continue;
    }
    await generateIcons(appType, source);
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  ✅ All icons generated successfully!');
  console.log('  📁 Output: scripts/icons-rider/, scripts/icons-driver/, scripts/icons-car/');
  console.log('═══════════════════════════════════════════');
}

main().catch(console.error);
