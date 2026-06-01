/**
 * ران — إعدادات بناء تطبيق الراكب
 * 
 * يبني فقط كود الراكب مع المكتبات المشتركة
 * المخرجات: dist-rider/
 * 
 * الاستخدام:
 *   npm run build:rider
 *   npx vite build --config vite.rider.config.ts
 */
import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { swInjectPlugin } from "./vite-sw-plugin";

// يوجه كل الطلبات إلى rider.html بدلاً من index.html
function htmlEntryPlugin(entryHtml: string): Plugin {
  return {
    name: 'html-entry-point',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url || '';
        const isViteInternal = url.startsWith('/@') || url.startsWith('/__');
        const hasFileExt = /\.\w+(\?|$)/.test(url);
        if (!isViteInternal && !hasFileExt) {
          req.url = `/${entryHtml}`;
        }
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  cacheDir: "node_modules/.vite-rider",
  define: {
    __APP_MODE__: JSON.stringify('rider'),
  },
  server: {
    host: "::",
    port: 8081,
    hmr: {
      overlay: false, // منع ظهور overlay الأخطاء على شاشة الجوال
    },
  },
  optimizeDeps: {
    include: ["react-day-picker"],
  },
  plugins: [react(), htmlEntryPlugin('rider.html'), swInjectPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    outDir: "dist-rider",
    emptyOutDir: true,
    sourcemap: false,
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: mode === "production",
        drop_debugger: true,
        passes: 2,
      },
    },
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "rider.html"),
      },
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-ui": ["framer-motion", "zustand", "class-variance-authority", "clsx", "tailwind-merge"],
          "vendor-radix": [
            "@radix-ui/react-dialog", "@radix-ui/react-popover", "@radix-ui/react-select",
            "@radix-ui/react-dropdown-menu", "@radix-ui/react-tooltip", "@radix-ui/react-accordion",
            "@radix-ui/react-tabs", "@radix-ui/react-scroll-area", "@radix-ui/react-slot",
            "@radix-ui/react-checkbox", "@radix-ui/react-label", "@radix-ui/react-switch",
            "@radix-ui/react-separator", "@radix-ui/react-progress", "@radix-ui/react-radio-group",
            "@radix-ui/react-slider", "@radix-ui/react-avatar", "@radix-ui/react-alert-dialog",
          ],
          "vendor-sentry": ["@sentry/react"],
          "vendor-maps": ["@turf/turf"],
        },
      },
    },
  },
}));
