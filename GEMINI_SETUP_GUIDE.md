# Gemini API Integration Guide

## Setup Instructions

### Step 1: Get Your Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click on **"Get API Key"** button
3. Click **"Create new secret key"**
4. Copy your API key

### Step 2: Configure the Backend

#### Option A: Using .env file (Recommended)

1. Create a `.env` file in the `backend/` directory:
   ```bash
   cd backend
   touch .env
   ```

2. Add the following to your `.env` file:
   ```env
   GEMINI_API_KEY=your_api_key_here
   MONGODB_URL=mongodb://localhost:27017
   DATABASE_NAME=mohiom_db
   DEBUG=False
   ```

3. Replace `your_api_key_here` with your actual Gemini API key

#### Option B: Using Environment Variables (Windows PowerShell)

```powershell
# Set the environment variable
$env:GEMINI_API_KEY="your_api_key_here"

# Verify it's set
Get-ChildItem env:GEMINI_API_KEY
```

### Step 3: Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### Step 4: Run the Backend

```bash
python -m app.main
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Step 5: Test the Gemini Integration

#### Check if Gemini is configured:
```bash
curl http://localhost:8000/api/gemini/health
```

#### Generate text:
```bash
curl -X POST "http://localhost:8000/api/gemini/generate-text" \
  -H "Content-Type: application/json" \
  -d "{\"prompt\": \"Write a short story about a hero's journey\"}"
```

#### Analyze a story:
```bash
curl -X POST "http://localhost:8000/api/gemini/analyze-story" \
  -H "Content-Type: application/json" \
  -d "{\"story_text\": \"Your story here...\", \"num_chapters\": 3}"
```

## API Endpoints

### Gemini Endpoints

- **POST** `/api/gemini/generate-text` - Generate text from a prompt
  ```json
  {
    "prompt": "Your prompt here"
  }
  ```

- **POST** `/api/gemini/analyze-story` - Analyze a story for comic adaptation
  ```json
  {
    "story_text": "Your story here",
    "num_chapters": 3
  }
  ```

- **POST** `/api/gemini/character-prompt` - Generate image prompt for a character
  ```json
  {
    "character_description": "Character description"
  }
  ```

- **POST** `/api/gemini/panel-script` - Generate panel script for a scene
  ```json
  {
    "scene_description": "Scene description"
  }
  ```

- **GET** `/api/gemini/health` - Check if Gemini API is configured

## Troubleshooting

### Error: "GEMINI_API_KEY environment variable is not set"

**Solution:**
- Make sure you've created the `.env` file in the backend directory
- Verify the API key is correctly set
- Restart your backend server

### Error: "Invalid API Key"

**Solution:**
- Double-check your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
- Make sure you didn't accidentally add extra spaces or characters
- Create a new API key if the current one doesn't work

### Connection Timeout

**Solution:**
- Check your internet connection
- Verify the API key is valid and hasn't been revoked
- Check if Google's services are accessible in your region

## Integration with Frontend

### Update Frontend API Service

Update `frontend/src/services/api.ts` to add Gemini endpoints:

```typescript
export const geminiApi = {
  generateText: (prompt: string) =>
    apiClient.post("/gemini/generate-text", { prompt }),

  analyzeStory: (storyText: string, numChapters: number = 3) =>
    apiClient.post("/gemini/analyze-story", {
      story_text: storyText,
      num_chapters: numChapters,
    }),

  generateCharacterPrompt: (characterDescription: string) =>
    apiClient.post("/gemini/character-prompt", {
      character_description: characterDescription,
    }),

  generatePanelScript: (sceneDescription: string) =>
    apiClient.post("/gemini/panel-script", {
      scene_description: sceneDescription,
    }),

  health: () => apiClient.get("/gemini/health"),
};
```

### Use in React Component

```typescript
import { geminiApi } from "@/services/api";

// In your component
const handleAnalyzeStory = async () => {
  try {
    const response = await geminiApi.analyzeStory(storyText, 3);
    console.log(response.data);
  } catch (error) {
    console.error("Failed to analyze story:", error);
  }
};
```

## Next Steps

1. ✅ Set up Gemini API key
2. ✅ Install dependencies
3. ✅ Configure backend
4. ✅ Test Gemini endpoints
5. 📝 Integrate with TextToComicGenerator component
6. 🎨 Build comic generation features

## Resources

- [Google Gemini API Docs](https://ai.google.dev/docs)
- [Python SDK Installation](https://ai.google.dev/tutorials/python_quickstart)
- [API Reference](https://ai.google.dev/api/python/google/generativeai)

