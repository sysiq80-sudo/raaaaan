import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8081,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(
    Boolean
  ),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // المكتبات الأساسية
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-supabase": ["@supabase/supabase-js"],
          // مكتبات الواجهة
          "vendor-ui": ["framer-motion", "zustand", "class-variance-authority", "clsx", "tailwind-merge"],
          // الخرائط والجغرافيا
          "vendor-maps": ["@turf/turf"],
          // Mapbox فقط لصفحات الأدمن المحددة - يحمل عند الحاجة فقط
          "vendor-mapbox": ["mapbox-gl"],
          // الرسوم البيانية (للأدمن فقط)
          "vendor-charts": ["recharts"],
        },
      },
    },
  },
  // إزالة console.log في بيئة الإنتاج
  esbuild: {
    drop: mode === "production" ? ["console", "debugger"] : [],
  },
}));
