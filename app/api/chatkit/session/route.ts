import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST() {
  const workflowId = process.env.WORKFLOW_ID;

  if (!workflowId) {
    return Response.json(
      { ok: false, error: "Missing WORKFLOW_ID env var" },
      { status: 500 }
    );
  }

  const session = await openai.beta.chatkit.sessions.create({
    user: crypto.randomUUID(),
    workflow: { id: workflowId },
  });

  return Response.json({ client_secret: session.client_secret });
}
