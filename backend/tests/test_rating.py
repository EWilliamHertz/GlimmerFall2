"""Unit tests for rating.py (Elo math, placement K-factor, rounding, search window)."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import rating  # noqa: E402


def test_expected_score_equal_and_symmetric():
    assert abs(rating.expected_score(1400, 1400) - 0.5) < 1e-9
    e_hi = rating.expected_score(1600, 1400)
    e_lo = rating.expected_score(1400, 1600)
    assert e_hi > 0.75
    assert abs((e_hi + e_lo) - 1.0) < 1e-9


def test_k_factor_tiers_and_placement():
    assert rating.k_factor(1400, placement_games_left=5) == 40
    assert rating.k_factor(2300, placement_games_left=1) == 40
    assert rating.k_factor(1400, placement_games_left=0) == 32
    assert rating.k_factor(1850, placement_games_left=0) == 24
    assert rating.k_factor(2250, placement_games_left=0) == 16


def test_rate_match_equal_players_and_placement_decrement():
    res = rating.rate_match(1400, 1400, winner=1, placement1=3, placement2=0)
    # Placement K=40 -> +20; standard K=32 -> -16
    assert res["1"]["after"] == 1420
    assert res["1"]["delta"] == 20
    assert res["1"]["placement_games_left"] == 2
    assert res["2"]["after"] == 1384
    assert res["2"]["delta"] == -16
    assert res["2"]["placement_games_left"] == 0


def test_rate_match_rounding_and_floor():
    # Underdog win gives > half K, rounded properly; 0-MMR loser stays >= 0
    res = rating.rate_match(0, 400, winner=2, placement1=0, placement2=0)
    assert res["1"]["after"] == 0
    assert res["2"]["after"] >= 400


def test_rate_match_draw():
    res = rating.rate_match(1600, 1400, winner=0)
    # Higher-rated player loses points on a draw; lower-rated player gains
    assert res["1"]["delta"] < 0
    assert res["2"]["delta"] > 0


def test_search_window_expands_and_opens():
    assert rating.search_window(0) == 100.0
    assert rating.search_window(10) == 350.0
    assert rating.search_window(60) == float("inf")
    assert rating.search_window(120) == float("inf")
