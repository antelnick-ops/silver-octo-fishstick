import OpenAI from "openai";

/**
 * Shared OpenAI client
 */
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

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

  const response = await client.responses.create({
    model: "gpt-4.1",
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userInput }
    ]
  });

  return response.output_text ?? "No response generated.";
}

/**
 * MAIN ENTRYPOINT
 * This is what your API route will call
 */
export async function runWorkflow(userInput: string) {
  // 1. Supervisor classification
  const classification = await classifyIntent(userInput);

  // 2. Route to correct agent
  const answer = await runSpecialtyAgent(classification, userInput);

  // 3. Return everything needed by UI
  return {
    classification,
    answer
  };
}

