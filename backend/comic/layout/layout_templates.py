"""
All coordinates in % of page (0–100).
G = gutter (space between panels)
M = margin (space from page edge)

Panel polygons go clockwise from top-left.
Rectangle panels: 4 points [(x,y), (x+w,y), (x+w,y+h), (x,y+h)]
Diagonal panels:  4+ points with shifted corners
"""

from typing import List, Dict, Callable
from .panel_definition import PanelDefinition, PageLayout

G = 0.8   # gutter %
M = 1.5   # margin %


class MangaLayoutTemplates:

    @staticmethod
    def _rect(id: str, x: float, y: float, w: float, h: float,
               shot: str = "MEDIUM", **kwargs) -> PanelDefinition:
        return PanelDefinition.from_polygon(
            id=id,
            polygon=[(x, y), (x + w, y), (x + w, y + h), (x, y + h)],
            recommended_shot=shot,
            **kwargs,
        )

    # ── STANDARD RECTANGULAR ───────────────────────────────────────────────────

    @classmethod
    def grid_2x2(cls) -> List[PanelDefinition]:
        """
        4 equal panels:
        ┌──────┬──────┐
        │  P1  │  P2  │
        ├──────┼──────┤
        │  P3  │  P4  │
        └──────┴──────┘
        """
        mx = 50.0
        my = 50.0
        pw = mx - M - G / 2
        ph = my - M - G / 2
        return [
            cls._rect("p1", M,       M,       pw, ph, "ESTABLISHING"),
            cls._rect("p2", mx+G/2,  M,       pw, ph, "MEDIUM"),
            cls._rect("p3", M,       my+G/2,  pw, ph, "CLOSE-UP"),
            cls._rect("p4", mx+G/2,  my+G/2,  pw, ph, "MEDIUM-WIDE"),
        ]

    @classmethod
    def three_panels_row(cls) -> List[PanelDefinition]:
        """
        3 panels horizontal:
        ┌─────┬──────┬──────┐
        │ P1  │  P2  │  P3  │
        └─────┴──────┴──────┘
        """
        h = 100.0 - 2 * M
        w1 = 28.0 - M - G
        w2 = 36.0
        w3 = 100.0 - M - (M + w1 + G) - (G + w2 + G)
        return [
            cls._rect("p1", M,                M, w1, h, "CLOSE-UP"),
            cls._rect("p2", M + w1 + G,       M, w2, h, "MEDIUM"),
            cls._rect("p3", M + w1 + G + w2 + G, M, w3, h, "WIDE"),
        ]

    @classmethod
    def one_large_two_small(cls) -> List[PanelDefinition]:
        """
        1 large left + 2 small right:
        ┌──────────┬─────┐
        │          │ P2  │
        │    P1    ├─────┤
        │          │ P3  │
        └──────────┴─────┘
        """
        lw = 58.0
        sh = (100.0 - 2 * M - G) / 2
        sw = 100.0 - M - lw - M - G
        return [
            cls._rect("p1", M,        M,        lw, 100.0 - 2 * M, "ESTABLISHING"),
            cls._rect("p2", M + lw + G, M,       sw, sh, "CLOSE-UP"),
            cls._rect("p3", M + lw + G, M + sh + G, sw, sh, "MEDIUM"),
        ]

    @classmethod
    def two_small_one_large(cls) -> List[PanelDefinition]:
        """
        2 small left + 1 large right:
        ┌─────┬──────────┐
        │ P1  │          │
        ├─────┤    P3    │
        │ P2  │          │
        └─────┴──────────┘
        """
        rw = 58.0
        sh = (100.0 - 2 * M - G) / 2
        sw = 100.0 - M - rw - M - G
        return [
            cls._rect("p1", M,        M,        sw, sh, "CLOSE-UP"),
            cls._rect("p2", M,        M + sh + G, sw, sh, "MEDIUM"),
            cls._rect("p3", M + sw + G, M,      rw, 100.0 - 2 * M, "WIDE"),
        ]

    # ── DIAGONAL / ACTION ──────────────────────────────────────────────────────

    @classmethod
    def diagonal_split_2(cls) -> List[PanelDefinition]:
        """
        2 panels with a diagonal cut:
        ┌──────────────╱──┐
        │    P1       ╱   │
        │            ╱ P2 │
        └───────────╱─────┘
        """
        D = 12.0
        h = 100.0 - 2 * M
        mx = 50.0
        return [
            PanelDefinition.from_polygon(
                id="p1",
                polygon=[
                    (M, M),
                    (mx + D, M),
                    (mx - D, M + h),
                    (M, M + h),
                ],
                recommended_shot="WIDE",
                has_diagonal=True,
                diagonal_type="slash",
            ),
            PanelDefinition.from_polygon(
                id="p2",
                polygon=[
                    (mx + D + G, M),
                    (100.0 - M, M),
                    (100.0 - M, M + h),
                    (mx - D + G, M + h),
                ],
                recommended_shot="CLOSE-UP",
                has_diagonal=True,
                diagonal_type="slash",
            ),
        ]

    @classmethod
    def diagonal_3_panels(cls) -> List[PanelDefinition]:
        """
        3 panels — full top + diagonal bottom two:
        ┌──────────────────┐
        │       P1         │
        ├──────╱───────────┤
        │ P2  ╱     P3     │
        └────╱─────────────┘
        """
        split_y = 43.0
        split_x = 38.0
        D = 7.0
        ph = 100.0 - M - split_y - G / 2 - M
        return [
            PanelDefinition.from_polygon(
                id="p1",
                polygon=[
                    (M, M),
                    (100.0 - M, M),
                    (100.0 - M, split_y - G / 2),
                    (M, split_y - G / 2),
                ],
                recommended_shot="ESTABLISHING",
            ),
            PanelDefinition.from_polygon(
                id="p2",
                polygon=[
                    (M, split_y + G / 2),
                    (split_x - G / 2 - D, split_y + G / 2),
                    (split_x - G / 2 + D, 100.0 - M),
                    (M, 100.0 - M),
                ],
                recommended_shot="CLOSE-UP",
                has_diagonal=True,
                diagonal_type="slash",
            ),
            PanelDefinition.from_polygon(
                id="p3",
                polygon=[
                    (split_x + G / 2 - D, split_y + G / 2),
                    (100.0 - M, split_y + G / 2),
                    (100.0 - M, 100.0 - M),
                    (split_x + G / 2 + D, 100.0 - M),
                ],
                recommended_shot="MEDIUM",
                has_diagonal=True,
                diagonal_type="slash",
            ),
        ]

    @classmethod
    def action_dynamic_4(cls) -> List[PanelDefinition]:
        """
        4 panels — crossed diagonal dividers:
        ┌──────────╱──────┐
        │   P1    ╱  P2   │
        ├────────╱         │
        │  P3   ╱──────────┤
        │      ╱    P4     │
        └─────╱────────────┘
        """
        D = 9.0
        mx = 50.0
        my = 50.0
        return [
            PanelDefinition.from_polygon(
                id="p1",
                polygon=[
                    (M, M),
                    (mx - D, M),
                    (mx - D * 1.5, my - G / 2),
                    (M, my - G / 2),
                ],
                recommended_shot="MEDIUM",
                has_diagonal=True,
            ),
            PanelDefinition.from_polygon(
                id="p2",
                polygon=[
                    (mx + D, M),
                    (100.0 - M, M),
                    (100.0 - M, my - G / 2),
                    (mx + D * 1.5, my - G / 2),
                ],
                recommended_shot="CLOSE-UP",
                has_diagonal=True,
            ),
            PanelDefinition.from_polygon(
                id="p3",
                polygon=[
                    (M, my + G / 2),
                    (mx - D * 1.5, my + G / 2),
                    (mx - D, 100.0 - M),
                    (M, 100.0 - M),
                ],
                recommended_shot="WIDE",
                has_diagonal=True,
            ),
            PanelDefinition.from_polygon(
                id="p4",
                polygon=[
                    (mx + D * 1.5, my + G / 2),
                    (100.0 - M, my + G / 2),
                    (100.0 - M, 100.0 - M),
                    (mx + D, 100.0 - M),
                ],
                recommended_shot="MEDIUM-WIDE",
                has_diagonal=True,
            ),
        ]

    # ── FEATURE / SPLASH ───────────────────────────────────────────────────────

    @classmethod
    def splash_top(cls) -> List[PanelDefinition]:
        """
        Large splash top + 3 small bottom:
        ┌──────────────────┐
        │   SPLASH  P1     │  60%
        ├──────┬─────┬─────┤
        │  P2  │ P3  │ P4  │  40%
        └──────┴─────┴─────┘
        """
        splash_h = 60.0
        bottom_h = 100.0 - M - splash_h - G - M
        w3 = (100.0 - 2 * M - 2 * G) / 3
        return [
            cls._rect("p1", M, M, 100.0 - 2 * M, splash_h, "ESTABLISHING", is_splash=True),
            cls._rect("p2", M,                splash_h + G, w3, bottom_h, "CLOSE-UP"),
            cls._rect("p3", M + w3 + G,       splash_h + G, w3, bottom_h, "MEDIUM"),
            cls._rect("p4", M + w3 + G + w3 + G, splash_h + G, w3, bottom_h, "CLOSE-UP"),
        ]

    @classmethod
    def splash_bottom(cls) -> List[PanelDefinition]:
        """
        3 small top + large splash bottom:
        ┌──────┬─────┬─────┐
        │  P1  │ P2  │ P3  │  35%
        ├──────┴─────┴─────┤
        │    SPLASH  P4    │  65%
        └──────────────────┘
        """
        top_h = 35.0
        splash_h = 100.0 - M - top_h - G - M
        w3 = (100.0 - 2 * M - 2 * G) / 3
        return [
            cls._rect("p1", M,                M, w3, top_h, "CLOSE-UP"),
            cls._rect("p2", M + w3 + G,       M, w3, top_h, "MEDIUM"),
            cls._rect("p3", M + w3 + G + w3 + G, M, w3, top_h, "CLOSE-UP"),
            cls._rect("p4", M, top_h + G, 100.0 - 2 * M, splash_h, "WIDE", is_splash=True),
        ]

    @classmethod
    def full_bleed(cls) -> List[PanelDefinition]:
        """Single full-page panel (no margin)."""
        return [
            cls._rect("p1", 0.0, 0.0, 100.0, 100.0, "ESTABLISHING", is_splash=True),
        ]

    # ── COMPLEX MANGA ──────────────────────────────────────────────────────────

    @classmethod
    def manga_classic_5(cls) -> List[PanelDefinition]:
        """
        Classic manga 5-panel:
        ┌───────────┬──────┐
        │    P1     │  P2  │
        ├──────┬────┴──────┤
        │  P3  │    P4     │
        ├──────┴──────┬────┤
        │     P5      │    │
        └─────────────┴────┘
        """
        return [
            cls._rect("p1", M,       M,       68 - G / 2,    42 - G / 2,  "WIDE"),
            cls._rect("p2", 68 + G / 2, M,    32 - M - G / 2, 42 - G / 2, "CLOSE-UP"),
            cls._rect("p3", M,       42 + G / 2, 38 - G / 2, 30 - G,    "MEDIUM"),
            cls._rect("p4", 38 + G / 2, 42 + G / 2, 62 - M - G / 2, 30 - G, "MEDIUM-WIDE"),
            cls._rect("p5", M,       72 + G / 2, 100.0 - 2 * M, 28 - M - G / 2, "ESTABLISHING"),
        ]

    @classmethod
    def cinematic_strips(cls) -> List[PanelDefinition]:
        """
        3 horizontal cinematic strips:
        ┌──────────────────┐
        │       P1         │
        ├──────────────────┤
        │       P2         │
        ├──────────────────┤
        │       P3         │
        └──────────────────┘
        """
        pw = 100.0 - 2 * M
        ph = (100.0 - 2 * M - 2 * G) / 3
        return [
            cls._rect("p1", M, M,             pw, ph, "WIDE"),
            cls._rect("p2", M, M + ph + G,    pw, ph, "MEDIUM"),
            cls._rect("p3", M, M + ph + G + ph + G, pw, ph, "CLOSE-UP"),
        ]

    @classmethod
    def asymmetric_4(cls) -> List[PanelDefinition]:
        """
        4 panels asymmetric — manga tension:
        ┌────────────┬───────┐
        │            │  P2   │
        │    P1      ├───────┤
        │   (tall)   │  P3   │
        ├────────────┴───────┤
        │        P4          │
        └────────────────────┘
        """
        return [
            cls._rect("p1", M,       M,       60 - G / 2,    62 - G / 2,  "ESTABLISHING"),
            cls._rect("p2", 60 + G / 2, M,    40 - M - G / 2, 30 - G / 2, "CLOSE-UP"),
            cls._rect("p3", 60 + G / 2, 30 + G / 2, 40 - M - G / 2, 32 - G, "MEDIUM"),
            cls._rect("p4", M,       62 + G / 2, 100.0 - 2 * M, 38 - M - G / 2, "WIDE"),
        ]

    @classmethod
    def vertical_flow(cls) -> List[PanelDefinition]:
        """
        Vertical reading flow — 4 panels:
        ┌──────┬───────────┐
        │      │           │
        │  P1  │    P2     │
        │      │           │
        ├──────┴──┬────────┤
        │         │        │
        │   P3    │   P4   │
        │         │        │
        └─────────┴────────┘
        """
        return [
            cls._rect("p1", M,       M,       32 - G / 2,    48 - G / 2,  "CLOSE-UP"),
            cls._rect("p2", 32 + G / 2, M,    68 - M - G / 2, 48 - G / 2, "MEDIUM"),
            cls._rect("p3", M,       48 + G / 2, 55 - G / 2, 52 - M - G / 2, "WIDE"),
            cls._rect("p4", 55 + G / 2, 48 + G / 2, 45 - M - G / 2, 52 - M - G / 2, "CLOSE-UP"),
        ]

    # ── NEW RECTANGULAR LAYOUTS ────────────────────────────────────────────────

    @classmethod
    def single(cls) -> List[PanelDefinition]:
        return [cls._rect("p1", 1.5, 1.5, 97.0, 97.0, "ESTABLISHING")]

    @classmethod
    def horizontal_duo(cls) -> List[PanelDefinition]:
        return [
            cls._rect("p1", 1.5,  1.5,  97.0, 48.0, "MEDIUM"),
            cls._rect("p2", 1.5,  50.5, 97.0, 48.0, "CLOSE-UP"),
        ]

    @classmethod
    def vertical_trio(cls) -> List[PanelDefinition]:
        return [
            cls._rect("p1", 1.5,  1.5, 31.5, 97.0, "CLOSE-UP"),
            cls._rect("p2", 34.0, 1.5, 32.0, 97.0, "MEDIUM"),
            cls._rect("p3", 67.0, 1.5, 31.5, 97.0, "WIDE"),
        ]

    @classmethod
    def grid_2x3(cls) -> List[PanelDefinition]:
        return [
            cls._rect("p1", 1.5,  1.5,  48.0, 31.5, "ESTABLISHING"),
            cls._rect("p2", 50.5, 1.5,  48.0, 31.5, "MEDIUM"),
            cls._rect("p3", 1.5,  34.0, 48.0, 32.0, "CLOSE-UP"),
            cls._rect("p4", 50.5, 34.0, 48.0, 32.0, "MEDIUM-WIDE"),
            cls._rect("p5", 1.5,  67.0, 48.0, 31.5, "WIDE"),
            cls._rect("p6", 50.5, 67.0, 48.0, 31.5, "CLOSE-UP"),
        ]

    @classmethod
    def hero_left(cls) -> List[PanelDefinition]:
        return [
            cls._rect("p1", 1.5,  1.5,  58.5, 97.0, "ESTABLISHING"),
            cls._rect("p2", 61.0, 1.5,  37.5, 31.5, "CLOSE-UP"),
            cls._rect("p3", 61.0, 34.0, 37.5, 32.0, "MEDIUM"),
            cls._rect("p4", 61.0, 67.0, 37.5, 31.5, "WIDE"),
        ]

    @classmethod
    def hero_right(cls) -> List[PanelDefinition]:
        return [
            cls._rect("p1", 1.5,  1.5,  37.5, 31.5, "CLOSE-UP"),
            cls._rect("p2", 1.5,  34.0, 37.5, 32.0, "MEDIUM"),
            cls._rect("p3", 1.5,  67.0, 37.5, 31.5, "WIDE"),
            cls._rect("p4", 40.0, 1.5,  58.5, 97.0, "ESTABLISHING"),
        ]

    @classmethod
    def wide_duo(cls) -> List[PanelDefinition]:
        return [
            cls._rect("p1", 1.5,  1.5,  97.0, 53.5, "ESTABLISHING"),
            cls._rect("p2", 1.5,  56.0, 48.0, 42.5, "MEDIUM"),
            cls._rect("p3", 50.5, 56.0, 48.0, 42.5, "CLOSE-UP"),
        ]

    @classmethod
    def widescreen_pair(cls) -> List[PanelDefinition]:
        return [
            cls._rect("p1", 1.5, 1.5,  97.0, 48.0, "WIDE"),
            cls._rect("p2", 1.5, 50.5, 97.0, 48.0, "WIDE"),
        ]

    @classmethod
    def widescreen_trio(cls) -> List[PanelDefinition]:
        return [
            cls._rect("p1", 1.5, 1.5,  97.0, 30.5, "WIDE"),
            cls._rect("p2", 1.5, 33.0, 97.0, 33.0, "MEDIUM"),
            cls._rect("p3", 1.5, 67.0, 97.0, 31.5, "CLOSE-UP"),
        ]

    @classmethod
    def film_strip(cls) -> List[PanelDefinition]:
        return [
            cls._rect("p1", 1.5,  1.5, 23.0, 97.0, "CLOSE-UP"),
            cls._rect("p2", 25.5, 1.5, 23.0, 97.0, "MEDIUM"),
            cls._rect("p3", 49.5, 1.5, 23.5, 97.0, "MEDIUM"),
            cls._rect("p4", 74.0, 1.5, 24.5, 97.0, "WIDE"),
        ]

    @classmethod
    def t_shape(cls) -> List[PanelDefinition]:
        return [
            cls._rect("p1", 1.5,  1.5,  97.0, 33.5, "ESTABLISHING"),
            cls._rect("p2", 1.5,  36.0, 31.5, 62.5, "CLOSE-UP"),
            cls._rect("p3", 34.0, 36.0, 32.0, 62.5, "MEDIUM"),
            cls._rect("p4", 67.0, 36.0, 31.5, 62.5, "WIDE"),
        ]

    @classmethod
    def l_shape(cls) -> List[PanelDefinition]:
        return [
            cls._rect("p1", 1.5,  1.5,  58.5, 97.0, "ESTABLISHING"),
            cls._rect("p2", 61.0, 1.5,  37.5, 48.0, "CLOSE-UP"),
            cls._rect("p3", 61.0, 50.5, 37.5, 48.0, "MEDIUM"),
        ]

    # ── REGISTRY ───────────────────────────────────────────────────────────────

    @classmethod
    def get_all(cls) -> Dict[str, Callable]:
        return {
            # Standard
            "grid_2x2":            cls.grid_2x2,
            "three_panels_row":    cls.three_panels_row,
            "one_large_two_small": cls.one_large_two_small,
            "two_small_one_large": cls.two_small_one_large,
            # Diagonal
            "diagonal_split_2":    cls.diagonal_split_2,
            "diagonal_3_panels":   cls.diagonal_3_panels,
            "action_dynamic_4":    cls.action_dynamic_4,
            # Feature
            "splash_top":          cls.splash_top,
            "splash_bottom":       cls.splash_bottom,
            "full_bleed":          cls.full_bleed,
            # Complex
            "manga_classic_5":     cls.manga_classic_5,
            "cinematic_strips":    cls.cinematic_strips,
            "asymmetric_4":        cls.asymmetric_4,
            "vertical_flow":       cls.vertical_flow,
            # New rectangular
            "single":              cls.single,
            "horizontal_duo":      cls.horizontal_duo,
            "vertical_trio":       cls.vertical_trio,
            "grid_2x3":            cls.grid_2x3,
            "hero_left":           cls.hero_left,
            "hero_right":          cls.hero_right,
            "wide_duo":            cls.wide_duo,
            "widescreen_pair":     cls.widescreen_pair,
            "widescreen_trio":     cls.widescreen_trio,
            "film_strip":          cls.film_strip,
            "t_shape":             cls.t_shape,
            "l_shape":             cls.l_shape,
        }

    @classmethod
    def get_for_panel_count(cls, count: int) -> Dict[str, Callable]:
        """Return only templates that match the given panel count."""
        matching = {}
        for name, fn in cls.get_all().items():
            try:
                panels = fn()
                if len(panels) == count:
                    matching[name] = fn
            except Exception:
                pass
        return matching
