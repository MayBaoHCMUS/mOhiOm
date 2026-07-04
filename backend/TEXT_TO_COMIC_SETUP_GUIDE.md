# Text-to-Comic Generation Pipeline - Setup & Usage Guide

## Overview

This is a production-ready, 4-step sequential pipeline that transforms story text into a complete manga/comic generation blueprint using Google's Gemini API.

**Pipeline Stages:**
1. **Step 1: Analysis & Planning** - Story analysis, character breakdown, chapter division
2. **Step 2: Character Designs** - Detailed character sheets with AI image prompts
3. **Step 3: Panel-by-Panel Script** - Complete manga script with panel descriptions and image prompts
4. **Step 4: Image Generation Simulation** - Image prompts processing with ASCII placeholders

## Installation

### Prerequisites
- Python 3.8+
- Google Gemini API key
- FastAPI and dependencies (already in `requirements.txt`)

### Setup Steps

1. **Ensure dependencies are installed:**
   ```bash
   cd F:\Thesis\backend
   pip install -r requirements.txt
   ```

2. **Set your Gemini API key:**
   
   **Windows (PowerShell):**
   ```powershell
   $env:GEMINI_API_KEY = "your-api-key-here"
   ```
   
   **Windows (Command Prompt):**
   ```cmd
   set GEMINI_API_KEY=your-api-key-here
   ```
   
   **Or create a `.env` file in the backend directory:**
   ```
   GEMINI_API_KEY=your-api-key-here
   ```

## Usage Methods

### Method 1: Standalone Script (Direct Execution)

Run the pipeline directly from the command line:

```bash
cd F:\Thesis\backend
python text_to_comic_pipeline.py
```

**Features:**
- Executes all 4 steps sequentially
- Saves results to `pipeline_output/` directory
- Generates JSON files for each step
- Creates a consolidated `Final_Manga_Script.md`
- Supports custom story and configuration

**Output Files:**
- `pipeline_output/step1_result.json` - Analysis & Planning
- `pipeline_output/step2_result.json` - Character Designs
- `pipeline_output/step3_result.json` - Panel-by-Panel Script
- `pipeline_output/step4_result.json` - Image Generation Simulation
- `pipeline_output/Final_Manga_Script.md` - Consolidated output

### Method 2: REST API (Integrated with FastAPI)

Start the FastAPI server:

```bash
cd F:\Thesis\backend
uvicorn app.main:app --reload
```

**Endpoints:**

#### 1. Start Comic Generation
```
POST /api/v1/comics/generate
```

**Request Body:**
```json
{
  "story_text": "In a world where ancient magic awakens, a young warrior...",
  "main_characters": 5,
  "num_chapters": 4,
  "target_pages": 100,
  "genre_tone": "Fantasy/Adventure, Epic and inspirational",
  "art_style": "Traditional manga style with detailed backgrounds",
  "max_panels_per_page": 6,
  "generate_markdown": true
}
```

**Response:**
```json
{
  "job_id": "comic_20240330_120000",
  "status": "queued",
  "message": "Comic generation pipeline started",
  "status_url": "/api/v1/comics/status/comic_20240330_120000"
}
```

#### 2. Check Job Status
```
GET /api/v1/comics/status/{job_id}
```

**Response:**
```json
{
  "job_id": "comic_20240330_120000",
  "status": "running",
  "progress": {
    "current_step": 2,
    "total_steps": 4,
    "message": "Step 2: Character Designs..."
  },
  "output_files": null,
  "error_message": null
}
```

**Status Values:**
- `queued` - Job is waiting to start
- `running` - Pipeline is executing
- `completed` - All steps finished successfully
- `failed` - An error occurred

#### 3. Get Results
```
GET /api/v1/comics/results/{job_id}
```

**Response:**
```json
{
  "job_id": "comic_20240330_120000",
  "completed_at": "2024-03-30T12:05:00",
  "results": {
    "step1": { "step": 1, "timestamp": "...", "content": "..." },
    "step2": { "step": 2, "timestamp": "...", "content": "..." },
    "step3": { "step": 3, "timestamp": "...", "content": "..." },
    "step4": { "step": 4, "timestamp": "...", "content": "..." }
  },
  "output_directory": "F:\\Thesis\\backend\\pipeline_output\\comic_20240330_120000"
}
```

#### 4. List All Jobs
```
GET /api/v1/comics/jobs
```

