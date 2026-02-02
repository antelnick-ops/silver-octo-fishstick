export const runtime = "nodejs";

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;
  const workflowId = process.env.WORKFLOW_ID;

  if (!apiKey) {
    return Response.json({ ok: false, error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }
  if (!workflowId) {
    return Response.json({ ok: false, error: "Missing WORKFLOW_ID" }, { status: 500 });
  }

  // If your ChatKit UI showed version="draft", keep this as "draft".
  // If you want production, delete the "version" field (or set WORKFLOW_VERSION to empty).
  const workflowVersion = process.env.WORKFLOW_VERSION || "draft";

  const res = await fetch("https://api.openai.com/v1/chatkit/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      // Required per ChatKit API docs:
      "OpenAI-Beta": "chatkit_beta=v1",
    },
    body: JSON.stringify({
      user: crypto.randomUUID(),
      workflow: workflowVersion ? { id: workflowId, version: workflowVersion } : { id: workflowId },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return Response.json(
      { ok: false, error: "Failed to create ChatKit session", details: data },
      { status: 500 }
    );
  }

  return Response.json({ client_secret: data.client_secret });
}
