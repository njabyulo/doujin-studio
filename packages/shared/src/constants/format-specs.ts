export type TAdFormat = "1:1" | "9:16" | "16:9";

export interface TFormatSpec {
  width: number;
  height: number;
  safeArea: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  textMaxLength: number;
}

export const FORMAT_SPECS: Record<TAdFormat, TFormatSpec> = {
  "1:1": {
    width: 1080,
    height: 1080,
    safeArea: { top: 100, bottom: 100, left: 100, right: 100 },
    textMaxLength: 80,
  },
  "9:16": {
    width: 1080,
    height: 1920,
    safeArea: { top: 200, bottom: 200, left: 50, right: 50 },
    textMaxLength: 60,
  },
  "16:9": {
    width: 1920,
    height: 1080,
    safeArea: { top: 100, bottom: 100, left: 200, right: 200 },
    textMaxLength: 100,
  },
};
