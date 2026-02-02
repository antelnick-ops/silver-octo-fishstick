"use client";

import { ChatKit, useChatKit } from "@openai/chatkit-react";

export default function Page() {
  const { control } = useChatKit({
    api: {
      async getClientSecret() {
        const res = await fetch("/api/chatkit/session", { method: "POST" });
        const data = await res.json();
        return data.client_secret;
      },
    },
  });

  return (
    <div style={{ height: "100vh", display: "flex", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 560, height: 650 }}>
        <ChatKit control={control} />
      </div>
    </div>
  );
}
