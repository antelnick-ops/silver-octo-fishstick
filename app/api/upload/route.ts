import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_MB = 4;
const MAX_BYTES = MAX_FILE_MB * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/octet-stream",
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
      return NextResponse.json({ ok: false, success: false, error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }
    if (!vectorStoreId) {
      return NextResponse.json({ ok: false, success: false, error: "Missing VECTOR_STORE_ID" }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });

    const form = await req.formData();

    const rawFiles = [
      ...form.getAll("files"),
      ...(form.get("file") ? [form.get("file")] : []),
    ].filter(Boolean);

    if (rawFiles.length === 0) {
      return NextResponse.json(
        { ok: false, success: false, error: "No files uploaded. Use form field name: files (or file)." },
        { status: 400 }
      );
    }

    const uploadedFileIds: string[] = [];

    for (const item of rawFiles) {
      if (!(item instanceof File)) {
        return NextResponse.json(
          { ok: false, success: false, error: "Invalid upload. Each item must be a File." },
          { status: 400 }
        );
      }

      if (item.size > MAX_BYTES) {
        return NextResponse.json(
          { ok: false, success: false, error: `File too large: ${item.name}. Max ~${MAX_FILE_MB}MB on Vercel.` },
          { status: 400 }
        );
      }

      const mime = item.type || "application/octet-stream";
      if (!ALLOWED_MIME_TYPES.has(mime) && !isAllowedByExtension(item.name)) {
        return NextResponse.json(
          { ok: false, success: false, error: `File type not allowed: ${mime}`, allowed: ["pdf", "docx", "txt"] },
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

    // ✅ Correct SDK casing for your version
    const batch = await openai.vectorStores.fileBatches.createAndPoll(
      vectorStoreId,
      { file_ids: uploadedFileIds }
    );

    if (batch.status !== "completed") {
      return NextResponse.json(
        { ok: false, success: false, error: "Vector store indexing did not complete", batch },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      success: true,
      message: "Added to knowledge base",
      status: "completed",
      file_batch_id: batch.id,
      file_ids: uploadedFileIds,
      uploaded_file_ids: uploadedFileIds,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, success: false, error: "Upload failed", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
