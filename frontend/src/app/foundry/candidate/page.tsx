"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useFoundry } from "@/context/FoundryContext";

export default function CandidatePage() {
  const { state, setState } = useFoundry();
  const [resume, setResume] = useState("");

  const parse = async () => {
    const res = await api<{ candidate: any; experience: any[] }>("/candidates/parse", "POST", { resume_text: resume });
    setState({ candidate: res.candidate });
    alert("Resume parsed");
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Candidate</h1>
      <textarea className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 min-h-60" value={resume} onChange={(e) => setResume(e.target.value)} placeholder="Paste resume text here" />
      <div>
        <button onClick={parse} className="px-4 py-2 rounded brand-gradient text-black font-medium">Parse</button>
      </div>
      {state.candidate ? (
        <div className="rounded-lg p-4 bg-white/5 border border-white/10">
          <div className="font-medium">{state.candidate.name || "Candidate"} · {state.candidate.seniority}</div>
          <div className="text-sm opacity-80">Domains: {(state.candidate.domains || []).join(", ")}</div>
        </div>
      ) : null}
    </main>
  );
}

