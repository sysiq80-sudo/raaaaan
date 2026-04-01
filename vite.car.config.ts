/**
 * ران RAAN — إعدادات بناء تطبيق السيارة
 *
 * تطبيق مستقل مخصص لشاشات السيارات دون التأثير على التطبيق الأساسي.
 * المخرجات: dist-car/
 */
import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

function htmlEntryPlugin(entryHtml: string): Plugin {
  return {
    name: "html-entry-point",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url || "";
        const isViteInternal = url.startsWith("/@") || url.startsWith("/__");
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
  cacheDir: "node_modules/.vite-car",
  define: {
    __APP_MODE__: JSON.stringify("car"),
  },
  server: {
    host: "::",
    port: 8084,
  },
  plugins: [react(), htmlEntryPlugin("car.html")],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    outDir: "dist-car",
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
        main: path.resolve(__dirname, "car.html"),
      },
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-ui": ["framer-motion", "zustand", "class-variance-authority", "clsx", "tailwind-merge"],
        },
      },
    },
  },
}));
