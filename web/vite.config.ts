import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev proxy: forward /api to the saq backend so the live demo works without CORS
// fuss. The backend contract is documented in ../CLAUDE.md (POST /api/v1/detect).
export default defineConfig({
  plugins: [react()],
  // transformers.js (onnxruntime-web) ships its own wasm and dislikes Vite's
  // dep pre-bundling — exclude it and let the STT worker import it directly.
  optimizeDeps: {
    exclude: ["@huggingface/transformers"],
  },
  worker: {
    format: "es",
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
});
