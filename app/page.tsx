"use client";

import React, { useEffect, useState } from "react";
import { ChatKit, useChatKit } from "@openai/chatkit-react";

export default function Page() {
  const [err, setErr] = useState<string | null>(null);

  const { control } = useChatKit({
    api: {
      async getClientSecret() {
        const res = await fetch("/api/chatkit/session", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Session failed");
        if (!data?.client_secret) throw new Error("Missing client_secret");
        return data.client_secret;
      },
    },

    composer: {
      placeholder: "Message…",
      attachments: {
        enabled: true,

        // ✅ Your ChatKit version expects Record<string, string[]>
        accept: {
          "application/pdf": [".pdf"],
          "text/plain": [".txt"],
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
            ".docx",
          ],
        },
      },
    },
  });

  useEffect(() => {
    const onErr = (e: any) => setErr(e?.message ?? String(e));
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr as any);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onErr as any);
    };
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0f19",
        color: "white",
        padding: 16,
        display: "grid",
        placeItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 680 }}>
        <h1 style={{ fontSize: 18, marginBottom: 10 }}>Northwind AI Widget</h1>

        {err ? (
          <pre
            style={{
              background: "rgba(255,0,0,0.12)",
              border: "1px solid rgba(255,0,0,0.35)",
              padding: 12,
              borderRadius: 12,
              whiteSpace: "pre-wrap",
              marginBottom: 12,
            }}
          >
            {String(err)}
          </pre>
        ) : null}

        <div
          style={{
            height: 720,
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <ChatKit
            control={control}
            style={{ height: "100%", width: "100%", display: "block" }}
          />
        </div>
      </div>
    </div>
  );
}
