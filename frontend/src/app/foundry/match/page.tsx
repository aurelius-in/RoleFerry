"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useFoundry } from "@/context/FoundryContext";

export default function MatchPage() {
  const { state } = useFoundry();
  const [jobIds, setJobIds] = useState("job_demo_1");
  const [matches, setMatches] = useState<any[]>([]);

  const score = async () => {
    const ids = jobIds.split(",").map((s) => s.trim()).filter(Boolean);
    const res = await api<{ matches: any[] }>("/matches/score", "POST", { candidate_id: state.candidate?.id || "cand_demo_1", job_ids: ids });
    setMatches(res.matches);
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Match</h1>
      <div className="flex items-center gap-2">
        <input className="px-3 py-2 rounded bg-white/5 border border-white/10 w-full" value={jobIds} onChange={(e) => setJobIds(e.target.value)} />
        <button onClick={score} className="px-4 py-2 rounded brand-gradient text-black font-medium">Score</button>
      </div>
      <div className="rounded-lg border border-white/10 divide-y divide-white/10">
        {matches.map((m) => (
          <div key={m.job_id} className="p-3">
            <div className="font-medium">{m.job_id} · Score {m.score}</div>
            <div className="text-sm opacity-80">Reasons: {m.reasons?.join(", ")}</div>
            <div className="text-sm opacity-80">Blockers: {m.blockers?.join(", ")}</div>
          </div>
        ))}
      </div>
    </main>
  );
}

