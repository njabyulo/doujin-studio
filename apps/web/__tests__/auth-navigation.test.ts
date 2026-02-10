import { describe, expect, it } from "vitest";
import { buildAuthHref, getSafeNextPath } from "./auth-navigation";

describe("auth navigation helpers", () => {
  it("accepts internal next paths", () => {
    expect(getSafeNextPath("/projects/123")).toBe("/projects/123");
  });

  it("rejects unsafe next values", () => {
    expect(getSafeNextPath("https://evil.com")).toBe("/");
    expect(getSafeNextPath("//evil.com")).toBe("/");
    expect(getSafeNextPath(null)).toBe("/");
  });

  it("builds auth href with sanitized next", () => {
    expect(buildAuthHref("/auth/sign-in", "/projects/123")).toBe(
      "/auth/sign-in?next=%2Fprojects%2F123",
    );
    expect(buildAuthHref("/auth/sign-up", "https://evil.com")).toBe(
      "/auth/sign-up?next=%2F",
    );
  });
});
