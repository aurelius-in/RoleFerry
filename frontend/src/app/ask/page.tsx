"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import InlineSpinner from "@/components/InlineSpinner";

type AskResponse = { answer: string; insights?: Record<string, number>; actions?: { label: string; endpoint: string }[] };

export default function AskPage() {
  const [prompt, setPrompt] = useState("");
  const [resp, setResp] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true);
    try {
      const r = await api<AskResponse>("/ask", "POST", { prompt });
      setResp(r);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Ask</h1>
      <div className="rounded-lg border border-white/10 p-4 space-y-3">
        <textarea className="w-full min-h-24 px-3 py-2 rounded bg-white/5 border border-white/10" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask anything about your data or tell RoleFerry what to do..." />
        <button onClick={send} disabled={loading} className="px-4 py-2 rounded brand-gradient text-black font-medium inline-flex items-center gap-2">
          {loading ? (
            <>
              <InlineSpinner className="border-black/25 border-t-black/80" />
              <span>Thinking</span>
            </>
          ) : (
            "Send"
          )}
        </button>
      </div>
      {resp ? (
        <div className="rounded-lg border border-white/10 p-4 space-y-3">
          <div className="text-sm opacity-80">Answer</div>
          <div>{resp.answer}</div>
          {resp.insights ? (
            <div className="text-sm opacity-80">Insights: {Object.entries(resp.insights).map(([k, v]) => `${k}: ${v}`).join(" · ")}</div>
          ) : null}
          {resp.actions?.length ? (
            <div className="flex flex-wrap gap-2">
              {resp.actions.map((a, i) => (
                <a key={i} href={`/api${a.endpoint}`} target="_blank" className="px-3 py-1 rounded bg-white/10 border border-white/10 text-sm">{a.label}</a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}


