import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // If the repository name is different, update this base path.
  base: process.env.NODE_ENV === "production" ? "/investment-portfolio/" : "/",
  plugins: [react()],
});
