from .panel_definition import PanelDefinition


def calc_flux_dimensions(
    panel: PanelDefinition,
    page_w: int = 1240,
    page_h: int = 1754,
    min_dim: int = 256,
    max_dim: int = 1024,
) -> tuple[int, int]:
    """Return (width_px, height_px) snapped to nearest multiple of 8, clamped to [min_dim, max_dim]."""
    x_pct, y_pct, w_pct, h_pct = panel.bbox
    raw_w = w_pct / 100.0 * page_w
    raw_h = h_pct / 100.0 * page_h
    w = max(min_dim, min(max_dim, round(raw_w / 8) * 8))
    h = max(min_dim, min(max_dim, round(raw_h / 8) * 8))
    return w, h
