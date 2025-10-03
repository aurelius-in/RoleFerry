"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export default function OfferPage() {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [result, setResult] = useState<any>(null);

  async function onGenerate() {
    const r = await api<any>("/offer-decks/build", "POST", { company, role, problems: [], candidate_profile: {}, uvp: "", evidence_links: [] });
    setResult(r);
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Offer Decks</h1>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm mb-1">Company</label>
          <input className="w-full p-2 rounded bg-white/5 border border-white/10" value={company} onChange={(e)=>setCompany(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Role</label>
          <input className="w-full p-2 rounded bg-white/5 border border-white/10" value={role} onChange={(e)=>setRole(e.target.value)} />
        </div>
        <div className="flex items-end">
          <button className="px-3 py-2 rounded bg-blue-600" onClick={onGenerate}>Generate Deck</button>
        </div>
      </div>
      {result && (
        <pre className="p-3 rounded bg-black/30 border border-white/10 text-xs overflow-auto">{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  );
}


