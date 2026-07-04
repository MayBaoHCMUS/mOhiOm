"""
Run this to verify all layout templates and the procedural generator
render correctly — uses gray placeholder images, no SD required.

Usage (from backend/):
    source venv/bin/activate
    python test_layouts.py
"""

import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))

from PIL import Image
from comic.layout.layout_templates import MangaLayoutTemplates
from comic.layout.procedural_generator import ProceduralLayoutGenerator
from comic.layout.mask_renderer import MaskRenderer
from comic.layout.panel_definition import PageLayout

OUT_DIR = os.path.join(os.path.dirname(__file__), "test_layout_output")
os.makedirs(OUT_DIR, exist_ok=True)

GRAY_SHADES = [
    (200, 200, 200),
    (180, 180, 180),
    (160, 160, 160),
    (140, 140, 140),
    (220, 220, 220),
]


def make_placeholder(w: int, h: int, color: tuple) -> Image.Image:
    return Image.new("RGB", (max(1, w), max(1, h)), color)


def test_all_templates():
    renderer = MaskRenderer(1240, 1754)
    templates = MangaLayoutTemplates.get_all()
    passed = 0

    for name, fn in templates.items():
        try:
            panels = fn()
            images = {}
            for i, panel in enumerate(panels):
                w, h = renderer.compute_sd_dimensions(panel)
                images[panel.id] = make_placeholder(w, h, GRAY_SHADES[i % len(GRAY_SHADES)])

            layout = PageLayout(name, len(panels), panels)
            page = renderer.render_page(layout, images)
            out_path = os.path.join(OUT_DIR, f"template_{name}.png")
            page.save(out_path)
            print(f"  ✓  {name} ({len(panels)} panels)")
            passed += 1
        except Exception as exc:
            print(f"  ✗  {name}: {exc}")

    return passed, len(templates)


def test_procedural(count: int = 8):
    renderer = MaskRenderer(1240, 1754)
    gen = ProceduralLayoutGenerator()
    passed = 0

    for i in range(count):
        panel_count = random.randint(2, 5)
        style = random.choice(["balanced", "feature", "dynamic", "cinematic"])
        diagonals = random.random() < 0.4

        try:
            panels = gen.generate(panel_count, style, add_diagonals=diagonals)
            images = {}
            for j, panel in enumerate(panels):
                w, h = renderer.compute_sd_dimensions(panel)
                color = tuple(random.randint(140, 220) for _ in range(3))
                images[panel.id] = make_placeholder(w, h, color)

            layout = PageLayout(f"procedural_{style}", len(panels), panels)
            page = renderer.render_page(layout, images)
            out_path = os.path.join(OUT_DIR, f"procedural_{i}_{style}_{panel_count}p.png")
            page.save(out_path)
            diag_tag = "+diag" if diagonals else ""
            print(f"  ✓  procedural {i}: {panel_count}p {style}{diag_tag}")
            passed += 1
        except Exception as exc:
            print(f"  ✗  procedural {i}: {exc}")

    return passed, count


if __name__ == "__main__":
    print(f"\nOutput → {OUT_DIR}\n")

    print("Templates:")
    t_pass, t_total = test_all_templates()

    print("\nProcedural layouts:")
    p_pass, p_total = test_procedural(8)

    print(f"\nResults: {t_pass}/{t_total} templates · {p_pass}/{p_total} procedural")
    if t_pass < t_total or p_pass < p_total:
        sys.exit(1)
