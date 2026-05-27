import axios from "axios";
import type { AxiosRequestConfig } from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
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

type RequestWithMetadata = AxiosRequestConfig & { metadata?: { startedAt: number } };

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
  const requestConfig = config as RequestWithMetadata;
  requestConfig.headers = requestConfig.headers || {};
  requestConfig.headers["X-User-Id"] = getOrCreateUserId();

  requestConfig.metadata = { startedAt: Date.now() };

  if (API_LOGGING_ENABLED) {
    const method = (requestConfig.method || "GET").toUpperCase();
    const url = fullUrl(requestConfig.baseURL, requestConfig.url);
    console.groupCollapsed(`API REQUEST ${method} ${url}`);
    console.log("method:", method);
    console.log("url:", url);
    console.log("params:", requestConfig.params ?? null);
    console.log("headers:", redactHeaders(requestConfig.headers));
    console.log("data:", requestConfig.data ?? null);
    console.groupEnd();
  }

  return requestConfig;
});

apiClient.interceptors.response.use(
  (response) => {
    if (API_LOGGING_ENABLED) {
      const config = response.config as RequestWithMetadata;
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
      const config = (error.config || {}) as RequestWithMetadata;
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
  project_id?: string;
  stream?: boolean;
}

export interface AnalyzeStoryStructuredResponse {
  analysis: string;
  structured_json: Record<string, unknown>;
}

export interface Step2DesignPayload {
  project_id: string;
  step1_json: Record<string, unknown>;
  desired_main_characters: number;
  genre_tone: string;
  art_style_reference: string;
  special_requests: string;
  stream?: boolean;
}

export interface Step2DesignStructuredResponse {
  design_markdown: string;
  structured_json: Record<string, unknown>;
}

export interface Step3ScriptPayload {
  project_id: string;
  step1_json: Record<string, unknown>;
  step2_json: Record<string, unknown>;
  num_chapters: number;
  target_total_pages: string;
  genre_tone: string;
  art_style_reference: string;
  max_panels_per_page: number;
  special_requests: string;
  stream?: boolean;
}

export interface Step3ScriptStructuredResponse {
  script_markdown: string;
  structured_json: Record<string, unknown>;
}

export interface PanelImagePayload {
  image_prompt: string;
  width?: number;
  height?: number;
}

export interface PanelImageResponse {
  image_url: string;
  image_data_url?: string;
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

// ─── Streaming helpers ───────────────────────────────────────────────────────

export interface Step1StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (result: AnalyzeStoryStructuredResponse) => void;
  onError: (message: string, statusCode?: number) => void;
}

/**
 * Stream Step 1 story analysis via SSE.
 * The backend sends {"type":"token","content":"..."} events as the LLM generates
 * tokens, then a final {"type":"done","analysis":"...","structured_json":{...}}.
 * Returns an AbortController so the caller can cancel mid-stream.
 */
export function analyzeStoryStructuredStream(
  payload: AnalyzeStoryPayload,
  callbacks: Step1StreamCallbacks,
): AbortController {
  const controller = new AbortController();

  const getUserId = (): string => {
    const key = "mohiom-user-id";
    if (typeof window === "undefined") return "server";
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const next =
      "randomUUID" in window.crypto
        ? window.crypto.randomUUID()
        : `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(key, next);
    return next;
  };

  (async () => {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/gemini/analyze-story-structured`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": getUserId(),
        },
        credentials: "include",
        body: JSON.stringify({ ...payload, stream: true }),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") {
        callbacks.onError(err instanceof Error ? err.message : "Network error");
      }
      return;
    }

    if (!response.ok) {
      let msg = `Request failed (${response.status})`;
      try {
        const body = await response.json() as { detail?: string | { message?: string } };
        const detail = body?.detail;
        msg = typeof detail === "string" ? detail : detail?.message ?? msg;
      } catch { /* ignore */ }
      callbacks.onError(msg, response.status);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) { callbacks.onError("No response body"); return; }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim().startsWith("data:")) continue;
          const raw = line.trim().slice(5).trim();
          if (!raw || raw === "[DONE]") continue;

          let event: {
            type?: "token" | "done" | "error";
            content?: string;
            analysis?: string;
            structured_json?: Record<string, unknown>;
            message?: string;
            status_code?: number;
          };
          try { event = JSON.parse(raw) as typeof event; } catch { continue; }

          if (event.type === "token" && event.content) {
            callbacks.onToken(event.content);
          } else if (event.type === "done") {
            callbacks.onDone({ analysis: event.analysis ?? "", structured_json: event.structured_json ?? {} });
          } else if (event.type === "error") {
            callbacks.onError(event.message ?? "Unknown error", event.status_code);
          }
        }
      }
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") {
        callbacks.onError(err instanceof Error ? err.message : "Stream read error");
      }
    } finally {
      reader.releaseLock();
    }
  })();

  return controller;
}

