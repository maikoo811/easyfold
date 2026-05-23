"""Excel-column-style chain ID generator (1-indexed)."""


def excel_chain_id(n: int) -> str:
    """Return the n-th chain ID in Excel column order.

    1 → "A", 26 → "Z", 27 → "AA", 28 → "AB", …, 52 → "AZ",
    53 → "BA", …, 702 → "ZZ", 703 → "AAA".

    Args:
        n: 1-based index. Must be >= 1.

    Raises:
        ValueError: when ``n < 1``.
    """
    if n < 1:
        raise ValueError(f"chain id index must be >= 1, got {n}")
    result = ""
    remaining = n
    while remaining > 0:
        remaining, rem = divmod(remaining - 1, 26)
        result = chr(ord("A") + rem) + result
    return result
