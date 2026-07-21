import { NextResponse } from "next/server";

const REQUEST_TIMEOUT_MS = 180000; // OmniGen2 is a larger model, often slower than SD1.5/SDXL
export const maxDuration = 60;
const BACKEND_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

// Uploads base64 image data to the FastAPI backend, which stores it in
// Cloudflare R2 and returns a public URL — MongoDB never sees base64.
// (Mirrors the identically-named helper in ../route.ts — Next.js route files
// don't share code, so each proxy route keeps its own copy.)
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

type MultiCharacterProxyRequestBody = {
  url?: string;
  story_id?: string;
  scene_prompt?: string;
  negative_prompt?: string;
  character_names?: string[];
  style?: string;
  width?: number;
  height?: number;
  image_guidance_scale?: number;
  text_guidance_scale?: number;
  num_inference_steps?: number;
  seed?: number;
};

export async function POST(request: Request) {
  let body: MultiCharacterProxyRequestBody;

  try {
    body = (await request.json()) as MultiCharacterProxyRequestBody;
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

  targetUrl.pathname = `${targetUrl.pathname.replace(/\/?$/, "")}/generate-page-multi-character`;

  const requestBody: Record<string, unknown> = {
    story_id: body.story_id ?? "default",
    scene_prompt: body.scene_prompt ?? "",
    negative_prompt: body.negative_prompt ?? "lowres, bad anatomy, worst quality, blurry",
    character_names: body.character_names ?? [],
    style: body.style ?? "manga",
    image_guidance_scale: body.image_guidance_scale ?? 2.8,
    text_guidance_scale: body.text_guidance_scale ?? 5.0,
    num_inference_steps: body.num_inference_steps ?? 30,
  };
  if (body.width !== undefined) requestBody.width = body.width;
  if (body.height !== undefined) requestBody.height = body.height;
  if (body.seed !== undefined) requestBody.seed = body.seed;

  console.log("[image-proxy/multi-character] ▶ Forwarding request");
  console.log("[image-proxy/multi-character]   Target URL   :", targetUrl.toString());
  console.log("[image-proxy/multi-character]   Request body :", JSON.stringify(requestBody));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "bypass-tunnel-reminder": "true",
        "x-forwarded-for": "127.0.0.1",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    console.log("[image-proxy/multi-character]   HTTP status  :", response.status, response.statusText);

    if (!response.ok) {
      const details = await response.json().catch(() => `Upstream returned a non-JSON error (status ${response.status}).`);
      console.error("[image-proxy/multi-character] ✖ Upstream error body:", details);
      return NextResponse.json(
        { error: "Upstream multi-character image API error.", status: response.status, details },
        { status: response.status }
      );
    }

    const data = (await response.json()) as {
      status?: string;
      image_base64?: string;
      metadata?: Record<string, unknown>;
      characters_injected?: string[];
    };

    if (data.status !== "success" || !data.image_base64) {
      return NextResponse.json(
        { error: "Multi-character image API did not return an image.", details: data },
        { status: 502 }
      );
    }

    console.log(
      "[image-proxy/multi-character]   image_base64 :",
      `[base64, ${data.image_base64.length} chars] — uploading to R2`
    );
    const image_url = await uploadToBackend(data.image_base64, "panels");
    return NextResponse.json({
      status: "success",
      image_url,
      metadata: data.metadata,
      characters_injected: data.characters_injected,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[image-proxy/multi-character] ✖ Request timed out after", REQUEST_TIMEOUT_MS, "ms");
      return NextResponse.json({ error: "Multi-character image API request timed out." }, { status: 504 });
    }
    console.error("[image-proxy/multi-character] ✖ Fetch or upload failed:", error);
    const message = error instanceof Error ? error.message : "Failed to reach multi-character image API or upload image.";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
