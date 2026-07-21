export const maxDuration = 60;

import { NextResponse } from "next/server";

type SaveCharacterBody = {
  url?: string;
  story_id?: string;
  character_name?: string;
  reference_image_b64?: string;
};

export async function POST(request: Request) {
  let body: SaveCharacterBody;

  try {
    body = (await request.json()) as SaveCharacterBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { url, story_id, character_name, reference_image_b64 } = body;

  if (!url || !story_id || !character_name || !reference_image_b64) {
    return NextResponse.json(
      { error: "Missing required fields: url, story_id, character_name, reference_image_b64." },
      { status: 400 }
    );
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
    return NextResponse.json({ error: "Only http/https URLs are allowed." }, { status: 400 });
  }

  // OmniGen2's RAM character store is separate from SD1.5/SDXL's — a
  // reference saved via /api/image-proxy/characters is NOT visible here.
  const saveUrl = `${targetUrl.origin}${targetUrl.pathname.replace(/\/?$/, "")}/characters/save`;

  console.log("[image-proxy/multi-character/characters] Saving character:", character_name, "for story:", story_id);
  console.log("[image-proxy/multi-character/characters] Target:", saveUrl);

  try {
    const res = await fetch(saveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "bypass-tunnel-reminder": "true",
        "x-forwarded-for": "127.0.0.1",
      },
      body: JSON.stringify({ story_id, character_name, reference_image_b64 }),
    });

    const data = await res.json() as Record<string, unknown>;
    console.log("[image-proxy/multi-character/characters] Response:", data);
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error("[image-proxy/multi-character/characters] Fetch failed:", error);
    return NextResponse.json({ error: "Failed to reach multi-character image API." }, { status: 502 });
  }
}
