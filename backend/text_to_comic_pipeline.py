"""
Text-to-Comic Generation Pipeline using Google Gemini API
========================================================

A sequential 4-step pipeline that transforms story text into a complete manga/comic
generation plan with character designs, panel scripts, and image prompts.

Usage:
    python text_to_comic_pipeline.py

Output Files:
    - step1_result.json: Character breakdown, plot analysis, chapter division
    - step2_result.json: Character design sheets with image prompts
    - step3_result.json: Complete panel-by-panel script with image prompts
    - step4_result.json: Image generation simulation and final output
    - Final_Manga_Script.md: Consolidated final readable output
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional
from google import genai
from google.api_core import exceptions as google_exceptions
from datetime import datetime


class TextToComicPipeline:
    """Main pipeline orchestrator for text-to-comic generation."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        output_dir: str = "pipeline_output",
        model_name: str = "gemini-3-flash-preview",
    ):
        """
        Initialize the pipeline with Gemini API.

        Args:
            api_key: Google Gemini API key (or use GEMINI_API_KEY env var)
            output_dir: Directory to save pipeline output files
            model_name: Gemini model to use for generation
        """
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError(
                "GEMINI_API_KEY not provided. Set it as parameter or environment variable."
            )

        self.model_name = model_name
        # Client-based SDK surface; avoids global configuration.
        self.client = genai.Client(api_key=self.api_key)

        # Output directory setup
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)

        # Store results from each step for injection into next step
        self.step_results = {}

        print(f"✓ Pipeline initialized")
        print(f"✓ Output directory: {self.output_dir.absolute()}\n")

    def call_gemini_api(self, prompt: str) -> str:
        """
        Call Gemini API with the given prompt.

        Args:
            prompt: The prompt to send to Gemini

        Returns:
            The generated response text
        """
        try:
            response = self.client.models.generate_content(
                model=self.model_name, contents=prompt
            )
            return response.text
        except google_exceptions.ResourceExhausted as exc:
            raise Exception(
                "Gemini quota exceeded. Please retry later or review your plan/limits."
            ) from exc
        except google_exceptions.NotFound as exc:
            raise Exception(
                f"Gemini model '{self.model_name}' not found. Update the model name or check availability."
            ) from exc
        except Exception as e:
            raise Exception(f"Gemini API call failed: {str(e)}")

    def save_json_result(self, step_number: int, content: str) -> Dict[str, Any]:
        """
        Parse response and save as JSON with metadata.

        Args:
            step_number: The step number (1-4)
            content: The response content from Gemini

        Returns:
            Dictionary containing metadata and content
        """
        result = {
            "step": step_number,
            "timestamp": datetime.now().isoformat(),
            "content": content,
        }

        filename = f"step{step_number}_result.json"
        filepath = self.output_dir / filename

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        print(f"✓ Saved: {filename}")
        return result

    def load_step_result(self, step_number: int) -> str:
        """
        Load a previously saved step result.

        Args:
            step_number: The step number to load

        Returns:
            The content from that step's JSON file
        """
        filename = f"step{step_number}_result.json"
        filepath = self.output_dir / filename

        if not filepath.exists():
            raise FileNotFoundError(f"Step {step_number} result not found: {filepath}")

        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data["content"]

    def step1_analysis_planning(
        self,
        story_text: str,
        main_characters: int = 5,
        num_chapters: int = 4,
        target_pages: int = 100,
        genre_tone: str = "Action/Adventure, Epic tone",
        art_style: str = "Japanese manga style, detailed",
        max_panels_per_page: int = 6,
    ) -> str:
        """
        STEP 1: Analysis & Planning
        ==============================
        Read the story and create a structured plan without generating images.

        Args:
            story_text: The user's story text
            main_characters: Desired number of main characters
            num_chapters: Number of chapters to divide into
            target_pages: Target total number of pages
            genre_tone: Preferred manga genre and tone
            art_style: Art style reference
            max_panels_per_page: Maximum panels allowed per page

        Returns:
            Analysis and planning content
        """
        print("\n" + "=" * 70)
        print("STEP 1: ANALYSIS & PLANNING")
        print("=" * 70)

        prompt = f"""You are a professional manga adaptation studio AI. Your only job right now is Step 1: Analysis & Planning. Never generate images or dialogue yet — only the structured plan.

USER CUSTOMIZATION INPUTS:
- Story text: {story_text}
- Desired total main characters: {main_characters}
- Number of chapters: {num_chapters}
- Target total pages: {target_pages}
- Preferred manga genre & tone: {genre_tone}
- Art style reference: {art_style}
- Maximum panels per page allowed: {max_panels_per_page}

TASK — STEP 1 ONLY: Read the story and output EXACTLY in this order using clean markdown:
1. Character Breakdown
2. Plot & Arc Analysis
3. Chapter Division
4. Scene-by-Scene Breakdown
5. Global Manga Layout Rules
6. Final Statistics Summary

Important: Focus on structure and planning only. Do not create any character designs, dialogues, or image descriptions yet."""

        print("\n📋 Analyzing story and creating structure plan...")
        response = self.call_gemini_api(prompt)

        result = self.save_json_result(1, response)
        self.step_results[1] = response

        print(f"\n✓ Step 1 complete: {len(response)} characters generated")
        return response

    def step2_character_designs(self) -> str:
        """
        STEP 2: Character Designs
        ==========================
        Create detailed character design sheets based on Step 1 plan.

        Returns:
            Character design content
        """
        print("\n" + "=" * 70)
        print("STEP 2: CHARACTER DESIGNS")
        print("=" * 70)

        if 1 not in self.step_results:
            print("\n⏳ Loading Step 1 results...")
            step1_content = self.load_step_result(1)
        else:
            step1_content = self.step_results[1]

        prompt = f"""You are a professional manga adaptation studio AI. Your only job right now is Step 2: Character Designs. Never generate images yet — only text-based design sheets and descriptions.

REFERENCE FROM STEP 1:
{step1_content}

TASK — STEP 2 ONLY: Based on the Step 1 plan, create detailed character design sheets. Output EXACTLY in this order using clean markdown:
1. Global Design Guidelines
2. Main Character Design Sheets (Include AI Image Prompt Ready for each character with detailed appearance, clothing, pose, and art style specifications)
3. Supporting Character Design Sheets (if any)
4. Interaction & Relationship Notes
5. Final Design Summary

Important: Create comprehensive design specifications that would be ready for AI image generation. Include detailed visual descriptions for each character."""

        print("\n🎨 Creating character design sheets...")
        response = self.call_gemini_api(prompt)

        result = self.save_json_result(2, response)
        self.step_results[2] = response

        print(f"\n✓ Step 2 complete: {len(response)} characters generated")
        return response

    def step3_panel_script_prompts(self) -> str:
        """
        STEP 3: Panel-by-Panel Script & Image Prompts
        ==============================================
        Create complete manga script with detailed panel breakdowns and AI image prompts.

        Returns:
            Panel script and image prompts content
        """
        print("\n" + "=" * 70)
        print("STEP 3: PANEL-BY-PANEL SCRIPT & IMAGE PROMPTS")
        print("=" * 70)

        if 1 not in self.step_results:
            print("\n⏳ Loading Step 1 results...")
            step1_content = self.load_step_result(1)
        else:
            step1_content = self.step_results[1]

        if 2 not in self.step_results:
            print("⏳ Loading Step 2 results...")
            step2_content = self.load_step_result(2)
        else:
            step2_content = self.step_results[2]

        prompt = f"""You are a professional manga adaptation studio AI. Your only job right now is Step 3: Panel-by-Panel Script & Image Prompts.

REFERENCE FROM PREVIOUS STEPS:

STEP 1 ANALYSIS & PLANNING:
{step1_content}

STEP 2 CHARACTER DESIGNS:
{step2_content}

TASK — STEP 3 ONLY: Using the scene breakdowns from Step 1 and designs from Step 2, create a full manga script. Output EXACTLY in this order using clean markdown:

1. Global Scripting Rules
   - Panel numbering system
   - Dialogue formatting
   - Sound effects notation
   - Action descriptions

2. Chapter-by-Chapter Script
   For each chapter:
   - Page Number (e.g., Page 1, Page 2)
   - Layout Summary (number of panels and their arrangement)
   - Panel-by-Panel Breakdown:
     * Panel layout description
     * Scene visual description
     * Character positions
     * Dialogue/Thoughts (in quotes, character name in parentheses)
     * Sound effects and action descriptions
     * Detailed AI Image Prompt (specific, vivid, ready for image generation)

3. Special Pages Inventory
   - Title pages
   - Splash pages
   - Double-page spreads

4. Final Script Summary
   - Total pages created
   - Total panels created
   - Character appearances count
   - Key visual moments

Important: Each panel must have a detailed, ready-to-use AI image generation prompt."""

        print("\n📖 Creating panel-by-panel script...")
        response = self.call_gemini_api(prompt)

        result = self.save_json_result(3, response)
        self.step_results[3] = response

        print(f"\n✓ Step 3 complete: {len(response)} characters generated")
        return response

    def step4_image_generation_simulation(self) -> str:
        """
        STEP 4: Image Generation Simulation
        ===================================
        Process the script and create image generation simulation with ASCII placeholders.

        Returns:
            Image generation simulation content
        """
        print("\n" + "=" * 70)
        print("STEP 4: IMAGE GENERATION SIMULATION")
        print("=" * 70)

        if 1 not in self.step_results:
            print("\n⏳ Loading Step 1 results...")
            step1_content = self.load_step_result(1)
        else:
            step1_content = self.step_results[1]

        if 2 not in self.step_results:
            print("⏳ Loading Step 2 results...")
            step2_content = self.load_step_result(2)
        else:
            step2_content = self.step_results[2]

        if 3 not in self.step_results:
            print("⏳ Loading Step 3 results...")
            step3_content = self.load_step_result(3)
        else:
            step3_content = self.step_results[3]

        prompt = f"""You are a professional manga adaptation studio AI. Your only job right now is Step 4: Image Generation Simulation. Use the image prompts from Step 3 to simulate manga panels/images.

REFERENCE FROM PREVIOUS STEPS:

STEP 1 ANALYSIS & PLANNING:
{step1_content}

STEP 2 CHARACTER DESIGNS:
{step2_content}

STEP 3 PANEL-BY-PANEL SCRIPT:
{step3_content}

TASK — STEP 4 ONLY: Process the Step 3 script. Output EXACTLY in this order:

1. Global Generation Settings
   - Image resolution specifications
   - Color palette guidelines
   - Art style consistency rules
   - Quality parameters

2. Batch-by-Batch Image Generation
   For each batch of panels:
   - Batch ID and page reference
   - For each panel:
     * Panel ID
     * AI Image Prompt (from Step 3)
     * ASCII Placeholder: Create a simple ASCII art representation of the scene
     * Vivid Description: Write a poetic 2-3 sentence description of what the image should look like
     * Generation notes (character consistency, color notes, mood, etc.)

3. Compilation Options
   - Panel arrangement for final pages
   - Full-page layout assembly instructions
   - Color enhancement recommendations

4. Final Generation Summary
   - Total unique image prompts
   - Total panels to generate
   - Estimated generation time
   - Quality assurance checklist

The ASCII placeholders should be creative representations, not just boxes. Use ASCII characters to suggest the composition."""

        print("\n🖼️  Creating image generation simulation...")
        response = self.call_gemini_api(prompt)

        result = self.save_json_result(4, response)
        self.step_results[4] = response

        print(f"\n✓ Step 4 complete: {len(response)} characters generated")
        return response

    def generate_final_markdown(self) -> str:
        """
        Generate the final consolidated markdown file.

        Returns:
            Path to the generated markdown file
        """
        print("\n" + "=" * 70)
        print("GENERATING FINAL CONSOLIDATED OUTPUT")
        print("=" * 70)

        # Load all steps if not in memory
        if 1 not in self.step_results:
            self.step_results[1] = self.load_step_result(1)
        if 2 not in self.step_results:
            self.step_results[2] = self.load_step_result(2)
        if 3 not in self.step_results:
            self.step_results[3] = self.load_step_result(3)
        if 4 not in self.step_results:
            self.step_results[4] = self.load_step_result(4)

        markdown_content = f"""# Final Manga Script - Consolidated Output

**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## Table of Contents

1. [Step 1: Analysis & Planning](#step-1-analysis--planning)
2. [Step 2: Character Designs](#step-2-character-designs)
3. [Step 3: Panel-by-Panel Script](#step-3-panel-by-panel-script)
4. [Step 4: Image Generation Simulation](#step-4-image-generation-simulation)

---

## Step 1: Analysis & Planning

{self.step_results[1]}

---

## Step 2: Character Designs

{self.step_results[2]}

---

## Step 3: Panel-by-Panel Script

{self.step_results[3]}

---

## Step 4: Image Generation Simulation

{self.step_results[4]}

---

## Summary

All pipeline steps have been completed successfully. Each step's JSON output has been saved separately for reuse and integration into other tools.

**Output Files:**
- `step1_result.json` - Analysis & Planning
- `step2_result.json` - Character Designs
- `step3_result.json` - Panel-by-Panel Script
- `step4_result.json` - Image Generation Simulation
- `Final_Manga_Script.md` - This consolidated document

For more details, see the individual JSON files in the output directory.
"""

        filepath = self.output_dir / "Final_Manga_Script.md"
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(markdown_content)

        print(f"\n✓ Saved: Final_Manga_Script.md")
        return str(filepath)

    def run_full_pipeline(
        self,
        story_text: str,
        main_characters: int = 5,
        num_chapters: int = 4,
        target_pages: int = 100,
        genre_tone: str = "Action/Adventure, Epic tone",
        art_style: str = "Japanese manga style, detailed",
        max_panels_per_page: int = 6,
        generate_markdown: bool = True,
    ):
        """
        Run the complete 4-step pipeline sequentially.

        Args:
            story_text: The user's story text
            main_characters: Desired number of main characters
            num_chapters: Number of chapters
            target_pages: Target number of pages
            genre_tone: Manga genre and tone
            art_style: Art style preference
            max_panels_per_page: Max panels per page
            generate_markdown: Whether to generate final markdown file

        Returns:
            Dictionary with all results and file paths
        """
        try:
            print("\n" + "🚀 " * 25)
            print("TEXT-TO-COMIC GENERATION PIPELINE")
            print("🚀 " * 25)

            # Execute all 4 steps
            self.step1_analysis_planning(
                story_text,
                main_characters,
                num_chapters,
                target_pages,
                genre_tone,
                art_style,
                max_panels_per_page,
            )

            self.step2_character_designs()
            self.step3_panel_script_prompts()
            self.step4_image_generation_simulation()

            # Generate consolidated markdown
            if generate_markdown:
                markdown_path = self.generate_final_markdown()
            else:
                markdown_path = None

            # Summary
            print("\n" + "=" * 70)
            print("PIPELINE EXECUTION COMPLETE ✓")
            print("=" * 70)
            print(f"\n📁 Output Directory: {self.output_dir.absolute()}")
            print("\n📄 Generated Files:")
            print(f"   • step1_result.json - Analysis & Planning")
            print(f"   • step2_result.json - Character Designs")
            print(f"   • step3_result.json - Panel-by-Panel Script")
            print(f"   • step4_result.json - Image Generation Simulation")
            if markdown_path:
                print(f"   • Final_Manga_Script.md - Consolidated Output")

            return {
                "success": True,
                "output_dir": str(self.output_dir.absolute()),
                "files": {
                    "step1": str(self.output_dir / "step1_result.json"),
                    "step2": str(self.output_dir / "step2_result.json"),
                    "step3": str(self.output_dir / "step3_result.json"),
                    "step4": str(self.output_dir / "step4_result.json"),
                    "final_markdown": markdown_path,
                },
            }

        except Exception as e:
            print(f"\n❌ Pipeline execution failed: {str(e)}")
            raise


