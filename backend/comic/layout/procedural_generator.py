"""
Binary Space Partitioning for procedural layout generation.
Used when no template matches the panel count or when random variety is requested.
"""

import random
from dataclasses import dataclass
from typing import Optional, List
from .panel_definition import PanelDefinition

G = 0.8   # gutter %
M = 1.5   # margin %


@dataclass
class BSPNode:
    x: float
    y: float
    w: float
    h: float
    left: Optional["BSPNode"] = None
    right: Optional["BSPNode"] = None

    @property
    def area(self) -> float:
        return self.w * self.h

    @property
    def aspect_ratio(self) -> float:
        return self.w / self.h if self.h > 0 else 1.0

    @property
    def is_leaf(self) -> bool:
        return self.left is None and self.right is None


class ProceduralLayoutGenerator:
    """
    Generates random but valid manga layouts using Binary Space Partitioning.

    style options:
      'balanced'  — roughly equal panel sizes
      'feature'   — one dominant panel + smaller ones
      'dynamic'   — high variety in sizes (action scenes)
      'cinematic' — horizontal strips only
    """

    MIN_PANEL_W = 18.0
    MIN_PANEL_H = 14.0

    def __init__(self, seed: Optional[int] = None):
        if seed is not None:
            random.seed(seed)

    def generate(
        self,
        panel_count: int,
        style: str = "balanced",
        add_diagonals: bool = False,
        diagonal_probability: float = 0.25,
    ) -> List[PanelDefinition]:
        root = BSPNode(x=M, y=M, w=100.0 - 2 * M, h=100.0 - 2 * M)
        self._split(root, target_panels=panel_count, style=style, depth=0)

        leaves: List[BSPNode] = []
        self._collect_leaves(root, leaves)

        panels = []
        for i, node in enumerate(leaves):
            shot = self._suggest_shot(node.area, node.aspect_ratio)
            panel = PanelDefinition.from_polygon(
                id=f"p{i + 1}",
                polygon=[
                    (node.x, node.y),
                    (node.x + node.w, node.y),
                    (node.x + node.w, node.y + node.h),
                    (node.x, node.y + node.h),
                ],
                recommended_shot=shot,
            )
            panels.append(panel)

        if add_diagonals:
            panels = self._apply_diagonals(panels, diagonal_probability)

        return panels

    def _split(self, node: BSPNode, target_panels: int, style: str, depth: int) -> None:
        if target_panels <= 1:
            return

        horizontal = self._pick_direction(node, style, depth)
        split_ratio = self._pick_split_ratio(style, target_panels)
        dim = node.h if horizontal else node.w
        split_at = dim * split_ratio

        if horizontal:
            if split_at < self.MIN_PANEL_H or (dim - split_at) < self.MIN_PANEL_H:
                return
            node.left  = BSPNode(x=node.x, y=node.y,                  w=node.w, h=split_at - G / 2)
            node.right = BSPNode(x=node.x, y=node.y + split_at + G / 2, w=node.w, h=dim - split_at - G / 2)
        else:
            if split_at < self.MIN_PANEL_W or (dim - split_at) < self.MIN_PANEL_W:
                return
            node.left  = BSPNode(x=node.x,                  y=node.y, w=split_at - G / 2, h=node.h)
            node.right = BSPNode(x=node.x + split_at + G / 2, y=node.y, w=dim - split_at - G / 2, h=node.h)

        left_count  = max(1, round(target_panels * split_ratio))
        right_count = target_panels - left_count

        if left_count > 1 and node.left:
            self._split(node.left,  left_count,  style, depth + 1)
        if right_count > 1 and node.right:
            self._split(node.right, right_count, style, depth + 1)

    def _pick_direction(self, node: BSPNode, style: str, depth: int) -> bool:
        """True = horizontal split (top/bottom), False = vertical (left/right)."""
        if style == "cinematic":
            return True

        ar = node.aspect_ratio
        if ar > 1.6:
            return random.random() < 0.72
        elif ar < 0.65:
            return random.random() < 0.28
        else:
            return random.random() < 0.52

    def _pick_split_ratio(self, style: str, remaining: int) -> float:
        if style == "feature" and remaining >= 3:
            return random.uniform(0.55, 0.68)
        elif style == "dynamic":
            return random.uniform(0.30, 0.70)
        else:
            return random.uniform(0.40, 0.60)

    def _collect_leaves(self, node: BSPNode, leaves: List[BSPNode]) -> None:
        if node.is_leaf:
            leaves.append(node)
        else:
            if node.left:
                self._collect_leaves(node.left, leaves)
            if node.right:
                self._collect_leaves(node.right, leaves)

    def _suggest_shot(self, area: float, aspect_ratio: float) -> str:
        if area > 2500:
            return "ESTABLISHING"
        elif area > 1500:
            return "WIDE" if aspect_ratio > 1.5 else "MEDIUM-WIDE"
        elif area > 800:
            return "MEDIUM"
        elif area > 400:
            return "MEDIUM-SHOT"
        else:
            return "CLOSE-UP"

    def _apply_diagonals(
        self,
        panels: List[PanelDefinition],
        probability: float,
    ) -> List[PanelDefinition]:
        """Randomly convert some rectangular panels to diagonal-edged panels."""
        result = []
        D = 8.0

        for panel in panels:
            if random.random() < probability:
                poly = panel.polygon
                x1, y1 = poly[0]
                x2, _  = poly[1]
                x3, y3 = poly[2]
                _,  y4 = poly[3]
                w = x2 - x1
                d = min(D, w * 0.15)

                new_poly = [
                    (x1 + d, y1),
                    (x2,     y1),
                    (x3 - d, y3),
                    (x1,     y4),
                ]
                result.append(PanelDefinition.from_polygon(
                    id=panel.id,
                    polygon=new_poly,
                    recommended_shot=panel.recommended_shot,
                    has_diagonal=True,
                    diagonal_type="slash",
                ))
            else:
                result.append(panel)

        return result
