"use client";

import { useState } from "react";

export default function Home() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  async function send() {
    if (!message.trim()) return;

    setLoading(true);
    setReply("");

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const data = await res.json();
    setReply(data.reply || "");
    setLoading(false);
  }

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 720 }}>
      <h1>North Wind Consulting AI</h1>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask a question..."
          style={{
            flex: 1,
            padding: 10,
            border: "1px solid #ccc",
            borderRadius: 8,
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button
          onClick={send}
          disabled={loading}
          style={{ padding: "10px 14px", borderRadius: 8 }}
        >
          {loading ? "..." : "Send"}
        </button>
      </div>

      <div style={{ marginTop: 16, whiteSpace: "pre-wrap" }}>
        {reply && <strong>Reply:</strong>}
        <div>{reply}</div>
      </div>
    </main>
  );
}

