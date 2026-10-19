import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  publicDir: false,
  plugins: [tailwindcss()],
  build: {
    outDir: "public/build",
    emptyOutDir: false,
    rollupOptions: {
      input: "src/app.css",
      output: {
        assetFileNames: "assets/app.css",
      },
    },
  },
});
