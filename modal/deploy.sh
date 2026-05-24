#!/usr/bin/env bash
# Deploy an EasyFold inference Modal Function to the currently-authenticated
# Modal workspace. Run `uv run modal setup` from `backend/` first if you haven't.
#
# Prerequisites:
#   * AF3: a populated `easyfold-af3-weights` Volume — see ./README.md § AlphaFold 3.
#   * Boltz-2: nothing manual; `easyfold-boltz-cache` self-creates on first deploy.
#
# Usage:
#   ./modal/deploy.sh             # default: AF3
#   ./modal/deploy.sh af3
#   ./modal/deploy.sh boltz
set -euo pipefail

TARGET="${1:-af3}"
case "$TARGET" in
  af3)   MODULE="easyfold/inference/af3.py"   ;;
  boltz) MODULE="easyfold/inference/boltz.py" ;;
  *)     echo "Usage: $0 [af3|boltz]" >&2; exit 1 ;;
esac

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT/backend"

echo "==> Deploying $TARGET Function to Modal (first run builds ~5-10 min)"
uv run modal deploy "$MODULE"
