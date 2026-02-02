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

    // ✅ Simple working call (no workflow param)
    const result = await openai.responses.create({
      model: "gpt-4o-mini",
      input: message,
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
