import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// NOTE: Vercel Functions have a ~4.5MB request body limit.
// If you keep MAX_FILE_MB > 4, uploads will fail before this code runs.
// See: FUNCTION_PAYLOAD_TOO_LARGE / 4.5MB limit on Vercel.
const MAX_FILE_MB = 4;
const MAX_BYTES = MAX_FILE_MB * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/octet-stream", // common when browser doesn't know the type
]);

function isAllowedByExtension(filename: string) {
  const lower = filename.toLowerCase();
  return lower.endsWith(".pdf") || lower.endsWith(".docx") || lower.endsWith(".txt");
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const vectorStoreId = process.env.VECTOR_STORE_ID;

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Missing OPENAI_API_KEY env var" },
        { status: 500 }
      );
    }
    if (!vectorStoreId) {
      return NextResponse.json(
        { ok: false, error: "Missing VECTOR_STORE_ID env var" },
        { status: 500 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const form = await req.formData();

    // Accept both "files" (multiple) and "file" (single) to avoid client mismatch
    const rawFiles = [
      ...form.getAll("files"),
      ...(form.get("file") ? [form.get("file")] : []),
    ].filter(Boolean);

    if (rawFiles.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No files uploaded. Use form field name: files (or file)." },
        { status: 400 }
      );
    }

    const uploadedFileIds: string[] = [];

    for (const item of rawFiles) {
      if (!(item instanceof File)) {
        return NextResponse.json(
          { ok: false, error: "Invalid upload. Each item must be a File." },
          { status: 400 }
        );
      }

      // Size check (remember: Vercel will hard-fail above ~4.5MB anyway)
      if (item.size > MAX_BYTES) {
        return NextResponse.json(
          { ok: false, error: `File too large: ${item.name}. Max ~${MAX_FILE_MB}MB on Vercel.` },
          { status: 400 }
        );
      }

      // Type check: allow by MIME OR by extension fallback
      const mime = item.type || "application/octet-stream";
      if (!ALLOWED_MIME_TYPES.has(mime) && !isAllowedByExtension(item.name)) {
        return NextResponse.json(
          {
            ok: false,
            error: `File type not allowed: ${mime || "unknown"}`,
            allowed: ["pdf", "docx", "txt"],
          },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await item.arrayBuffer());
      const uploadable = await toFile(buffer, item.name, { type: mime });

      const uploaded = await openai.files.create({
        file: uploadable,
        purpose: "assistants",
      });

      uploadedFileIds.push(uploaded.id);
    }

    // ✅ Add uploaded files to the vector store and WAIT until indexing finishes
    const batch = await openai.vector_stores.file_batches.create_and_poll(
      vectorStoreId,
      { file_ids: uploadedFileIds }
    troubled);

    if (batch.status !== "completed") {
      return NextResponse.json(
        { ok: false, error: "Vector store indexing did not complete", batch },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      vector_store_id: vectorStoreId,
      uploaded_file_ids: uploadedFileIds,
      file_batch_id: batch.id,
      status: batch.status,
      file_counts: batch.file_counts,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: "Upload failed", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
