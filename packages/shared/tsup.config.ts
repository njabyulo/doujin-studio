import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "types/index": "src/types/index.ts",
    "consts/index": "src/consts/index.ts",
    "utils/index": "src/utils/index.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  outDir: "dist",
});
