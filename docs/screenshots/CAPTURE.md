# Screenshot capture guide

All public-facing screenshots live in this directory. The README's top-of-page
"Build → Predict → Interpret" tour stacks three screenshots vertically, each
focused on one stage of the flow.

| File | What it shows | Target size |
|---|---|---|
| `input.png` | Assembly builder mid-build | ~1280×900 |
| `result.png` | Mol\* viewer + pLDDT chart + PAE heatmap | ~1280×900 |
| `interpret.png` | Claude's natural-language interpretation with API key + question + answer + actions | ~1280×900 |

If you change the README's image references, update this file to match.

---

## input.png

The home page (`http://localhost:3000`) with the assembly builder fully built:

- 1 protein (UniProt lookup of **P04637** is the canonical example)
- `copies = 2` on the protein (so chain labels show "Chains A, B")
- 1 modification: **PHOSPHO** at residue 15 (so the Boltz-disabled tooltip is visible)
- 1 ligand: SMILES **`CCO`** (or CCD **`HEM`**)

This single frame demonstrates every assembly-builder feature: multi-chain,
post-translational modifications, ligands, per-model capability surface
(the disabled-Boltz tooltip), and the chain-ID preview.

---

## result.png

A successful prediction's `/predict/[jobId]` page. The cleanest version of
this screenshot includes (top → bottom in one frame):

- Header strip with the protein name + `pTM` / `ipTM` badges.
- Mol\* viewer with the cartoon structure rendered. For P04637 the
  DNA-binding domain (~residues 100–300) shows up as the high-confidence
  blue region in the middle, with disordered N-/C-termini in orange.
- Per-residue pLDDT chart (0–100 axis, peaks in the DBD region).
- PAE heatmap (lower is darker = better; the structured-region square
  in the middle is visually obvious).

The smaller-zoom version (everything fits in one viewport) makes a better
README hero than a tightly-cropped Mol\*-only frame.

---

## interpret.png

The Interpret panel with a Claude response visible. Recommended setup:

1. Enter your Anthropic API key (BYOK — never sent to our backend).
2. Question: anything that gets a biologically-grounded answer. Good
   choices for P04637:
   - `What does pTM 0.53 mean here?`
   - `Where are the disordered regions?`
   - `Is the structured core trustworthy enough for docking?`
3. Click **Interpret**. Wait a few seconds for the answer.
4. Frame the screenshot so the question, the answer paragraph, **and** the
   "Next steps" actionable suggestions are all in one frame. The full
   panel is what sells the differentiation.

---

## Capture tips

- **Browser zoom 100%, system display at standard scale.** Hi-DPI displays
  produce 2× images; that's fine — GitHub downsamples nicely.
- **Hide bookmarks bar.** It's noise.
- **Scroll position at the top of the content area** unless what you want
  is below.
- **macOS**: ⌘⇧4, then drag for an area screenshot. PNG only — text in
  JPGs gets fuzzy.
- **The localhost URL bar is fine to include** — it signals "this is your
  own machine, not our service" which matches the BYOC pitch. Crop only
  if it's visually distracting.
