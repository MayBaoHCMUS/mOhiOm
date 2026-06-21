from dataclasses import dataclass, field
from typing import List, Tuple, Optional

# All coordinates are PERCENTAGES (0.0 to 100.0) of page dimensions.
# This makes layouts resolution-independent.
Point = Tuple[float, float]  # (x_pct, y_pct)


@dataclass
class PanelDefinition:
    """
    Defines one panel on a comic page.

    polygon: list of (x%, y%) vertices defining the panel shape, clockwise.
    bbox: bounding box (x%, y%, w%, h%) used to size the SD image request.
          SD generates image for this bbox; polygon mask clips it to shape.
    sd_width / sd_height: pixel size to request from SD (multiples of 8).
    """
    id: str
    polygon: List[Point]
    bbox: Tuple[float, float, float, float]  # x, y, w, h in %
    recommended_shot: str = "MEDIUM"
    is_splash: bool = False
    has_diagonal: bool = False
    diagonal_type: str = "none"  # 'slash' | 'backslash' | 'none'
    sd_width: int = 512
    sd_height: int = 512

    @classmethod
    def from_polygon(
        cls,
        id: str,
        polygon: List[Point],
        recommended_shot: str = "MEDIUM",
        **kwargs,
    ) -> "PanelDefinition":
        xs = [p[0] for p in polygon]
        ys = [p[1] for p in polygon]
        bbox = (min(xs), min(ys), max(xs) - min(xs), max(ys) - min(ys))
        return cls(id=id, polygon=polygon, bbox=bbox, recommended_shot=recommended_shot, **kwargs)

    @property
    def area_pct(self) -> float:
        return self.bbox[2] * self.bbox[3]

    @property
    def aspect_ratio(self) -> float:
        _, _, w, h = self.bbox
        return w / h if h > 0 else 1.0


@dataclass
class PageLayout:
    """Complete layout for one comic page."""
    template_name: str
    panel_count: int
    panels: List[PanelDefinition]
    page_width: int = 1240
    page_height: int = 1754
    gutter: float = 0.8   # % gutter between panels
    margin: float = 1.5   # % page margin
