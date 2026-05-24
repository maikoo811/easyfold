#!/usr/bin/env bash
# Build the EasyFold demo as a Next.js static export and push it to a
# Hugging Face Space (Static SDK).
#
# Prerequisites:
#   - $HF_TOKEN exported in your environment (write access to the Space)
#   - pnpm installed (we use it for the demo build)
#   - uv installed (we invoke huggingface-cli via uvx so there's no global Python dep)
#   - The Space already exists. Create once via the HF UI or:
#       uvx --from huggingface_hub huggingface-cli repo create \
#         --type=space --space_sdk=static <hf-username>/<space-name>
#
# Usage:
#   ./demo/deploy.sh <hf-username>/<space-name>
#
# Example:
#   HF_TOKEN=hf_... ./demo/deploy.sh maikoo811/easyfold-demo
set -euo pipefail

SPACE="${1:?Pass the HF Space ID as the first arg, e.g. maikoo811/easyfold-demo}"

if [[ -z "${HF_TOKEN:-}" ]]; then
  echo "error: HF_TOKEN must be set in the environment" >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT/frontend"

echo "==> Installing frontend deps (frozen lockfile)"
pnpm install --frozen-lockfile

echo "==> Building demo (BUILD_TARGET=demo)"
BUILD_TARGET=demo pnpm build

if [[ ! -d out ]]; then
  echo "error: build did not produce frontend/out/ — aborting" >&2
  exit 1
fi

echo "==> Copying HF Spaces README into the export root"
cp "$REPO_ROOT/demo/README.md" out/README.md

echo "==> Uploading out/ to Space $SPACE"
uvx --from huggingface_hub huggingface-cli upload "$SPACE" out/ . \
  --repo-type=space \
  --commit-message="Deploy EasyFold demo $(git rev-parse --short HEAD)"

echo
echo "Done. Space will rebuild and go live at https://huggingface.co/spaces/$SPACE"
