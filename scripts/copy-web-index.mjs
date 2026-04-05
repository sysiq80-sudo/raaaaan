/**
 * ينسخ rider.html | driver.html | car.html إلى index.html داخل مجلد الـ dist
 * حتى تعمل الاستضافة الثابتة (Netlify / S3 / أي خادم يخدم index.html عند الجذر).
 *
 * الاستخدام: node scripts/copy-web-index.mjs <rider|driver|car>
 */
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const map = {
  rider: { dir: "dist-rider", html: "rider.html" },
  driver: { dir: "dist-driver", html: "driver.html" },
  car: { dir: "dist-car", html: "car.html" },
  admin: { dir: "dist-admin", html: "admin.html" },
};

const app = process.argv[2];
const entry = map[app];

if (!entry) {
  console.error("Usage: node scripts/copy-web-index.mjs <rider|driver|car|admin>");
  process.exit(1);
}

const root = join(process.cwd(), entry.dir);
const src = join(root, entry.html);
const dest = join(root, "index.html");

if (!existsSync(src)) {
  console.error(`Missing ${src} — run the matching vite build first (e.g. npm run build:${app}).`);
  process.exit(1);
}

copyFileSync(src, dest);
console.log(`[copy-web-index] ${entry.dir}/${entry.html} → ${entry.dir}/index.html`);
