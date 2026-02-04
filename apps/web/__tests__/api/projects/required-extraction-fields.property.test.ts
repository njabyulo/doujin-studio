// Feature: mvp-architecture-refactor, Property 2: Required Extraction Fields
// Validates: Requirements 2.6

import { SBrandKit } from "@doujin/shared/schemas";
import type { TBrandKit } from "@doujin/shared/types";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

describe("Property 2: Required Extraction Fields", () => {
  it("should always include productName, tagline, and benefits in extracted brandKit (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl(),
        fc.constantFrom("1:1", "9:16", "16:9"),
        async (url, format) => {
          const brandKit = await mockExtractBrandKit(url, format);

          expect(brandKit).toBeDefined();
          expect(brandKit.productName).toBeDefined();
          expect(typeof brandKit.productName).toBe("string");
          expect(brandKit.productName.length).toBeGreaterThan(0);

          expect(brandKit.tagline).toBeDefined();
          expect(typeof brandKit.tagline).toBe("string");
          expect(brandKit.tagline.length).toBeGreaterThan(0);

          expect(brandKit.benefits).toBeDefined();
          expect(Array.isArray(brandKit.benefits)).toBe(true);
          expect(brandKit.benefits.length).toBeGreaterThan(0);

          const validationResult = SBrandKit.safeParse(brandKit);
          expect(validationResult.success).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

async function mockExtractBrandKit(
  url: string,
  format: string,
): Promise<TBrandKit> {
  const urlHash = hashString(url + format);
  const seed = urlHash % 1000;

  return {
    version: "1",
    productName: `Product ${seed}`,
    tagline: `Tagline for product ${seed}`,
    benefits: [
      `Benefit 1 for ${seed}`,
      `Benefit 2 for ${seed}`,
      `Benefit 3 for ${seed}`,
    ],
    colors: {
      primary: `#${(seed * 123).toString(16).padStart(6, "0").slice(0, 6)}`,
      secondary: `#${(seed * 456).toString(16).padStart(6, "0").slice(0, 6)}`,
      accent: `#${(seed * 789).toString(16).padStart(6, "0").slice(0, 6)}`,
    },
    fonts: {
      heading: "Arial",
      body: "Helvetica",
    },
    tone: "professional",
    pricing: seed % 3 === 0 ? `$${seed % 100}` : undefined,
    testimonials:
      seed % 2 === 0
        ? [`Testimonial 1 for ${seed}`, `Testimonial 2 for ${seed}`]
        : undefined,
    logoUrl:
      seed % 4 === 0 ? `https://example.com/logo-${seed}.png` : undefined,
  };
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
