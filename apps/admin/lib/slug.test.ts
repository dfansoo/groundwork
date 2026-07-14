import { describe, expect, it } from "vitest";
import { slugifyTitle, slugField } from "./slug";

describe("slugifyTitle", () => {
  it("mirrors the backend: lowercase, dashed, diacritics stripped", () => {
    expect(slugifyTitle("Yala Safari Day Tour")).toBe("yala-safari-day-tour");
    expect(slugifyTitle("Café  Crème!!")).toBe("cafe-creme");
    expect(slugifyTitle("  --Hello--  ")).toBe("hello");
    expect(slugifyTitle("***")).toBe("");
  });

  it("truncates to 80 chars without a trailing dash", () => {
    expect(slugifyTitle("a".repeat(79) + " bc")).toBe("a".repeat(79));
    expect(slugifyTitle("a".repeat(100))).toHaveLength(80);
  });
});

describe("slugField", () => {
  it("accepts an empty string, meaning the backend derives it", () => {
    expect(slugField.parse("")).toBe("");
  });

  it("accepts a well-formed slug", () => {
    expect(slugField.parse("wildlife-escape-2")).toBe("wildlife-escape-2");
  });

  it("rejects uppercase, spaces and doubled dashes", () => {
    expect(slugField.safeParse("Wildlife").success).toBe(false);
    expect(slugField.safeParse("wildlife escape").success).toBe(false);
    expect(slugField.safeParse("wildlife--escape").success).toBe(false);
    expect(slugField.safeParse("-wildlife").success).toBe(false);
  });
});
