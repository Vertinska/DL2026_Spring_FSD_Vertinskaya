import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite dev server configuration with proxy to the Node.js backend.
// Frontend runs on http://localhost:3000 and proxies /api requests to http://localhost:5000.

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});

