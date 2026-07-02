"""
FastAPI router for manga panel layout compositing.
Takes already-generated panel images and composites them into a page
using diverse polygon layouts (diagonals, splashes, asymmetric grids, etc.).
SD image generation is handled by the existing pipeline — not here.
"""

import base64
import io
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from comic.layout.page_compositor import PageCompositor
from comic.layout.layout_selector import select_layout, suggest_layout
from comic.layout.layout_templates import MangaLayoutTemplates
from comic.layout.mask_renderer import MaskRenderer

router = APIRouter(prefix="/comic-layout", tags=["comic-layout"])


# ── Request / Response Models ──────────────────────────────────────────────────

class ComposePageRequest(BaseModel):
    panel_images: Dict[str, str]   # key → base64 PNG/JPEG
    panel_count: int
    layout_name: str = "auto"
    style: str = "balanced"
    scene_type: str = "default"
    mood: str = "neutral"
    add_diagonals: bool = False
    seed: Optional[int] = None
    page_width: int = 1240
    page_height: int = 1754


class PanelInfo(BaseModel):
    shot_type: Optional[str] = None
    scene_type: Optional[str] = None


class SuggestLayoutRequest(BaseModel):
    panel_count: int
    scene_type: Optional[str] = None
    panels: Optional[List[PanelInfo]] = None   # per-panel info for better inference


class ConfirmLayoutRequest(BaseModel):
    panel_count: int
    layout_name: str                           # exact template name (not 'auto')
    page_width: int = 1240
    page_height: int = 1754


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/suggest")
async def suggest_layout_endpoint(request: SuggestLayoutRequest):
    """
    Suggest the best polygon layout for a page.
    Returns the top pick + alternatives + rationale.
    Infers scene type from panel shot types when not provided explicitly.
    """
    try:
        panels_data = None
        if request.panels:
            panels_data = [p.model_dump() for p in request.panels]

        result = suggest_layout(
            panel_count=request.panel_count,
            scene_type=request.scene_type,
            panels_data=panels_data,
        )
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/confirm")
async def confirm_layout_endpoint(request: ConfirmLayoutRequest):
    """
    Confirm a layout choice and return per-panel SD dimensions.
    The frontend stores these dimensions and passes them to image generation
    so each panel is generated at the exact pixel size needed for compositing.
    Returns panel slot definitions with sd_width / sd_height for each.
    """
    try:
        renderer = MaskRenderer(request.page_width, request.page_height)

        # Resolve template
        all_templates = MangaLayoutTemplates.get_all()
        if request.layout_name not in all_templates:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown layout: {request.layout_name!r}. "
                       f"Available: {sorted(all_templates.keys())}",
            )

        panels = all_templates[request.layout_name]()
        if len(panels) != request.panel_count:
            # Still return the layout — frontend will handle mismatch warning
            pass

        panel_definitions = []
        for panel in panels:
            w_px, h_px = renderer.compute_sd_dimensions(panel)
            panel.sd_width  = w_px
            panel.sd_height = h_px
            panel_definitions.append({
                "id":               panel.id,
                "bbox":             panel.bbox,
                "polygon":          panel.polygon,
                "recommended_shot": panel.recommended_shot,
                "has_diagonal":     panel.has_diagonal,
                "is_splash":        panel.is_splash,
                "sd_width":         w_px,
                "sd_height":        h_px,
            })

        return {
            "layout_name": request.layout_name,
            "panel_count": len(panels),
            "page_width":  request.page_width,
            "page_height": request.page_height,
            "panels":      panel_definitions,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/compose-page")
async def compose_page(request: ComposePageRequest):
    """
    Apply diverse polygon panel layouts to existing panel images.
    Returns the composited page as base64 PNG + layout metadata.
    """
    from PIL import Image as PILImage

    try:
        layout_name = request.layout_name
        if layout_name == "auto":
            layout_name = select_layout(
                panel_count=request.panel_count,
                scene_type=request.scene_type,
                mood=request.mood,
                prefer_dynamic=request.add_diagonals,
            )

        panel_images: Dict[str, PILImage.Image] = {}
        for key, b64_str in request.panel_images.items():
            raw = base64.b64decode(b64_str.split(",")[-1])
            img = PILImage.open(io.BytesIO(raw)).convert("RGB")
            panel_images[key] = img

        compositor = PageCompositor(
            page_width=request.page_width,
            page_height=request.page_height,
        )
        page_image, layout_panels = compositor.compose(
            panel_images=panel_images,
            panel_count=request.panel_count,
            layout_name=layout_name,
            style=request.style,
            add_diagonals=request.add_diagonals,
            seed=request.seed,
        )

        buf = io.BytesIO()
        page_image.save(buf, format="PNG", optimize=True)
        img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        return {
            "success": True,
            "page_image_b64": img_b64,
            "layout_used": layout_name,
            "panels": [
                {
                    "id":               p.id,
                    "bbox":             p.bbox,
                    "polygon":          p.polygon,
                    "recommended_shot": p.recommended_shot,
                    "has_diagonal":     p.has_diagonal,
                    "is_splash":        p.is_splash,
                    "sd_width":         p.sd_width,
                    "sd_height":        p.sd_height,
                }
                for p in layout_panels
            ],
        }

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/layouts")
async def get_available_layouts():
    """List all layout templates with panel counts and feature flags."""
    templates = MangaLayoutTemplates.get_all()
    result = {}
    for name, fn in templates.items():
        try:
            panels = fn()
            result[name] = {
                "panel_count": len(panels),
                "has_diagonal": any(p.has_diagonal for p in panels),
                "has_splash":   any(p.is_splash   for p in panels),
            }
        except Exception:
            pass
    return {"layouts": result}


@router.get("/layouts/{panel_count}")
async def get_layouts_for_count(panel_count: int):
    """List templates that match a specific panel count."""
    matching = MangaLayoutTemplates.get_for_panel_count(panel_count)
    result = {}
    for name, fn in matching.items():
        try:
            panels = fn()
            result[name] = {
                "panel_count": len(panels),
                "has_diagonal": any(p.has_diagonal for p in panels),
                "has_splash":   any(p.is_splash   for p in panels),
            }
        except Exception:
            pass
    return {"panel_count": panel_count, "layouts": result}
