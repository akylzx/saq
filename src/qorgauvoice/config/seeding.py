"""Determinism (D48). Global seeding + an explicit Generator factory so transforms/splits
take their RNG as a parameter (no hidden global state)."""

from __future__ import annotations

import os
import random

import numpy as np


def seed_everything(seed: int) -> None:
    os.environ["PYTHONHASHSEED"] = str(seed)
    random.seed(seed)
    np.random.seed(seed)
    try:  # torch optional at import-time (D39/D55)
        import torch

        torch.manual_seed(seed)
        if torch.backends.mps.is_available():
            torch.mps.manual_seed(seed)
    except Exception:
        pass


def make_rng(seed: int) -> np.random.Generator:
    """Explicit RNG to pass into augmentation/splits (D48)."""
    return np.random.default_rng(seed)
