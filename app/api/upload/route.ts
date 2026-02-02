import OpenAI from "openai";
import { toFile } from "openai/uploads";

export const runtime = "nodejs";

// Simple allowlist (adjust as needed)
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "text/plain"
]);

const MAX_FILE_MB = 20; // change if you want
const MAX_BYTES = MAX_FILE_MB * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const vectorStoreId = process.env.VECTOR_STORE_ID;
    if (!vectorStoreId) {
      return Response.json(
        { error: "Missing VECTOR_STORE_ID env var" },
        { status: 500 }
      );
    }

    // Parse multipart form data
    const form = await req.formData();

    // Your <input name="files" type="file" multiple />
    const files = form.getAll("files") as unknown[];

    if (!files || files.length === 0) {
      return Response.json(
        { error: "No files uploaded. Expected form field name: files" },
        { status: 400 }
      );
    }

    // Validate + upload each file to OpenAI Files
    const uploadedFileIds: string[] = [];

    for (const item of files) {
      if (!(item instanceof File)) {
        return Response.json(
          { error: "Invalid upload. Each item must be a File." },
          { status: 400 }
        );
      }

      // Basic checks
      if (!ALLOWED_MIME_TYPES.has(item.type)) {
        return Response.json(
          {
            error: `File type not allowed: ${item.type || "unknown"}`,
            allowed: Array.from(ALLOWED_MIME_TYPES)
          },
          { status: 400 }
        );
      }

      if (item.size > MAX_BYTES) {
        return Response.json(
          { error: `File too large: ${item.name}. Max ${MAX_FILE_MB}MB.` },
          { status: 400 }
        );
      }

      // Convert File -> Buffer -> OpenAI Uploadable
      const arrayBuffer = await item.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const uploadable = await toFile(buffer, item.name, { type: item.type });

      const uploaded = await openai.files.create({
        file: uploadable,
        // Use "assistants" for Files used with assistants/tools (vector store file search).
        purpose: "assistants"
      });

      uploadedFileIds.push(uploaded.id);
    }

    // Attach uploaded files to the vector store in a single batch
    const batch = await openai.vectorStores.fileBatches.create(vectorStoreId, {
      file_ids: uploadedFileIds
    });

    // Optional: you can poll until indexing is complete (good for UX).
    // For now, we just return the batch id and file ids.
    return Response.json({
      ok: true,
      vector_store_id: vectorStoreId,
      uploaded_file_ids: uploadedFileIds,
      file_batch_id: batch.id,
      status: batch.status
    });
  } catch (err: any) {
    console.error(err);
    return Response.json(
      {
        error: "Upload failed",
        details: err?.message ?? String(err)
      },
      { status: 500 }
    );
  }
}
