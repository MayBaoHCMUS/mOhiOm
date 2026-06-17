"""
Composes a list of panel images into a single comic page using Pillow.
Pure image processing — no FastAPI, no DB, no LLM.
"""

import base64
import io
from PIL import Image, ImageDraw

# ── Constants ─────────────────────────────────────────────────────────────────

PAGE_W = 1200
PAGE_H = 1600
MARGIN = 24
GUTTER_MANGA = 10
GUTTER_WEBTOON = 0
BG_COLOR = (255, 255, 255)
BORDER_COLOR = (10, 10, 10)
BORDER_W_MANGA = 3

# Map shot_type string (lowercased) → intensity weight (1–5)
SHOT_INTENSITY: dict[str, int] = {
    "splash": 5,
    "full page": 5,
    "full-page": 5,
    "wide shot": 4,
    "establishing shot": 4,
    "establishing": 4,
    "medium shot": 3,
    "medium wide": 3,
    "two shot": 3,
    "close-up": 2,
    "close up": 2,
    "closeup": 2,
    "insert": 1,
    "detail shot": 1,
    "detail": 1,
}

DEFAULT_INTENSITY = 3

# ── Layout templates by panel count ───────────────────────────────────────────
# Each template: list of rows; each row: list of panel indices (0-based)

LAYOUT_TEMPLATES: dict[int, dict[str, list[list[int]]]] = {
    1: {
        "splash":         [[0]],
    },
    2: {
        "stacked":        [[0], [1]],
        "side_by_side":   [[0, 1]],
    },
    3: {
        "three_rows":     [[0], [1], [2]],
        "top_wide":       [[0], [1, 2]],
        "bottom_wide":    [[0, 1], [2]],
    },
    4: {
        "grid_2x2":       [[0, 1], [2, 3]],
        "top_wide_3":     [[0], [1, 2, 3]],
        "bottom_wide_3":  [[0, 1, 2], [3]],
        "four_rows":      [[0], [1], [2], [3]],
    },
    5: {
        "wide_2x2":       [[0], [1, 2], [3, 4]],
        "2x2_wide":       [[0, 1], [2, 3], [4]],
    },
    6: {
        "grid_3x2":       [[0, 1, 2], [3, 4, 5]],
        "grid_2x3":       [[0, 1], [2, 3], [4, 5]],
    },
}

LAYOUT_DISPLAY_NAMES: dict[str, str] = {
    "splash":        "Full Splash",
    "stacked":       "Stacked Rows",
    "side_by_side":  "Side by Side",
    "three_rows":    "Three Rows",
    "top_wide":      "Wide Top",
    "bottom_wide":   "Wide Bottom",
    "grid_2x2":      "2×2 Grid",
    "top_wide_3":    "Wide + Three",
    "bottom_wide_3": "Three + Wide",
    "four_rows":     "Four Rows",
    "wide_2x2":      "Wide + 2×2",
    "2x2_wide":      "2×2 + Wide",
    "grid_3x2":      "3-Column Grid",
    "grid_2x3":      "2-Column Grid",
    "stacked_n":     "Stacked Rows",
    "custom":        "Custom Layout",
}


def _shot_intensity(shot_type: str) -> int:
    return SHOT_INTENSITY.get(shot_type.lower().strip(), DEFAULT_INTENSITY)


def _decode_image(data_url: str) -> Image.Image:
    """Decode a base64 data URL into a PIL Image."""
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(data_url))).convert("RGB")


