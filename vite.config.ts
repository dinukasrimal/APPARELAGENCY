
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
  // The droplet serves the build with `vite preview` behind nginx. Vite
  // rejects requests for hostnames it doesn't recognise, so the public
  // HTTPS name has to be listed or every proxied request is blocked.
  preview: {
    allowedHosts: ["app.dag-apparel.com"],
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    // Define process.env for compatibility if needed
    'process.env': {},
  },
  optimizeDeps: {
    include: ['leaflet'],
    exclude: []
  },
  ssr: {
    noExternal: ['leaflet']
  }
}));
