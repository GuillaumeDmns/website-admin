import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    // website-react uses 3000, the Flutter web app 5000; the backend allows any localhost origin in development
    port: 4000,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    css: { modules: { classNameStrategy: "non-scoped" } },
  },
});