def _fit_image(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Scale image to fit within target dimensions, preserving aspect ratio."""
    ratio = min(target_w / img.width, target_h / img.height)
    new_w = max(1, int(img.width * ratio))
    new_h = max(1, int(img.height * ratio))
    return img.resize((new_w, new_h), Image.LANCZOS)


def _cover_image(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Scale and center-crop image to exactly fill target_w × target_h (no white bars)."""
    ratio = max(target_w / img.width, target_h / img.height)
    new_w = max(1, int(img.width * ratio))
    new_h = max(1, int(img.height * ratio))
    resized = img.resize((new_w, new_h), Image.LANCZOS)
    x = (new_w - target_w) // 2
    y = (new_h - target_h) // 2
    return resized.crop((x, y, x + target_w, y + target_h))


def _draw_speech_bubble(
    draw: ImageDraw.ImageDraw,
    text: str,
    bubble_x: int,
    bubble_y: int,
    max_width: int = 200,
) -> None:
    """Draw a simple speech bubble centered at bubble_x, top of panel."""
    pad = 10
    char_w = 7   # approximate pixel width per char with default font
    words = text.split()
    lines: list[str] = []
    line: list[str] = []
    for w in words:
        line.append(w)
        if len(" ".join(line)) * char_w > max_width - 2 * pad:
            if len(line) > 1:
                lines.append(" ".join(line[:-1]))
                line = [w]
            else:
                lines.append(" ".join(line))
                line = []
    if line:
        lines.append(" ".join(line))
    if not lines:
        return

    line_h = 16
    bw = max(len(l) for l in lines) * char_w + 2 * pad
    bw = min(bw, max_width)
    bh = len(lines) * line_h + 2 * pad
    bx = bubble_x - bw // 2
    by = bubble_y

    draw.rounded_rectangle(
        [bx, by, bx + bw, by + bh],
        radius=8,
        fill=(255, 255, 255),
        outline=BORDER_COLOR,
        width=2,
    )
    tail = [(bx + 20, by + bh), (bx + 35, by + bh), (bx + 18, by + bh + 12)]
    draw.polygon(tail, fill=(255, 255, 255), outline=BORDER_COLOR)
    for j, l in enumerate(lines):
        draw.text((bx + pad, by + pad + j * line_h), l, fill=BORDER_COLOR)


def rule_based_layout(panels: list[dict]) -> tuple[list[list[int]], str]:
    """
    Choose a layout template based on panel shot types without calling LLM.
    Returns (layout, template_name).
    """
    n = len(panels)
    shots = [p.get("shot_type", "").lower().strip() for p in panels]

    def is_wide(s: str) -> bool:
        return any(k in s for k in ("wide", "establishing", "splash", "full"))

    def is_close(s: str) -> bool:
        return any(k in s for k in ("close", "insert", "detail"))

    templates = LAYOUT_TEMPLATES.get(n)
    if not templates:
        # For n > 6, fall back to stacked rows
        return [[i] for i in range(n)], "stacked_n"

    if n == 1:
        return templates["splash"], "splash"

    if n == 2:
        if all(is_close(s) for s in shots):
            return templates["side_by_side"], "side_by_side"
        return templates["stacked"], "stacked"

    if n == 3:
        if is_wide(shots[0]):
            return templates["top_wide"], "top_wide"
        if is_wide(shots[-1]):
            return templates["bottom_wide"], "bottom_wide"
        return templates["three_rows"], "three_rows"

    if n == 4:
        has_splash = any(is_wide(s) and "splash" in s for s in shots)
        if has_splash:
            return templates["four_rows"], "four_rows"
        return templates["grid_2x2"], "grid_2x2"

    if n == 5:
        if is_wide(shots[0]):
            return templates["wide_2x2"], "wide_2x2"
        return templates["2x2_wide"], "2x2_wide"

    # n == 6
    return templates["grid_2x3"], "grid_2x3"


def compute_layout_cell_dimensions(
    layout: list[list[int]],
    panel_shot_types: list[str],
    style: str = "manga",
) -> list[dict]:
    """
    Compute exact pixel dimensions for each panel cell in the given layout.
    Mirrors compose_page() row/column geometry so images generated at these sizes
    fill their cells without cropping.

    Returns [{"panel_index": int, "width": int, "height": int}, ...] sorted by panel_index.
    """
    is_manga = style.lower() != "webtoon"
    gutter = GUTTER_MANGA if is_manga else GUTTER_WEBTOON

    num_rows = len(layout)
    usable_h = PAGE_H - 2 * MARGIN - max(0, num_rows - 1) * gutter
    usable_w = PAGE_W - 2 * MARGIN

    row_weights = [
        max(
            _shot_intensity(panel_shot_types[idx])
            if idx < len(panel_shot_types) else DEFAULT_INTENSITY
            for idx in row
        )
        for row in layout
    ]
    total_weight = sum(row_weights) or 1
    row_heights = [max(1, int(usable_h * w / total_weight)) for w in row_weights]
    row_heights[-1] = max(1, usable_h - sum(row_heights[:-1]))

    result: list[dict] = []
    for row_panels, row_h in zip(layout, row_heights):
        num_cols = len(row_panels)
        col_gutter = gutter if is_manga else 0
        total_col_gutter = max(0, num_cols - 1) * col_gutter
        base_cell_w = max(1, (usable_w - total_col_gutter) // num_cols)

        x = MARGIN  # track running x to compute last-column remainder (mirrors compose_page)
        for col_idx, panel_idx in enumerate(row_panels):
            cell_w = max(1, MARGIN + usable_w - x) if col_idx == num_cols - 1 else base_cell_w
            result.append({"panel_index": panel_idx, "width": cell_w, "height": row_h})
            x += cell_w + col_gutter

    result.sort(key=lambda d: d["panel_index"])
    return result


def compose_page(
    panels: list[dict],
    style: str = "manga",
    layout: list[list[int]] | None = None,
) -> Image.Image:
    """
    Compose panel images into a 1200×1600 comic page.

    Each dict in panels must have:
      - image_data_url: str   base64 data URL
      - shot_type: str        determines row height weight
      - dialogue: str | None  optional speech bubble text
      - panel_number: int     sort order

    style:  "manga" (borders + gutter) | "webtoon" (no border, no gutter)
    layout: list of rows; each row is a list of panel indices (0-based).
            e.g. [[0, 1], [2], [3, 4]] → row 0 has panels 0 & 1 side-by-side,
            row 1 has panel 2 full-width, row 2 has panels 3 & 4 side-by-side.
            None → one row per panel (original stacked behaviour).
    """
    is_manga = style.lower() != "webtoon"
    gutter = GUTTER_MANGA if is_manga else GUTTER_WEBTOON

    panels_sorted = sorted(panels, key=lambda p: p.get("panel_number", 0))
    n = len(panels_sorted)
    if n == 0:
        return Image.new("RGB", (PAGE_W, PAGE_H), BG_COLOR)

    # Default layout: one panel per row
    if layout is None:
        layout = [[i] for i in range(n)]

    # Clamp panel indices to valid range
    layout = [[idx for idx in row if idx < n] for row in layout]
    layout = [row for row in layout if row]

    # Decode all images
    images = [_decode_image(p["image_data_url"]) for p in panels_sorted]

    num_rows = len(layout)
    usable_h = PAGE_H - 2 * MARGIN - max(0, num_rows - 1) * gutter
    usable_w = PAGE_W - 2 * MARGIN

    # Row heights proportional to max shot intensity in each row
    row_weights = [
        max(_shot_intensity(panels_sorted[idx].get("shot_type", "")) for idx in row)
        for row in layout
    ]
    total_weight = sum(row_weights) or 1
    row_heights = [max(1, int(usable_h * w / total_weight)) for w in row_weights]
    # Fix rounding drift on last row
    row_heights[-1] = max(1, usable_h - sum(row_heights[:-1]))

    page = Image.new("RGB", (PAGE_W, PAGE_H), BG_COLOR)
    draw = ImageDraw.Draw(page)

    y = MARGIN
    for row_idx, (row_panels, row_h) in enumerate(zip(layout, row_heights)):
        num_cols = len(row_panels)
        col_gutter = gutter if is_manga else 0
        total_col_gutter = max(0, num_cols - 1) * col_gutter
        cell_w = max(1, (usable_w - total_col_gutter) // num_cols)

        x = MARGIN
        for col_idx, panel_idx in enumerate(row_panels):
            # Last column absorbs rounding remainder
            if col_idx == num_cols - 1:
                cell_w = max(1, MARGIN + usable_w - x)

            panel = panels_sorted[panel_idx]
            img = images[panel_idx]

            # Cover-crop image to exactly fill the cell
            filled = _cover_image(img, cell_w, row_h)
            page.paste(filled, (x, y))

            if is_manga:
                draw.rectangle(
                    [x, y, x + cell_w - 1, y + row_h - 1],
                    outline=BORDER_COLOR,
                    width=BORDER_W_MANGA,
                )

            dialogue = panel.get("dialogue") or ""
            if dialogue.strip():
                _draw_speech_bubble(
                    draw,
                    dialogue.strip(),
                    bubble_x=x + cell_w // 2,
                    bubble_y=y + 20,
                    max_width=cell_w - 32,
                )

            x += cell_w + col_gutter

        y += row_h + gutter

    return page
