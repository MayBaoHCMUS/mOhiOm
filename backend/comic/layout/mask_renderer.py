"""
Applies polygon masks to rectangular images using Pillow.
Rectangular SD output → cover-cropped to bbox → polygon mask → composite onto page.
"""

from PIL import Image, ImageDraw
from typing import List, Tuple, Dict
from .panel_definition import PanelDefinition, PageLayout


class MaskRenderer:
    """
    Composites masked panel images onto a comic page canvas.

    Input:  PageLayout with polygon panel definitions +
            Dict[panel_id → PIL Image] (rectangular, from SD or placeholder)
    Output: Single PIL Image (complete comic page)
    """

    BORDER_COLOR = (0, 0, 0)
    BORDER_WIDTH = 3
    PAGE_BG      = (255, 255, 255)
    PANEL_BG     = (230, 230, 230)

    def __init__(self, page_width: int = 1240, page_height: int = 1754):
        self.W = page_width
        self.H = page_height

    # ── Coordinate helpers ─────────────────────────────────────────────────────

    def pct_to_px(self, points: List[Tuple[float, float]]) -> List[Tuple[int, int]]:
        return [
            (int(p[0] / 100.0 * self.W), int(p[1] / 100.0 * self.H))
            for p in points
        ]

    def get_bbox_px(self, polygon_pct: List[Tuple[float, float]]) -> Tuple[int, int, int, int]:
        """Return (x, y, w, h) pixel bounding box of a percent-coordinate polygon."""
        xs = [p[0] / 100.0 * self.W for p in polygon_pct]
        ys = [p[1] / 100.0 * self.H for p in polygon_pct]
        x = int(min(xs))
        y = int(min(ys))
        w = int(max(xs)) - x
        h = int(max(ys)) - y
        return x, y, w, h

    # ── Image fitting ──────────────────────────────────────────────────────────

    def _cover_crop(self, img: Image.Image, target_w: int, target_h: int) -> Image.Image:
        """
        Scale image so it covers target_w × target_h, then center-crop.
        Preserves aspect ratio — no stretching, no white bars.
        Same algorithm as _cover_image() in comic_composer.py.
        """
        src_w, src_h = img.size
        if src_w == target_w and src_h == target_h:
            return img

        ratio  = max(target_w / max(src_w, 1), target_h / max(src_h, 1))
        new_w  = max(target_w, int(src_w * ratio))
        new_h  = max(target_h, int(src_h * ratio))
        scaled = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        left = (new_w - target_w) // 2
        top  = (new_h - target_h) // 2
        return scaled.crop((left, top, left + target_w, top + target_h))

    # ── Polygon helpers ────────────────────────────────────────────────────────

    def _expand_polygon(
        self,
        polygon_px: List[Tuple[int, int]],
        expand_px: int = 1,
    ) -> List[Tuple[int, int]]:
        """
        Push each vertex outward from the polygon centroid by expand_px pixels.
        Closes floating-point hairline gaps between adjacent panels.
        Borders drawn afterward (BORDER_WIDTH px) cover the seam.
        expand_px=1 is sufficient; do not exceed 2 or image bleeds outside border.
        """
        if len(polygon_px) < 3:
            return polygon_px

        pts = [(float(x), float(y)) for x, y in polygon_px]
        cx  = sum(p[0] for p in pts) / len(pts)
        cy  = sum(p[1] for p in pts) / len(pts)

        expanded = []
        for x, y in pts:
            dx   = x - cx
            dy   = y - cy
            dist = max(0.001, (dx ** 2 + dy ** 2) ** 0.5)
            f    = (dist + expand_px) / dist
            expanded.append((int(cx + dx * f), int(cy + dy * f)))

        return expanded

    def create_panel_mask(
        self,
        polygon_px: List[Tuple[int, int]],
        canvas_size: Tuple[int, int],
    ) -> Image.Image:
        """White = visible, black = transparent."""
        mask = Image.new("L", canvas_size, 0)
        draw = ImageDraw.Draw(mask)
        draw.polygon(polygon_px, fill=255)
        return mask

    # ── Main compositor ────────────────────────────────────────────────────────

    def render_page(
        self,
        layout: PageLayout,
        generated_images: Dict[str, Image.Image],
        show_empty_panels: bool = True,
    ) -> Image.Image:
        """
        Composite all panels onto the page canvas.

        generated_images maps panel.id → PIL Image (any size).
        Images are cover-cropped to the panel bbox before masking —
        no stretching, correct composition preserved.
        """
        page         = Image.new("RGB", (self.W, self.H), self.PAGE_BG)
        border_layer = Image.new("RGBA", (self.W, self.H), (0, 0, 0, 0))
        border_draw  = ImageDraw.Draw(border_layer)

        for panel in layout.panels:
            polygon_px                     = self.pct_to_px(panel.polygon)
            bbox_x, bbox_y, bbox_w, bbox_h = self.get_bbox_px(panel.polygon)

            if panel.id in generated_images:
                src_img = generated_images[panel.id].convert("RGB")
            elif show_empty_panels:
                src_img = Image.new("RGB", (max(1, bbox_w), max(1, bbox_h)), self.PANEL_BG)
            else:
                continue

            # Cover-crop to bbox: preserves aspect ratio, no white bars, no stretch
            src_fitted = self._cover_crop(src_img, max(1, bbox_w), max(1, bbox_h))

            # Place fitted image at bbox position on a full-page canvas
            img_canvas = Image.new("RGB", (self.W, self.H), self.PAGE_BG)
            img_canvas.paste(src_fitted, (bbox_x, bbox_y))

            # Expand polygon by 1px to close hairline gaps between panels
            expanded_px = self._expand_polygon(polygon_px, expand_px=1)

            # Clip to polygon shape via mask (expanded to close gaps)
            page_mask = self.create_panel_mask(expanded_px, (self.W, self.H))
            page.paste(img_canvas, mask=page_mask)

            # Draw border using original (un-expanded) polygon; +1 width covers seam
            border_draw.polygon(
                polygon_px,
                outline=self.BORDER_COLOR,
                width=self.BORDER_WIDTH + 1,
            )

        page = page.convert("RGBA")
        page.alpha_composite(border_layer)
        return page.convert("RGB")

    # ── SD dimension helper ────────────────────────────────────────────────────

    def compute_sd_dimensions(self, panel: PanelDefinition) -> Tuple[int, int]:
        """
        Compute image request size from panel bbox.
        Must be multiples of 8; capped at 1024px per dimension.
        """
        _, _, w_pct, h_pct = panel.bbox
        w_px = int(w_pct / 100.0 * self.W)
        h_px = int(h_pct / 100.0 * self.H)

        w_px = max(64, round(w_px / 8) * 8)
        h_px = max(64, round(h_px / 8) * 8)
        w_px = min(w_px, 1024)
        h_px = min(h_px, 1024)

        return w_px, h_px
