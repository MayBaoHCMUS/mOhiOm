"""
Selects manga layout templates based on scene type, panel count, and shot composition.
Provides both a simple name selector and a richer suggestion with alternatives.
"""

import random
from typing import Dict, List, Optional

SELECTION_RULES: Dict[str, Dict[int, List[str]]] = {
    "action": {
        2: ["diagonal_split_2"],
        3: ["diagonal_3_panels"],
        4: ["action_dynamic_4"],
        5: ["manga_classic_5"],
    },
    "emotional": {
        2: ["diagonal_split_2", "one_large_two_small"],
        3: ["one_large_two_small", "splash_top"],
        4: ["splash_top", "asymmetric_4"],
        5: ["manga_classic_5"],
    },
    "dialogue": {
        2: ["diagonal_split_2", "one_large_two_small"],
        3: ["three_panels_row", "diagonal_3_panels"],
        4: ["grid_2x2", "vertical_flow", "asymmetric_4"],
        5: ["manga_classic_5"],
    },
    "establishing": {
        1: ["full_bleed"],
        2: ["splash_top", "one_large_two_small"],
        3: ["splash_bottom", "cinematic_strips"],
        4: ["splash_top", "grid_2x2"],
    },
    "climax": {
        1: ["full_bleed"],
        2: ["diagonal_split_2"],
        3: ["diagonal_3_panels"],
        4: ["action_dynamic_4"],
    },
    "default": {
        1: ["full_bleed"],
        2: ["diagonal_split_2", "one_large_two_small"],
        3: ["three_panels_row", "diagonal_3_panels"],
        4: ["grid_2x2", "action_dynamic_4", "vertical_flow"],
        5: ["manga_classic_5"],
    },
}

SCENE_REASONS: Dict[str, str] = {
    "action":       "Dynamic diagonal panels amplify motion and impact",
    "emotional":    "Asymmetric sizing draws focus to the emotional beat",
    "dialogue":     "Balanced grid keeps eye flow smooth for character exchange",
    "establishing": "Wide splash or cinematic strips set the scene atmosphere",
    "climax":       "High-energy layout with strong diagonal tension",
    "default":      "Balanced composition suited to mixed scene content",
}

SHOT_TYPE_SCENE_MAP: Dict[str, str] = {
    "extreme close-up":  "emotional",
    "close-up":          "emotional",
    "medium close-up":   "dialogue",
    "medium shot":       "dialogue",
    "medium long shot":  "establishing",
    "long shot":         "establishing",
    "wide shot":         "establishing",
    "establishing shot": "establishing",
    "action shot":       "action",
    "dynamic shot":      "action",
    "over the shoulder": "dialogue",
}


def _infer_scene_type(panels_data: Optional[List[dict]], fallback: str = "default") -> str:
    """
    Infer scene type from the shot types of panels on this page.
    panels_data items may have keys: 'shot_type', 'scene_type'.
    """
    if not panels_data:
        return fallback

    # Use explicit scene_type if all panels agree
    explicit = [p.get("scene_type", "").lower() for p in panels_data if p.get("scene_type")]
    valid_scenes = set(SELECTION_RULES.keys()) - {"default"}
    explicit_valid = [s for s in explicit if s in valid_scenes]
    if explicit_valid:
        # majority vote
        counts: Dict[str, int] = {}
        for s in explicit_valid:
            counts[s] = counts.get(s, 0) + 1
        return max(counts, key=lambda k: counts[k])

    # Infer from shot types
    inferred_scenes: List[str] = []
    for p in panels_data:
        shot = (p.get("shot_type") or "").lower()
        for keyword, scene in SHOT_TYPE_SCENE_MAP.items():
            if keyword in shot:
                inferred_scenes.append(scene)
                break

    if not inferred_scenes:
        return fallback

    counts: Dict[str, int] = {}
    for s in inferred_scenes:
        counts[s] = counts.get(s, 0) + 1
    return max(counts, key=lambda k: counts[k])


def suggest_layout(
    panel_count: int,
    scene_type: Optional[str] = None,
    panels_data: Optional[List[dict]] = None,
) -> dict:
    """
    Suggest the best layout + ranked alternatives for a page.

    panels_data (optional): list of {shot_type, scene_type} dicts, one per panel.
    Returns:
        {
            suggested:           str,   # template name
            reason:              str,   # human-readable rationale
            alternatives:        list,  # other template names (up to 3)
            panel_count:         int,
            scene_type_detected: str,
        }
    """
    detected = _infer_scene_type(panels_data, fallback=scene_type or "default")
    if scene_type and scene_type in SELECTION_RULES:
        detected = scene_type

    rules   = SELECTION_RULES.get(detected, SELECTION_RULES["default"])
    options = rules.get(panel_count) or SELECTION_RULES["default"].get(panel_count) or []

    if not options:
        suggested   = "procedural"
        alternatives: List[str] = []
    else:
        suggested = options[0]
        alternatives = [o for o in options[1:] if o != suggested][:3]

        # Pad alternatives from default rules if needed
        default_opts = SELECTION_RULES["default"].get(panel_count, [])
        for o in default_opts:
            if o != suggested and o not in alternatives:
                alternatives.append(o)
                if len(alternatives) >= 3:
                    break

    reason = SCENE_REASONS.get(detected, SCENE_REASONS["default"])

    return {
        "suggested":           suggested,
        "reason":              reason,
        "alternatives":        alternatives[:3],
        "panel_count":         panel_count,
        "scene_type_detected": detected,
    }


def select_layout(
    panel_count: int,
    scene_type: str = "default",
    mood: str = "neutral",
    prefer_dynamic: bool = False,
) -> str:
    """
    Return the name of the best matching layout template.
    (Simple interface kept for backward compatibility with compose-page endpoint.)
    """
    scene_type = scene_type.lower()
    if scene_type not in SELECTION_RULES:
        scene_type = "default"

    rules   = SELECTION_RULES[scene_type]
    options = rules.get(panel_count) or SELECTION_RULES["default"].get(panel_count)

    if not options:
        return "procedural"

    if mood in ("tense", "dramatic") or prefer_dynamic:
        dynamic = [o for o in options if any(k in o for k in ("diagonal", "action", "dynamic"))]
        if dynamic:
            options = dynamic
    elif mood == "calm":
        calm = [o for o in options if any(k in o for k in ("grid", "cinematic", "splash"))]
        if calm:
            options = calm

    return random.choice(options)