def main():
    """
    Main entry point for the pipeline script.
    """
    # Example story for demonstration
    example_story = """
    In a world where ancient magic awakens, a young warrior discovers they are the last
    descendant of a forgotten royal lineage. Tasked with saving the realm from an encroaching
    darkness, they must rally unlikely allies and uncover the secrets of their past. Along
    the way, they will face personal demons, make difficult choices, and discover that true
    power lies not in magic, but in friendship and sacrifice.
    """

    # Configuration
    config = {
        "main_characters": 6,
        "num_chapters": 4,
        "target_pages": 80,
        "genre_tone": "Fantasy/Adventure, Epic and inspirational",
        "art_style": "Traditional manga style with detailed backgrounds",
        "max_panels_per_page": 6,
    }

    try:
        # Initialize pipeline
        pipeline = TextToComicPipeline(
            output_dir="pipeline_output",
        )

        # Run full pipeline
        result = pipeline.run_full_pipeline(
            story_text=example_story,
            **config,
            generate_markdown=True,
        )

        print("\n✨ Success! Your comic generation pipeline is complete.")
        return result

    except ValueError as e:
        print(f"\n❌ Configuration Error: {str(e)}")
        print("\nPlease ensure GEMINI_API_KEY is set:")
        print("  Windows: set GEMINI_API_KEY=your_key_here")
        print("  Linux/Mac: export GEMINI_API_KEY=your_key_here")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    main()

