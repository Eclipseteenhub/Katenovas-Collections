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
        about: path.resolve(__dirname, "about.html"),
        "privacy-policy": path.resolve(__dirname, "privacy-policy.html"),
        terms: path.resolve(__dirname, "terms.html"),
        "refund-policy": path.resolve(__dirname, "refund-policy.html"),
        "shipping-policy": path.resolve(__dirname, "shipping-policy.html"),
        checkout: path.resolve(__dirname, "checkout.html"),
        "order-success": path.resolve(__dirname, "order-success.html"),
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
