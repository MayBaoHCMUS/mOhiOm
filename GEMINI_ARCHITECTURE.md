# Gemini API Integration Architecture

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React/Next.js)                │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │           TextToComicGenerator Component                   │ │
│  │                                                            │ │
│  │  - Upload Story                                          │ │
│  │  - Configure Parameters                                 │ │
│  │  - Display Results                                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            │                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │           services/api.ts (API Client)                    │ │
│  │                                                            │ │
│  │  - geminiApi.generateText()                              │ │
│  │  - geminiApi.analyzeStory()                              │ │
│  │  - geminiApi.generateCharacterPrompt()                   │ │
│  │  - geminiApi.generatePanelScript()                       │ │
│  │  - geminiApi.health()                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTP/REST
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI)                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │         routers/gemini.py (API Endpoints)                │ │
│  │                                                            │ │
│  │  POST /api/gemini/generate-text                          │ │
│  │  POST /api/gemini/analyze-story                          │ │
│  │  POST /api/gemini/character-prompt                       │ │
│  │  POST /api/gemini/panel-script                           │ │
│  │  GET  /api/gemini/health                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            │                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │           services.py (Gemini Service)                    │ │
│  │                                                            │ │
│  │  class GeminiService:                                    │ │
│  │    - generate_text()                                    │ │
│  │    - analyze_story()                                    │ │
│  │    - generate_character_prompts()                       │ │
│  │    - generate_panel_script()                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            │                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │           config.py (Configuration)                       │ │
│  │                                                            │ │
│  │  - GEMINI_API_KEY (from .env)                            │ │
│  │  - MONGODB_URL                                           │ │
│  │  - DATABASE_NAME                                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                            │                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
        ┌──────────────────┐  ┌──────────────────┐
        │  Google Gemini   │  │    MongoDB       │
        │  API             │  │  Database        │
        │                  │  │                  │
        │ (Text Gen/       │  │ (Store Data)     │
        │  Analysis)       │  │                  │
        └──────────────────┘  └──────────────────┘
```

## Data Flow

### 1. Story Analysis Flow
```
User Input (Story Text)
    ↓
Frontend: geminiApi.analyzeStory()
    ↓
POST /api/gemini/analyze-story
    ↓
Backend: GeminiService.generate_plot_analysis()
    ↓
Google Gemini API
    ↓
Response: Plot Analysis, Chapter Division
    ↓
Frontend: Display Results
```

### 2. Character Generation Flow
```
Character Description
    ↓
Frontend: geminiApi.generateCharacterPrompt()
    ↓
POST /api/gemini/character-prompt
    ↓
Backend: GeminiService.generate_character_prompts()
    ↓
Google Gemini API
    ↓
Response: Image Generation Prompt
    ↓
Frontend: Use for Image Generation
```

### 3. Panel Script Generation Flow
```
Scene Description
    ↓
Frontend: geminiApi.generatePanelScript()
    ↓
POST /api/gemini/panel-script
    ↓
Backend: GeminiService.generate_panel_script()
    ↓
Google Gemini API
    ↓
Response: Panel Breakdown with Dialogue
    ↓
Frontend: Display Comic Panels
```

## Component Interaction

```
TextToComicGenerator.tsx
    │
    ├─ Input: Story Text
    │
    ├─ Step 1: Story Analysis
    │  └─ Calls: geminiApi.analyzeStory()
    │     └─ Uses: GeminiService.generate_plot_analysis()
    │        └─ Calls: Google Gemini API
    │
    ├─ Step 2: Character Generation
    │  └─ Calls: geminiApi.generateCharacterPrompt()
    │     └─ Uses: GeminiService.generate_character_prompts()
    │        └─ Calls: Google Gemini API
    │
    ├─ Step 3: Panel Script
    │  └─ Calls: geminiApi.generatePanelScript()
    │     └─ Uses: GeminiService.generate_panel_script()
    │        └─ Calls: Google Gemini API
    │
    └─ Step 4: Image Generation
       └─ Uses panel scripts for image prompts
```

## Environment Setup

```
Windows PowerShell
    ↓
setup-gemini.ps1
    ↓
Creates backend/.env with:
    - GEMINI_API_KEY (from Google AI Studio)
    - MONGODB_URL
    - DATABASE_NAME
    ↓
Backend reads config.py
    ↓
Services.py initializes GeminiService
    ↓
Routers/gemini.py registers endpoints
    ↓
main.py includes Gemini router
```

## Request/Response Example

### Request
```json
POST /api/gemini/analyze-story

{
  "story_text": "Once upon a time, a hero embarked on a quest...",
  "num_chapters": 3
}
```

### Process
```
1. FastAPI receives request
2. Router validates input
3. GeminiService.generate_plot_analysis() called
4. Gemini API processes with prompt
5. Response parsed and formatted
```

### Response
```json
{
  "analysis": "# Plot Analysis\n\n## Main Plot Arc\n...\n## Character Development\n...\n"
}
```

## Integration Points

### Frontend Integration
- `src/services/api.ts` - API client methods
- `src/components/TextToComicGenerator.tsx` - Component using Gemini

### Backend Integration
- `app/main.py` - Router registration
- `app/config.py` - Configuration
- `app/services.py` - Gemini service
- `app/routers/gemini.py` - API endpoints

## Technology Stack

```
Frontend Layer:
├─ React 18
├─ Next.js 14
├─ TypeScript
└─ Axios (HTTP Client)

Backend Layer:
├─ FastAPI
├─ Uvicorn (ASGI)
├─ Pydantic (Validation)
└─ google-generativeai (SDK)

External APIs:
├─ Google Gemini API
└─ MongoDB

Deployment:
├─ Docker
├─ Docker Compose
└─ Environment Variables
```

---

**Version**: 1.0  
**Last Updated**: March 30, 2026

