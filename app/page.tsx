"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content: "Hi — I’m North Wind Consulting AI. What can I help you with today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    const nextMessages: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // send the latest user message; you can later send full history if you want
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json();
      setMessages([...nextMessages, { role: "assistant", content: data.reply || "…" }]);
    } catch {
      setMessages([
        ...nextMessages,
        { role: "assistant", content: "Sorry — something went wrong. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div style={styles.brandDot} />
        <div>
          <div style={styles.title}>North Wind Consulting AI</div>
          <div style={styles.subtitle}>Ask a question • Get an answer</div>
        </div>
      </header>

      <main style={styles.chat}>
        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              ...styles.row,
              justifyContent: m.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                ...styles.bubble,
                ...(m.role === "user" ? styles.userBubble : styles.assistantBubble),
              }}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ ...styles.row, justifyContent: "flex-start" }}>
            <div style={{ ...styles.bubble, ...styles.assistantBubble, opacity: 0.8 }}>
              Typing…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      <footer style={styles.footer}>
        <div style={styles.inputWrap}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message North Wind Consulting AI…"
            style={styles.input}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
          />
          <button onClick={send} disabled={loading || !input.trim()} style={styles.button}>
            Send
          </button>
        </div>
        <div style={styles.disclaimer}>
          Responses may be imperfect. Don’t share sensitive information.
        </div>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
    background: "#0b0f17",
    color: "#e7eaf0",
  },
  header: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: "14px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(11,15,23,0.9)",
    backdropFilter: "blur(10px)",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  brandDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "#22c55e",
    boxShadow: "0 0 0 4px rgba(34,197,94,0.15)",
  },
  title: { fontWeight: 700, letterSpacing: 0.2 },
  subtitle: { fontSize: 12, opacity: 0.7, marginTop: 2 },

  chat: {
    flex: 1,
    overflowY: "auto",
    padding: "18px 14px 24px",
    maxWidth: 900,
    width: "100%",
    margin: "0 auto",
  },
  row: { display: "flex", padding: "8px 0" },
  bubble: {
    maxWidth: "80%",
    padding: "12px 14px",
    borderRadius: 16,
    lineHeight: 1.4,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontSize: 15,
  },
  assistantBubble: {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderTopLeftRadius: 6,
  },
  userBubble: {
    background: "rgba(34,197,94,0.18)",
    border: "1px solid rgba(34,197,94,0.25)",
    borderTopRightRadius: 6,
  },

  footer: {
    borderTop: "1px solid rgba(255,255,255,0.08)",
    padding: "12px 12px 14px",
    background: "rgba(11,15,23,0.9)",
    backdropFilter: "blur(10px)",
  },
  inputWrap: {
    display: "flex",
    gap: 10,
    maxWidth: 900,
    margin: "0 auto",
  },
  input: {
    flex: 1,
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#e7eaf0",
    outline: "none",
  },
  button: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.08)",
    color: "#e7eaf0",
    cursor: "pointer",
  },
  disclaimer: {
    maxWidth: 900,
    margin: "10px auto 0",
    fontSize: 12,
    opacity: 0.55,
  },
};
