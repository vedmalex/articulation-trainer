import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

// Relative base: the built `dist/` can sit in any static folder.
export default defineConfig({
  plugins: [preact(), VitePWA({
    registerType: "autoUpdate",
    includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
    manifest: {
      name: "Артикуляционный тренажёр",
      short_name: "Артикуляция",
      description: "Упражнения для артикуляции и дикции",
      lang: "ru",
      start_url: "./",
      scope: "./",
      display: "standalone",
      background_color: "#f3eadc",
      theme_color: "#f3eadc",
      icons: [
        { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    workbox: { globPatterns: ["**/*.{js,css,html,woff,woff2,png,svg}"] },
  })],
  base: "./",
});
