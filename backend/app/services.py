"""Gemini API service for text generation and analysis."""

import json
import re

# google-genai is optional at import time so the app can start without it;
# we surface a clear error when the service is instantiated.
try:
    from google import genai
    from google.genai import errors as genai_errors
    from google.api_core import exceptions as google_exceptions
    genai_import_error = None
except ModuleNotFoundError as exc:  # pragma: no cover - environment dependent
    genai = None
    genai_errors = None
    google_exceptions = None
    genai_import_error = exc

from app.config import settings


class GeminiServiceError(Exception):
    """Gemini service error with an HTTP status code."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        retry_after_seconds: float | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.retry_after_seconds = retry_after_seconds


def _extract_retry_after_seconds(error_text: str) -> float | None:
    """Extract retry delay from Gemini error text when present."""
    if not error_text:
        return None

    decimal_match = re.search(r"Please retry in\s+([0-9]+(?:\.[0-9]+)?)s", error_text)
    if decimal_match:
        return float(decimal_match.group(1))

    seconds_match = re.search(r"'retryDelay':\s*'([0-9]+)s'", error_text)
    if seconds_match:
        return float(seconds_match.group(1))

    return None


def _extract_json_payload(text: str) -> dict:
    """Extract a JSON object from plain text or fenced markdown output."""
    candidate = text.strip()

    fenced_match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", candidate, re.DOTALL)
    if fenced_match:
        candidate = fenced_match.group(1).strip()

    start = candidate.find("{")
    end = candidate.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = candidate[start : end + 1]

    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise GeminiServiceError(
            "Failed to parse structured JSON response for Step 1.", status_code=500
        ) from exc

    if not isinstance(parsed, dict):
        raise GeminiServiceError(
            "Structured Step 1 response is not a JSON object.", status_code=500
        )

    return parsed


def _first_nonempty_line(text: str) -> str:
    for line in text.splitlines():
        cleaned = line.strip().strip("*#- ")
        if cleaned:
            return cleaned
    return ""


def _build_step1_fallback_snapshot(
    project_id: str,
    story_text: str,
    genre_tone: str,
    art_style_reference: str,
    max_panels_per_page: int,
    special_requests: str,
    step_status: str,
    last_updated: str,
    num_chapters: int,
    analysis_markdown: str,
) -> dict:
    """Build a minimal, always-valid snapshot when model JSON is malformed."""
    story_preview = story_text[:4000]
    plot_line = _first_nonempty_line(analysis_markdown)
    total_scenes_guess = max(1, len(re.findall(r"\bscene\b", analysis_markdown, re.IGNORECASE)))

    return {
        "project_id": project_id,
        "project_status": "in_progress",
        "user_inputs": {
            "story_content": story_preview,
            "genre": genre_tone,
            "tone": genre_tone,
            "art_style_reference": art_style_reference,
            "max_panels_per_page": max_panels_per_page,
            "user_customizations": {
                "special_requests": special_requests,
            },
        },
        "steps": {
            "step_1_analysis": {
                "status": step_status,
                "last_updated": last_updated,
                "data": {
                    "analysis": {
                        "total_characters_detected": 0,
                        "main_characters": [],
                        "supporting_characters": [],
                        "plot": plot_line,
                        "arcs": [],
                        "structure": "",
                    },
                    "chapters_structure": [
                        {
                            "chapter_number": idx + 1,
                            "title": f"Chapter {idx + 1}",
                            "pages_estimate": "auto",
                            "scenes": [],
                        }
                        for idx in range(max(1, num_chapters))
                    ],
                    "final_statistics": {
                        "total_chapters": max(1, num_chapters),
                        "total_pages": 0,
                        "total_scenes": total_scenes_guess,
                    },
                    "analysis_markdown": analysis_markdown,
                    "parser_note": "Fallback JSON generated because model output was not valid JSON.",
                },
            }
        },
    }


def _build_step2_fallback_snapshot(
    project_id: str,
    genre_tone: str,
    art_style_reference: str,
    special_requests: str,
    step_status: str,
    last_updated: str,
    step1_json: dict,
    design_markdown: str,
) -> dict:
    """Build a minimal, valid Step 2 snapshot if model JSON output is malformed."""
    existing_steps = step1_json.get("steps", {}) if isinstance(step1_json, dict) else {}
    return {
        "project_id": project_id,
        "project_status": "in_progress",
        "user_inputs": {
            "genre": genre_tone,
            "tone": genre_tone,
            "art_style_reference": art_style_reference,
            "user_customizations": {"special_requests": special_requests},
        },
        "steps": {
            **existing_steps,
            "step_2_design": {
                "status": step_status,
                "last_updated": last_updated,
                "data": {
                    "main_characters_designs": {},
                    "supporting_designs": {},
                    "design_markdown": design_markdown,
                    "parser_note": "Fallback JSON generated because model output was not valid JSON.",
                },
            },
        },
    }


class GeminiService:
    """Service class for interacting with Google's Gemini API."""

    def __init__(self, model: str | None = None):
        """Initialize Gemini API with API key from settings."""
        if genai is None:
            raise ImportError(
                "google-genai is not installed. Run `pip install google-genai`."
            ) from genai_import_error
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY environment variable is not set")

        self.model_name = model or settings.GEMINI_MODEL
        # Client-based SDK surface; avoids global state.
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

    async def generate_text(self, prompt: str) -> str:
        """
        Generate text using Gemini API.

        Args:
            prompt: The input prompt for text generation

        Returns:
            Generated text response
        """
        try:
            response = self.client.models.generate_content(
                model=self.model_name, contents=prompt
            )
            return response.text
        except google_exceptions.ResourceExhausted as exc:
            retry_after = _extract_retry_after_seconds(str(exc))
            raise GeminiServiceError(
                "Gemini quota exceeded. Please retry later or check your billing/limits.",
                status_code=429,
                retry_after_seconds=retry_after,
            ) from exc
        except google_exceptions.NotFound as exc:
            raise GeminiServiceError(
                f"Gemini model '{self.model_name}' not found. Update GEMINI_MODEL to an available model.",
                status_code=404,
            ) from exc
        except genai_errors.ClientError as exc:
            status_code = int(getattr(exc, "code", 500) or 500)
            retry_after = _extract_retry_after_seconds(str(exc))
            if status_code == 429:
                raise GeminiServiceError(
                    "Gemini quota exceeded. Please retry later or check your billing/limits.",
                    status_code=429,
                    retry_after_seconds=retry_after,
                ) from exc
            if status_code == 404:
                raise GeminiServiceError(
                    f"Gemini model '{self.model_name}' not found. Update GEMINI_MODEL to an available model.",
                    status_code=404,
                ) from exc
            raise GeminiServiceError(
                f"Gemini API request failed: {exc}", status_code=status_code
            ) from exc
        except Exception as exc:
            raise GeminiServiceError(f"Failed to generate text: {exc}") from exc

    async def analyze_story(self, story_text: str) -> str:
        """
        Analyze a story for comic adaptation.

        Args:
            story_text: The story text to analyze

        Returns:
            Analysis of the story
        """
        prompt = f"""
Please analyze the following story for comic/manga adaptation:

{story_text}

Provide a detailed analysis including:
1. Main plot points
2. Character development arcs
3. Recommended pacing for comic panels
4. Key scenes for visual adaptation
5. Suggested art style considerations
        """
        return await self.generate_text(prompt)

    async def generate_plot_analysis(
        self,
        story_text: str,
        num_chapters: int = 3,
        desired_main_characters: int = 5,
        target_total_pages: str = "auto",
        genre_tone: str = "Shonen action",
        art_style_reference: str = "classic black-and-white weekly shonen",
        max_panels_per_page: int = 6,
        special_requests: str = "None",
        output_format: str = "markdown",
        project_id: str = "manga_project_001",
        step_status: str = "review_pending",
        last_updated: str | None = None,
    ) -> str:
        """
        Generate detailed plot analysis for story division.

        Args:
            story_text: The story to analyze
            num_chapters: Number of chapters to divide into

        Returns:
            Plot analysis and chapter breakdown
        """
        if output_format.lower() == "json":
            json_last_updated = last_updated or "1970-01-01T00:00:00Z"
            prompt = f"""
You are a professional manga adaptation studio AI.
Your task is Step 1: Analysis & Planning, and you must return one valid JSON object only.
Do not include markdown, explanation, comments, or code fences.

Generate JSON using this exact top-level structure:
{{
  "project_id": "{project_id}",
  "project_status": "in_progress",
  "user_inputs": {{
    "story_content": "...",
    "genre": "...",
    "tone": "...",
    "art_style_reference": "...",
    "max_panels_per_page": 0,
    "user_customizations": {{
      "special_requests": "..."
    }}
  }},
  "steps": {{
    "step_1_analysis": {{
      "status": "{step_status}",
      "last_updated": "{json_last_updated}",
      "data": {{
        "analysis": {{
          "total_characters_detected": 0,
          "main_characters": [
            {{ "id": "", "name": "", "role": "", "visual_hook": "" }}
          ],
          "supporting_characters": [
            {{ "id": "", "name": "", "role": "" }}
          ],
          "plot": "",
          "arcs": [],
          "structure": ""
        }},
        "chapters_structure": [
          {{
            "chapter_number": 1,
            "title": "",
            "pages_estimate": "",
            "scenes": []
          }}
        ],
        "final_statistics": {{
          "total_chapters": 0,
          "total_pages": 0,
          "total_scenes": 0
        }}
      }}
    }}
  }}
}}

User input data:
- story_content: {story_text}
- desired_main_characters: {desired_main_characters}
- num_chapters: {num_chapters}
- target_total_pages: {target_total_pages}
- genre: {genre_tone}
- tone: {genre_tone}
- art_style_reference: {art_style_reference}
- max_panels_per_page: {max_panels_per_page}
- special_requests: {special_requests}

Rules:
- Return strict JSON only.
- Ensure chapters_structure has exactly {num_chapters} chapter objects.
- Keep all required keys present.
- Use numeric values for totals.
            """
            return await self.generate_text(prompt)

        prompt = f"""
You are a professional manga adaptation studio AI. Your only job right now is Step 1: Analysis & Planning. Never generate images or dialogue yet - only the structured plan.

USER CUSTOMIZATION INPUTS:

Story text: '''{story_text}'''
Desired total main characters: {desired_main_characters} (example: 5) -> If the story has more, you MUST suggest smart merges or which characters to keep/promote.
Number of chapters the manga should have: {num_chapters} (example: 8)
Target total pages for the whole manga: {target_total_pages} (example: 120 or auto)
Preferred manga genre & tone: {genre_tone}
Art style reference (optional): {art_style_reference}
Maximum panels per page allowed: {max_panels_per_page} (default 6-8; you can change to 4 for dramatic pacing)
Any special requests: {special_requests}

TASK - STEP 1 ONLY
Read the story and output EXACTLY in this order using clean markdown:

1. Character Breakdown

Total characters detected: __
Main characters (exactly the number the user requested): list them with 1-sentence role + personality + suggested visual design hook.
Supporting / minor characters (grouped or merged if needed to respect the user limit).
Any characters you recommend removing or combining and why.

2. Plot & Arc Analysis

Main plot in one sentence.
Number of major plot arcs.
Subplots (list each with importance level: High / Medium / Low).
Overall story structure (3-act or 4-act) and how it will be divided into the exact number of chapters the user wants.

3. Chapter Division
Create exactly {num_chapters} chapters.
For each chapter:

Chapter title (creative manga-style title)
Chapters covered pages estimate (so total matches user's target pages)
List of scenes inside this chapter (numbered)

4. Scene-by-Scene Breakdown (the most important part)
For every single scene across all chapters:

Scene number & chapter it belongs to
One-sentence summary
Key emotional/visual moment (what must be shown big)
Suggested number of pages this scene needs (1-4 pages)
Suggested number of panels on each of those pages (example: Page 1: 6 panels, Page 2: splash + 3 panels)
Panel layout notes (e.g. "double-page spread for the betrayal", "vertical 4-panel strip for tension", "cinematic wide panel for city reveal", etc.)
Whether this scene needs a splash page or double-page spread

5. Global Manga Layout Rules You Will Follow Later

Average panels per page for normal scenes
How many full splash pages you plan
Pacing rhythm (e.g. "Chapter 1: fast 5-7 panels/page, Chapter 4 climax: slower 3-4 panels/page")
Any recurring visual motifs or page tricks you will use

6. Final Statistics Summary (in a boxed table)

Total chapters: __
Total scenes: __
Total estimated pages: __
Main characters used: __
Average scenes per page across the whole manga: __
Number of splash/double pages: __

After you output everything above, end with this exact line:
"Step 1 complete. Reply with 'Proceed to Step 2 - Character Designs' if you want me to create full character sheets, or tell me any changes you want to the plan first."
        """
        return await self.generate_text(prompt)

    async def generate_plot_analysis_structured(
        self,
        project_id: str,
        story_text: str,
        num_chapters: int,
        desired_main_characters: int,
        target_total_pages: str,
        genre_tone: str,
        art_style_reference: str,
        max_panels_per_page: int,
        special_requests: str,
        step_status: str,
        last_updated: str,
    ) -> dict:
        """Generate and parse Step 1 structured JSON directly from the Step 1 prompt."""
        raw_json = await self.generate_plot_analysis(
            story_text=story_text,
            num_chapters=num_chapters,
            desired_main_characters=desired_main_characters,
            target_total_pages=target_total_pages,
            genre_tone=genre_tone,
            art_style_reference=art_style_reference,
            max_panels_per_page=max_panels_per_page,
            special_requests=special_requests,
            output_format="json",
            project_id=project_id,
            step_status=step_status,
            last_updated=last_updated,
        )

        try:
            return _extract_json_payload(raw_json)
        except GeminiServiceError:
            return _build_step1_fallback_snapshot(
                project_id=project_id,
                story_text=story_text,
                genre_tone=genre_tone,
                art_style_reference=art_style_reference,
                max_panels_per_page=max_panels_per_page,
                special_requests=special_requests,
                step_status=step_status,
                last_updated=last_updated,
                num_chapters=num_chapters,
                analysis_markdown=raw_json,
            )

    async def generate_character_prompts(self, character_description: str) -> str:
        """
        Generate AI image prompts for a character.

        Args:
            character_description: Description of the character

        Returns:
            Image generation prompt
        """
        prompt = f"""
Create a detailed image generation prompt for this manga/anime character:

{character_description}

The prompt should include:
1. Character appearance details
2. Clothing and accessories
3. Pose suggestion
4. Art style specifications
5. Emotional expression
        """
        return await self.generate_text(prompt)

    async def generate_step2_character_design_markdown(
        self,
        step1_json: dict,
        desired_main_characters: int,
        genre_tone: str,
        art_style_reference: str,
        special_requests: str,
    ) -> str:
        """Generate Step 2 markdown design sheets using Step 1 structured JSON context."""
        step1_json_text = json.dumps(step1_json, ensure_ascii=True, indent=2)
        prompt = f"""
You are a professional manga adaptation studio AI. Your only job right now is Step 2: Character Designs. Never generate images yet - only text-based design sheets and descriptions that could be used for AI image prompts later.

REFERENCE FROM STEP 1 (structured JSON):
{step1_json_text}

USER CUSTOMIZATION INPUTS:
- Desired total main characters: {desired_main_characters}
- Preferred manga genre & tone: {genre_tone}
- Art style reference: {art_style_reference}
- Any special requests for designs: {special_requests}

TASK - STEP 2 ONLY
Based on the Step 1 plan, create detailed character design sheets for exactly the main characters specified, plus any supporting ones if they appear in multiple scenes.
Output EXACTLY in this order using clean markdown:

1. Global Design Guidelines
2. Main Character Design Sheets
3. Supporting Character Design Sheets
4. Interaction & Relationship Notes
5. Final Design Summary (in a boxed table)

For each main character include:
- Name & Role
- Personality & Backstory (2-3 sentences)
- Physical Appearance
- Outfit & Accessories
- Expressions & Poses
- Visual Design Hook
- AI Image Prompt Ready

After you output everything above, end with this exact line:
"Step 2 complete. Reply with 'Proceed to Step 3 - Panel-by-Panel Script & Image Prompts' if you want me to generate the full manga script with per-panel details, or tell me any changes you want to the designs first."
        """
        return await self.generate_text(prompt)

    async def generate_step2_structured_snapshot(
        self,
        project_id: str,
        step1_json: dict,
        desired_main_characters: int,
        genre_tone: str,
        art_style_reference: str,
        special_requests: str,
        step_status: str,
        last_updated: str,
        design_markdown: str,
    ) -> dict:
        """Generate strict Step 2 structured JSON using markdown + Step 1 JSON context."""
        step1_json_text = json.dumps(step1_json, ensure_ascii=True, indent=2)
        prompt = f"""
Convert the following Step 2 character design content into one strict JSON object.
Return JSON only (no markdown, no code fence, no comments).

Use this exact shape:
{{
  "project_id": "{project_id}",
  "project_status": "in_progress",
  "user_inputs": {{
    "genre": "{genre_tone}",
    "tone": "{genre_tone}",
    "art_style_reference": "{art_style_reference}",
    "user_customizations": {{ "special_requests": "{special_requests}" }}
  }},
  "steps": {{
    "step_1_analysis": {{}},
    "step_2_design": {{
      "status": "{step_status}",
      "last_updated": "{last_updated}",
      "data": {{
        "main_characters_designs": {{
          "character_id": {{
            "name": "",
            "physical_appearance": "",
            "outfit_casual": "",
            "expressions": {{}},
            "ai_image_prompt_ready": ""
          }}
        }},
        "supporting_designs": {{}}
      }}
    }}
  }}
}}

Step 1 JSON reference:
{step1_json_text}

Step 2 markdown source:
{design_markdown}

Rules:
- Keep JSON valid.
- Keep step_1_analysis from input JSON if available.
- Ensure each main character includes ai_image_prompt_ready.
        """

        raw_json = await self.generate_text(prompt)
        try:
            parsed = _extract_json_payload(raw_json)
        except GeminiServiceError:
            return _build_step2_fallback_snapshot(
                project_id=project_id,
                genre_tone=genre_tone,
                art_style_reference=art_style_reference,
                special_requests=special_requests,
                step_status=step_status,
                last_updated=last_updated,
                step1_json=step1_json,
                design_markdown=design_markdown,
            )

        if isinstance(step1_json, dict):
            parsed_steps = parsed.setdefault("steps", {})
            if "step_1_analysis" not in parsed_steps and "steps" in step1_json:
                prior_step1 = step1_json.get("steps", {}).get("step_1_analysis")
                if prior_step1 is not None:
                    parsed_steps["step_1_analysis"] = prior_step1

        return parsed

    async def generate_panel_script(self, scene_description: str) -> str:
        """
        Generate detailed panel scripts for a scene.

        Args:
            scene_description: Description of the scene

        Returns:
            Detailed panel breakdown
        """
        prompt = f"""
Create a detailed manga panel script for this scene:

{scene_description}

Include:
1. Panel layout (number and arrangement)
2. Each panel's visual description
3. Dialogue and thoughts
4. Action sequences
5. Visual effects and emphasis
        """
        return await self.generate_text(prompt)

    async def generate_step1_structured_snapshot(
        self,
        project_id: str,
        story_text: str,
        num_chapters: int,
        desired_main_characters: int,
        target_total_pages: str,
        genre_tone: str,
        art_style_reference: str,
        max_panels_per_page: int,
        special_requests: str,
        analysis_markdown: str,
        step_status: str,
        last_updated: str,
    ) -> dict:
        """Generate a strict JSON snapshot for Step 1 using the markdown analysis context."""
        prompt = f"""
Convert the following Step 1 manga analysis into one strict JSON object.
Return JSON only (no markdown, no code fence, no comments).

Use this exact top-level schema:
{{
  "project_id": "{project_id}",
  "project_status": "in_progress",
  "user_inputs": {{
    "story_content": "...",
    "genre": "...",
    "tone": "...",
    "art_style_reference": "...",
    "max_panels_per_page": 0,
    "user_customizations": {{
      "special_requests": "..."
    }}
  }},
  "steps": {{
    "step_1_analysis": {{
      "status": "{step_status}",
      "last_updated": "{last_updated}",
      "data": {{
        "analysis": {{
          "total_characters_detected": 0,
          "main_characters": [],
          "supporting_characters": [],
          "plot": "",
          "arcs": [],
          "structure": ""
        }},
        "chapters_structure": [],
        "final_statistics": {{
          "total_chapters": 0,
          "total_pages": 0,
          "total_scenes": 0
        }}
      }}
    }}
  }}
}}

Known user inputs:
- story_content: {story_text}
- genre: {genre_tone}
- tone: {genre_tone}
- art_style_reference: {art_style_reference}
- max_panels_per_page: {max_panels_per_page}
- special_requests: {special_requests}
- desired_main_characters: {desired_main_characters}
- num_chapters: {num_chapters}
- target_total_pages: {target_total_pages}

Source Step 1 markdown:
{analysis_markdown}

Rules:
- Keep JSON valid.
- Use numeric values for totals where possible.
- chapters_structure must be an array of chapter objects.
- main_characters and supporting_characters must be arrays of objects.
- If a value is unavailable, infer conservatively but keep schema complete.
        """

        raw_json = await self.generate_text(prompt)
        try:
            return _extract_json_payload(raw_json)
        except GeminiServiceError:
            return _build_step1_fallback_snapshot(
                project_id=project_id,
                story_text=story_text,
                genre_tone=genre_tone,
                art_style_reference=art_style_reference,
                max_panels_per_page=max_panels_per_page,
                special_requests=special_requests,
                step_status=step_status,
                last_updated=last_updated,
                num_chapters=num_chapters,
                analysis_markdown=analysis_markdown,
            )

