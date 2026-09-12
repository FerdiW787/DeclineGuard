// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import clerk from "@clerk/astro";
import tailwindcss from "@tailwindcss/vite";
import node from "@astrojs/node";

export default defineConfig({
  integrations: [react(), clerk()],
  vite: {
    // @ts-ignore
    plugins: [tailwindcss()],
    server: {
      // Allow ngrok (and similar) tunnels to reach the Vite/Astro dev server
      allowedHosts: [".ngrok-free.dev", ".ngrok.io", "localhost"],
    },
    // @visx packages ship extensionless ESM imports that Node’s SSR resolver
    // cannot load; bundling them for SSR avoids ERR_MODULE_NOT_FOUND.
    ssr: {
      noExternal: [/^@visx\//],
    },
  },
  server: {
    port: 4321,
    host: true,
  },
  adapter: node({
    mode: "standalone",
  }),
  output: "server",
});
