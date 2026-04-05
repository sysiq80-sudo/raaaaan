/**
 * ران — إعدادات بناء لوحة تحكم الأدمن
 * 
 * يبني فقط كود الأدمن — ويب فقط (بدون Capacitor)
 * المخرجات: dist-admin/
 * 
 * الاستخدام:
 *   npm run build:admin
 *   npx vite build --config vite.admin.config.ts
 */
import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// يوجه كل الطلبات إلى admin.html بدلاً من index.html
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
  cacheDir: "node_modules/.vite-admin",
  define: {
    __APP_MODE__: JSON.stringify('admin'),
  },
  server: {
    host: "::",
    port: 8083,
  },
  optimizeDeps: {
    include: ["react-day-picker"],
  },
  plugins: [react(), htmlEntryPlugin('admin.html')],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    outDir: "dist-admin",
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
        main: path.resolve(__dirname, "admin.html"),
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
            "@radix-ui/react-collapsible", "@radix-ui/react-context-menu", "@radix-ui/react-hover-card",
            "@radix-ui/react-menubar", "@radix-ui/react-navigation-menu", "@radix-ui/react-aspect-ratio",
            "@radix-ui/react-toggle", "@radix-ui/react-toggle-group",
          ],
          "vendor-sentry": ["@sentry/react"],
          "vendor-maps": ["@turf/turf"],
          "vendor-mapbox": ["mapbox-gl"],
          "vendor-charts": ["recharts"],
        },
      },
    },
  },
}));
