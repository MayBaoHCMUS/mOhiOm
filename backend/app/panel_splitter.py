"""
Projection-based manga panel detection using pure Pillow (no numpy).
Detects black gutter lines separating panels, crops each panel region.
Falls back to uniform grid split when detection yields the wrong count.
"""

import math
from PIL import Image

_DARK_THRESHOLD = 30     # pixel value below which counts as "dark"
_ROW_MIN_DARK = 0.50     # fraction of row pixels that must be dark → separator row
_COL_MIN_DARK = 0.40     # fraction of col pixels that must be dark → separator col
_MIN_REGION_PX = 40      # minimum panel dimension to be considered valid
_BORDER_TRIM = 4         # pixels to trim inward from each panel edge


# ── Low-level helpers ─────────────────────────────────────────────────────────

def _row_dark_flags(data: bytes, w: int, h: int) -> list[bool]:
    """For each row, True if ≥ ROW_MIN_DARK fraction of pixels are dark."""
    flags: list[bool] = []
    for y in range(h):
        row = data[y * w : (y + 1) * w]
        dark = sum(1 for p in row if p < _DARK_THRESHOLD)
        flags.append(dark / w >= _ROW_MIN_DARK)
    return flags


def _col_dark_flags(data: bytes, w: int, h: int) -> list[bool]:
    """For each column, True if ≥ COL_MIN_DARK fraction of pixels are dark."""
    flags: list[bool] = []
    for x in range(w):
        col = data[x :: w]  # every w-th byte starting at x
        dark = sum(1 for p in col if p < _DARK_THRESHOLD)
        flags.append(dark / h >= _COL_MIN_DARK)
    return flags


def _separator_bands(flags: list[bool]) -> list[tuple[int, int]]:
    """Return (start, end) of each contiguous True run in flags."""
    bands: list[tuple[int, int]] = []
    in_band = False
    start = 0
    for i, f in enumerate(flags):
        if f and not in_band:
            in_band = True
            start = i
        elif not f and in_band:
            in_band = False
            bands.append((start, i))
    if in_band:
        bands.append((start, len(flags)))
    return bands


def _content_regions(bands: list[tuple[int, int]], total: int) -> list[tuple[int, int]]:
    """
    Return (start, end) of content regions between separator bands.
    Includes leading region before first band and trailing region after last band.
    Filters out regions smaller than _MIN_REGION_PX.
    """
    edges = [0] + [e for _, e in bands] + [total]
    starts = [0] + [s for s, _ in bands]

    regions: list[tuple[int, int]] = []
    for i in range(len(bands) + 1):
        s = edges[i]
        e = starts[i] if i < len(bands) else total
        # clamp edge from the previous band end
        region_start = bands[i - 1][1] if i > 0 else 0
        region_end = bands[i][0] if i < len(bands) else total
        if region_end - region_start >= _MIN_REGION_PX:
            regions.append((region_start, region_end))

    return regions


def _trim(img: Image.Image) -> Image.Image:
    """Trim _BORDER_TRIM px from all sides to remove gutter remnants."""
    t = _BORDER_TRIM
    w, h = img.size
    left = min(t, w // 4)
    top = min(t, h // 4)
    right = max(w - t, w * 3 // 4)
    bottom = max(h - t, h * 3 // 4)
    return img.crop((left, top, right, bottom))


# ── Core detection ────────────────────────────────────────────────────────────

def _detect_panels(page_img: Image.Image) -> list[Image.Image]:
    """
    Detect panels via horizontal + vertical projection.
    Returns panels in reading order (top→bottom, left→right).
    """
    gray = page_img.convert("L")
    w, h = gray.size
    data = gray.tobytes()

    # ── 1. Find horizontal gutters → row strips ───────────────────────────────
    row_flags = _row_dark_flags(data, w, h)
    h_bands = _separator_bands(row_flags)
    row_regions = _content_regions(h_bands, h)

    panels: list[Image.Image] = []

    for (ry0, ry1) in row_regions:
        # Crop horizontal strip
        strip = page_img.crop((0, ry0, w, ry1))
        strip_gray = strip.convert("L")
        sw, sh = strip_gray.size
        strip_data = strip_gray.tobytes()

        # ── 2. Find vertical gutters within this strip ────────────────────────
        col_flags = _col_dark_flags(strip_data, sw, sh)
        v_bands = _separator_bands(col_flags)
        col_regions = _content_regions(v_bands, sw)

        for (cx0, cx1) in col_regions:
            cell = page_img.crop((cx0, ry0, cx1, ry1))
            panels.append(_trim(cell))

    return panels


# ── Fallback: uniform grid ────────────────────────────────────────────────────

def _uniform_split(page_img: Image.Image, n: int) -> list[Image.Image]:
    """Split image into n equal cells arranged in the most square-ish grid."""
    w, h = page_img.size
    # Pick rows/cols so rows*cols == n and aspect ratio is reasonable
    best_rows, best_cols = 1, n
    best_score = float("inf")
    for rows in range(1, n + 1):
        if n % rows != 0:
            continue
        cols = n // rows
        # Score: how far the cell aspect ratio is from 1:1
        cell_ratio = (w / cols) / (h / rows)
        score = abs(math.log(cell_ratio))
        if score < best_score:
            best_score = score
            best_rows, best_cols = rows, cols

    cell_h = h // best_rows
    cell_w = w // best_cols
    panels: list[Image.Image] = []
    for r in range(best_rows):
        for c in range(best_cols):
            x0, y0 = c * cell_w, r * cell_h
            x1, y1 = x0 + cell_w, y0 + cell_h
            panels.append(_trim(page_img.crop((x0, y0, x1, y1))))
    return panels


# ── Public API ────────────────────────────────────────────────────────────────

def split_panels(page_img: Image.Image, n_panels: int) -> list[Image.Image]:
    """
    Split a comic page into individual panel images.

    Tries projection-based gutter detection first.
    Falls back to uniform grid if detected count doesn't match n_panels.

    Returns panels in reading order (top→bottom, left→right).
    """
    detected = _detect_panels(page_img)
    if len(detected) == n_panels:
        return detected
    # Fallback: uniform grid
    return _uniform_split(page_img, n_panels)
