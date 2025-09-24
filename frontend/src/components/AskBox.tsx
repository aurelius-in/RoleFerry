"use client";
import { useState } from "react";
import { api } from "@/lib/api";

type AskResponse = {
  answer: string;
  insights?: Record<string, number>;
  actions?: { label: string; endpoint: string }[];
};

export default function AskBox() {
  const [prompt, setPrompt] = useState("");
  const [resp, setResp] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const r = await api<AskResponse>("/ask", "POST", { prompt });
      setResp(r);
    } catch (e) {
      setResp({ answer: String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="max-w-3xl mx-auto w-full space-y-3">
      <div className="rounded-lg border border-white/10 p-4 bg-white/5">
        <div className="text-sm opacity-80 mb-2">All Aboard!</div>
        <textarea
          className="w-full min-h-24 px-3 py-2 rounded bg-white/5 border border-white/10"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask about your data or tell RoleFerry what to do..."
        />
        <div className="mt-2">
          <button onClick={send} disabled={loading} className="px-4 py-2 rounded brand-gradient text-black font-medium">
            {loading ? "Thinking..." : "ASK"}
          </button>
        </div>
      </div>
      {resp ? (
        <div className="rounded-lg border border-white/10 p-4 bg-white/5 space-y-2">
          <div className="text-sm opacity-80">Answer</div>
          <div>{resp.answer}</div>
          {resp.insights ? (
            <div className="text-sm opacity-80">
              Insights: {Object.entries(resp.insights).map(([k, v]) => `${k}: ${v}`).join(" · ")}
            </div>
          ) : null}
          {resp.actions?.length ? (
            <div className="flex flex-wrap gap-2">
              {resp.actions.map((a, i) => (
                <a key={i} href={`/api${a.endpoint}`} target="_blank" className="px-3 py-1 rounded bg-white/10 border border-white/10 text-sm">
                  {a.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}


