"""
Composites already-generated panel images into a page using polygon mask layouts.
SD/image generation is handled by the existing pipeline — this module only does
layout selection + Pillow polygon masking + page compositing.
"""

import random
from PIL import Image
from typing import List, Dict, Optional

from .panel_definition import PanelDefinition, PageLayout
from .layout_templates import MangaLayoutTemplates
from .procedural_generator import ProceduralLayoutGenerator
from .mask_renderer import MaskRenderer
from .layout_selector import select_layout


class PageCompositor:

    def __init__(self, page_width: int = 1240, page_height: int = 1754):
        self.renderer = MaskRenderer(page_width, page_height)
        self.W = page_width
        self.H = page_height

    def compose(
        self,
        panel_images: Dict[str, Image.Image],
        panel_count: int,
        layout_name: str = "auto",
        style: str = "balanced",
        add_diagonals: bool = False,
        seed: Optional[int] = None,
    ) -> tuple[Image.Image, List[PanelDefinition]]:
        """
        Apply a polygon layout to already-generated panel images.

        panel_images: dict keyed by 'p1', 'p2', … (or integer-keyed, auto-remapped)
        Returns (composited_page_image, layout_panels).
        """
        # Normalise integer-keyed dicts to 'p1', 'p2', …
        if panel_images and not all(isinstance(k, str) for k in panel_images):
            panel_images = {f"p{i + 1}": img for i, img in enumerate(panel_images.values())}

        layout_panels = self._select_layout(panel_count, layout_name, style, add_diagonals, seed)

        layout = PageLayout(
            template_name=layout_name,
            panel_count=panel_count,
            panels=layout_panels,
            page_width=self.W,
            page_height=self.H,
        )
        page = self.renderer.render_page(layout, panel_images)
        return page, layout_panels

    def _select_layout(
        self,
        panel_count: int,
        layout_name: str,
        style: str,
        add_diagonals: bool,
        seed: Optional[int],
    ) -> List[PanelDefinition]:

        if layout_name == "procedural":
            return ProceduralLayoutGenerator(seed=seed).generate(
                panel_count, style, add_diagonals=add_diagonals
            )

        if layout_name == "auto":
            matching = MangaLayoutTemplates.get_for_panel_count(panel_count)
            if matching:
                chosen = random.choice(list(matching.keys()))
                panels = matching[chosen]()
                print(f"Auto-selected layout: {chosen}")
            else:
                print(f"No template for {panel_count} panels — using procedural")
                return ProceduralLayoutGenerator(seed=seed).generate(
                    panel_count, style, add_diagonals=add_diagonals
                )
        else:
            templates = MangaLayoutTemplates.get_all()
            if layout_name not in templates:
                raise ValueError(
                    f"Unknown layout '{layout_name}'. "
                    f"Available: {list(templates.keys())}"
                )
            panels = templates[layout_name]()

        if add_diagonals:
            panels = ProceduralLayoutGenerator(seed=seed)._apply_diagonals(panels, probability=0.3)

        return panels
