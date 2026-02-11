import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "services/index": "src/services/index.ts",
  },
  target: "es2015",
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  outDir: "dist",
});
