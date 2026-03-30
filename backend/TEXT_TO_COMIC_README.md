# 🚀 Text-to-Comic Generation Pipeline

A production-ready, 4-step sequential pipeline that transforms story text into a complete manga/comic generation blueprint using Google's Gemini API.

## 📋 What This Does

This pipeline takes a story and produces:
- ✓ **Step 1:** Story analysis, character breakdown, chapter division plan
- ✓ **Step 2:** Detailed character design sheets with AI image prompts
- ✓ **Step 3:** Complete panel-by-panel manga script with image prompts for each panel
- ✓ **Step 4:** Image generation simulation with ASCII placeholders and descriptions

Each step's output is saved as JSON and injected into the next step for seamless context flow.

## 🎯 Quick Start (< 5 minutes)

### 1. Set API Key
```powershell
$env:GEMINI_API_KEY = "your-google-gemini-api-key"
```

### 2. Run Pipeline
```bash
cd F:\Thesis\backend
python text_to_comic_pipeline.py
```

### 3. Check Results
Results are saved in `pipeline_output/` directory

## 📁 Project Structure

```
backend/
├── text_to_comic_pipeline.py          # Main pipeline script
├── app/
│   ├── routers/
│   │   ├── text_to_comic.py          # FastAPI endpoints
│   │   ├── gemini.py                 # Existing Gemini routes
│   │   └── items.py                  # Existing items routes
│   ├── main.py                        # Updated with new router
│   ├── config.py                      # Configuration
│   ├── services.py                    # Gemini service
│   └── ...
├── TEXT_TO_COMIC_SETUP_GUIDE.md       # Complete documentation
├── TEXT_TO_COMIC_QUICK_REFERENCE.md   # Quick reference
├── start-pipeline.ps1                 # PowerShell launcher
├── test_text_to_comic_pipeline.py     # Test suite
└── pipeline_output/                   # Generated outputs (auto-created)
    ├── step1_result.json
    ├── step2_result.json
    ├── step3_result.json
    ├── step4_result.json
    └── Final_Manga_Script.md
```

## 🚀 Three Ways to Use

### **Method 1: Standalone Script** (Simplest)
```bash
python text_to_comic_pipeline.py
```
- Executes complete 4-step pipeline
- Uses built-in example story
- Saves to `pipeline_output/`
- Takes ~20-30 minutes

### **Method 2: REST API** (Recommended)
```bash
# Terminal 1: Start server
uvicorn app.main:app --reload

# Terminal 2: Send request
curl -X POST http://localhost:8000/api/v1/comics/generate \
  -H "Content-Type: application/json" \
  -d '{
    "story_text": "Your story text here...",
    "main_characters": 5,
    "num_chapters": 4,
    "target_pages": 100
  }'
```

**API Endpoints:**
- `POST /api/v1/comics/generate` - Start comic generation
- `GET /api/v1/comics/status/{job_id}` - Check job status
- `GET /api/v1/comics/results/{job_id}` - Get results
- `GET /api/v1/comics/jobs` - List all jobs

### **Method 3: Python Integration** (For automation)
```python
from text_to_comic_pipeline import TextToComicPipeline

pipeline = TextToComicPipeline()
result = pipeline.run_full_pipeline(
    story_text="Your story...",
    main_characters=5,
    num_chapters=4,
    target_pages=100
)
```

## 📊 Output Files

| File | Purpose | Size |
|------|---------|------|
| `step1_result.json` | Analysis & Planning | ~50-100 KB |
| `step2_result.json` | Character Designs | ~100-200 KB |
| `step3_result.json` | Panel Script & Prompts | ~300-500 KB |
| `step4_result.json` | Image Generation Simulation | ~200-400 KB |
| `Final_Manga_Script.md` | Consolidated readable output | ~1-2 MB |

**Each JSON file contains:**
```json
{
  "step": 1,
  "timestamp": "2024-03-30T12:00:00",
  "content": "Full response from Gemini API..."
}
```

## 🔧 Installation

### Prerequisites
- Python 3.8+
- Google Gemini API key
- FastAPI and dependencies

### Setup
```bash
# Install dependencies
pip install -r requirements.txt

# Set API key (Windows PowerShell)
$env:GEMINI_API_KEY = "your-key-here"

# Or create .env file
echo "GEMINI_API_KEY=your-key-here" > .env
```

## 📖 Configuration Options

### Standard Configuration
```python
pipeline.run_full_pipeline(
    story_text="Your story...",
    main_characters=5,          # 1-20
    num_chapters=4,             # 1-12
    target_pages=100,           # 50-500
    genre_tone="Fantasy/Adventure",
    art_style="Traditional manga",
    max_panels_per_page=6,      # 1-12
    generate_markdown=True      # Create final MD file
)
```

### Genre Presets

**Action/Adventure:**
```python
{
    "genre_tone": "Action/Adventure, Fast-paced",
    "art_style": "Dynamic action manga",
    "max_panels_per_page": 7
}
```

**Romance:**
```python
{
    "genre_tone": "Romance, Emotional",
    "art_style": "Shoujo manga, soft lines",
    "max_panels_per_page": 8
}
```

**Horror:**
```python
{
    "genre_tone": "Horror, Dark thriller",
    "art_style": "High contrast horror manga",
    "max_panels_per_page": 5
}
```

## ⏱️ Performance

| Step | Time | Activity |
|------|------|----------|
| 1 | 2-5 min | Story analysis & planning |
| 2 | 3-7 min | Character design creation |
| 3 | 5-10 min | Panel script & prompts |
| 4 | 3-5 min | Image generation simulation |
| **Total** | **15-30 min** | Complete pipeline |

## ✅ Verification

Run the test suite to verify installation:
```bash
python test_text_to_comic_pipeline.py
```

