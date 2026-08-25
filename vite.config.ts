import { defineConfig } from "vite";

export default defineConfig({
  server: {
    watch: {
      // audio-source/ is a staging folder for raw downloaded tracks, not
      // part of the app — Vite's watcher was crashing the whole dev server
      // (EBUSY) whenever a new file landed there mid-download/mid-write.
      ignored: ["**/audio-source/**"],
    },
  },
});
