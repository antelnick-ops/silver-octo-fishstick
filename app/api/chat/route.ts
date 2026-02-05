import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ ok: false, error: "Missing message" }, { status: 400 });
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

IMPORTANT:
- You MUST use file_search to answer questions about uploaded documents.
- Answer ONLY using retrieved text from the uploaded documents.
- If nothing is found, say: "I searched the uploaded documents but found no matching text."
- When possible, quote the supporting text in your answer.
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

    return NextResponse.json({
      ok: true,
      reply: result.output_text ?? "",
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "Chat failed", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
