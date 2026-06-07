import { defineConfig } from "vite";

const port = Number(process.env.PORT) || 3000;
const basePath = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
