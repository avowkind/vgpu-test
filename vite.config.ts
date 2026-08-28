import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { wgslVitePlugin } from "@vgpu/wgsl/loader-vite";

const root = fileURLToPath(new URL(".", import.meta.url));
/** Project Pages URL is https://<user>.github.io/vgpu-test/ */
const pagesBase = process.env.GITHUB_ACTIONS ? "/vgpu-test/" : "/";

function demoInputs() {
  const demosRoot = resolve(root, "demos");
  const entries: Record<string, string> = {
    main: resolve(root, "index.html"),
  };

  for (const name of readdirSync(demosRoot, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    entries[name.name] = resolve(demosRoot, name.name, "index.html");
  }

  return entries;
}

export default defineConfig({
  base: pagesBase,
  plugins: [wgslVitePlugin()],
  appType: "mpa",
  build: {
    rollupOptions: {
      input: demoInputs(),
    },
  },
  server: {
    open: "/",
  },
});
