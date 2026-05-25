"""Regenerate ``tests/api/openapi.snapshot.json`` after an intentional API change.

When ``test_openapi_snapshot_matches`` fails:

1. Run ``uv run python scripts/update_openapi_snapshot.py`` from ``backend/``.
2. Inspect the diff (``git diff tests/api/openapi.snapshot.json``).
3. If the change is intentional (added/renamed/removed endpoint, schema
   change), commit the new snapshot alongside the code change.
4. If the diff is surprising, **don't update the snapshot** — find the
   regression in the API and fix it.

The snapshot is serialized with ``sort_keys=True`` and a trailing newline
so the file is reproducible across runs and ``git`` shows clean diffs.
"""

import json
import sys
from pathlib import Path

# Make the ``backend/`` directory importable when running this script
# directly (``uv run python scripts/update_openapi_snapshot.py``) — the
# script lives in ``backend/scripts/`` but the importable package
# (``easyfold``) is in its parent.
sys.path.insert(0, str(Path(__file__).parent.parent))

from easyfold.main import app

TARGET = Path(__file__).parent.parent / "tests" / "api" / "openapi.snapshot.json"


def main() -> None:
    spec = app.openapi()
    TARGET.write_text(json.dumps(spec, indent=2, sort_keys=True) + "\n")
    print(f"Updated {TARGET}")


if __name__ == "__main__":
    main()
