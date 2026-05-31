# Text Generation Streaming Implementation

## Overview
This implementation provides both streaming and non-streaming modes for text generation across the entire Text-to-Comic Pipeline, allowing users to see responses in real-time or wait for complete responses.

## Backend Implementation

### 1. Service Layer (`backend/app/services.py`)

#### `GeminiService.generate_text(prompt, stream=False)`
- **Non-streaming mode**: Returns complete text response
- **Streaming mode**: Returns async generator that yields text chunks

#### Gemini API Streaming
- Uses `generate_content_stream()` for real-time token streaming
- Yields each chunk as it arrives from the API

#### 9Router API Streaming
- Uses Server-Sent Events (SSE) format
- Parses `data:` prefixed lines
- Extracts content from delta objects in streaming responses

#### Pipeline Methods with Streaming Support
All major pipeline methods now support streaming:
- `generate_plot_analysis()` - Step 1: Story Analysis
- `generate_step2_character_design_markdown()` - Step 2: Character Design
- `generate_step3_panel_script_markdown()` - Step 3: Panel Script

### 2. API Routes (`backend/app/routers/gemini.py`)

#### `POST /api/gemini/generate-text`
**Request Body:**
```json
{
  "prompt": "Your prompt here",
  "stream": false  // true for streaming, false for complete response
}
```

**Non-streaming Response:**
```json
{
  "generated_text": "Complete response text"
}
```

**Streaming Response:**
- Content-Type: `text/event-stream`
- Format: Server-Sent Events (SSE)
- Each chunk: `data: <text>\n\n`
- End marker: `data: [DONE]\n\n`

#### `POST /api/gemini/analyze-story-structured`
**Request Body:**
```json
{
  "project_id": "manga_project_001",
  "story_text": "Your story here",
  "num_chapters": 3,
  "desired_main_characters": 5,
  "target_total_pages": "auto",
  "genre_tone": "Shonen action",
  "art_style_reference": "classic black-and-white weekly shonen",
  "max_panels_per_page": 6,
  "special_requests": "None",
  "stream": true
}
```

**Streaming Response:**
- Streams markdown analysis chunks
- Sends structured JSON at the end: `data: [STRUCTURED_JSON]{...}\n\n`
- End marker: `data: [DONE]\n\n`

#### `POST /api/gemini/character-designs-structured`
**Request Body:**
```json
{
  "project_id": "manga_project_001",
  "step1_json": {...},
  "desired_main_characters": 5,
  "genre_tone": "Shonen action",
  "art_style_reference": "classic black-and-white weekly shonen",
  "special_requests": "None",
  "stream": true
}
```

**Streaming Response:**
- Streams character design markdown chunks
- Sends structured JSON at the end: `data: [STRUCTURED_JSON]{...}\n\n`
- End marker: `data: [DONE]\n\n`

#### `POST /api/gemini/panel-script-structured`
**Request Body:**
```json
{
  "project_id": "manga_project_001",
  "step1_json": {...},
  "step2_json": {...},
  "num_chapters": 3,
  "target_total_pages": "auto",
  "genre_tone": "Shonen action",
  "art_style_reference": "classic black-and-white weekly shonen",
  "max_panels_per_page": 6,
  "special_requests": "None",
  "stream": true
}
```

**Streaming Response:**
- Streams panel script markdown chunks
- Sends structured JSON at the end: `data: [STRUCTURED_JSON]{...}\n\n`
- End marker: `data: [DONE]\n\n`

## Frontend Implementation

### 1. API Client (`frontend/src/services/api.ts`)

#### Standard Methods
- `geminiApi.generateText(prompt, stream)`
- `geminiApi.analyzeStoryStructured(payload)`
- `geminiApi.generateCharacterDesignsStructured(payload)`
- `geminiApi.generatePanelScriptStructured(payload)`

