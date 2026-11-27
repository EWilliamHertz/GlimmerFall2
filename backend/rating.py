"""GlimmerFall Elo / MMR rating.

Pure functions only (no DB) so they are trivially unit-testable.

Rules:
- New players start at DEFAULT_MMR and play PLACEMENT_GAMES provisional games
  with a high K-factor so they reach their true rating quickly.
- After placement, K shrinks as rating rises (stability at the top).
- Results are rounded (not truncated) and floored at 0.
- A forfeit / disconnect / concede is scored as a normal loss.
"""

DEFAULT_MMR = 1400
PLACEMENT_GAMES = 10
MMR_FLOOR = 0


def expected_score(mmr_a: float, mmr_b: float) -> float:
    """Probability that A beats B under the logistic Elo model."""
    return 1.0 / (1.0 + 10 ** ((mmr_b - mmr_a) / 400.0))


def k_factor(mmr: int, placement_games_left: int = 0) -> int:
    if placement_games_left and placement_games_left > 0:
        return 40
    if mmr >= 2200:
        return 16
    if mmr >= 1800:
        return 24
    return 32


def rate_match(mmr1, mmr2, winner, placement1=0, placement2=0):
    """Compute new ratings for a finished 1v1.

    winner: 1, 2, or None/0 for a draw.
    Returns dict with new mmr + delta for each slot and decremented placement counters.
    """
    mmr1 = DEFAULT_MMR if mmr1 is None else int(mmr1)
    mmr2 = DEFAULT_MMR if mmr2 is None else int(mmr2)
    placement1 = max(0, int(placement1 or 0))
    placement2 = max(0, int(placement2 or 0))

    if winner == 1:
        s1, s2 = 1.0, 0.0
    elif winner == 2:
        s1, s2 = 0.0, 1.0
    else:
        s1 = s2 = 0.5

    e1 = expected_score(mmr1, mmr2)
    e2 = 1.0 - e1

    new1 = max(MMR_FLOOR, int(round(mmr1 + k_factor(mmr1, placement1) * (s1 - e1))))
    new2 = max(MMR_FLOOR, int(round(mmr2 + k_factor(mmr2, placement2) * (s2 - e2))))

    return {
        "1": {"before": mmr1, "after": new1, "delta": new1 - mmr1,
              "placement_games_left": max(0, placement1 - 1)},
        "2": {"before": mmr2, "after": new2, "delta": new2 - mmr2,
              "placement_games_left": max(0, placement2 - 1)},
    }


def search_window(wait_seconds: float) -> float:
    """Max MMR difference accepted by ranked matchmaking after waiting N seconds.

    Starts at ±100, widens ~25 MMR/s, and after 60s anyone is acceptable.
    """
    w = max(0.0, float(wait_seconds or 0))
    if w >= 60:
        return float("inf")
    return 100.0 + 25.0 * w
