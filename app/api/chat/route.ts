import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Hard fallback: remove common markdown formatting.
// (Not perfect, but very effective for headings/bullets/bold/code.)
function stripMarkdown(text: string) {
  return text
    // code fences
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, "").trim())
    // inline code
    .replace(/`([^`]+)`/g, "$1")
    // bold/italic
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // headings/quotes/list markers
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    // extra blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = body?.message;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { ok: false, error: "Missing message" },
        { status: 400 }
      );
    }

    const vectorStoreId = process.env.VECTOR_STORE_ID;
    if (!vectorStoreId) {
      return NextResponse.json(
        { ok: false, error: "Missing VECTOR_STORE_ID env var" },
        { status: 500 }
      );
    }

    const system = `
You are a proposal assistant.

CRITICAL TOOL RULE:
- You MUST use file_search to answer questions about uploaded documents.
- Use ONLY retrieved text from the uploaded documents.
- If nothing is found, say exactly: I searched the uploaded documents but found no matching text.

CRITICAL OUTPUT RULE:
- Output PLAIN TEXT ONLY.
- Do NOT use Markdown (no bullets, no headings, no bold, no code blocks).
- Use short paragraphs with normal sentences.
`.trim();

    const result = await openai.responses.create({
      model: "gpt-4o-mini",
      tools: [
        {
          type: "file_search",
          vector_store_ids: [vectorStoreId],
        },
      ],
      input: [
        { role: "system", content: system },
        { role: "user", content: message },
      ],
    });

    const raw = result.output_text ?? "";
    const reply = stripMarkdown(raw);

    return NextResponse.json({
      ok: true,
      reply,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "Chat failed", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