#### Streaming Methods
- `geminiApi.generateTextStream(prompt, onChunk, onComplete, onError)`
- `geminiApi.analyzeStoryStructuredStream(payload, onChunk, onComplete, onError)`
- `geminiApi.generateCharacterDesignsStructuredStream(payload, onChunk, onComplete, onError)`
- `geminiApi.generatePanelScriptStructuredStream(payload, onChunk, onComplete, onError)`

All streaming methods use Fetch API with callbacks:
- `onChunk(chunk)`: Called for each text chunk
- `onComplete(structuredJson)`: Called when streaming finishes with structured data
- `onError(error)`: Called on errors

### 2. Context (`frontend/src/context/ComicGenerationContext.tsx`)

#### New State
- `useStreaming: boolean` - Toggle between streaming and non-streaming modes
- `streamingText: string` - Accumulates streaming text for display

#### Updated Methods
- `buildStepPayload()` - Now checks `useStreaming` flag and uses appropriate API method
- All three pipeline steps (1, 2, 3) support both streaming and non-streaming

### 3. UI Component (`frontend/src/components/TextGenerationDemo.tsx`)

Features:
- Radio buttons to switch between streaming and non-streaming modes
- Real-time text display during streaming
- Visual indicator showing streaming status
- Error handling for both modes
- Clear button to reset state

## Usage Example

### Access the Demo
Navigate to: `http://localhost:3000/demo`

### Using in Comic Generation Pipeline

The streaming feature is automatically integrated into the comic generation pipeline. Users can toggle streaming mode in the context:

```typescript
const { useStreaming, setUseStreaming, handleGenerate } = useComicGeneration();

// Enable streaming
setUseStreaming(true);

// Generate Step 1 with streaming
await handleGenerate(1);
```

### Streaming Mode
1. Enable streaming: `setUseStreaming(true)`
2. Click "Generate" for any step
3. Watch the response appear in real-time
4. Structured JSON is processed after streaming completes

### Non-Streaming Mode
1. Disable streaming: `setUseStreaming(false)`
2. Click "Generate" for any step
3. Wait for the complete response
4. Both markdown and structured JSON returned together

## Technical Details

### Rate Limiting
- Both modes use the same rate limiter
- Streaming releases token after stream completes
- Non-streaming releases token immediately after response

### Error Handling
- Streaming: Errors sent as SSE data events
- Non-streaming: Standard HTTP error responses
- Both include retry-after information when available

### Browser Compatibility
- Streaming uses Fetch API with ReadableStream
- Supported in all modern browsers
- Falls back gracefully on errors

### Special SSE Markers
- `data: [DONE]` - Indicates end of stream
- `data: [STRUCTURED_JSON]{...}` - Contains structured JSON data
- Regular chunks are plain text without markers

## Configuration

### Backend Environment Variables
```env
# Gemini API
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash

# Or use 9Router
NINE_ROUTER_URL=https://your-router-url
NINE_ROUTER_API_KEY=your_key_here
NINE_ROUTER_MODEL=kr/claude-sonnet-4.5
```

### Frontend Environment Variables
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

## Benefits

### Streaming Mode
- ✅ Immediate feedback to users
- ✅ Better perceived performance
- ✅ Can start reading while generation continues
- ✅ Lower perceived latency
- ✅ Better user experience for long-running operations

### Non-Streaming Mode
- ✅ Simpler implementation for some use cases
- ✅ Complete response guaranteed before display
- ✅ Easier to process/validate full response
- ✅ Better for short responses

## Pipeline Integration

### Step 1: Story Analysis
- Streams character breakdown and plot analysis
- Returns structured JSON with chapters and scenes
- Real-time feedback during analysis

### Step 2: Character Design
- Streams character design sheets
- Returns structured JSON with AI image prompts
- Shows design details as they're generated

### Step 3: Panel Script
- Streams panel-by-panel script
- Returns structured JSON with panel data
- Displays script progressively

## Future Enhancements
- Add progress indicators showing percentage complete
- Support cancellation of streaming requests
- Add streaming to image generation endpoints
- Implement retry logic for failed streams
- Add streaming analytics and metrics
