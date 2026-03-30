import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Gemini API endpoints
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

// Comic Generation Pipeline endpoints
export const comicApi = {
  generateComic: (payload: {
    story_text: string;
    main_characters: number;
    num_chapters: number;
    target_pages: number;
    genre_tone: string;
    art_style: string;
    max_panels_per_page: number;
    generate_markdown?: boolean;
  }) => apiClient.post("/comics/generate", payload),

  getStatus: (jobId: string) => apiClient.get(`/comics/status/${jobId}`),

  getResults: (jobId: string) => apiClient.get(`/comics/results/${jobId}`),

  listJobs: () => apiClient.get("/comics/jobs"),
};

export default apiClient;

