// vite.admin.config.ts
import { defineConfig } from "file:///D:/projects/taksi-iraqi/RAAN/RAAN/node_modules/vite/dist/node/index.js";
import react from "file:///D:/projects/taksi-iraqi/RAAN/RAAN/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
var __vite_injected_original_dirname = "D:\\projects\\taksi-iraqi\\RAAN\\RAAN";
function htmlEntryPlugin(entryHtml) {
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
    }
  };
}
var vite_admin_config_default = defineConfig(({ mode }) => ({
  cacheDir: "node_modules/.vite-admin",
  server: {
    host: "::",
    port: 8083
  },
  optimizeDeps: {
    include: ["react-day-picker"]
  },
  plugins: [react(), htmlEntryPlugin("admin.html")],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
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
        passes: 2
      }
    },
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        main: path.resolve(__vite_injected_original_dirname, "admin.html")
      },
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-ui": ["framer-motion", "zustand", "class-variance-authority", "clsx", "tailwind-merge"],
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-accordion",
            "@radix-ui/react-tabs",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-slot",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-label",
            "@radix-ui/react-switch",
            "@radix-ui/react-separator",
            "@radix-ui/react-progress",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-slider",
            "@radix-ui/react-avatar",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-context-menu",
            "@radix-ui/react-hover-card",
            "@radix-ui/react-menubar",
            "@radix-ui/react-navigation-menu",
            "@radix-ui/react-aspect-ratio",
            "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group"
          ],
          "vendor-sentry": ["@sentry/react"],
          "vendor-maps": ["@turf/turf"],
          "vendor-mapbox": ["mapbox-gl"],
          "vendor-charts": ["recharts"]
        }
      }
    }
  }
}));
export {
  vite_admin_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5hZG1pbi5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxwcm9qZWN0c1xcXFx0YWtzaS1pcmFxaVxcXFxSQUFOXFxcXFJBQU5cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkQ6XFxcXHByb2plY3RzXFxcXHRha3NpLWlyYXFpXFxcXFJBQU5cXFxcUkFBTlxcXFx2aXRlLmFkbWluLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vRDovcHJvamVjdHMvdGFrc2ktaXJhcWkvUkFBTi9SQUFOL3ZpdGUuYWRtaW4uY29uZmlnLnRzXCI7LyoqXHJcbiAqIFx1MDYzMVx1MDYyN1x1MDY0NiBcdTIwMTQgXHUwNjI1XHUwNjM5XHUwNjJGXHUwNjI3XHUwNjJGXHUwNjI3XHUwNjJBIFx1MDYyOFx1MDY0Nlx1MDYyN1x1MDYyMSBcdTA2NDRcdTA2NDhcdTA2MkRcdTA2MjkgXHUwNjJBXHUwNjJEXHUwNjQzXHUwNjQ1IFx1MDYyN1x1MDY0NFx1MDYyM1x1MDYyRlx1MDY0NVx1MDY0NlxyXG4gKiBcclxuICogXHUwNjRBXHUwNjI4XHUwNjQ2XHUwNjRBIFx1MDY0MVx1MDY0Mlx1MDYzNyBcdTA2NDNcdTA2NDhcdTA2MkYgXHUwNjI3XHUwNjQ0XHUwNjIzXHUwNjJGXHUwNjQ1XHUwNjQ2IFx1MjAxNCBcdTA2NDhcdTA2NEFcdTA2MjggXHUwNjQxXHUwNjQyXHUwNjM3IChcdTA2MjhcdTA2MkZcdTA2NDhcdTA2NDYgQ2FwYWNpdG9yKVxyXG4gKiBcdTA2MjdcdTA2NDRcdTA2NDVcdTA2MkVcdTA2MzFcdTA2MkNcdTA2MjdcdTA2MkE6IGRpc3QtYWRtaW4vXHJcbiAqIFxyXG4gKiBcdTA2MjdcdTA2NDRcdTA2MjdcdTA2MzNcdTA2MkFcdTA2MkVcdTA2MkZcdTA2MjdcdTA2NDU6XHJcbiAqICAgbnBtIHJ1biBidWlsZDphZG1pblxyXG4gKiAgIG5weCB2aXRlIGJ1aWxkIC0tY29uZmlnIHZpdGUuYWRtaW4uY29uZmlnLnRzXHJcbiAqL1xyXG5pbXBvcnQgeyBkZWZpbmVDb25maWcsIFBsdWdpbiB9IGZyb20gXCJ2aXRlXCI7XHJcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XHJcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XHJcblxyXG4vLyBcdTA2NEFcdTA2NDhcdTA2MkNcdTA2NDcgXHUwNjQzXHUwNjQ0IFx1MDYyN1x1MDY0NFx1MDYzN1x1MDY0NFx1MDYyOFx1MDYyN1x1MDYyQSBcdTA2MjVcdTA2NDRcdTA2NDkgYWRtaW4uaHRtbCBcdTA2MjhcdTA2MkZcdTA2NDRcdTA2MjdcdTA2NEIgXHUwNjQ1XHUwNjQ2IGluZGV4Lmh0bWxcclxuZnVuY3Rpb24gaHRtbEVudHJ5UGx1Z2luKGVudHJ5SHRtbDogc3RyaW5nKTogUGx1Z2luIHtcclxuICByZXR1cm4ge1xyXG4gICAgbmFtZTogJ2h0bWwtZW50cnktcG9pbnQnLFxyXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xyXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKChyZXEsIF9yZXMsIG5leHQpID0+IHtcclxuICAgICAgICBjb25zdCB1cmwgPSByZXEudXJsIHx8ICcnO1xyXG4gICAgICAgIGNvbnN0IGlzVml0ZUludGVybmFsID0gdXJsLnN0YXJ0c1dpdGgoJy9AJykgfHwgdXJsLnN0YXJ0c1dpdGgoJy9fXycpO1xyXG4gICAgICAgIGNvbnN0IGhhc0ZpbGVFeHQgPSAvXFwuXFx3KyhcXD98JCkvLnRlc3QodXJsKTtcclxuICAgICAgICBpZiAoIWlzVml0ZUludGVybmFsICYmICFoYXNGaWxlRXh0KSB7XHJcbiAgICAgICAgICByZXEudXJsID0gYC8ke2VudHJ5SHRtbH1gO1xyXG4gICAgICAgIH1cclxuICAgICAgICBuZXh0KCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSxcclxuICB9O1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiAoe1xyXG4gIGNhY2hlRGlyOiBcIm5vZGVfbW9kdWxlcy8udml0ZS1hZG1pblwiLFxyXG4gIHNlcnZlcjoge1xyXG4gICAgaG9zdDogXCI6OlwiLFxyXG4gICAgcG9ydDogODA4MyxcclxuICB9LFxyXG4gIG9wdGltaXplRGVwczoge1xyXG4gICAgaW5jbHVkZTogW1wicmVhY3QtZGF5LXBpY2tlclwiXSxcclxuICB9LFxyXG4gIHBsdWdpbnM6IFtyZWFjdCgpLCBodG1sRW50cnlQbHVnaW4oJ2FkbWluLmh0bWwnKV0sXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zcmNcIiksXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIHRhcmdldDogXCJlczIwMjBcIixcclxuICAgIG91dERpcjogXCJkaXN0LWFkbWluXCIsXHJcbiAgICBlbXB0eU91dERpcjogdHJ1ZSxcclxuICAgIHNvdXJjZW1hcDogZmFsc2UsXHJcbiAgICBtaW5pZnk6IFwidGVyc2VyXCIsXHJcbiAgICB0ZXJzZXJPcHRpb25zOiB7XHJcbiAgICAgIGNvbXByZXNzOiB7XHJcbiAgICAgICAgZHJvcF9jb25zb2xlOiBtb2RlID09PSBcInByb2R1Y3Rpb25cIixcclxuICAgICAgICBkcm9wX2RlYnVnZ2VyOiB0cnVlLFxyXG4gICAgICAgIHBhc3NlczogMixcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDYwMCxcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgaW5wdXQ6IHtcclxuICAgICAgICBtYWluOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcImFkbWluLmh0bWxcIiksXHJcbiAgICAgIH0sXHJcbiAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIG1hbnVhbENodW5rczoge1xyXG4gICAgICAgICAgXCJ2ZW5kb3ItcmVhY3RcIjogW1wicmVhY3RcIiwgXCJyZWFjdC1kb21cIiwgXCJyZWFjdC1yb3V0ZXItZG9tXCJdLFxyXG4gICAgICAgICAgXCJ2ZW5kb3ItcXVlcnlcIjogW1wiQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5XCJdLFxyXG4gICAgICAgICAgXCJ2ZW5kb3Itc3VwYWJhc2VcIjogW1wiQHN1cGFiYXNlL3N1cGFiYXNlLWpzXCJdLFxyXG4gICAgICAgICAgXCJ2ZW5kb3ItdWlcIjogW1wiZnJhbWVyLW1vdGlvblwiLCBcInp1c3RhbmRcIiwgXCJjbGFzcy12YXJpYW5jZS1hdXRob3JpdHlcIiwgXCJjbHN4XCIsIFwidGFpbHdpbmQtbWVyZ2VcIl0sXHJcbiAgICAgICAgICBcInZlbmRvci1yYWRpeFwiOiBbXHJcbiAgICAgICAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LWRpYWxvZ1wiLCBcIkByYWRpeC11aS9yZWFjdC1wb3BvdmVyXCIsIFwiQHJhZGl4LXVpL3JlYWN0LXNlbGVjdFwiLFxyXG4gICAgICAgICAgICBcIkByYWRpeC11aS9yZWFjdC1kcm9wZG93bi1tZW51XCIsIFwiQHJhZGl4LXVpL3JlYWN0LXRvb2x0aXBcIiwgXCJAcmFkaXgtdWkvcmVhY3QtYWNjb3JkaW9uXCIsXHJcbiAgICAgICAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LXRhYnNcIiwgXCJAcmFkaXgtdWkvcmVhY3Qtc2Nyb2xsLWFyZWFcIiwgXCJAcmFkaXgtdWkvcmVhY3Qtc2xvdFwiLFxyXG4gICAgICAgICAgICBcIkByYWRpeC11aS9yZWFjdC1jaGVja2JveFwiLCBcIkByYWRpeC11aS9yZWFjdC1sYWJlbFwiLCBcIkByYWRpeC11aS9yZWFjdC1zd2l0Y2hcIixcclxuICAgICAgICAgICAgXCJAcmFkaXgtdWkvcmVhY3Qtc2VwYXJhdG9yXCIsIFwiQHJhZGl4LXVpL3JlYWN0LXByb2dyZXNzXCIsIFwiQHJhZGl4LXVpL3JlYWN0LXJhZGlvLWdyb3VwXCIsXHJcbiAgICAgICAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LXNsaWRlclwiLCBcIkByYWRpeC11aS9yZWFjdC1hdmF0YXJcIiwgXCJAcmFkaXgtdWkvcmVhY3QtYWxlcnQtZGlhbG9nXCIsXHJcbiAgICAgICAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LWNvbGxhcHNpYmxlXCIsIFwiQHJhZGl4LXVpL3JlYWN0LWNvbnRleHQtbWVudVwiLCBcIkByYWRpeC11aS9yZWFjdC1ob3Zlci1jYXJkXCIsXHJcbiAgICAgICAgICAgIFwiQHJhZGl4LXVpL3JlYWN0LW1lbnViYXJcIiwgXCJAcmFkaXgtdWkvcmVhY3QtbmF2aWdhdGlvbi1tZW51XCIsIFwiQHJhZGl4LXVpL3JlYWN0LWFzcGVjdC1yYXRpb1wiLFxyXG4gICAgICAgICAgICBcIkByYWRpeC11aS9yZWFjdC10b2dnbGVcIiwgXCJAcmFkaXgtdWkvcmVhY3QtdG9nZ2xlLWdyb3VwXCIsXHJcbiAgICAgICAgICBdLFxyXG4gICAgICAgICAgXCJ2ZW5kb3Itc2VudHJ5XCI6IFtcIkBzZW50cnkvcmVhY3RcIl0sXHJcbiAgICAgICAgICBcInZlbmRvci1tYXBzXCI6IFtcIkB0dXJmL3R1cmZcIl0sXHJcbiAgICAgICAgICBcInZlbmRvci1tYXBib3hcIjogW1wibWFwYm94LWdsXCJdLFxyXG4gICAgICAgICAgXCJ2ZW5kb3ItY2hhcnRzXCI6IFtcInJlY2hhcnRzXCJdLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gIH0sXHJcbn0pKTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQVVBLFNBQVMsb0JBQTRCO0FBQ3JDLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFaakIsSUFBTSxtQ0FBbUM7QUFlekMsU0FBUyxnQkFBZ0IsV0FBMkI7QUFDbEQsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sZ0JBQWdCLFFBQVE7QUFDdEIsYUFBTyxZQUFZLElBQUksQ0FBQyxLQUFLLE1BQU0sU0FBUztBQUMxQyxjQUFNLE1BQU0sSUFBSSxPQUFPO0FBQ3ZCLGNBQU0saUJBQWlCLElBQUksV0FBVyxJQUFJLEtBQUssSUFBSSxXQUFXLEtBQUs7QUFDbkUsY0FBTSxhQUFhLGNBQWMsS0FBSyxHQUFHO0FBQ3pDLFlBQUksQ0FBQyxrQkFBa0IsQ0FBQyxZQUFZO0FBQ2xDLGNBQUksTUFBTSxJQUFJLFNBQVM7QUFBQSxRQUN6QjtBQUNBLGFBQUs7QUFBQSxNQUNQLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRjtBQUNGO0FBRUEsSUFBTyw0QkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE9BQU87QUFBQSxFQUN6QyxVQUFVO0FBQUEsRUFDVixRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsRUFDUjtBQUFBLEVBQ0EsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLGtCQUFrQjtBQUFBLEVBQzlCO0FBQUEsRUFDQSxTQUFTLENBQUMsTUFBTSxHQUFHLGdCQUFnQixZQUFZLENBQUM7QUFBQSxFQUNoRCxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixRQUFRO0FBQUEsSUFDUixhQUFhO0FBQUEsSUFDYixXQUFXO0FBQUEsSUFDWCxRQUFRO0FBQUEsSUFDUixlQUFlO0FBQUEsTUFDYixVQUFVO0FBQUEsUUFDUixjQUFjLFNBQVM7QUFBQSxRQUN2QixlQUFlO0FBQUEsUUFDZixRQUFRO0FBQUEsTUFDVjtBQUFBLElBQ0Y7QUFBQSxJQUNBLHVCQUF1QjtBQUFBLElBQ3ZCLGVBQWU7QUFBQSxNQUNiLE9BQU87QUFBQSxRQUNMLE1BQU0sS0FBSyxRQUFRLGtDQUFXLFlBQVk7QUFBQSxNQUM1QztBQUFBLE1BQ0EsUUFBUTtBQUFBLFFBQ04sY0FBYztBQUFBLFVBQ1osZ0JBQWdCLENBQUMsU0FBUyxhQUFhLGtCQUFrQjtBQUFBLFVBQ3pELGdCQUFnQixDQUFDLHVCQUF1QjtBQUFBLFVBQ3hDLG1CQUFtQixDQUFDLHVCQUF1QjtBQUFBLFVBQzNDLGFBQWEsQ0FBQyxpQkFBaUIsV0FBVyw0QkFBNEIsUUFBUSxnQkFBZ0I7QUFBQSxVQUM5RixnQkFBZ0I7QUFBQSxZQUNkO0FBQUEsWUFBMEI7QUFBQSxZQUEyQjtBQUFBLFlBQ3JEO0FBQUEsWUFBaUM7QUFBQSxZQUEyQjtBQUFBLFlBQzVEO0FBQUEsWUFBd0I7QUFBQSxZQUErQjtBQUFBLFlBQ3ZEO0FBQUEsWUFBNEI7QUFBQSxZQUF5QjtBQUFBLFlBQ3JEO0FBQUEsWUFBNkI7QUFBQSxZQUE0QjtBQUFBLFlBQ3pEO0FBQUEsWUFBMEI7QUFBQSxZQUEwQjtBQUFBLFlBQ3BEO0FBQUEsWUFBK0I7QUFBQSxZQUFnQztBQUFBLFlBQy9EO0FBQUEsWUFBMkI7QUFBQSxZQUFtQztBQUFBLFlBQzlEO0FBQUEsWUFBMEI7QUFBQSxVQUM1QjtBQUFBLFVBQ0EsaUJBQWlCLENBQUMsZUFBZTtBQUFBLFVBQ2pDLGVBQWUsQ0FBQyxZQUFZO0FBQUEsVUFDNUIsaUJBQWlCLENBQUMsV0FBVztBQUFBLFVBQzdCLGlCQUFpQixDQUFDLFVBQVU7QUFBQSxRQUM5QjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLEVBQUU7IiwKICAibmFtZXMiOiBbXQp9Cg==
