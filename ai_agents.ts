import OpenAI from "openai";

type Citation = {
  /** The exact quoted snippet (best-effort). */
  quote?: string;
  /** Source label / filename if available. */
  source?: string;
  /** File id if available. */
  file_id?: string;
};

/**
 * Shared OpenAI client
 */
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function getVectorStoreId(): string | null {
  const id = process.env.VECTOR_STORE_ID;
  return id && id.trim().length ? id.trim() : null;
}

/**
 * Best-effort extraction of citations/annotations returned by the Responses API.
 * We return something usable for your UI without assuming a specific response shape.
 */
function extractCitations(response: any): Citation[] {
  const citations: Citation[] = [];

  // Newer Responses API shapes often include `output` with messages and content items.
  const output = response?.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      const content = item?.content;
      if (!Array.isArray(content)) continue;
      for (const c of content) {
        const annotations = c?.annotations;
        if (!Array.isArray(annotations)) continue;
        for (const a of annotations) {
          // `file_citation` is the common annotation type for retrieval.
          const isFileCitation = a?.type === "file_citation" || a?.type === "file_reference";
          if (!isFileCitation) continue;
          citations.push({
            quote: a?.quote,
            source: a?.filename || a?.source,
            file_id: a?.file_id,
          });
        }
      }
    }
  }

  // De-dupe (basic)
  const seen = new Set<string>();
  return citations.filter((c) => {
    const key = `${c.file_id || ""}|${c.source || ""}|${c.quote || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Supervisor: classifies the user request
 */
async function classifyIntent(userInput: string) {
  const response = await client.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: `
You are a classification agent.

Classify the user's request into ONE of the following values:
- pricing_cost
- corporate_admin
- key_personnel_staffing
- management_technical
- past_performance

Return ONLY valid JSON:
{ "classification": "<value>" }
`
      },
      {
        role: "user",
        content: userInput
      }
    ]
  });

  const text = response.output_text ?? "{}";
  return JSON.parse(text).classification as string;
}

/**
 * Specialty agent runner
 */
async function runSpecialtyAgent(
  classification: string,
  userInput: string
) {
  let systemPrompt = "";

  switch (classification) {
    case "pricing_cost":
      systemPrompt =
        "You are a Pricing & Cost expert for government proposals.";
      break;

    case "corporate_admin":
      systemPrompt =
        "You are a Corporate & Administrative data expert for proposals.";
      break;

    case "key_personnel_staffing":
      systemPrompt =
        "You are a Key Personnel & Staffing expert for proposals.";
      break;

    case "management_technical":
      systemPrompt =
        "You are a Management & Technical Approach expert for DOT contracts.";
      break;

    case "past_performance":
      systemPrompt =
        "You are a Past Performance expert for government proposals.";
      break;

    default:
      systemPrompt = "You are a helpful proposal assistant.";
  }

  const vectorStoreId = getVectorStoreId();

  // If a vector store is configured, enable retrieval. Otherwise fall back gracefully.
  const tools = vectorStoreId ? [{ type: "file_search" as const }] : undefined;
  const tool_resources = vectorStoreId
    ? { file_search: { vector_store_ids: [vectorStoreId] } }
    : undefined;

  const retrievalInstructions = vectorStoreId
    ? "\n\nIMPORTANT: Use the file_search tool to answer questions based on uploaded documents. Quote and cite the exact relevant text. If the answer is not in the documents, say you could not find it in the uploaded files."
    : "\n\nNOTE: No vector store is configured (VECTOR_STORE_ID missing). Answer normally.";

  const response = await client.responses.create({
    model: "gpt-4.1",
    tools,
    tool_resources,
    input: [
      { role: "system", content: systemPrompt + retrievalInstructions },
      { role: "user", content: userInput }
    ]
  });

  return {
    text: response.output_text ?? "No response generated.",
    citations: extractCitations(response),
    used_vector_store: Boolean(vectorStoreId),
    vector_store_id: vectorStoreId,
  };
}

/**
 * MAIN ENTRYPOINT
 * This is what your API route will call
 */
export async function runWorkflow(userInput: string) {
  // 1. Supervisor classification
  const classification = await classifyIntent(userInput);

  // 2. Route to correct agent
  const result = await runSpecialtyAgent(classification, userInput);

  // 3. Return everything needed by UI
  return {
    classification,
    answer: result.text,
    citations: result.citations,
    used_vector_store: result.used_vector_store,
    vector_store_id: result.vector_store_id,
  };
}

