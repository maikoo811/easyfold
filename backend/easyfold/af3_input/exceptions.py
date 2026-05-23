class InvalidAf3Input(ValueError):
    """Raised when a dict does not satisfy the AlphaFold 3 input JSON contract."""


class InvalidSequence(ValueError):
    """Raised when a sequence contains characters outside the 20 standard amino acids."""
