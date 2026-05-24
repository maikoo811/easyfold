#!/usr/bin/env bash
# Deploy the EasyFold AlphaFold 3 Modal Function to the currently-authenticated
# Modal workspace. Run `uv run modal setup` from `backend/` first if you haven't.
#
# Prerequisites: a populated `easyfold-af3-weights` Volume — see ./README.md.
#
# Usage:
#   ./modal/deploy.sh
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT/backend"

echo "==> Deploying AF3 Function to Modal (first run builds ~5-10 min)"
uv run modal deploy easyfold/inference/af3.py