Tests check:
- ✓ API key availability
- ✓ Dependency imports
- ✓ Pipeline initialization
- ✓ File system operations
- ✓ FastAPI router integration
- ✓ Method availability

## 📚 Documentation

### Quick Reference (5 min read)
See `TEXT_TO_COMIC_QUICK_REFERENCE.md` for:
- Quick start examples
- Common configurations
- Troubleshooting tips
- Pro tips

### Complete Guide (30 min read)
See `TEXT_TO_COMIC_SETUP_GUIDE.md` for:
- Detailed API documentation
- Advanced usage patterns
- Batch processing
- Integration examples
- Performance optimization

## 🎨 Prompt Templates

### Step 1: Analysis & Planning
Analyzes story structure and creates a detailed plan including:
- Character Breakdown
- Plot & Arc Analysis
- Chapter Division
- Scene-by-Scene Breakdown
- Global Manga Layout Rules
- Statistics Summary

### Step 2: Character Designs
Creates detailed character design sheets based on Step 1:
- Global Design Guidelines
- Main Character Design Sheets (with AI Image Prompts)
- Supporting Character Design Sheets
- Interaction & Relationship Notes
- Design Summary

### Step 3: Panel-by-Panel Script
Generates complete manga script using Steps 1 & 2:
- Global Scripting Rules
- Chapter-by-Chapter Script (with panel layouts and AI Image Prompts)
- Special Pages Inventory
- Script Summary

### Step 4: Image Generation Simulation
Processes image prompts and creates simulation:
- Global Generation Settings
- Batch-by-Batch Image Generation (with ASCII art)
- Compilation Options
- Generation Summary

## 🔄 Data Flow

```
User Input
    ↓
Step 1: Analysis & Planning
    → save to step1_result.json
    ↓
Step 2: Character Designs (+ inject step1_result.json)
    → save to step2_result.json
    ↓
Step 3: Panel Script (+ inject step1,2 results)
    → save to step3_result.json
    ↓
Step 4: Image Simulation (+ inject step1,2,3 results)
    → save to step4_result.json
    ↓
Generate Final_Manga_Script.md
    ↓
✓ Complete!
```

## 🚨 Troubleshooting

| Issue | Solution |
|-------|----------|
| "GEMINI_API_KEY not set" | `$env:GEMINI_API_KEY = "your-key"` |
| Import errors | `pip install -r requirements.txt` |
| Port 8000 in use | Use different port: `--port 8001` |
| Slow execution | Normal - API calls take time (1-3 min each) |
| JSON files not created | Check directory permissions |
| Router import fails | Can still run standalone pipeline |

## 💡 Pro Tips

1. **Reuse Results** - JSON files can be used for multiple generations
2. **Batch Processing** - Generate multiple comics sequentially
3. **Archive** - Keep JSON files for version control
4. **Customize** - Use configuration presets for quick setups
5. **Monitor** - Use API status endpoint to track progress
6. **Integrate** - Use JSON output with image generation tools (DALL-E, Midjourney, Stable Diffusion)

## 🔌 Integration with Image Generation Tools

The image prompts from Step 3 can be used with:
- **DALL-E API** - OpenAI's image generation
- **Midjourney** - Advanced AI art generation
- **Stable Diffusion** - Open-source image generation
- **Local Models** - RunwayML, ComfyUI, etc.

Example workflow:
```
1. Generate pipeline outputs
2. Extract image prompts from step3_result.json
3. Send prompts to image generation tool
4. Assemble images into final manga
```

## 📝 Sample Story

The pipeline includes a sample fantasy story:
```
In a world where ancient magic awakens, a young warrior 
discovers they are the last descendant of a forgotten 
royal lineage. Tasked with saving the realm from an 
encroaching darkness, they must rally unlikely allies 
and uncover the secrets of their past...
```

Replace with your own story for custom comics!

## 🎯 Use Cases

- **Educational**: Learn about manga/comic structure
- **Creative**: Generate story guides and character designs
- **Commercial**: Create content for graphic novels
- **Marketing**: Generate promotional comics
- **Entertainment**: Adapt stories into visual format

## 📞 Support

For issues or questions:
1. Check `TEXT_TO_COMIC_QUICK_REFERENCE.md` for common solutions
2. Review `TEXT_TO_COMIC_SETUP_GUIDE.md` for detailed docs
3. Run `test_text_to_comic_pipeline.py` to diagnose issues
4. Check terminal output for specific error messages

## 📜 License & Attribution

This pipeline uses:
- **Google Generative AI (Gemini)** - API calls for content generation
- **FastAPI** - REST API framework
- **Pydantic** - Data validation
- **Python 3.8+** - Runtime environment

## 🌟 Features

✅ Production-ready code  
✅ Complete documentation  
✅ Test suite included  
✅ Multiple usage methods  
✅ REST API integration  
✅ JSON result storage  
✅ Error handling  
✅ Progress tracking  
✅ Configuration presets  
✅ Batch processing support  

## 🚀 Next Steps

1. **Quick Test**: `python test_text_to_comic_pipeline.py`
2. **First Run**: `python text_to_comic_pipeline.py`
3. **REST API**: `uvicorn app.main:app --reload`
4. **Read Docs**: Open `TEXT_TO_COMIC_SETUP_GUIDE.md`
5. **Customize**: Modify story and configuration
6. **Integrate**: Use JSON outputs with image generation

---

**Created:** March 30, 2024  
**Version:** 1.0  
**Status:** Production Ready ✓

**For complete setup and usage instructions, see:**
- `TEXT_TO_COMIC_QUICK_REFERENCE.md` - Quick start
- `TEXT_TO_COMIC_SETUP_GUIDE.md` - Complete documentation

