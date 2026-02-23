import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import path from "node:path";
import { readFileSync } from "node:fs";

const rootPkg = JSON.parse(
  readFileSync(path.resolve(__dirname, "../../package.json"), "utf-8"),
);

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version ?? "0.0.0"),
  },
  plugins: [react(), tailwindcss(), cloudflare()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
