"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  ts: number;
};

/**
 * ✅ FIXED: discriminated union where BOTH variants contain `ok`
 * - When ok === true → UploadOk (has uploaded_file_ids, status, etc.)
 * - When ok === false → UploadErr (has error/details/allowed)
 */
type UploadOk = {
  ok: true;
  vector_store_id: string;
  uploaded_file_ids: string[];
  file_batch_id: string;
  status: string;
};

type UploadErr = {
  ok: false;
  error: string;
  details?: string;
  allowed?: string[];
};

type UploadResult = UploadOk | UploadErr;

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export default function ChatLikeWidget() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: "assistant",
      text: "Hi — upload your docs, then ask me questions about them.",
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState<string>("");

  const listRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

  useEffect(() => {
    // auto-scroll to bottom
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  function push(role: ChatMessage["role"], text: string) {
    setMessages((m) => [...m, { id: uid(), role, text, ts: Date.now() }]);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;

    push("user", text);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();

      if (!res.ok) {
        push("system", `Error: ${data?.error ?? "Request failed"}`);
        return;
      }

      const reply = data?.reply ?? data?.answer ?? JSON.stringify(data);
      push("assistant", reply);
    } catch (e: any) {
      push("system", `Network error: ${e?.message ?? String(e)}`);
    } finally {
      setSending(false);
    }
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;
    setFiles(picked);
    setUploadInfo("");
  }

  async function uploadFiles() {
    if (!files.length || uploading) return;

    setUploading(true);
    setUploadInfo("");

    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);

      const res = await fetch("/api/upload", { method: "POST", body: fd });

      // NOTE: your /api/upload MUST return { ok: true, ... } on success
      // and { ok: false, error: "...", ... } on failure.
      const data = (await res.json()) as UploadResult;

      // ✅ FIXED: Now TS knows data.error exists ONLY when ok === false
      if (!data.ok) {
        setUploadInfo(
          `Upload failed: ${data.error}${data.details ? ` (${data.details})` : ""}`
        );
        if (data.allowed?.length) {
          push("system", `Allowed types: ${data.allowed.join(", ")}`);
        }
        return;
      }

      setUploadInfo(
        `Uploaded ${data.uploaded_file_ids.length} file(s). Indexing status: ${data.status}`
      );
      push(
        "system",
        `📎 Uploaded ${files.length} file(s) to knowledge base. You can ask questions now.`
      );

      // clear selection
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      setUploadInfo(`Upload error: ${e?.message ?? String(e)}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={styles.shell}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.brand}>
          <div style={styles.dot} />
          <div>
            <div style={styles.title}>Proposal Assistant</div>
            <div style={styles.subtitle}>
              ChatGPT-style widget + file upload → vector store
            </div>
          </div>
        </div>

        <button
          style={styles.smallBtn}
          onClick={() => {
            setMessages([
              {
                id: uid(),
                role: "assistant",
                text: "New session started. Upload docs, then ask me anything.",
                ts: Date.now(),
              },
            ]);
            setUploadInfo("");
            setFiles([]);
            setInput("");
          }}
          title="New chat"
        >
          New
        </button>
      </div>

      {/* Messages */}
      <div ref={listRef} style={styles.chat}>
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              ...styles.row,
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                ...styles.bubble,
                ...(m.role === "user"
                  ? styles.userBubble
                  : m.role === "assistant"
                  ? styles.assistantBubble
                  : styles.systemBubble),
              }}
            >
              <div style={styles.bubbleRole}>
                {m.role === "user" ? "You" : m.role === "assistant" ? "Assistant" : "System"}
              </div>
              <div style={styles.bubbleText}>{m.text}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Upload strip */}
      <div style={styles.uploadStrip}>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={onPickFiles}
          style={{ display: "none" }}
          accept=".pdf,.docx,.txt,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        />

        <button
          style={styles.uploadBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Add documents to the knowledge base"
        >
          📎 Upload
        </button>

        <div style={styles.uploadMeta}>
          <div style={styles.uploadFiles}>
            {files.length ? (
              <>
                <span style={styles.pill}>{files.length} selected</span>
                <span style={styles.filesPreview}>
                  {files.slice(0, 2).map((f) => f.name).join(", ")}
                  {files.length > 2 ? ` (+${files.length - 2} more)` : ""}
                </span>
              </>
            ) : (
              <span style={{ opacity: 0.75 }}>Upload PDFs/DOCX/TXT to improve answers</span>
            )}
          </div>

          <div style={styles.uploadActions}>
            <button
              style={{
                ...styles.smallBtn,
                opacity: files.length ? 1 : 0.5,
                cursor: files.length ? "pointer" : "not-allowed",
              }}
              onClick={uploadFiles}
              disabled={!files.length || uploading}
              title="Send selected files to the vector store"
            >
              {uploading ? "Uploading…" : "Add to Knowledge"}
            </button>
          </div>
        </div>
      </div>

      {uploadInfo ? <div style={styles.uploadInfo}>{uploadInfo}</div> : null}

      {/* Composer */}
      <div style={styles.composer}>
        <textarea
          style={styles.textarea}
          placeholder="Message… (Ask about your uploaded docs)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <button
          style={{
            ...styles.sendBtn,
            opacity: canSend ? 1 : 0.5,
            cursor: canSend ? "pointer" : "not-allowed",
          }}
          onClick={sendMessage}
          disabled={!canSend}
          title="Send message"
        >
          {sending ? "…" : "Send"}
        </button>
      </div>

      <div style={styles.footer}>
        Tip: Upload a SOW, then ask “List deliverables, deadlines, and reporting cadence.”
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    height: "100vh",
    maxHeight: 650,
    width: "100%",
    maxWidth: 560,
    margin: "0 auto",
    border: "1px solid rgba(0,0,0,0.08)",
    borderRadius: 18,
    overflow: "hidden",
    background: "#0b0f19",
    color: "rgba(255,255,255,0.92)",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    padding: "14px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "#0b0f19",
  },
  brand: { display: "flex", alignItems: "center", gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 999, background: "rgba(255,255,255,0.9)" },
  title: { fontWeight: 700, fontSize: 14, letterSpacing: 0.2 },
  subtitle: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  chat: {
    flex: 1,
    padding: 14,
    overflowY: "auto",
    background:
      "radial-gradient(1200px 600px at 50% -100px, rgba(255,255,255,0.08), transparent 60%), #0b0f19",
  },
  row: { display: "flex", marginBottom: 12 },
  bubble: {
    maxWidth: "86%",
    borderRadius: 16,
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.10)",
    backdropFilter: "blur(10px)",
  },
  userBubble: { background: "rgba(255,255,255,0.10)" },
  assistantBubble: { background: "rgba(255,255,255,0.06)" },
  systemBubble: { background: "rgba(255,255,255,0.03)", opacity: 0.9 },
  bubbleRole: { fontSize: 11, opacity: 0.65, marginBottom: 6 },
  bubbleText: { whiteSpace: "pre-wrap", lineHeight: 1.35, fontSize: 13 },
  composer: {
    padding: 12,
    display: "flex",
    gap: 10,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    background: "#0b0f19",
  },
  textarea: {
    flex: 1,
    resize: "none",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    padding: "10px 12px",
    outline: "none",
    fontSize: 13,
    lineHeight: 1.35,
    minHeight: 42,
    maxHeight: 120,
  },
  sendBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.92)",
    fontWeight: 700,
    minWidth: 74,
  },
  uploadStrip: {
    padding: "10px 12px",
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.02)",
  },
  uploadBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  uploadMeta: { flex: 1, display: "flex", justifyContent: "space-between", gap: 10 },
  uploadFiles: { display: "flex", alignItems: "center", gap: 8, minHeight: 22 },
  filesPreview: { fontSize: 12, opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis" },
  pill: {
    fontSize: 11,
    padding: "3px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
  },
  uploadActions: { display: "flex", alignItems: "center" },
  uploadInfo: {
    padding: "8px 12px",
    fontSize: 12,
    opacity: 0.85,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.02)",
  },
  smallBtn: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  footer: {
    padding: "10px 12px",
    fontSize: 11,
    opacity: 0.65,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    background: "#0b0f19",
  },
};
