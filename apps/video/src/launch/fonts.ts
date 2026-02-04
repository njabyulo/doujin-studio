import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadSora } from "@remotion/google-fonts/Sora";

export const bodyFont = loadSora("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});

export const displayFont = loadFraunces("normal", {
  weights: ["500", "600", "700"],
  subsets: ["latin"],
});
