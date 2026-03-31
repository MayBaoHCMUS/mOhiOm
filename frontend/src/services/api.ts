import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

const API_LOGGING_ENABLED =
  typeof window !== "undefined" &&
  (process.env.NEXT_PUBLIC_API_LOGGING || "true").toLowerCase() !== "false";

const redactHeaders = (headers: unknown): unknown => {
  if (!headers || typeof headers !== "object") return headers;

  const blockedKeys = new Set(["authorization", "cookie", "set-cookie", "x-api-key"]);
  const safe: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    safe[key] = blockedKeys.has(key.toLowerCase()) ? "[REDACTED]" : value;
  }

  return safe;
};

const fullUrl = (baseURL: string | undefined, url: string | undefined): string => {
  if (!url) return baseURL || "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${baseURL || ""}${url}`;
};

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

  (config as any).metadata = { startedAt: Date.now() };

  if (API_LOGGING_ENABLED) {
    const method = (config.method || "GET").toUpperCase();
    const url = fullUrl(config.baseURL, config.url);
    console.groupCollapsed(`API REQUEST ${method} ${url}`);
    console.log("method:", method);
    console.log("url:", url);
    console.log("params:", config.params ?? null);
    console.log("headers:", redactHeaders(config.headers));
    console.log("data:", config.data ?? null);
    console.groupEnd();
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    if (API_LOGGING_ENABLED) {
      const config: any = response.config || {};
      const method = (config.method || "GET").toUpperCase();
      const url = fullUrl(config.baseURL, config.url);
      const startedAt = config.metadata?.startedAt || Date.now();
      const durationMs = Date.now() - startedAt;

      console.groupCollapsed(`API RESPONSE ${response.status} ${method} ${url}`);
      console.log("status:", response.status);
      console.log("durationMs:", durationMs);
      console.log("headers:", redactHeaders(response.headers));
      console.log("data:", response.data ?? null);
      console.groupEnd();
    }

    return response;
  },
  (error) => {
    if (API_LOGGING_ENABLED && axios.isAxiosError(error)) {
      const config: any = error.config || {};
      const method = (config.method || "GET").toUpperCase();
      const url = fullUrl(config.baseURL, config.url);
      const startedAt = config.metadata?.startedAt || Date.now();
      const durationMs = Date.now() - startedAt;

      console.groupCollapsed(
        `API ERROR ${error.response?.status || "NO_STATUS"} ${method} ${url}`
      );
      console.log("message:", error.message);
      console.log("status:", error.response?.status ?? null);
      console.log("durationMs:", durationMs);
      console.log("requestHeaders:", redactHeaders(config.headers));
      console.log("requestData:", config.data ?? null);
      console.log("responseHeaders:", redactHeaders(error.response?.headers));
      console.log("responseData:", error.response?.data ?? null);
      console.groupEnd();
    }

    return Promise.reject(error);
  }
);

export interface ApiErrorInfo {
  status: number;
  message: string;
  retryAfterSeconds?: number;
}

export interface AnalyzeStoryPayload {
  story_text: string;
  num_chapters: number;
  desired_main_characters: number;
  target_total_pages: string;
  genre_tone: string;
  art_style_reference: string;
  max_panels_per_page: number;
  special_requests: string;
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

  analyzeStory: (payload: AnalyzeStoryPayload) =>
    apiClient.post("/gemini/analyze-story", payload),

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

