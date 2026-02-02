import OpenAI from "openai";
import { toFile } from "openai/uploads";

export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain"
]);

const MAX_FILE_MB = 20;
const MAX_BYTES = MAX_FILE_MB * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const vectorStoreId = process.env.VECTOR_STORE_ID;

    if (!apiKey) {
      return Response.json(
        { ok: false, error: "Missing OPENAI_API_KEY env var" },
        { status: 500 }
      );
    }

    if (!vectorStoreId) {
      return Response.json(
        { ok: false, error: "Missing VECTOR_STORE_ID env var" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const form = await req.formData();
    const files = form.getAll("files") as unknown[];

    if (!files || files.length === 0) {
      return Response.json(
        { ok: false, error: "No files uploaded. Expected form field name: files" },
        { status: 400 }
      );
    }

    const uploadedFileIds: string[] = [];

    for (const item of files) {
      if (!(item instanceof File)) {
        return Response.json(
          { ok: false, error: "Invalid upload. Each item must be a File." },
          { status: 400 }
        );
      }

      if (!ALLOWED_MIME_TYPES.has(item.type)) {
        return Response.json(
          {
            ok: false,
            error: `File type not allowed: ${item.type || "unknown"}`,
            allowed: Array.from(ALLOWED_MIME_TYPES)
          },
          { status: 400 }
        );
      }

      if (item.size > MAX_BYTES) {
        return Response.json(
          {
            ok: false,
            error: `File too large: ${item.name}. Max ${MAX_FILE_MB}MB.`
          },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await item.arrayBuffer());
      const uploadable = await toFile(buffer, item.name, { type: item.type });

      const uploaded = await openai.files.create({
        file: uploadable,
        purpose: "assistants"
      });

      uploadedFileIds.push(uploaded.id);
    }

    const batch = await openai.vectorStores.fileBatches.create(vectorStoreId, {
      file_ids: uploadedFileIds
    });

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
        ok: false,
        error: "Upload failed",
        details: err?.message ?? String(err)
      },
      { status: 500 }
    );
  }
}
