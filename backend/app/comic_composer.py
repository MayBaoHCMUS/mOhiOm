"""
Composes a list of panel images into a single comic page using Pillow.
Pure image processing — no FastAPI, no DB, no LLM.
"""

import base64
import io
import os
from PIL import Image, ImageDraw, ImageFont

_FONT_DIR = os.path.join(os.path.dirname(__file__), "..", "fonts")

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


class BubbleFont:
    """Load NotoSans TTF once; fallback to PIL default if file is missing."""
    _regular = _bold = _italic = None
    FONT_SIZE = 22

    @classmethod
    def regular(cls) -> ImageFont.FreeTypeFont:
        if cls._regular is None:
            cls._regular = cls._load("NotoSans-Regular.ttf")
        return cls._regular

    @classmethod
    def bold(cls) -> ImageFont.FreeTypeFont:
        if cls._bold is None:
            cls._bold = cls._load("NotoSans-Bold.ttf")
        return cls._bold

    @classmethod
    def italic(cls) -> ImageFont.FreeTypeFont:
        if cls._italic is None:
            cls._italic = cls._load("NotoSans-Italic.ttf")
        return cls._italic

    @classmethod
    def _load(cls, filename: str) -> ImageFont.FreeTypeFont:
        path = os.path.join(_FONT_DIR, filename)
        try:
            return ImageFont.truetype(path, cls.FONT_SIZE)
        except (OSError, IOError):
            return ImageFont.load_default()


def classify_bubble(text: str) -> str:
    """Return "speech" | "thought" | "shout" | "sfx" | "narration"."""
    if not text:
        return "speech"
    t = text.strip()
    if (t.startswith("[") and t.endswith("]")) or (t.startswith("<") and t.endswith(">")):
        return "narration"
    if t.startswith("*") or (t.startswith("(") and t.endswith(")")):
        return "thought"
    stripped = t.strip("!.~")
    if stripped == stripped.upper() and len(stripped) <= 12 and stripped.isalpha():
        return "sfx"
    if t.endswith("!") or t.endswith("!!") or t.endswith("!?"):
        return "shout"
    return "speech"


# (fill_rgb, outline_rgb, outline_width, corner_radius)
BUBBLE_STYLES: dict[str, tuple] = {
    "speech":    ((255, 255, 255), (10,  10,  10), 2, 10),
    "thought":   ((245, 245, 240), (60,  60,  60), 2, 14),
    "shout":     ((255, 255, 255), (10,  10,  10), 4,  4),
    "sfx":       ((10,  10,  10),  (10,  10,  10), 2,  2),
    "narration": ((240, 240, 255), (80,  80, 180), 1,  6),
}

BUBBLE_TEXT_COLORS: dict[str, tuple] = {
    "speech":    (10,  10,  10),
    "thought":   (60,  60,  60),
    "shout":     (10,  10,  10),
    "sfx":       (255, 255, 255),
    "narration": (30,  30, 140),
}

BUBBLE_FONTS: dict = {
    "speech":    lambda: BubbleFont.regular(),
    "thought":   lambda: BubbleFont.italic(),
    "shout":     lambda: BubbleFont.bold(),
    "sfx":       lambda: BubbleFont.bold(),
    "narration": lambda: BubbleFont.regular(),
}


def _wrap_text(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """Word-wrap text to fit within max_width pixels."""
    words = text.split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        test = " ".join(current + [word])
        try:
            w = font.getlength(test)
        except AttributeError:
            w = len(test) * 10
        if w <= max_width:
            current.append(word)
        else:
            if current:
                lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    return lines or [text]


def _compute_bubble_size(
    text: str,
    font: ImageFont.FreeTypeFont,
    max_panel_w: int,
) -> tuple[int, int]:
    """Compute (width, height) for a bubble wrapping the given text."""
    pad = 12
    max_bw = int(max_panel_w * 0.85)
    lines = _wrap_text(text.strip().strip("*()[]<>"), font, max_bw - 2 * pad)
    try:
        _, _, _, lh = font.getbbox("A")
        lh += 6
        bw = min(max_bw, max(int(font.getlength(l)) for l in lines) + 2 * pad)
    except AttributeError:
        lh = 20
        bw = min(max_bw, max(len(l) * 10 for l in lines) + 2 * pad)
    bh = len(lines) * lh + 2 * pad
    return max(bw, 60), max(bh, 36)


def _draw_speech_bubble(
    draw: ImageDraw.ImageDraw,
    text: str,
    bubble_x: int,
    bubble_y: int,
    max_width: int = 200,
    bubble_type: str = "speech",
) -> None:
    """Draw a typed speech bubble. bubble_x is the horizontal center; bubble_y is the top edge."""
    if not text:
        return

    fill, outline, outline_w, radius = BUBBLE_STYLES.get(bubble_type, BUBBLE_STYLES["speech"])
    font       = BUBBLE_FONTS.get(bubble_type, BUBBLE_FONTS["speech"])()
    text_color = BUBBLE_TEXT_COLORS.get(bubble_type, (10, 10, 10))
    pad        = 12

    bw, bh = _compute_bubble_size(text, font, max_width)
    bx = bubble_x - bw // 2
    by = bubble_y

    # Body
    draw.rounded_rectangle(
        [bx, by, bx + bw, by + bh],
        radius=radius, fill=fill, outline=outline, width=outline_w,
    )

    # Tail (triangle for speech/shout, 3 dots for thought; none for sfx/narration)
    if bubble_type not in ("sfx", "narration"):
        tail = [(bx + 16, by + bh), (bx + 30, by + bh), (bx + 12, by + bh + 16)]
        draw.polygon(tail, fill=fill)
        draw.line([tail[0], tail[2]], fill=outline, width=outline_w)
        draw.line([tail[1], tail[2]], fill=outline, width=outline_w)
        if bubble_type == "thought":
            for cx, cy, r in [(bx + 22, by + bh + 5, 5), (bx + 16, by + bh + 12, 4), (bx + 11, by + bh + 18, 3)]:
                draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill, outline=outline, width=1)

    # Text
    clean = text.strip().strip("*()[]<>")
    lines = _wrap_text(clean, font, bw - 2 * pad)
    try:
        _, _, _, lh = font.getbbox("A")
        lh += 6
    except AttributeError:
        lh = 20
    total_h = len(lines) * lh
    y_start = by + (bh - total_h) // 2
    for i, line in enumerate(lines):
        try:
            lw = int(font.getlength(line))
        except AttributeError:
            lw = len(line) * 10
        draw.text((bx + (bw - lw) // 2, y_start + i * lh), line, fill=text_color, font=font)


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
                btype = classify_bubble(dialogue.strip())
                _draw_speech_bubble(
                    draw,
                    dialogue.strip(),
                    bubble_x=x + cell_w // 2,
                    bubble_y=y + 20,
                    max_width=cell_w - 32,
                    bubble_type=btype,
                )

            x += cell_w + col_gutter

        y += row_h + gutter

    return page
