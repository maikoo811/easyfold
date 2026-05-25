# Screenshot capture guide

All public-facing screenshots live in this directory. The README references them by path:

- `hero.png` — top-of-README composite, shown on github.com and on social previews.
- `input.png` — the assembly builder mid-build.
- `result.png` — a successful prediction's result page (Mol* + charts + interpret).
- (optional) `input-with-ligand.png` — close-up of the "Add ligand" panel.

If you change the README's image references, update this file to match.

---

## hero.png — composite, target ~1600×900 (16:9)

Three side-by-side panels combined into a single PNG (macOS Preview's "tile" works, or any image editor). From left to right:

1. **Input**: the home page with an assembly built — at least 1 protein (e.g. P04637 / p53), 1 modification (PHOSPHO at residue 15), 1 ligand (CCD `HEM` or SMILES `CCO`), `copies=1` is fine. Show the Predict buttons at the bottom. This is "what the user does."
2. **Result**: a `/predict/[jobId]` page showing the Mol\* viewer with a real cartoon structure rendered (p53 works — it's the structure that's been validated end-to-end). The pLDDT chart should be visible below the viewer. This is "what they get back."
3. **Interpret**: the InterpretationPanel with a Claude response visible. The example question "Where are the disordered regions?" with the answer that identifies the N-terminal transactivation domain + C-terminal regulatory domain is a great fit — it shows the *biological reasoning*, which is the whole differentiation. This is "what makes EasyFold different."

The hero is the most important visual; spend an extra few minutes getting the framing right.

---

## input.png — target ~1280×900

The home page (`http://localhost:3000`) with the assembly builder mid-build:

- 1 protein (P04637 looked up via UniProt)
- 1 modification (PHOSPHO at residue 15) — so the Boltz-disabled tooltip is visible
- 1 ligand (SMILES `CCO`, or CCD `HEM`)
- `copies` = 2 on the protein (so chain labels show "Chains A, B")

This screenshot is the cleanest single-frame demonstration that the assembly builder handles the full PredictionJob shape.

---

## result.png — target ~1280×900

A successful prediction's `/predict/[jobId]` page:

- Mol\* viewer rendering a real cartoon (p53 again, or whatever your last successful run was).
- The pLDDT chart visible below — values should be in 0-100 range (post the Task 3.3 validation polish).
- (Optional) Scroll down a bit to also include the InterpretationPanel input field at the bottom.

Frame the screenshot so the structure is clearly visible (not at the absolute top of the panel) and the chart is legible.

---

## input-with-ligand.png — optional, target ~800×600

A close-up of just the "Add ligand" inline panel, mid-fill (SMILES tab selected, `CCO` typed into the input). Useful only if the README ever grows a dedicated "ligand support" section.

---

## Capture tips

- **Browser zoom 100%, system display at standard scale.** Hi-DPI displays produce 2x images; that's fine — GitHub downsamples nicely.
- **Hide bookmarks bar.** It's noise.
- **Scroll position at the top of each panel** unless the content you want is below.
- **macOS**: `⌘ Shift 4`, then drag for an area screenshot. Output PNG.
- **No JPG**, ever — text in PNGs stays crisp.
- **Crop the URL bar** if it shows `localhost:3000` and that's distracting (though `localhost` is fine and signals "this is your own machine").

Once captured, drop the PNGs into this directory and remove this paragraph from `hero.png`'s expected size if you go with a different aspect ratio.
