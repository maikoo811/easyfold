/**
 * Excel-column-style chain ID generator (1-indexed).
 *
 * Mirrors `backend/easyfold/af3_input/_chain_ids.py` so the assembly preview
 * shows the same chain IDs the backend will assign at job-build time. Keep
 * the two implementations in sync — the backend is the source of truth for
 * chain ordering, this is purely a UX preview.
 */

export function excelChainId(n: number): string {
  if (n < 1) throw new Error(`chain id index must be >= 1, got ${n}`);
  let result = "";
  let remaining = n;
  while (remaining > 0) {
    const rem = (remaining - 1) % 26;
    remaining = Math.floor((remaining - 1) / 26);
    result = String.fromCharCode("A".charCodeAt(0) + rem) + result;
  }
  return result;
}

/** Returns a comma-separated string of chain IDs starting at `startIndex` for `count` chains. */
export function chainIdRange(startIndex: number, count: number): string {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(excelChainId(startIndex + i));
  }
  return ids.join(", ");
}
