import OpenAI from "openai";

/**
 * Shared OpenAI client
 */
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract citations from a Responses API result (best-effort).
 * Your UI can ignore this if you don't need citations.
 */
function extractCitations(response: any) {
  const citations: Array<{ title?: string; url?: string; file_id?: string; quote?: string }> = [];

  try {
    const output = response?.output ?? [];
    for (const item of output) {
      const contentArr = item?.content ?? [];
      for (const c of contentArr) {
        const anns = c?.annotations ?? [];
        for (const a of anns) {
          if (a?.type === "file_citation") {
            citations.push({
              file_id: a?.file_id,
              quote: a?.quote,
            });
          }
          if (a?.type === "url_citation") {
            citations.push({
              title: a?.title,
              url: a?.url,
              quote: a?.quote,
            });
          }
        }
      }
    }
  } catch {
    // ignore
  }

  return citations;
}

/**
 * File-search config (VECTOR_STORE_ID must match the store you ingest uploads into)
 */
function buildTools() {
  const vectorStoreId = process.env.VECTOR_STORE_ID;

  // IMPORTANT: In your SDK typings, file_search requires vector_store_ids ON the tool object
  const tools = vectorStoreId
    ? [{ type: "file_search" as const, vector_store_ids: [vectorStoreId] }]
    : [];

  const retrievalInstructions = vectorStoreId
    ? `\n\nYou have access to a knowledge base via file_search. If the user asks anything that could be answered using uploaded documents, you MUST use file_search first. Quote/cite the source when possible.`
    : `\n\nNo knowledge base is configured (VECTOR_STORE_ID missing). If the user asks about uploaded docs, explain that uploads are not connected.`;

  return { tools, retrievalInstructions, vectorStoreId };
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
`.trim(),
      },
      { role: "user", content: userInput },
    ],
  });

  const text = response.output_text ?? "{}";
  const parsed = JSON.parse(text);
  return String(parsed.classification || "corporate_admin");
}

/**
 * Specialty agent runner (this is what your ChatKit workflow effectively does)
 */
async function runSpecialtyAgent(classification: string, userInput: string) {
  let systemPrompt = "";

  switch (classification) {
    case "pricing_cost":
      systemPrompt = "You are a Pricing & Cost expert for government proposals.";
      break;

    case "corporate_admin":
      systemPrompt = "You are a Corporate & Administrative data expert for proposals.";
      break;

    case "key_personnel_staffing":
      systemPrompt = "You are a Key Personnel & Staffing expert for proposals.";
      break;

    case "management_technical":
      systemPrompt = "You are a Management & Technical Approach expert for DOT contracts.";
      break;

    case "past_performance":
      systemPrompt = "You are a Past Performance expert for government proposals.";
      break;

    default:
      systemPrompt = "You are a helpful proposal assistant.";
  }

  const { tools, retrievalInstructions } = buildTools();

  const response = await client.responses.create({
    model: "gpt-4.1",
    tools,
    input: [
      { role: "system", content: systemPrompt + retrievalInstructions },
      { role: "user", content: userInput },
    ],
  });

  return {
    text: response.output_text ?? "No response generated.",
    citations: extractCitations(response),
  };
}

/**
 * MAIN ENTRYPOINT
 * This is what your API route / ChatKit integration calls
 */
export async function runWorkflow(userInput: string) {
  // 1) Supervisor classification
  const classification = await classifyIntent(userInput);

  // 2) Route to correct agent
  const result = await runSpecialtyAgent(classification, userInput);

  // 3) Return everything needed by UI
  return {
    classification,
    answer: result.text,
    citations: result.citations,
  };
}
