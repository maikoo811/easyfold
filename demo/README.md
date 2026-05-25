---
title: EasyFold Demo
emoji: 🧬
colorFrom: gray
colorTo: indigo
sdk: static
app_file: index.html
pinned: false
license: cc-by-nc-sa-4.0
short_description: Pre-computed AlphaFold viewer for 3 example structures.
---

# EasyFold demo

Static demo of [EasyFold](https://github.com/maikoo811/easyfold) on Hugging Face Spaces (CPU free tier — no GPU, no backend, no AlphaFold runtime). Three pre-computed structures rendered with [Mol\*](https://molstar.org/) alongside pLDDT / PAE confidence charts and on-demand natural-language interpretation (BYOK Anthropic API key).

| | |
|---|---|
| **1TUP** | p53 tumor suppressor bound to DNA (219 aa) |
| **1CRN** | Crambin — textbook small disulfide-rich protein (46 aa) |
| **6LU7** | SARS-CoV-2 main protease + N3 inhibitor (306 aa) |

Confidence values shown are **synthetic** for the public demo. The production deployment (self-hosted via Modal one-click) will produce real AlphaFold 3 / Boltz-2 outputs from user-supplied sequences.

---

## How to build and deploy

The Space content is built from this repo's `/frontend` package as a Next.js static export, then uploaded to Hugging Face.

```bash
# From repo root, with HF_TOKEN in env:
./demo/deploy.sh <hf-username>/<space-name>
```

The script does:

1. `cd frontend && BUILD_TARGET=demo pnpm build` — produces `frontend/out/`
2. Copies this README into `frontend/out/README.md` (HF needs the YAML frontmatter at the Space root)
3. `huggingface-cli upload <space>` of the `out/` directory

Prerequisites: `pnpm`, `uv` (for `uvx huggingface-cli`), an HF account, and an HF token with write access to the Space.

If the Space doesn't exist yet, create it once in the Hugging Face UI (or via `huggingface-cli repo create --type=space --space_sdk=static <space>`), then run the deploy script.

---

## License

EasyFold (and this demo) ship under [CC-BY-NC-SA 4.0](https://github.com/maikoo811/easyfold/blob/main/LICENSE), inherited from AlphaFold 3. The non-commercial restriction applies to the AlphaFold-derived path; the Boltz-2 path is MIT and can be used commercially.
