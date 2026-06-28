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

  it("classifies into the AF3 4-band convention (≥90 / 70-89 / 50-69 / <50)", () => {
    const stats = summarizePlddt([95, 85, 71, 70, 60, 50, 49, 30]);
    expect(stats?.count).toBe(8);
    // ≥ 90: 95 → 1
    expect(stats?.veryHighFraction).toBeCloseTo(1 / 8, 5);
    // 70-89: 85, 71, 70 → 3
    expect(stats?.confidentFraction).toBeCloseTo(3 / 8, 5);
    // 50-69: 60, 50 → 2
    expect(stats?.lowFraction).toBeCloseTo(2 / 8, 5);
    // < 50: 49, 30 → 2
    expect(stats?.veryLowFraction).toBeCloseTo(2 / 8, 5);
    // Bands are mutually exclusive — fractions sum to 1.
    const sum =
      (stats?.veryHighFraction ?? 0) +
      (stats?.confidentFraction ?? 0) +
      (stats?.lowFraction ?? 0) +
      (stats?.veryLowFraction ?? 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("handles an all-confident array (all ≥ 70)", () => {
    const stats = summarizePlddt([90, 95, 88, 75]);
    expect(stats?.veryHighFraction).toBe(0.5);
    expect(stats?.confidentFraction).toBe(0.5);
    expect(stats?.lowFraction).toBe(0);
    expect(stats?.veryLowFraction).toBe(0);
  });

  it("handles an all-disordered array (all < 50)", () => {
    const stats = summarizePlddt([10, 20, 30, 40]);
    expect(stats?.veryHighFraction).toBe(0);
    expect(stats?.confidentFraction).toBe(0);
    expect(stats?.lowFraction).toBe(0);
    expect(stats?.veryLowFraction).toBe(1);
  });

  it("computes the median (50th percentile, linear interpolation)", () => {
    // Odd length → middle element.
    expect(summarizePlddt([10, 50, 90])?.median).toBe(50);
    // Even length → average of two middle elements.
    expect(summarizePlddt([10, 50, 60, 90])?.median).toBe(55);
  });

  it("median is robust to skewed (bimodal) distributions where mean misleads", () => {
    // Five super-confident + five totally disordered residues. Mean is in the
    // middle and reads as "low confidence overall"; median exposes the bimodal
    // split — half the residues are confidently folded.
    const stats = summarizePlddt([10, 15, 20, 25, 30, 80, 85, 90, 92, 95]);
    expect(stats?.mean).toBeCloseTo(54.2, 1);
    expect(stats?.median).toBe(55);
    // The bands tell the real story:
    expect(stats?.veryLowFraction).toBe(0.5);
    expect(stats?.veryHighFraction).toBe(0.3);
  });
});
