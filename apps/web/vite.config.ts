import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8799",
      "/health": "http://localhost:8799",
      "/webhooks": "http://localhost:8799",
    },
  },
});
