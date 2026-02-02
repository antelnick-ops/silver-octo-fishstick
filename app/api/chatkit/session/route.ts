export const runtime = "nodejs";

export async function POST() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const workflowId = process.env.WORKFLOW_ID;
    const workflowVersion = process.env.WORKFLOW_VERSION || "draft";

    if (!apiKey) {
      return Response.json({ ok: false, error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }
    if (!workflowId) {
      return Response.json({ ok: false, error: "Missing WORKFLOW_ID" }, { status: 500 });
    }

    const payload = {
      user: crypto.randomUUID(),
      workflow: workflowVersion
        ? { id: workflowId, version: workflowVersion }
        : { id: workflowId },
      file_upload: { enabled: true },
    };

    const res = await fetch("https://api.openai.com/v1/chatkit/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "OpenAI-Beta": "chatkit_beta=v1",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text(); // <-- IMPORTANT: don't assume JSON on errors

    if (!res.ok) {
      return Response.json(
        {
          ok: false,
          error: "Failed to create ChatKit session",
          status: res.status,
          details: text, // <-- THIS will show you the real problem
          sent: payload,
        },
        { status: 500 }
      );
    }

    const data = JSON.parse(text);
    return Response.json({ client_secret: data.client_secret });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: "Server error in /api/chatkit/session", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
