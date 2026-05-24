import fs from "fs";
import path from "path";

/**
 * Plugin: يحقن CACHE_VERSION و SUPABASE_URL في sw.js أثناء البناء
 * مشترك بين كل ملفات vite config
 */
export function swInjectPlugin() {
  return {
    name: 'raan-sw-inject',
    writeBundle(options: any) {
      const outDir = options.dir || 'dist';
      const swPath = path.resolve(outDir, 'sw.js');
      if (!fs.existsSync(swPath)) return;

      let sw = fs.readFileSync(swPath, 'utf-8');
      const version = `v${Date.now()}`;
      const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
      const functionsUrl = supabaseUrl ? `${supabaseUrl}/functions/v1` : '';

      // التحقق من وجود العناصر النائبة قبل الاستبدال
      if (!sw.includes('__SW_CACHE_VERSION__')) {
        console.warn('[raan-sw-inject] ⚠️ __SW_CACHE_VERSION__ غير موجود في sw.js');
      }
      if (!sw.includes('__SW_SUPABASE_URL__') && !supabaseUrl) {
        console.warn('[raan-sw-inject] ⚠️ VITE_SUPABASE_URL غير مكوّن — SW لن يتمكن من الوصول للسيرفر');
      }

      sw = sw.replace('__SW_CACHE_VERSION__', version);
      sw = sw.replace(/__SW_SUPABASE_URL__/g, functionsUrl);
      fs.writeFileSync(swPath, sw, 'utf-8');
      console.log(`[raan-sw-inject] ✅ SW version: ${version}, Supabase: ${supabaseUrl ? '✓' : '⚠ فارغ'}`);
    }
  };
}
