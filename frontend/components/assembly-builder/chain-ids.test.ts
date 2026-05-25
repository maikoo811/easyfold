/**
 * Golden tests against backend's ``excel_chain_id`` (see
 * ``backend/easyfold/af3_input/_chain_ids.py`` + its test file). The same
 * canonical pairs run on both sides; divergence is a regression.
 */

import { describe, expect, it } from "vitest";

import { chainIdRange, excelChainId } from "./chain-ids";

describe("excelChainId", () => {
  it.each([
    [1, "A"],
    [2, "B"],
    [26, "Z"],
    [27, "AA"],
    [28, "AB"],
    [52, "AZ"],
    [53, "BA"],
    [702, "ZZ"],
    [703, "AAA"],
  ])("maps %d → %s (matches backend)", (n, expected) => {
    expect(excelChainId(n)).toBe(expected);
  });

  it("rejects zero", () => {
    expect(() => excelChainId(0)).toThrow(/>= 1/);
  });

  it("rejects negative indices", () => {
    expect(() => excelChainId(-3)).toThrow(/>= 1/);
  });
});

describe("chainIdRange", () => {
  it("returns a comma-separated single-letter run", () => {
    expect(chainIdRange(1, 3)).toBe("A, B, C");
  });

  it("crosses the Z → AA boundary cleanly", () => {
    expect(chainIdRange(25, 4)).toBe("Y, Z, AA, AB");
  });

  it("returns an empty string when count is 0", () => {
    expect(chainIdRange(1, 0)).toBe("");
  });
});
