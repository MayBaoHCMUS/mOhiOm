import { NextResponse } from "next/server";
export const maxDuration = 60;
/**
 * Generic server-side proxy for the Kaggle manga API server.
 * Bypasses browser CORS restrictions by making the fetch server-side.
 *
 * Body: { apiUrl: string, path: string, method?: string, payload?: unknown }
 * - apiUrl: base Cloudflare tunnel URL (no trailing slash)
 * - path:   endpoint path, e.g. "/publish" or "/r/abc123/stats"
 * - method: HTTP method to forward (default "POST")
 * - payload: JSON body to forward (omit for GET/DELETE)
 */
export async function POST(request: Request) {
  let body: { apiUrl?: string; path?: string; method?: string; payload?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { apiUrl, path, method = "POST", payload } = body;

  if (!apiUrl || !path) {
    return NextResponse.json({ error: "Missing 'apiUrl' or 'path'." }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(`${apiUrl}${path}`);
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
    return NextResponse.json({ error: "Only http/https URLs are allowed." }, { status: 400 });
  }

  const upstreamMethod = method.toUpperCase();
  const hasBody = payload !== undefined && upstreamMethod !== "GET";

  try {
    const response = await fetch(targetUrl.toString(), {
      method: upstreamMethod,
      headers: {
        "Content-Type": "application/json",
        "bypass-tunnel-reminder": "true",
        "x-forwarded-for": "127.0.0.1",
      },
      ...(hasBody ? { body: JSON.stringify(payload) } : {}),
    });

    const contentType = response.headers.get("content-type") ?? "";

    if (!response.ok) {
      const errorBody = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
      return NextResponse.json(
        { error: "Upstream error.", status: response.status, details: errorBody },
        { status: response.status },
      );
    }

    if (upstreamMethod === "DELETE" || response.status === 204) {
      return NextResponse.json({ ok: true });
    }

    if (contentType.includes("application/json")) {
      return NextResponse.json(await response.json());
    }

    return NextResponse.json({ ok: true, body: await response.text() });
  } catch (error) {
    console.error("[manga-proxy] fetch failed:", error);
    return NextResponse.json({ error: "Failed to reach manga API." }, { status: 502 });
  }
}
