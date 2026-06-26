import { describe, expect, it } from "vitest";

import { summarizePlddt } from "./plddt-stats";

describe("summarizePlddt", () => {
  it("returns null for an empty array", () => {
    expect(summarizePlddt([])).toBeNull();
  });

  it("returns null when all entries are NaN", () => {
    expect(summarizePlddt([NaN, NaN, NaN])).toBeNull();
  });

  it("skips NaN entries when computing the mean", () => {
    const stats = summarizePlddt([50, 90, NaN, 70]);
    expect(stats?.count).toBe(3);
    expect(stats?.mean).toBeCloseTo(70, 5);
  });

  it("classifies > 70 as high and < 50 as low (strict inequalities)", () => {
    const stats = summarizePlddt([95, 85, 71, 70, 60, 50, 49, 30]);
    expect(stats?.count).toBe(8);
    // > 70: 95, 85, 71 → 3
    expect(stats?.highFraction).toBeCloseTo(3 / 8, 5);
    // < 50: 49, 30 → 2 (note: 50 itself is NOT low)
    expect(stats?.lowFraction).toBeCloseTo(2 / 8, 5);
  });

  it("handles an all-confident array", () => {
    const stats = summarizePlddt([90, 95, 88, 75]);
    expect(stats?.highFraction).toBe(1);
    expect(stats?.lowFraction).toBe(0);
  });

  it("handles an all-disordered array", () => {
    const stats = summarizePlddt([10, 20, 30, 40]);
    expect(stats?.highFraction).toBe(0);
    expect(stats?.lowFraction).toBe(1);
  });
});
