import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const USER_ID_STORAGE_KEY = "mohiom-user-id";

const getOrCreateUserId = (): string => {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  if (existing) return existing;

  const next =
    typeof window.crypto !== "undefined" && "randomUUID" in window.crypto
      ? window.crypto.randomUUID()
      : `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(USER_ID_STORAGE_KEY, next);
  return next;
};

apiClient.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  config.headers["X-User-Id"] = getOrCreateUserId();
  return config;
});

export interface ApiErrorInfo {
  status: number;
  message: string;
  retryAfterSeconds?: number;
}

export const toApiError = (error: unknown): ApiErrorInfo => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 0;
    const detail = error.response?.data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : detail?.message || error.message || "Request failed";

    const retryFromDetail =
      typeof detail?.retry_after_seconds === "number"
        ? detail.retry_after_seconds
        : undefined;
    const retryFromHeaderRaw = error.response?.headers?.["retry-after"];
    const retryFromHeader = retryFromHeaderRaw
      ? Number(retryFromHeaderRaw)
      : undefined;

    return {
      status,
      message,
      retryAfterSeconds:
        Number.isFinite(retryFromDetail)
          ? retryFromDetail
          : Number.isFinite(retryFromHeader)
            ? retryFromHeader
            : undefined,
    };
  }

  return {
    status: 0,
    message: error instanceof Error ? error.message : "Request failed",
  };
};

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

