#!/usr/bin/env python3
"""
Test script to verify Gemini API integration is working correctly.
Run this after starting the backend server.

Usage:
    python test_gemini_integration.py

Requirements:
    - Backend running on http://localhost:8000
    - Gemini API key configured
"""

import sys
import httpx
import json
from typing import Optional

# Configuration
BASE_URL = "http://localhost:8000/api"
TIMEOUT = 30

# Color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_header(text: str):
    """Print section header."""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}")
    print(f"{text:^60}")
    print(f"{'='*60}{Colors.ENDC}\n")

def print_success(text: str):
    """Print success message."""
    print(f"{Colors.OKGREEN}✓ {text}{Colors.ENDC}")

def print_error(text: str):
    """Print error message."""
    print(f"{Colors.FAIL}✗ {text}{Colors.ENDC}")

def print_info(text: str):
    """Print info message."""
    print(f"{Colors.OKCYAN}ℹ {text}{Colors.ENDC}")

def print_warning(text: str):
    """Print warning message."""
    print(f"{Colors.WARNING}⚠ {text}{Colors.ENDC}")

async def test_connection() -> bool:
    """Test basic connection to backend."""
    print_header("Testing Backend Connection")

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.get(f"{BASE_URL}/../health")
            if response.status_code == 200:
                print_success(f"Backend is running on {BASE_URL}")
                return True
            else:
                print_error(f"Backend returned status code {response.status_code}")
                return False
    except httpx.ConnectError:
        print_error(f"Cannot connect to backend at {BASE_URL}")
        print_info("Make sure backend is running: python -m app.main")
        return False
    except Exception as e:
        print_error(f"Connection failed: {str(e)}")
        return False

async def test_gemini_health() -> bool:
    """Test Gemini health endpoint."""
    print_header("Testing Gemini API Configuration")

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.get(f"{BASE_URL}/text-gen/health")

            if response.status_code == 200:
                data = response.json()
                status = data.get("status")

                if status == "configured":
                    print_success("Gemini API is configured ✓")
                    print_info(f"Status: {data}")
                    return True
                else:
                    print_error("Gemini API is not configured")
                    print_warning("Make sure GEMINI_API_KEY is set in backend/.env")
                    print_info(f"Status: {data}")
                    return False
            else:
                print_error(f"Health check returned status {response.status_code}")
                return False

    except Exception as e:
        print_error(f"Health check failed: {str(e)}")
        return False

async def test_generate_text(prompt: str = "Hello, write a short greeting") -> bool:
    """Test text generation endpoint."""
    print_header("Testing Text Generation Endpoint")

    print_info(f"Prompt: {prompt}")

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            payload = {"prompt": prompt}
            response = await client.post(
                f"{BASE_URL}/text-gen/generate-text",
                json=payload,
                timeout=60  # Longer timeout for AI generation
            )

            if response.status_code == 200:
                data = response.json()
                generated = data.get("generated_text", "")

                if generated:
                    print_success("Text generated successfully")
                    print(f"\n{Colors.OKBLUE}Generated text:{Colors.ENDC}")
                    print(f"{generated[:200]}...")  # Show first 200 chars
                    return True
                else:
                    print_error("No text was generated")
                    return False
            else:
                print_error(f"Request returned status {response.status_code}")
                print(f"Response: {response.text}")
                return False

    except httpx.TimeoutException:
        print_warning("Request timed out (API taking too long)")
        print_info("This might happen with slow internet or large requests")
        return False
    except Exception as e:
        print_error(f"Text generation failed: {str(e)}")
        return False

async def test_analyze_story(story: str = "A hero went on a quest.") -> bool:
    """Test story analysis endpoint."""
    print_header("Testing Story Analysis Endpoint")

    print_info(f"Story: {story}")

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            payload = {
                "story_text": story,
                "num_chapters": 3
            }
            response = await client.post(
                f"{BASE_URL}/text-gen/analyze-story",
                json=payload,
                timeout=60
            )

            if response.status_code == 200:
                data = response.json()
                analysis = data.get("analysis", "")

                if analysis:
                    print_success("Story analyzed successfully")
                    print(f"\n{Colors.OKBLUE}Analysis:{Colors.ENDC}")
                    print(f"{analysis[:200]}...")
                    return True
                else:
                    print_error("No analysis was generated")
                    return False
            else:
                print_error(f"Request returned status {response.status_code}")
                print(f"Response: {response.text}")
                return False

    except httpx.TimeoutException:
        print_warning("Request timed out (API taking too long)")
        return False
    except Exception as e:
        print_error(f"Story analysis failed: {str(e)}")
        return False

async def test_character_prompt(character: str = "A brave knight with blue armor") -> bool:
    """Test character prompt generation."""
    print_header("Testing Character Prompt Endpoint")

    print_info(f"Character: {character}")

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            payload = {"character_description": character}
            response = await client.post(
                f"{BASE_URL}/text-gen/character-prompt",
                json=payload,
                timeout=60
            )

            if response.status_code == 200:
                data = response.json()
                prompt = data.get("image_prompt", "")

                if prompt:
                    print_success("Character prompt generated successfully")
                    print(f"\n{Colors.OKBLUE}Image prompt:{Colors.ENDC}")
                    print(f"{prompt[:200]}...")
                    return True
                else:
                    print_error("No prompt was generated")
                    return False
            else:
                print_error(f"Request returned status {response.status_code}")
                return False

    except httpx.TimeoutException:
        print_warning("Request timed out")
        return False
    except Exception as e:
        print_error(f"Character prompt generation failed: {str(e)}")
        return False

async def run_all_tests():
    """Run all tests."""
    print(f"\n{Colors.BOLD}{Colors.HEADER}")
    print("╔" + "═"*58 + "╗")
    print("║" + "GEMINI API INTEGRATION TEST SUITE".center(58) + "║")
    print("╚" + "═"*58 + "╝")
    print(f"{Colors.ENDC}\n")

    results = []

    # Test 1: Connection
    connection_ok = await test_connection()
    results.append(("Backend Connection", connection_ok))

    if not connection_ok:
        print_error("Cannot proceed without backend connection")
        return results

    # Test 2: Gemini Health
    gemini_ok = await test_gemini_health()
    results.append(("Gemini Configuration", gemini_ok))

    if not gemini_ok:
        print_warning("Gemini API is not configured, skipping endpoint tests")
        return results

    # Test 3-5: Endpoints
    results.append(("Text Generation", await test_generate_text()))
    results.append(("Story Analysis", await test_analyze_story()))
    results.append(("Character Prompt", await test_character_prompt()))

    return results

async def print_summary(results: list):
    """Print test summary."""
    print_header("Test Summary")

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        if result:
            print_success(f"{test_name}")
        else:
            print_error(f"{test_name}")

    print()
    if passed == total:
        print_success(f"All {total} tests passed! ✓")
        print(f"\n{Colors.OKGREEN}{Colors.BOLD}Gemini API Integration is working perfectly!{Colors.ENDC}\n")
        return 0
    else:
        print_error(f"{passed}/{total} tests passed")
        print(f"\n{Colors.WARNING}Please check the errors above.{Colors.ENDC}\n")
        return 1

async def main():
    """Main entry point."""
    try:
        results = await run_all_tests()
        exit_code = await print_summary(results)
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print_warning("\n\nTests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print_error(f"Unexpected error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())

