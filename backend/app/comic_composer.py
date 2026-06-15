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


def compose_page(panels: list[dict], style: str = "manga") -> Image.Image:
    """
    Compose panel images into a 1200×1600 comic page.

    Each dict in panels must have:
      - image_data_url: str   base64 data URL
      - shot_type: str        determines row height weight
      - dialogue: str | None  optional speech bubble text
      - panel_number: int     sort order

    style: "manga" (borders + gutter) | "webtoon" (no border, no gutter)
    """
    is_manga = style.lower() != "webtoon"
    gutter = GUTTER_MANGA if is_manga else GUTTER_WEBTOON

    panels_sorted = sorted(panels, key=lambda p: p.get("panel_number", 0))
    n = len(panels_sorted)
    if n == 0:
        return Image.new("RGB", (PAGE_W, PAGE_H), BG_COLOR)

    # Decode all images
    images = [_decode_image(p["image_data_url"]) for p in panels_sorted]

    # Compute row heights proportional to intensity weights
    weights = [_shot_intensity(p.get("shot_type", "")) for p in panels_sorted]
    total_weight = sum(weights)
    usable_h = PAGE_H - 2 * MARGIN - (n - 1) * gutter
    row_heights = [max(1, int(usable_h * w / total_weight)) for w in weights]

    # Fix rounding drift on last row
    row_heights[-1] = PAGE_H - 2 * MARGIN - (n - 1) * gutter - sum(row_heights[:-1])
    row_heights[-1] = max(1, row_heights[-1])

    page = Image.new("RGB", (PAGE_W, PAGE_H), BG_COLOR)
    draw = ImageDraw.Draw(page)
    pw = PAGE_W - 2 * MARGIN

    y = MARGIN
    for panel, img, row_h in zip(panels_sorted, images, row_heights):
        x = MARGIN

        # Fit and center image in panel cell
        canvas = Image.new("RGB", (pw, row_h), BG_COLOR)
        resized = _fit_image(img, pw, row_h)
        off_x = (pw - resized.width) // 2
        off_y = (row_h - resized.height) // 2
        canvas.paste(resized, (off_x, off_y))
        page.paste(canvas, (x, y))

        if is_manga:
            draw.rectangle(
                [x, y, x + pw - 1, y + row_h - 1],
                outline=BORDER_COLOR,
                width=BORDER_W_MANGA,
            )

        dialogue = panel.get("dialogue") or ""
        if dialogue.strip():
            _draw_speech_bubble(
                draw,
                dialogue.strip(),
                bubble_x=x + pw // 2,
                bubble_y=y + 20,
                max_width=pw - 32,
            )

        y += row_h + gutter

    return page
