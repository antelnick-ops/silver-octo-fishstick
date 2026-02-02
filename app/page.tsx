"use client";

import { useState } from "react";

export default function Home() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage() {
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
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 700 }}>
      <h1>North Wind Consulting AI</h1>

      <p>Ask me anything:</p>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your question..."
          style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          style={{ padding: "10px 14px", borderRadius: 8 }}
        >
          {loading ? "..." : "Send"}
        </button>
      </div>

      {reply && (
        <div style={{ marginTop: 20, padding: 12, background: "#f4f4f4", borderRadius: 8 }}>
          <strong>Reply:</strong>
          <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{reply}</div>
        </div>
      )}
    </main>
  );
}
