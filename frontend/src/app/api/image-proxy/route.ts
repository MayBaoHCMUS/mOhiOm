import { NextResponse } from "next/server";

const REQUEST_TIMEOUT_MS = 120000;
export const maxDuration = 60;
const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// Uploads base64 image data to the FastAPI backend, which stores it in
// Cloudflare R2 and returns a public URL — MongoDB never sees base64.
async function uploadToBackend(imageBase64: string, folder: string): Promise<string> {
  const res = await fetch(`${BACKEND_API_URL}/images/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: imageBase64, folder }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Image upload to backend failed (${res.status}): ${detail}`);
  }
  const data = (await res.json()) as { image_url: string };
  return data.image_url;
}

type ProxyRequestBody = {
  url?: string;
  scene_prompt?: string;
  negative_prompt?: string;
  story_id?: string;
  character_name?: string;
  ip_adapter_scale?: number;
  reference_image_b64?: string;
  style?: string;
  control_image_b64?: string;
  controlnet_scale?: number;
  width?: number;
  height?: number;
  seed?: number;
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

  // Append /generate-page if the path doesn't already end with a known endpoint
  if (!targetUrl.pathname.endsWith("/generate-page") && !targetUrl.pathname.endsWith("/generate")) {
    targetUrl.pathname = targetUrl.pathname.replace(/\/?$/, "/generate-page");
  }

  const requestBody: Record<string, unknown> = {
    scene_prompt: body.scene_prompt ?? "",
    negative_prompt: body.negative_prompt ?? "lowres, bad anatomy, worst quality, blurry",
    story_id: body.story_id ?? "default",
    style: body.style ?? "manga",
    ip_adapter_scale: body.ip_adapter_scale ?? 0.7,
  };
  if (body.character_name) requestBody.character_name = body.character_name;
  if (body.reference_image_b64) requestBody.reference_image_b64 = body.reference_image_b64;
  if (body.control_image_b64) requestBody.control_image_b64 = body.control_image_b64;
  if (body.controlnet_scale !== undefined) requestBody.controlnet_scale = body.controlnet_scale;
  if (body.width !== undefined) requestBody.width = body.width;
  if (body.height !== undefined) requestBody.height = body.height;
  if (body.seed !== undefined) requestBody.seed = body.seed;

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
          `[base64, ${String(data.image_base64).length} chars] — uploading to R2`
        );
        const { image_base64: _imageBase64, ...rest } = data;
        const image_url = await uploadToBackend(String(data.image_base64), "panels");
        return NextResponse.json({ ...rest, image_url });
      }
      return NextResponse.json(data);
    }

    // Plain-text / binary fallback — upload then wrap in the expected shape
    const text = await response.text();
    console.log("[image-proxy] ✔ Plain-text response length:", text.length);
    const image_url = await uploadToBackend(text, "panels");
    return NextResponse.json({ status: "success", image_url });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[image-proxy] ✖ Request timed out after", REQUEST_TIMEOUT_MS, "ms");
      return NextResponse.json({ error: "Image API request timed out." }, { status: 504 });
    }
    console.error("[image-proxy] ✖ Fetch or upload failed:", error);
    const message = error instanceof Error ? error.message : "Failed to reach image API or upload image.";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
