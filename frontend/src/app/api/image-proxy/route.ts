import { NextResponse } from "next/server";

const REQUEST_TIMEOUT_MS = 120000;

type ProxyRequestBody = {
  url?: string;
  prompt?: string;
  negative_prompt?: string;
};

export async function POST(request: Request) {
  let body: ProxyRequestBody;

  try {
    body = (await request.json()) as ProxyRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.url) {
    return NextResponse.json({ error: "Missing 'url' in request body." }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(body.url);
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
    return NextResponse.json({ error: "Only http/https URLs are allowed." }, { status: 400 });
  }

  // Automatically append /generate if the path doesn't already end with it
  if (!targetUrl.pathname.endsWith("/generate")) {
    targetUrl.pathname = targetUrl.pathname.replace(/\/?$/, "/generate");
  }

  const requestBody = {
    prompt: body.prompt ?? "",
    negative_prompt: body.negative_prompt ?? "lowres, bad anatomy",
  };

  // ── Server-side debug ────────────────────────────────────────────────────
  console.log("[image-proxy] ▶ Forwarding request");
  console.log("[image-proxy]   Target URL   :", targetUrl.toString());
  console.log("[image-proxy]   Request body :", JSON.stringify(requestBody));
  // ─────────────────────────────────────────────────────────────────────────

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // LocalTunnel / similar tunnels show a splash page unless this header is present
        "bypass-tunnel-reminder": "true",
        // Some tunnels also check this
        "x-forwarded-for": "127.0.0.1",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";

    console.log("[image-proxy]   HTTP status  :", response.status, response.statusText);
    console.log("[image-proxy]   Content-Type :", contentType);

    if (!response.ok) {
      const errorBody = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
      console.error("[image-proxy] ✖ Upstream error body:", errorBody);
      return NextResponse.json(
        { error: "Upstream image API error.", status: response.status, details: errorBody },
        { status: response.status }
      );
    }

    if (contentType.includes("application/json")) {
      const data = await response.json() as Record<string, unknown>;
      console.log("[image-proxy] ✔ JSON response keys:", Object.keys(data));
      if (data.image_base64) {
        console.log(
          "[image-proxy]   image_base64 :",
          `[base64, ${String(data.image_base64).length} chars]`
        );
      }
      return NextResponse.json(data);
    }

    // Plain-text / binary fallback — wrap in the expected shape
    const text = await response.text();
    console.log("[image-proxy] ✔ Plain-text response length:", text.length);
    return NextResponse.json({ status: "success", image_base64: text });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[image-proxy] ✖ Request timed out after", REQUEST_TIMEOUT_MS, "ms");
      return NextResponse.json({ error: "Image API request timed out." }, { status: 504 });
    }
    console.error("[image-proxy] ✖ Fetch failed:", error);
    return NextResponse.json({ error: "Failed to reach image API." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
