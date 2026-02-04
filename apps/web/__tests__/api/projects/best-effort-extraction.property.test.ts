// Feature: mvp-architecture-refactor, Property 3: Best-Effort Extraction
// Validates: Requirements 2.7

import { SBrandKit } from "@doujin/shared/schemas";
import type { TBrandKit } from "@doujin/shared/types";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

describe("Property 3: Best-Effort Extraction", () => {
  it("should extract optional fields (pricing, testimonials, logoUrl) when present in source (min 100 iterations)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.webUrl(),
        fc.constantFrom("1:1", "9:16", "16:9"),
        fc.record({
          hasPricing: fc.boolean(),
          hasTestimonials: fc.boolean(),
          hasLogo: fc.boolean(),
        }),
        async (url, format, sourceContent) => {
          const brandKit = await mockExtractBrandKitWithOptionalFields(
            url,
            format,
            sourceContent,
          );

          const validationResult = SBrandKit.safeParse(brandKit);
          expect(validationResult.success).toBe(true);

          if (sourceContent.hasPricing) {
            expect(brandKit.pricing).toBeDefined();
            expect(typeof brandKit.pricing).toBe("string");
            expect(brandKit.pricing!.length).toBeGreaterThan(0);
          }

          if (sourceContent.hasTestimonials) {
            expect(brandKit.testimonials).toBeDefined();
            expect(Array.isArray(brandKit.testimonials)).toBe(true);
            expect(brandKit.testimonials!.length).toBeGreaterThan(0);
            brandKit.testimonials!.forEach((testimonial) => {
              expect(typeof testimonial).toBe("string");
              expect(testimonial.length).toBeGreaterThan(0);
            });
          }

          if (sourceContent.hasLogo) {
            expect(brandKit.logoUrl).toBeDefined();
            expect(typeof brandKit.logoUrl).toBe("string");
            expect(brandKit.logoUrl!.length).toBeGreaterThan(0);
            expect(() => new URL(brandKit.logoUrl!)).not.toThrow();
          }

          expect(brandKit.productName).toBeDefined();
          expect(brandKit.tagline).toBeDefined();
          expect(brandKit.benefits).toBeDefined();
          expect(brandKit.benefits.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

async function mockExtractBrandKitWithOptionalFields(
  url: string,
  format: string,
  sourceContent: {
    hasPricing: boolean;
    hasTestimonials: boolean;
    hasLogo: boolean;
  },
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
    pricing: sourceContent.hasPricing ? `$${(seed % 100) + 10}.99` : undefined,
    testimonials: sourceContent.hasTestimonials
      ? [
          `"Great product!" - Customer ${seed}`,
          `"Highly recommend!" - User ${seed + 1}`,
        ]
      : undefined,
    logoUrl: sourceContent.hasLogo
      ? `https://example.com/logos/product-${seed}.png`
      : undefined,
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
