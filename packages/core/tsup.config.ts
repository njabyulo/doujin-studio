import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "services/index": "src/services/index.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  outDir: "dist",
});
