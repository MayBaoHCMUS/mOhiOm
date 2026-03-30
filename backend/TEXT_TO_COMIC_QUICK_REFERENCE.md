# Text-to-Comic Pipeline - Quick Reference

## ⚡ Quick Start (5 minutes)

### 1. Set your API Key
```powershell
$env:GEMINI_API_KEY = "your-google-gemini-api-key"
```

### 2. Run the Pipeline
```bash
cd F:\Thesis\backend
python text_to_comic_pipeline.py
```

### 3. Check Results
```bash
# Output files created in:
# F:\Thesis\backend\pipeline_output\
```

---

## 🎯 Three Ways to Use

### **Option A: Standalone Script** (Simplest)
```bash
python text_to_comic_pipeline.py
```
- Runs with built-in example story
- Saves to `pipeline_output/`
- Takes ~20-30 minutes

### **Option B: REST API** (Recommended for integration)
```bash
# Terminal 1: Start server
uvicorn app.main:app --reload

# Terminal 2: Send request
curl -X POST http://localhost:8000/api/v1/comics/generate \
  -H "Content-Type: application/json" \
  -d '{"story_text": "Your story...", "main_characters": 5}'

# Check status
curl http://localhost:8000/api/v1/comics/status/comic_20240330_120000

# Get results
curl http://localhost:8000/api/v1/comics/results/comic_20240330_120000
```

### **Option C: Python Code** (For automation)
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

---

## 📁 Output Files Explained

| File | Contents |
|------|----------|
| `step1_result.json` | Story analysis, characters, chapter division |
| `step2_result.json` | Character designs with AI image prompts |
| `step3_result.json` | Complete manga script with panel descriptions |
| `step4_result.json` | Image generation simulation with ASCII art |
| `Final_Manga_Script.md` | All 4 steps combined in one readable file |

Each JSON file has this structure:
```json
{
  "step": 1,
  "timestamp": "2024-03-30T12:00:00",
  "content": "Actual response from Gemini API..."
}
```

**Why save as JSON?**
- Reuse results for future runs
- Integrate with image generation tools
- Batch process multiple stories
- Version control and archiving

---

## 🔧 Configuration Presets

### Short Comic (Quick)
```python
{
    "num_chapters": 2,
    "target_pages": 30,
    "max_panels_per_page": 4
}
```
**Time: ~10 minutes**

### Standard Comic (Recommended)
```python
{
    "num_chapters": 4,
    "target_pages": 100,
    "max_panels_per_page": 6
}
```
**Time: ~20-30 minutes**

### Full Manga (Comprehensive)
```python
{
    "num_chapters": 10,
    "target_pages": 200,
    "max_panels_per_page": 8
}
```
**Time: ~45-60 minutes**

---

## 🎨 Genre Presets

### Action/Adventure
```python
genre_tone="Action/Adventure, Fast-paced, Dynamic"
art_style="Action manga, bold strokes, dramatic angles"
max_panels_per_page=7
```

### Romance
```python
genre_tone="Romance, Emotional, Intimate"
art_style="Shoujo manga, soft lines, emotional expressions"
max_panels_per_page=8
```

### Horror
```python
genre_tone="Horror, Psychological thriller, Dark"
art_style="Horror manga, high contrast, unsettling atmosphere"
max_panels_per_page=5
```

### Comedy
```python
genre_tone="Comedy, Light-hearted, Fun"
art_style="Comedy manga, exaggerated expressions, chibi styles"
max_panels_per_page=9
```

---

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| "API key not set" | `$env:GEMINI_API_KEY = "your-key"` |
| Import error | `pip install -r requirements.txt` |
| Slow processing | Normal - each step takes 2-10 minutes |
| Server won't start | Check if port 8000 is in use |
| JSON files not created | Check output directory permissions |

---

## 📊 Pipeline Steps Breakdown

```
┌─────────────────────────────────────────┐
│ Step 1: Analysis & Planning (2-5 min)   │
│ • Analyze story structure                │
│ • Identify key characters               │
│ • Plan chapter division                 │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│ Step 2: Character Designs (3-7 min)     │
│ • Create character design sheets        │
│ • Generate AI image prompts             │
│ • Plan visual style                     │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│ Step 3: Panel Scripts (5-10 min)        │
│ • Write complete manga script           │
│ • Create panel-by-panel breakdown       │
│ • Generate detailed image prompts       │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│ Step 4: Image Simulation (3-5 min)      │
│ • Process image generation prompts      │
│ • Create ASCII placeholders             │
│ • Generate final manifest               │
└─────────────────────────────────────────┘
```

---

## 🚀 API Endpoints

```
POST   /api/v1/comics/generate       - Start new comic generation
GET    /api/v1/comics/status/{id}    - Check job status
GET    /api/v1/comics/results/{id}   - Get completed results
GET    /api/v1/comics/jobs           - List all jobs
```

---

## 💡 Pro Tips

1. **Save API responses** - JSON files let you reuse results
2. **Use presets** - Genre presets save configuration time
3. **Monitor progress** - Check API status endpoint to track progress
4. **Batch process** - Generate multiple comics sequentially
5. **Archive results** - Keep JSON files for future reference

---

## 📚 Full Documentation

See `TEXT_TO_COMIC_SETUP_GUIDE.md` for complete documentation including:
- Detailed API endpoint documentation
- Advanced usage patterns
- Performance optimization
- Integration examples
- Batch processing guides

---

## ✅ Verification Checklist

- [ ] API key is set (`GEMINI_API_KEY`)
- [ ] Dependencies installed (`pip install -r requirements.txt`)
- [ ] Test script passes (`python test_text_to_comic_pipeline.py`)
- [ ] Output directory writable
- [ ] Enough disk space (each comic ~10-50MB)

---

**Last Updated:** March 30, 2024
**Version:** 1.0