// Gemini API endpoints
export const geminiApi = {
  generateText: (prompt: string, stream: boolean = false) =>
    apiClient.post("/gemini/generate-text", { prompt, stream }),

  generateTextStream: async (
    prompt: string,
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (error: string) => void
  ) => {
    try {
      const response = await fetch(`${API_BASE_URL}/gemini/generate-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": getOrCreateUserId(),
        },
        body: JSON.stringify({ prompt, stream: true }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        onError(errorData.detail?.message || errorData.detail || "Request failed");
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError("No response body");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              onComplete();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                onError(parsed.error);
                return;
              }
            } catch {
              onChunk(data);
            }
          }
        }
      }

      onComplete();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Stream failed");
    }
  },

  analyzeStory: (payload: AnalyzeStoryPayload) =>
    apiClient.post("/gemini/analyze-story", payload),

  analyzeStoryStructured: (payload: AnalyzeStoryPayload) =>
    apiClient.post<AnalyzeStoryStructuredResponse>("/gemini/analyze-story-structured", payload),

  analyzeStoryStructuredStream: async (
    payload: AnalyzeStoryPayload,
    onChunk: (chunk: string) => void,
    onComplete: (structuredJson: Record<string, unknown>) => void,
    onError: (error: string) => void
  ) => {
    try {
      const response = await fetch(`${API_BASE_URL}/gemini/analyze-story-structured`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": getOrCreateUserId(),
        },
        body: JSON.stringify({ ...payload, stream: true }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        onError(errorData.detail?.message || errorData.detail || "Request failed");
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError("No response body");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let structuredJson: Record<string, unknown> | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              onComplete(structuredJson || {});
              return;
            }
            if (data.startsWith("[STRUCTURED_JSON]")) {
              try {
                structuredJson = JSON.parse(data.slice(17));
              } catch {
                // ignore parse errors
              }
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                onError(parsed.error);
                return;
              }
            } catch {
              onChunk(data);
            }
          }
        }
      }

      onComplete(structuredJson || {});
    } catch (error) {
      onError(error instanceof Error ? error.message : "Stream failed");
    }
  },

  generateCharacterDesignsStructured: (payload: Step2DesignPayload) =>
    apiClient.post<Step2DesignStructuredResponse>(
      "/gemini/character-designs-structured",
      payload
    ),

  generateCharacterDesignsStructuredStream: async (
    payload: Step2DesignPayload,
    onChunk: (chunk: string) => void,
    onComplete: (structuredJson: Record<string, unknown>) => void,
    onError: (error: string) => void
  ) => {
    try {
      const response = await fetch(`${API_BASE_URL}/gemini/character-designs-structured`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": getOrCreateUserId(),
        },
        body: JSON.stringify({ ...payload, stream: true }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        onError(errorData.detail?.message || errorData.detail || "Request failed");
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError("No response body");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let structuredJson: Record<string, unknown> | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              onComplete(structuredJson || {});
              return;
            }
            if (data.startsWith("[STRUCTURED_JSON]")) {
              try {
                structuredJson = JSON.parse(data.slice(17));
              } catch {
                // ignore parse errors
              }
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                onError(parsed.error);
                return;
              }
            } catch {
              onChunk(data);
            }
          }
        }
      }

      onComplete(structuredJson || {});
    } catch (error) {
      onError(error instanceof Error ? error.message : "Stream failed");
    }
  },

  generatePanelScriptStructured: (payload: Step3ScriptPayload) =>
    apiClient.post<Step3ScriptStructuredResponse>(
      "/gemini/panel-script-structured",
      payload
    ),

  generatePanelScriptStructuredStream: async (
    payload: Step3ScriptPayload,
    onChunk: (chunk: string) => void,
    onComplete: (structuredJson: Record<string, unknown>) => void,
    onError: (error: string) => void
  ) => {
    try {
      const response = await fetch(`${API_BASE_URL}/gemini/panel-script-structured`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": getOrCreateUserId(),
        },
        body: JSON.stringify({ ...payload, stream: true }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        onError(errorData.detail?.message || errorData.detail || "Request failed");
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError("No response body");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let structuredJson: Record<string, unknown> | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              onComplete(structuredJson || {});
              return;
            }
            if (data.startsWith("[STRUCTURED_JSON]")) {
              try {
                structuredJson = JSON.parse(data.slice(17));
              } catch {
                // ignore parse errors
              }
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                onError(parsed.error);
                return;
              }
            } catch {
              onChunk(data);
            }
          }
        }
      }

      onComplete(structuredJson || {});
    } catch (error) {
      onError(error instanceof Error ? error.message : "Stream failed");
    }
  },

  generateCharacterPrompt: (characterDescription: string) =>
    apiClient.post("/gemini/character-prompt", {
      character_description: characterDescription,
    }),

  generatePanelScript: (sceneDescription: string) =>
    apiClient.post("/gemini/panel-script", {
      scene_description: sceneDescription,
    }),

  generatePanelImage: (payload: PanelImagePayload) =>
    apiClient.post<PanelImageResponse>("/gemini/generate-panel-image", payload),

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

export const authApi = {
  register: (payload: { first_name: string; last_name: string; email: string; password: string }) =>
    apiClient.post("/auth/register", payload),

  login: (payload: { email: string; password: string }) => apiClient.post("/auth/login", payload),

  forgotPassword: (payload: { email: string }) => apiClient.post("/auth/forgot-password", payload),

  resetPassword: (payload: { email: string; token: string; password: string }) =>
    apiClient.post("/auth/reset-password", payload),

  me: () => apiClient.get("/auth/me"),

  logout: () => apiClient.post("/auth/logout"),

  oauthStart: (provider: "google" | "github", mode: "login" | "register") =>
    apiClient.get<{ url: string }>(`/auth/oauth/${provider}/start`, { params: { mode } }),
};

export default apiClient;