**Response:**
```json
{
  "total_jobs": 3,
  "jobs": [
    {
      "job_id": "comic_20240330_120000",
      "status": "completed",
      "started_at": "2024-03-30T12:00:00",
      "completed_at": "2024-03-30T12:05:00",
      "progress": { ... }
    }
  ]
}
```

### Method 3: Programmatic Integration

Import and use the pipeline in your own Python code:

```python
from text_to_comic_pipeline import TextToComicPipeline

# Initialize pipeline
pipeline = TextToComicPipeline(output_dir="my_comics")

# Define story and configuration
story = "Your story text here..."

config = {
    "main_characters": 5,
    "num_chapters": 4,
    "target_pages": 100,
    "genre_tone": "Fantasy/Adventure",
    "art_style": "Traditional manga",
    "max_panels_per_page": 6,
}

# Run pipeline
result = pipeline.run_full_pipeline(
    story_text=story,
    **config,
    generate_markdown=True
)

print(f"✓ Pipeline complete!")
print(f"Output directory: {result['output_dir']}")
```

## File System Structure

After running the pipeline, the output directory will contain:

```
pipeline_output/
├── step1_result.json          # Analysis & Planning results
├── step2_result.json          # Character Design results
├── step3_result.json          # Panel Script & Prompts results
├── step4_result.json          # Image Generation Simulation results
└── Final_Manga_Script.md      # Consolidated readable output

# For API-triggered runs, results are organized by job:
pipeline_output/
├── comic_20240330_120000/
│   ├── step1_result.json
│   ├── step2_result.json
│   ├── step3_result.json
│   ├── step4_result.json
│   └── Final_Manga_Script.md
├── comic_20240330_120100/
│   ├── step1_result.json
│   └── ...
```

## JSON Result Structure

Each `step{N}_result.json` file follows this structure:

```json
{
  "step": 1,
  "timestamp": "2024-03-30T12:00:00.123456",
  "content": "The actual response text from Gemini API..."
}
```

**Why JSON Storage?**
- Enables **result reuse** for future generation runs
- Allows **integration with image generation tools** (e.g., DALL-E, Midjourney)
- Supports **batch processing** of prompts
- Facilitates **versioning and A/B testing**
- Easy **serialization** and **archival**

## Configuration Reference

### Core Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `story_text` | string | Required | The story to adapt into manga |
| `main_characters` | int | 5 | Number of main characters (1-20) |
| `num_chapters` | int | 4 | Number of chapters to divide story into (1-12) |
| `target_pages` | int | 100 | Target total number of pages (50-500) |
| `genre_tone` | string | "Action/Adventure, Epic tone" | Manga genre and tone preference |
| `art_style` | string | "Japanese manga style, detailed" | Preferred art style |
| `max_panels_per_page` | int | 6 | Max panels per page (1-12) |
| `generate_markdown` | bool | true | Generate final consolidated markdown |

### Example Configurations

**Action/Adventure - Western Comic Style:**
```python
{
    "genre_tone": "Action/Adventure, Fast-paced, Western comic",
    "art_style": "Western comic book style, bold outlines",
    "max_panels_per_page": 4,
    "num_chapters": 3,
    "target_pages": 60
}
```

**Romance - Shoujo Manga Style:**
```python
{
    "genre_tone": "Romance, Emotional, Slice-of-life",
    "art_style": "Shoujo manga style, soft and elegant",
    "max_panels_per_page": 8,
    "num_chapters": 8,
    "target_pages": 150
}
```

**Horror - Dark Manga Style:**
```python
{
    "genre_tone": "Horror, Psychological, Dark thriller",
    "art_style": "Horror manga style, high contrast, detailed horror elements",
    "max_panels_per_page": 5,
    "num_chapters": 5,
    "target_pages": 120
}
```

## Step-by-Step Output Descriptions

### Step 1: Analysis & Planning
Provides:
- Character Breakdown (names, roles, key traits)
- Plot & Arc Analysis (main story arcs, turning points)
- Chapter Division (chapter summaries, page counts)
- Scene-by-Scene Breakdown (all scenes organized)
- Global Manga Layout Rules (consistent panel guidelines)
- Final Statistics Summary (total scenes, key moments)

### Step 2: Character Designs
Provides:
- Global Design Guidelines (art direction, palette)
- Main Character Design Sheets (detailed descriptions with AI image prompts)
- Supporting Character Design Sheets (supporting cast)
- Interaction & Relationship Notes (how characters interact)
- Final Design Summary (design consistency checklist)

