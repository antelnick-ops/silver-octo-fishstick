"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  ts: number;
};

type UploadOk = {
  ok: true;
  vector_store_id: string;
  uploaded_file_ids: string[];
  file_batch_id: string;
  status: string;
};

type UploadErr = {
  error: string;
  details?: string;
  allowed?: string[];
};

type UploadResult = UploadOk | UploadErr;

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function isUploadOk(x: UploadResult): x is UploadOk {
  return (x as any)?.ok === true && Array.isArray((x as any)?.uploaded_file_ids);
}

const THEMES = {
  dark: {
    bg: "#0b0f19",
    surface: "rgba(255,255,255,0.02)",
    surfaceStrong: "rgba(255,255,255,0.06)",
    text: "rgba(255,255,255,0.92)",
    textMuted: "rgba(255,255,255,0.70)",
    border: "rgba(255,255,255,0.10)",
    borderSoft: "rgba(255,255,255,0.08)",
    userBubble: "rgba(255,255,255,0.10)",
    assistantBubble: "rgba(255,255,255,0.06)",
    systemBubble: "rgba(255,255,255,0.03)",
    btn: "rgba(255,255,255,0.06)",
    btnStrong: "rgba(255,255,255,0.10)",
    dot: "rgba(255,255,255,0.9)",
    chatBg:
      "radial-gradient(1200px 600px at 50% -100px, rgba(255,255,255,0.08), transparent 60%), #0b0f19",
  },
  light: {
    bg: "#ffffff",
    surface: "#f7f7fb",
    surfaceStrong: "#ffffff",
    text: "rgba(0,0,0,0.88)",
    textMuted: "rgba(0,0,0,0.62)",
    border: "rgba(0,0,0,0.12)",
    borderSoft: "rgba(0,0,0,0.10)",
    userBubble: "rgba(0,0,0,0.06)",
    assistantBubble: "rgba(0,0,0,0.03)",
    systemBubble: "rgba(0,0,0,0.02)",
    btn: "#ffffff",
    btnStrong: "#f0f0f5",
    dot: "rgba(0,0,0,0.7)",
    chatBg:
      "radial-gradient(1200px 600px at 50% -100px, rgba(0,0,0,0.05), transparent 60%), #ffffff",
  },
} as const;

type ThemeName = keyof typeof THEMES;

