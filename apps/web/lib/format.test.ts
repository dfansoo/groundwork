import { describe, expect, it } from "vitest";
import { formatMoney, minorToMajor } from "@/lib/format";

describe("minorToMajor", () => {
  it("converts minor units to major", () => {
    expect(minorToMajor(150000)).toBe(1500);
    expect(minorToMajor(99)).toBe(0.99);
  });
});

describe("formatMoney", () => {
  it("formats PLN in the major unit (tolerant of ICU spacing)", () => {
    const out = formatMoney(150000, "PLN");
    expect(out).toMatch(/1[\s ]?500/);
    expect(out.toLowerCase()).toContain("z"); // 'zł'
  });

  it("returns a non-empty string for USD", () => {
    expect(formatMoney(120000, "USD").length).toBeGreaterThan(0);
  });
});
