"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export default function OnePager() {
  const [candidateId, setCandidateId] = useState("cand_demo_1");
  const [url, setUrl] = useState<string | null>(null);
  const gen = async () => {
    const res = await api<{ url: string }>("/onepager/generate", "POST", { candidate_id: candidateId });
    setUrl(res.url);
  };
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">One-pager Generator</h1>
      <div className="flex gap-2">
        <input className="px-3 py-2 rounded bg-white/5 border border-white/10" value={candidateId} onChange={(e) => setCandidateId(e.target.value)} />
        <button onClick={gen} className="px-4 py-2 rounded brand-gradient text-black font-medium">Generate</button>
      </div>
      {url ? (
        <div className="text-sm">
          URL: <a className="underline" href={url} target="_blank">{url}</a>
        </div>
      ) : null}
    </main>
  );
}

