# 🚀 Gemini API Integration - Quick Reference

## ⚡ 5-Minute Setup

```powershell
# 1. Get API key from https://makersuite.google.com/app/apikey

# 2. Run setup script
.\setup-gemini.ps1

# 3. Add your API key to backend/.env
# GEMINI_API_KEY=your_key_here

# 4. Install dependencies
cd backend
pip install -r requirements.txt

# 5. Start backend
python -m app.main

# 6. Test it works
curl http://localhost:8000/api/gemini/health
```

## 📚 API Quick Guide

### Generate Text
```bash
curl -X POST "http://localhost:8000/api/gemini/generate-text" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Your prompt here"}'
```

### Analyze Story
```bash
curl -X POST "http://localhost:8000/api/gemini/analyze-story" \
  -H "Content-Type: application/json" \
  -d '{"story_text": "Your story", "num_chapters": 3}'
```

### Character Prompt
```bash
curl -X POST "http://localhost:8000/api/gemini/character-prompt" \
  -H "Content-Type: application/json" \
  -d '{"character_description": "A brave warrior"}'
```

### Panel Script
```bash
curl -X POST "http://localhost:8000/api/gemini/panel-script" \
  -H "Content-Type: application/json" \
  -d '{"scene_description": "Battle scene"}'
```

## 🎯 React/Frontend Usage

```typescript
import { geminiApi } from "@/services/api";

// Generate text
const response = await geminiApi.generateText("Your prompt");

// Analyze story
const analysis = await geminiApi.analyzeStory(storyText, 3);

// Create character prompt
const charPrompt = await geminiApi.generateCharacterPrompt(description);

// Generate panel script
const script = await geminiApi.generatePanelScript(sceneDesc);

// Check health
const health = await geminiApi.health();
```

## ⚙️ Configuration Files

### `.env` (Backend)
```env
GEMINI_API_KEY=your_key_here
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=mohiom_db
DEBUG=False
```

### `.env.local` (Frontend)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## 🔧 File Locations

- **Backend Service**: `backend/app/services.py`
- **API Router**: `backend/app/routers/gemini.py`
- **Frontend Service**: `frontend/src/services/api.ts`
- **Configuration**: `backend/app/config.py`

## ❌ Common Issues

| Issue | Solution |
|-------|----------|
| `GEMINI_API_KEY not set` | Create `backend/.env` with your key |
| `Invalid API Key` | Verify key at https://makersuite.google.com/app/apikey |
| `Connection timeout` | Check internet & Google service availability |
| `Module not found` | Run `pip install -r requirements.txt` |

## 🔗 Important Links

- 🔑 Get API Key: https://makersuite.google.com/app/apikey
- 📖 Documentation: https://ai.google.dev/docs
- 🐍 Python SDK: https://ai.google.dev/tutorials/python_quickstart
- 📚 API Reference: https://ai.google.dev/api/python/google/generativeai

## ✅ Verification Checklist

- [ ] API key obtained from Google AI Studio
- [ ] `.env` file created in `backend/` directory
- [ ] `GEMINI_API_KEY` added to `.env`
- [ ] Dependencies installed: `pip install -r requirements.txt`
- [ ] Backend running: `python -m app.main`
- [ ] Health check passes: `curl http://localhost:8000/api/gemini/health`
- [ ] Can call `/api/gemini/generate-text` endpoint

## 📞 Support

For issues or questions:
1. Check GEMINI_SETUP_GUIDE.md for detailed instructions
2. Review error messages carefully
3. Verify API key validity
4. Ensure backend is running on port 8000
5. Check internet connection

---

**Version**: 1.0  
**Last Updated**: March 30, 2026  
**Status**: ✅ Ready to Use

