"""
Injects framing/composition keywords into SD prompts based on panel shape.
Tall panels → portrait framing; wide panels → landscape; small panels → tight crop.
"""

from typing import Dict, Optional, Tuple
from .panel_definition import PanelDefinition

SHOT_TYPE_MAP: Dict[str, str] = {
    "EXTREME_CLOSE_UP": "extreme close-up, face detail, high detail",
    "CLOSE_UP":         "close-up shot, facial expression, bokeh background",
    "MEDIUM_CLOSE_UP":  "medium close-up, upper body, portrait composition",
    "MEDIUM":           "medium shot, full figure, balanced composition",
    "LONG":             "long shot, full body, environment context",
    "WIDE":             "wide shot, establishing composition, landscape",
    "ESTABLISHING":     "establishing shot, panoramic view, world-building",
    "AERIAL":           "bird's eye view, top-down angle, aerial perspective",
    "LOW_ANGLE":        "low angle shot, dramatic perspective, imposing",
    "HIGH_ANGLE":       "high angle shot, overhead perspective, vulnerability",
    "DUTCH_ANGLE":      "dutch angle, tilted composition, tension, unease",
    "OVER_SHOULDER":    "over-the-shoulder shot, dialogue composition",
}

COMPOSITION_KEYWORDS: Dict[str, str] = {
    "portrait":  "vertical composition, portrait framing, centered subject",
    "landscape": "horizontal composition, wide framing, panoramic",
    "square":    "balanced framing, centered composition",
    "tall":      "vertical panel, full-height composition, vertical flow",
    "wide":      "horizontal panel, cinematic framing, widescreen",
    "splash":    "full-page illustration, dramatic impact, hero shot",
    "diagonal":  "dynamic angle, action framing, motion composition",
    "small":     "tight crop, close detail, focused composition",
}


def _classify_panel_shape(panel: PanelDefinition) -> str:
    """Return a shape keyword based on panel bbox aspect ratio and size."""
    _, _, w_pct, h_pct = panel.bbox
    total_area = w_pct * h_pct

    if panel.is_splash:
        return "splash"
    if panel.has_diagonal:
        return "diagonal"
    if total_area < 200:           # very small panel (< ~14% of page)
        return "small"

    ratio = w_pct / max(h_pct, 0.001)
    if ratio > 2.2:
        return "wide"
    if ratio < 0.55:
        return "tall"
    if 0.8 < ratio < 1.25:
        return "square"
    if ratio >= 1.25:
        return "landscape"
    return "portrait"


def get_composition_hint(panel: PanelDefinition) -> str:
    """Return a comma-separated framing hint string for this panel."""
    shape  = _classify_panel_shape(panel)
    framing = COMPOSITION_KEYWORDS.get(shape, "")

    shot   = (panel.recommended_shot or "MEDIUM").upper().replace(" ", "_").replace("-", "_")
    shot_hint = SHOT_TYPE_MAP.get(shot, "")

    parts = [h for h in [shot_hint, framing] if h]
    return ", ".join(parts)


def inject_composition(base_prompt: str, panel: PanelDefinition) -> str:
    """
    Append composition hints to a SD prompt.
    Returns the enhanced prompt; never modifies the original.
    """
    hint = get_composition_hint(panel)
    if not hint:
        return base_prompt
    base_stripped = base_prompt.rstrip(". ,")
    return f"{base_stripped}. {hint}"