export default function ChatLikeWidget() {
  const [theme, setTheme] = useState<ThemeName>("dark");

  // Persist theme
  useEffect(() => {
    const saved = localStorage.getItem("widget-theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
    else {
      // optional: default to system preference
      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
      setTheme(prefersDark ? "dark" : "light");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("widget-theme", theme);
  }, [theme]);

  const t = THEMES[theme];

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

  const canSend = useMemo(
    () => input.trim().length > 0 && !sending,
    [input, sending]
  );

  // Auto-scroll chat on new message
  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
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

      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { raw };
      }

      if (!res.ok) {
        push("system", `Error: ${data?.error ?? "Request failed"}`);
        return;
      }

      const reply =
        data?.reply ??
        data?.answer ??
        data?.message ??
        (typeof data === "string" ? data : JSON.stringify(data, null, 2));

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

      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });

      const raw = await res.text();
      let data: UploadResult;
      try {
        data = raw
          ? (JSON.parse(raw) as UploadResult)
          : ({ error: "Empty response" } as any);
      } catch {
        data = { error: "Invalid JSON response from /api/upload", details: raw } as any;
      }

      if (!res.ok) {
        setUploadInfo(
          `Upload failed: ${(data as any)?.error ?? "Unknown error"}${
            (data as any)?.details ? ` — ${(data as any).details}` : ""
          }`
        );
        return;
      }

      if (!isUploadOk(data)) {
        setUploadInfo("Upload succeeded but response format was unexpected.");
        return;
      }

      setUploadInfo(
        `Uploaded ${data.uploaded_file_ids.length} file(s). Indexing status: ${data.status}`
      );

      push(
        "system",
        `📎 Uploaded ${files.length} file(s) to the knowledge base. Ask a question now.`
      );

      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e: any) {
      setUploadInfo(`Upload error: ${e?.message ?? String(e)}`);
    } finally {
      setUploading(false);
    }
  }

  function resetChat() {
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
  }

  const styles: Record<string, React.CSSProperties> = {
    shell: {
      // Responsive sizing: fits within viewport and shrinks on small screens
      width: "min(560px, 92vw)",
      height: "min(650px, 80vh)",
      maxHeight: "calc(100vh - 24px)",
      margin: "12px auto",
      border: `1px solid ${t.borderSoft}`,
      borderRadius: 18,
      overflow: "hidden",
      background: t.bg,
      color: t.text,
      display: "flex",
      flexDirection: "column",
      minHeight: 0, // important for shrink/scroll
      boxShadow:
        theme === "dark"
          ? "0 20px 60px rgba(0,0,0,0.45)"
          : "0 20px 60px rgba(0,0,0,0.15)",
    },

    header: {
      padding: "14px 14px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottom: `1px solid ${t.borderSoft}`,
      background: t.bg,
      gap: 10,
      flexShrink: 0,
    },

    brand: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
    dot: {
      width: 12,
      height: 12,
      borderRadius: 999,
      background: t.dot,
      flexShrink: 0,
    },
    title: { fontWeight: 700, fontSize: 14, letterSpacing: 0.2 },
    subtitle: { fontSize: 12, color: t.textMuted, marginTop: 2 },

    headerActions: { display: "flex", alignItems: "center", gap: 8 },

    chat: {
      flex: 1,
      minHeight: 0,
      padding: 14,
      overflowY: "auto",
      background: t.chatBg,
    },

    row: { display: "flex", marginBottom: 12 },

    bubble: {
      maxWidth: "86%",
      borderRadius: 16,
      padding: "10px 12px",
      border: `1px solid ${t.border}`,
      backdropFilter: "blur(10px)",
      wordBreak: "break-word",
    },
    userBubble: { background: t.userBubble },
    assistantBubble: { background: t.assistantBubble },
    systemBubble: { background: t.systemBubble, opacity: 0.95 },

    bubbleRole: { fontSize: 11, color: t.textMuted, marginBottom: 6 },
    bubbleText: { whiteSpace: "pre-wrap", lineHeight: 1.35, fontSize: 13 },

    uploadStrip: {
      padding: "10px 12px",
      display: "flex",
      gap: 10,
      alignItems: "flex-start",
      borderTop: `1px solid ${t.borderSoft}`,
      background: t.surface,
      flexShrink: 0,
    },

    uploadBtn: {
      padding: "10px 12px",
      borderRadius: 14,
      border: `1px solid ${t.border}`,
      background: t.btn,
      color: t.text,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap",
    },

    uploadMeta: {
      flex: 1,
      display: "flex",
      justifyContent: "space-between",
      gap: 10,
      minWidth: 0,
    },

    uploadFiles: { display: "flex", alignItems: "center", gap: 8, minHeight: 22, minWidth: 0 },
    filesPreview: {
      fontSize: 12,
      color: t.textMuted,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      minWidth: 0,
    },
    pill: {
      fontSize: 11,
      padding: "3px 8px",
      borderRadius: 999,
      border: `1px solid ${t.border}`,
      background: t.btn,
      color: t.text,
      flexShrink: 0,
    },
    uploadActions: { display: "flex", alignItems: "center" },

    uploadInfo: {
      padding: "8px 12px",
      fontSize: 12,
      color: t.textMuted,
      borderTop: `1px solid ${t.borderSoft}`,
      background: t.surface,
      flexShrink: 0,
    },

    composer: {
      padding: 12,
      display: "flex",
      gap: 10,
      borderTop: `1px solid ${t.borderSoft}`,
      background: t.bg,
      flexShrink: 0,
    },

    textarea: {
      flex: 1,
      resize: "none",
      borderRadius: 14,
      border: `1px solid ${t.border}`,
      background: t.surfaceStrong,
      color: t.text,
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
      border: `1px solid ${t.border}`,
      background: t.btnStrong,
      color: t.text,
      fontWeight: 700,
      minWidth: 74,
    },

    smallBtn: {
      padding: "8px 10px",
      borderRadius: 12,
      border: `1px solid ${t.border}`,
      background: t.btn,
      color: t.text,
      cursor: "pointer",
      fontSize: 12,
      fontWeight: 700,
      whiteSpace: "nowrap",
    },

    footer: {
      padding: "10px 12px",
      fontSize: 11,
      color: t.textMuted,
      borderTop: `1px solid ${t.borderSoft}`,
      background: t.bg,
      flexShrink: 0,
    },
  };

  return (
    <div style={styles.shell}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.brand}>
          <div style={styles.dot} />
          <div style={{ minWidth: 0 }}>
            <div style={styles.title}>Proposal Assistant</div>
            <div style={styles.subtitle}>
              Chat widget + file upload → vector store
            </div>
          </div>
        </div>

        <div style={styles.headerActions}>
          <button
            style={styles.smallBtn}
            onClick={() => setTheme((x) => (x === "dark" ? "light" : "dark"))}
            title="Toggle theme"
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>

          <button style={styles.smallBtn} onClick={resetChat} title="New chat">
            New
          </button>
        </div>
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
          title="Select documents"
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
              <span style={{ color: t.textMuted }}>
                Upload PDFs/DOCX/TXT to improve answers
              </span>
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
              title="Upload selected files to vector store"
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
          title="Send"
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
