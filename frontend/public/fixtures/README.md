# Fixtures

Static structure files + synthetic confidence JSONs used by the `/demo` routes (no runtime fetch to RCSB).

| File | Source | Notes |
|---|---|---|
| `1tup.cif` | `https://files.rcsb.org/download/1TUP.cif` | TP53 tetramer bound to DNA; used by `/demo/viewer/1tup` |
| `1crn.cif` | `https://files.rcsb.org/download/1CRN.cif` | Crambin, 46 aa; used by `/demo/viewer/1crn` |
| `6lu7.cif` | `https://files.rcsb.org/download/6LU7.cif` | SARS-CoV-2 main protease + N3 inhibitor, 306 aa; used by `/demo/viewer/6lu7` |
| `<id>_confidence.json` | `scripts/generate-confidence-fixture.mjs` | Synthetic per-structure pLDDT + PAE + ipTM. Deterministic (Mulberry32, seeds 42/43/44). Will be replaced with real AlphaFold output in Task 3.x. |

## Regenerating

```bash
# From frontend/
node scripts/download-pdb-fixtures.mjs        # fetches 1CRN + 6LU7 (skips files already present)
node scripts/generate-confidence-fixture.mjs  # regenerates all confidence JSONs deterministically
```
