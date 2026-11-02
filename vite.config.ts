import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), viteSingleFile()],
  server: {
    proxy: {
      // FIRMS has no open CORS policy — proxy it in dev:
      // /firms/api/area/csv/... → https://firms.modaps.eosdis.nasa.gov/api/area/csv/...
      "/firms": {
        target: "https://firms.modaps.eosdis.nasa.gov",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/firms/, ""),
      },
    },
  },
});
