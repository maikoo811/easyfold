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
#   HF_TOKEN=hf_... ./demo/deploy.sh maiko811/easyfold-demo
set -euo pipefail

SPACE="${1:?Pass the HF Space ID as the first arg, e.g. maiko811/easyfold-demo}"

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

# Replace the root index.html (the live AssemblyBuilder) with a tiny redirect
# to /demo. The static HF Spaces deploy has no backend, so the AssemblyBuilder
# hits "Network error" on its first call to /api/v1/sequences. The pre-computed
# demo lives at /demo and works without a backend; redirecting root → /demo
# makes the HF Space "just work" for first-time visitors.
echo "==> Replacing root index.html with redirect to /demo"
cat > out/index.html <<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url=demo.html">
  <title>EasyFold demo</title>
  <link rel="canonical" href="demo.html">
</head>
<body>
  <p>Redirecting to <a href="demo.html">the EasyFold demo</a>…</p>
</body>
</html>
HTML

echo "==> Uploading out/ to Space $SPACE"
# Note: the old `huggingface-cli` CLI was deprecated in favor of `hf` (huggingface_hub >=0.34).
# Same args, different binary name. Invoked via uvx so contributors don't need a global install.
uvx --from huggingface_hub hf upload "$SPACE" out/ . \
  --repo-type=space \
  --commit-message="Deploy EasyFold demo $(git rev-parse --short HEAD)"

echo
echo "Done. Space will rebuild and go live at https://huggingface.co/spaces/$SPACE"
