"""
Test script for Text-to-Comic Generation Pipeline.

This script validates:
1. Environment setup (API key availability)
2. Pipeline initialization
3. Individual step execution
4. JSON file generation
5. FastAPI integration

Usage:
    python test_text_to_comic_pipeline.py
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime


def test_environment():
    """Test if GEMINI_API_KEY is set."""
    print("\n" + "=" * 70)
    print("TEST 1: Environment Setup")
    print("=" * 70)

    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        print("✓ GEMINI_API_KEY is set")
        print(f"  Key starts with: {api_key[:10]}...")
        return True
    else:
        print("✗ GEMINI_API_KEY is NOT set")
        print("\n  To set it:")
        print("    Windows PowerShell: $env:GEMINI_API_KEY = 'your-key'")
        print("    Windows CMD: set GEMINI_API_KEY=your-key")
        print("    Linux/Mac: export GEMINI_API_KEY=your-key")
        return False


def test_imports():
    """Test if required modules can be imported."""
    print("\n" + "=" * 70)
    print("TEST 2: Import Dependencies")
    print("=" * 70)

    required_modules = [
        ("fastapi", "FastAPI"),
        ("google.generativeai", "Google Generative AI"),
        ("pydantic", "Pydantic"),
    ]

    all_ok = True
    for module_name, display_name in required_modules:
        try:
            __import__(module_name)
            print(f"✓ {display_name} ({module_name})")
        except ImportError:
            print(f"✗ {display_name} ({module_name}) - NOT INSTALLED")
            all_ok = False

    if not all_ok:
        print("\n  Install missing dependencies:")
        print("    pip install -r requirements.txt")

    return all_ok


def test_pipeline_initialization():
    """Test if pipeline can be initialized."""
    print("\n" + "=" * 70)
    print("TEST 3: Pipeline Initialization")
    print("=" * 70)

    try:
        from text_to_comic_pipeline import TextToComicPipeline

        pipeline = TextToComicPipeline(output_dir="test_pipeline_output")
        print("✓ Pipeline initialized successfully")
        print(f"  Output directory: {pipeline.output_dir.absolute()}")
        return True

    except Exception as e:
        print(f"✗ Pipeline initialization failed: {str(e)}")
        return False


def test_file_system():
    """Test file system operations."""
    print("\n" + "=" * 70)
    print("TEST 4: File System Operations")
    print("=" * 70)

    test_dir = Path("test_pipeline_output")
    test_dir.mkdir(exist_ok=True)

    # Test JSON write
    test_file = test_dir / "test_write.json"
    test_data = {
        "test": True,
        "timestamp": datetime.now().isoformat(),
        "message": "Test file write successful",
    }

    try:
        with open(test_file, "w", encoding="utf-8") as f:
            json.dump(test_data, f, indent=2)
        print(f"✓ JSON file write successful")
        print(f"  File: {test_file.absolute()}")

        # Test JSON read
        with open(test_file, "r", encoding="utf-8") as f:
            loaded_data = json.load(f)
        print(f"✓ JSON file read successful")

        # Cleanup
        test_file.unlink()
        return True

    except Exception as e:
        print(f"✗ File system test failed: {str(e)}")
        return False


def test_router_import():
    """Test if the FastAPI router can be imported."""
    print("\n" + "=" * 70)
    print("TEST 5: FastAPI Router Integration")
    print("=" * 70)

    try:
        # This might fail if the router has import issues
        from app.routers.text_to_comic import router
        print("✓ FastAPI router imported successfully")
        print(f"  Router prefix: /comics")
        print(f"  Router tags: ['comic-generation']")
        return True

    except Exception as e:
        print(f"✗ Router import failed: {str(e)}")
        print("\n  This might be a circular import issue. You can still run the")
        print("  standalone pipeline directly with: python text_to_comic_pipeline.py")
        return False


def test_pipeline_methods():
    """Test if all pipeline methods exist."""
    print("\n" + "=" * 70)
    print("TEST 6: Pipeline Methods")
    print("=" * 70)

    try:
        from text_to_comic_pipeline import TextToComicPipeline

        required_methods = [
            "call_gemini_api",
            "save_json_result",
            "load_step_result",
            "step1_analysis_planning",
            "step2_character_designs",
            "step3_panel_script_prompts",
            "step4_image_generation_simulation",
            "generate_final_markdown",
            "run_full_pipeline",
        ]

        pipeline = TextToComicPipeline(output_dir="test_pipeline_output")

        all_ok = True
        for method_name in required_methods:
            if hasattr(pipeline, method_name):
                print(f"✓ Method: {method_name}")
            else:
                print(f"✗ Method: {method_name} - NOT FOUND")
                all_ok = False

        return all_ok

    except Exception as e:
        print(f"✗ Method check failed: {str(e)}")
        return False


def run_quick_pipeline_test():
    """Run a quick pipeline test with a short story."""
    print("\n" + "=" * 70)
    print("TEST 7: Quick Pipeline Execution (Optional)")
    print("=" * 70)

    try:
        response = input("\nRun full pipeline test? (This will take ~20 minutes) [y/N]: ")
        if response.lower() != "y":
            print("Skipped")
            return None

        from text_to_comic_pipeline import TextToComicPipeline

        # Use a very short story for quick testing
        short_story = """
        A young hero discovers a magical artifact and must save the kingdom.
        """

        print("\nStarting test pipeline with short story...")
        print("This will take approximately 15-30 minutes...\n")

        pipeline = TextToComicPipeline(output_dir="test_pipeline_output")

        result = pipeline.run_full_pipeline(
            story_text=short_story,
            main_characters=3,
            num_chapters=2,
            target_pages=20,
            genre_tone="Fantasy/Adventure",
            art_style="Manga",
            max_panels_per_page=4,
            generate_markdown=True,
        )

        print("\n✓ Pipeline test completed successfully")
        print(f"Output directory: {result['output_dir']}")

        # Verify output files
        print("\nVerifying output files:")
        for step, filepath in result["files"].items():
            path = Path(filepath)
            if path.exists():
                size = path.stat().st_size
                print(f"  ✓ {step}: {path.name} ({size} bytes)")
            else:
                print(f"  ✗ {step}: {path.name} - NOT FOUND")

        return True

    except Exception as e:
        print(f"✗ Pipeline test failed: {str(e)}")
        return False


def print_summary(results):
    """Print test summary."""
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)

    tests = [
        ("Environment Setup", results.get("env")),
        ("Import Dependencies", results.get("imports")),
        ("Pipeline Initialization", results.get("pipeline")),
        ("File System Operations", results.get("filesystem")),
        ("FastAPI Router", results.get("router")),
        ("Pipeline Methods", results.get("methods")),
    ]

    passed = 0
    failed = 0

    for test_name, result in tests:
        if result is True:
            print(f"✓ {test_name}")
            passed += 1
        elif result is False:
            print(f"✗ {test_name}")
            failed += 1
        else:
            print(f"⊘ {test_name} (skipped)")

    print(f"\nPassed: {passed}/{len(tests)}")

    if failed == 0 and passed == len(tests):
        print("\n✨ All tests passed! Pipeline is ready to use.")
        print("\nNext steps:")
        print("  1. Standalone: python text_to_comic_pipeline.py")
        print("  2. API: uvicorn app.main:app --reload")
        print("  3. Read: TEXT_TO_COMIC_SETUP_GUIDE.md")
    elif failed > 0:
        print(f"\n❌ {failed} test(s) failed. Please review the errors above.")


def main():
    """Run all tests."""
    print("\n" + "🚀 " * 20)
    print("TEXT-TO-COMIC PIPELINE - SYSTEM TEST")
    print("🚀 " * 20)

    results = {}

    # Run tests
    results["env"] = test_environment()
    results["imports"] = test_imports()
    results["pipeline"] = test_pipeline_initialization()
    results["filesystem"] = test_file_system()
    results["router"] = test_router_import()
    results["methods"] = test_pipeline_methods()

    # Optional: Run pipeline test
    results["pipeline_test"] = run_quick_pipeline_test()

    # Print summary
    print_summary(results)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Tests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Unexpected error: {str(e)}")
        sys.exit(1)