### Step 3: Panel-by-Panel Script
Provides:
- Global Scripting Rules (panel numbering, dialogue formatting)
- Chapter-by-Chapter Script with:
  - Page numbers and layouts
  - Panel-by-panel breakdowns
  - Detailed dialogue and SFX
  - AI Image Prompts (ready for image generation tools)
- Special Pages Inventory (title pages, splash pages)
- Final Script Summary (statistics)

### Step 4: Image Generation Simulation
Provides:
- Global Generation Settings (resolution, color palette)
- Batch-by-Batch Image Generation with:
  - ASCII art placeholders
  - Vivid descriptions
  - Generation notes
  - Character consistency markers
- Compilation Options (page assembly)
- Final Generation Summary (statistics and QA checklist)

## Troubleshooting

### Issue: "GEMINI_API_KEY environment variable is not set"
**Solution:** Set the API key using the methods described in the Setup section.

### Issue: Pipeline takes a long time for Step 1
**Solution:** This is normal. Step 1 involves detailed story analysis. Processing time depends on story length and API response time (typically 1-3 minutes per step).

### Issue: Pipeline fails with timeout
**Solution:** Increase Gemini API request timeout by modifying the timeout settings in the pipeline code (if needed).

### Issue: JSON files not being created
**Solution:** 
1. Check that the output directory has write permissions
2. Verify the pipeline completes successfully (check terminal output)
3. Ensure all 4 steps complete before checking files

## API Integration Examples

### Using cURL

**Start a job:**
```bash
curl -X POST "http://localhost:8000/api/v1/comics/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "story_text": "Your story here...",
    "main_characters": 5,
    "num_chapters": 4,
    "target_pages": 100
  }'
```

**Check status:**
```bash
curl "http://localhost:8000/api/v1/comics/status/comic_20240330_120000"
```

**Get results:**
```bash
curl "http://localhost:8000/api/v1/comics/results/comic_20240330_120000"
```

### Using Python requests

```python
import requests

# Start generation
response = requests.post(
    "http://localhost:8000/api/v1/comics/generate",
    json={
        "story_text": "Your story...",
        "main_characters": 5,
        "num_chapters": 4,
        "target_pages": 100
    }
)

job_id = response.json()["job_id"]

# Poll for completion
import time
while True:
    status = requests.get(f"http://localhost:8000/api/v1/comics/status/{job_id}")
    if status.json()["status"] == "completed":
        break
    print(f"Progress: {status.json()['progress']['message']}")
    time.sleep(5)

# Get results
results = requests.get(f"http://localhost:8000/api/v1/comics/results/{job_id}")
print(results.json())
```

## Advanced Usage

### Reusing Previous Results

To reuse results from a previous pipeline run:

```python
from text_to_comic_pipeline import TextToComicPipeline

# Initialize with existing output
pipeline = TextToComicPipeline(output_dir="existing_pipeline_output")

# Load and reuse previous results
step1_content = pipeline.load_step_result(1)
step2_content = pipeline.load_step_result(2)

# Continue from step 3 with new configuration
step3_result = pipeline.step3_panel_script_prompts()
```

### Batch Processing

Process multiple stories in sequence:

```python
stories = [
    "Story 1...",
    "Story 2...",
    "Story 3..."
]

for i, story in enumerate(stories):
    pipeline = TextToComicPipeline(output_dir=f"pipeline_output/batch_{i}")
    pipeline.run_full_pipeline(story_text=story)
```

## Performance Notes

- **Step 1**: 2-5 minutes (story analysis)
- **Step 2**: 3-7 minutes (character design)
- **Step 3**: 5-10 minutes (panel script generation)
- **Step 4**: 3-5 minutes (image generation simulation)
- **Total**: 15-30 minutes for complete pipeline

*Times vary based on story length, API load, and configuration complexity.*

## Next Steps

1. **Standalone Usage:** Run `python text_to_comic_pipeline.py` to test the pipeline
2. **API Integration:** Start the FastAPI server and try the REST endpoints
3. **Image Generation:** Use the image prompts from Step 3 with tools like:
   - DALL-E API
   - Midjourney (via API)
   - Stable Diffusion
   - Local image generation models

4. **Post-Processing:** Import the JSON results into design tools for final adjustments

---

**For questions or issues, check the error messages in the terminal output for detailed diagnostic information.**

