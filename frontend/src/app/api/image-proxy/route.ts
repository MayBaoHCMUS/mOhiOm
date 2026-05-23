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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: body.prompt ?? "",
        negative_prompt: body.negative_prompt ?? "lowres, bad anatomy",
      }),
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      const errorBody = contentType.includes("application/json") ? await response.json() : await response.text();
      return NextResponse.json(
        { error: "Upstream image API error.", status: response.status, details: errorBody },
        { status: response.status }
      );
    }

    if (contentType.includes("application/json")) {
      const data = await response.json();
      return NextResponse.json(data);
    }

    const text = await response.text();
    return NextResponse.json({ status: "success", image_base64: text });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Image API request timed out." }, { status: 504 });
    }

    return NextResponse.json({ error: "Failed to reach image API." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

