import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message) {
      return NextResponse.json({ ok: false, error: "Missing message" }, { status: 400 });
    }

    const workflowId = process.env.WORKFLOW_ID;
    if (!workflowId) {
      return NextResponse.json(
        { ok: false, error: "Missing WORKFLOW_ID env var" },
        { status: 500 }
      );
    }

    // 🔥 This runs your Workflow (which has your vector store + agents)
    const result = await openai.responses.create({
      model: "gpt-4o-mini",
      input: message,
      // This is the important part:
      workflow: workflowId,
    });

    const text =
      result.output_text || "No response text returned from workflow.";

    return NextResponse.json({ ok: true, reply: text });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "Chat failed", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
