"""
FastAPI integration for Text-to-Comic Generation Pipeline.

This module adds REST API endpoints to the existing FastAPI application
to trigger and monitor the text-to-comic generation pipeline.

Usage:
    Include this router in your FastAPI app:
    app.include_router(text_to_comic.router, prefix="/api/v1")
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import json
import os
from pathlib import Path
from datetime import datetime
import logging

# Import the pipeline
from text_to_comic_pipeline import TextToComicPipeline

router = APIRouter(prefix="/comics", tags=["comic-generation"])
logger = logging.getLogger(__name__)

# Store job status for long-running operations
job_status: Dict[str, Dict[str, Any]] = {}


class ComicGenerationRequest(BaseModel):
    """Request model for comic generation."""

    story_text: str = Field(
        ..., description="The story text to convert to comic", min_length=50
    )
    main_characters: int = Field(default=5, ge=1, le=20, description="Number of main characters")
    num_chapters: int = Field(default=4, ge=1, le=12, description="Number of chapters")
    target_pages: int = Field(default=100, ge=50, le=500, description="Target total pages")
    genre_tone: str = Field(
        default="Action/Adventure, Epic tone", description="Manga genre and tone"
    )
    art_style: str = Field(
        default="Japanese manga style, detailed", description="Preferred art style"
    )
    max_panels_per_page: int = Field(
        default=6, ge=1, le=12, description="Maximum panels per page"
    )
    generate_markdown: bool = Field(
        default=True, description="Generate final consolidated markdown file"
    )


class PipelineStatus(BaseModel):
    """Response model for pipeline status."""

    job_id: str
    status: str  # "queued", "running", "completed", "failed"
    progress: Dict[str, Any]
    output_files: Optional[Dict[str, str]] = None
    error_message: Optional[str] = None


@router.post("/generate", response_model=Dict[str, Any])
async def generate_comic(request: ComicGenerationRequest, background_tasks: BackgroundTasks):
    """
    Start a comic generation pipeline.

    This endpoint initiates the 4-step text-to-comic generation process.
    The pipeline runs in the background and saves results to JSON files.

    Args:
        request: ComicGenerationRequest with story and configuration
        background_tasks: FastAPI background tasks

    Returns:
        Job information with ID and status URL

    Example:
        POST /api/v1/comics/generate
        {
            "story_text": "Once upon a time...",
            "main_characters": 5,
            "num_chapters": 4,
            "target_pages": 100,
            "genre_tone": "Fantasy/Adventure",
            "art_style": "Traditional manga",
            "max_panels_per_page": 6
        }
    """
    try:
        # Generate unique job ID
        job_id = f"comic_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        # Initialize job status
        job_status[job_id] = {
            "status": "queued",
            "started_at": datetime.now().isoformat(),
            "progress": {
                "current_step": 0,
                "total_steps": 4,
                "message": "Job queued",
            },
            "output_files": None,
            "error_message": None,
        }

        # Add background task
        background_tasks.add_task(
            _execute_pipeline,
            job_id,
            request,
        )

        return {
            "job_id": job_id,
            "status": "queued",
            "message": "Comic generation pipeline started",
            "status_url": f"/api/v1/comics/status/{job_id}",
        }

    except Exception as e:
        logger.error(f"Error starting comic generation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{job_id}", response_model=PipelineStatus)
async def get_pipeline_status(job_id: str):
    """
    Get the status of a comic generation pipeline.

    Args:
        job_id: The job ID returned from generate endpoint

    Returns:
        Current status and progress of the pipeline

    Example:
        GET /api/v1/comics/status/comic_20240330_120000
    """
    if job_id not in job_status:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    status_data = job_status[job_id]
    return PipelineStatus(
        job_id=job_id,
        status=status_data["status"],
        progress=status_data["progress"],
        output_files=status_data.get("output_files"),
        error_message=status_data.get("error_message"),
    )


@router.get("/results/{job_id}")
async def get_pipeline_results(job_id: str):
    """
    Get the complete results from a finished pipeline.

    Args:
        job_id: The job ID

    Returns:
        Dictionary containing all step results

    Example:
        GET /api/v1/comics/results/comic_20240330_120000
    """
    if job_id not in job_status:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    status_data = job_status[job_id]

    if status_data["status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Job is still {status_data['status']}. Cannot retrieve results.",
        )

    # Load all step results
    output_dir = Path("pipeline_output") / job_id
    results = {}

    try:
        for step in range(1, 5):
            filename = output_dir / f"step{step}_result.json"
            if filename.exists():
                with open(filename, "r", encoding="utf-8") as f:
                    results[f"step{step}"] = json.load(f)
    except Exception as e:
        logger.error(f"Error loading results: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error loading results: {str(e)}")

    return {
        "job_id": job_id,
        "completed_at": status_data.get("completed_at"),
        "results": results,
        "output_directory": str(output_dir.absolute()),
    }


@router.get("/jobs")
async def list_jobs():
    """
    List all comic generation jobs.

    Returns:
        List of all jobs with their status
    """
    jobs = []
    for job_id, status_data in job_status.items():
        jobs.append(
            {
                "job_id": job_id,
                "status": status_data["status"],
                "started_at": status_data.get("started_at"),
                "completed_at": status_data.get("completed_at"),
                "progress": status_data["progress"],
            }
        )
    return {"total_jobs": len(jobs), "jobs": jobs}


# Helper function to execute pipeline in background
def _execute_pipeline(job_id: str, request: ComicGenerationRequest):
    """
    Execute the pipeline in background task.

    Args:
        job_id: Unique job identifier
        request: Comic generation request
    """
    try:
        # Create job-specific output directory
        output_dir = Path("pipeline_output") / job_id
        output_dir.mkdir(parents=True, exist_ok=True)

        # Update status
        job_status[job_id]["status"] = "running"
        job_status[job_id]["progress"]["message"] = "Initializing pipeline..."

        # Initialize pipeline
        pipeline = TextToComicPipeline(output_dir=str(output_dir))

        # Step 1
        job_status[job_id]["progress"]["current_step"] = 1
        job_status[job_id]["progress"]["message"] = "Step 1: Analysis & Planning..."
        pipeline.step1_analysis_planning(
            story_text=request.story_text,
            main_characters=request.main_characters,
            num_chapters=request.num_chapters,
            target_pages=request.target_pages,
            genre_tone=request.genre_tone,
            art_style=request.art_style,
            max_panels_per_page=request.max_panels_per_page,
        )

        # Step 2
        job_status[job_id]["progress"]["current_step"] = 2
        job_status[job_id]["progress"]["message"] = "Step 2: Character Designs..."
        pipeline.step2_character_designs()

        # Step 3
        job_status[job_id]["progress"]["current_step"] = 3
        job_status[job_id]["progress"]["message"] = "Step 3: Panel-by-Panel Script..."
        pipeline.step3_panel_script_prompts()

        # Step 4
        job_status[job_id]["progress"]["current_step"] = 4
        job_status[job_id]["progress"]["message"] = "Step 4: Image Generation Simulation..."
        pipeline.step4_image_generation_simulation()

        # Generate markdown
        if request.generate_markdown:
            job_status[job_id]["progress"]["message"] = "Generating final markdown..."
            pipeline.generate_final_markdown()

        # Update completion status
        job_status[job_id]["status"] = "completed"
        job_status[job_id]["completed_at"] = datetime.now().isoformat()
        job_status[job_id]["progress"]["current_step"] = 4
        job_status[job_id]["progress"]["message"] = "Pipeline completed successfully!"
        job_status[job_id]["output_files"] = {
            "step1": str(output_dir / "step1_result.json"),
            "step2": str(output_dir / "step2_result.json"),
            "step3": str(output_dir / "step3_result.json"),
            "step4": str(output_dir / "step4_result.json"),
            "final_markdown": str(output_dir / "Final_Manga_Script.md") if request.generate_markdown else None,
        }

        logger.info(f"Pipeline {job_id} completed successfully")

    except Exception as e:
        job_status[job_id]["status"] = "failed"
        job_status[job_id]["error_message"] = str(e)
        job_status[job_id]["completed_at"] = datetime.now().isoformat()
        logger.error(f"Pipeline {job_id} failed: {str(e)}")

