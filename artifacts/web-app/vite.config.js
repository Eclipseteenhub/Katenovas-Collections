import { defineConfig } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "index.html"),
        products: path.resolve(__dirname, "products.html"),
        cart: path.resolve(__dirname, "cart.html"),
        contact: path.resolve(__dirname, "contact.html"),
        "admin-login": path.resolve(__dirname, "admin-login.html"),
        "admin-dashboard": path.resolve(__dirname, "admin-dashboard.html"),
      },
    },
  },
  server: {
    allowedHosts: true,
    host: "0.0.0.0",
    port: parseInt(process.env.PORT || "22965"),
    strictPort: true,
  },
});
