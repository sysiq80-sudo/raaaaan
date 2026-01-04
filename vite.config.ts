import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/taksi-iraqi-smart/' : '/',
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // المكتبات الثقيلة
          'mapbox': ['mapbox-gl'],
          'framer': ['framer-motion'],
          'charts': ['recharts'],
          // الصفحات الثقيلة
          'admin-pages': [
            'src/pages/admin/AdminDashboard.tsx',
            'src/pages/admin/AdminDrivers.tsx',
            'src/pages/admin/AdminRides.tsx',
          ],
          'rider-pages': [
            'src/pages/rider/RiderHomeCustom.tsx',
            'src/pages/rider/RiderHomeMap.tsx',
            'src/pages/rider/RiderHomeClassic.tsx',
          ],
          'driver-pages': [
            'src/pages/driver/DriverHome.tsx',
            'src/pages/driver/DriverStatistics.tsx',
          ],
          // مكونات الخريطة الثقيلة
          'map-components': [
            'src/components/Map.tsx',
            'src/components/LazyMap.tsx',
            'src/components/rider/MapLocationPicker.tsx',
          ],
        },
      },
    },
    chunkSizeWarningLimit: 1000, // تحذير عند 1 MB بدلاً من 500 KB
  },
}));

