import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} env var`);
  return v;
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
  try {
    return (JSON.parse(text).classification as string) || "corporate_admin";
  } catch {
    return "corporate_admin";
  }
}

/**
 * Specialty agent runner (WITH vector store retrieval)
 */
async function runSpecialtyAgent(classification: string, userInput: string) {
  const vectorStoreId = mustEnv("VECTOR_STORE_ID");

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

  const retrievalInstructions = `
You MUST use file_search to answer questions based on uploaded documents.
Before answering:
1) Use file_search to find relevant excerpts.
2) Answer ONLY using retrieved text.
3) If nothing is found, say: "I searched the uploaded documents but found no matching text."
4) Quote the supporting text in your answer.
`.trim();

  const response = await client.responses.create({
    model: "gpt-4.1",
    // ✅ IMPORTANT: your OpenAI SDK typing requires vector_store_ids here
    tools: [{ type: "file_search", vector_store_ids: [vectorStoreId] }],
    input: [
      { role: "system", content: `${systemPrompt}\n\n${retrievalInstructions}` },
      { role: "user", content: userInput },
    ],
  });

  return response.output_text ?? "No response generated.";
}

/**
 * MAIN ENTRYPOINT
 * This is what your API route must call
 */
export async function runWorkflow(userInput: string) {
  const classification = await classifyIntent(userInput);
  const answer = await runSpecialtyAgent(classification, userInput);
  return { classification, answer };
}
