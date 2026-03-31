import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
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
      output: {
        manualChunks: {
          // المكتبات الأساسية
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-supabase": ["@supabase/supabase-js"],
          // مكتبات الواجهة
          "vendor-ui": ["framer-motion", "zustand", "class-variance-authority", "clsx", "tailwind-merge"],
          // Radix UI primitives (مشتركة بكثرة — chunk منفصل)
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
          // Sentry — مراقبة الأخطاء (لا يحتاجها المستخدم مباشرة)
          "vendor-sentry": ["@sentry/react"],
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
}));
