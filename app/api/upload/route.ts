export const runtime = "nodejs";

export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;
  const workflowId = process.env.WORKFLOW_ID;
  const workflowVersion = process.env.WORKFLOW_VERSION || "draft";

  if (!apiKey) {
    return Response.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }
  if (!workflowId) {
    return Response.json({ error: "Missing WORKFLOW_ID" }, { status: 500 });
  }

  const upstream = await fetch("https://api.openai.com/v1/chatkit/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "OpenAI-Beta": "chatkit_beta=v1",
    },
    body: JSON.stringify({
      user: crypto.randomUUID(),
      workflow: workflowVersion
        ? { id: workflowId, version: workflowVersion }
        : { id: workflowId },

      // Enable attachments in ChatKit UI
      chatkit_configuration: {
        file_upload: {
          enabled: true,
          max_files: 10,
          max_file_size: 512, // MB
        },
      },
    }),
  });

  const text = await upstream.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!upstream.ok) {
    return Response.json(
      {
        error: "ChatKit session create failed",
        status: upstream.status,
        upstream: data,
        using: { workflowId, workflowVersion: workflowVersion || null },
      },
      { status: 500 }
    );
  }

  return Response.json({ client_secret: data.client_secret });
}
