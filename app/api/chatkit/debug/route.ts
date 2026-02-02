export const runtime = "nodejs";

export async function GET() {
  const hasKey = !!process.env.OPENAI_API_KEY;
  const hasWorkflow = !!process.env.WORKFLOW_ID;

  // Don’t leak secrets
  const keyPreview = process.env.OPENAI_API_KEY
    ? process.env.OPENAI_API_KEY.slice(0, 6) + "..." + process.env.OPENAI_API_KEY.slice(-4)
    : null;

  return Response.json({
    ok: true,
    has_OPENAI_API_KEY: hasKey,
    has_WORKFLOW_ID: hasWorkflow,
    OPENAI_API_KEY_preview: keyPreview,
    WORKFLOW_ID: process.env.WORKFLOW_ID ?? null
  });
}
