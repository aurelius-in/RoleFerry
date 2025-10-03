"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Row = {
  domain: string;
  name: string;
  title: string;
  linkedin_url: string;
  decision: string;
  reason: string;
  email: string | null;
  verification_status: string | null;
  verification_score: number | null;
  cost_usd: number;
};

export default function ProspectTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [decision, setDecision] = useState<string>("");
  const [verif, setVerif] = useState<string>("");
  const [domain, setDomain] = useState<string>("");

  async function load() {
    const qs = new URLSearchParams();
    if (decision) qs.set("decision", decision);
    if (verif) qs.set("verification_status", verif);
    if (domain) qs.set("domain", domain);
    const data = await api<{ prospects: Row[] }>(`/lead-qual/prospects${qs.toString() ? "?" + qs.toString() : ""}`, "GET");
    setRows(data.prospects || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-end">
        <div>
          <label className="block text-xs mb-1">Decision</label>
          <select className="p-2 rounded bg-white/5 border border-white/10" value={decision} onChange={(e)=>setDecision(e.target.value)}>
            <option value="">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="maybe">Maybe</option>
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1">Verification</label>
          <select className="p-2 rounded bg-white/5 border border-white/10" value={verif} onChange={(e)=>setVerif(e.target.value)}>
            <option value="">All</option>
            <option value="valid">Valid</option>
            <option value="accept_all">Accept-All</option>
            <option value="invalid">Invalid</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        <div>
          <label className="block text-xs mb-1">Domain</label>
          <input className="p-2 rounded bg-white/5 border border-white/10" value={domain} onChange={(e)=>setDomain(e.target.value)} placeholder="acme.com" />
        </div>
        <button className="px-3 py-2 rounded bg-blue-600" onClick={load}>Apply</button>
        <div className="flex-1" />
        <a className="px-3 py-2 rounded bg-white/10 border border-white/15" href="/api/exports/instantly.csv" target="_blank" rel="noopener noreferrer">Export CSV (Instantly)</a>
        <a className="px-3 py-2 rounded bg-white/10 border border-white/15" href="/api/exports/prospects.csv" target="_blank" rel="noopener noreferrer">Export CSV (Full Dump)</a>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left opacity-70">
              <th className="p-2">Domain</th>
              <th className="p-2">Prospect</th>
              <th className="p-2">Decision</th>
              <th className="p-2">Verification</th>
              <th className="p-2">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.domain}-${r.linkedin_url}`} className="border-t border-white/10">
                <td className="p-2">{r.domain}</td>
                <td className="p-2">
                  <div className="flex flex-col">
                    <a className="underline" href={r.linkedin_url} target="_blank">{r.name}</a>
                    <span className="opacity-70">{r.title}</span>
                  </div>
                </td>
                <td className="p-2"><span title={r.reason}>{r.decision === "yes" ? "✅ Yes" : r.decision === "no" ? "❌ No" : "❔ Maybe"}</span><div className="opacity-70">{r.reason}</div></td>
                <td className="p-2">{r.email || "—"}<div className="opacity-70"><span title={r.verification_status ? `Status: ${r.verification_status}${r.verification_score ? `, Score ${r.verification_score}` : ''}` : ''}>{r.verification_status ?? ""} {r.verification_score ?? ""}</span></div></td>
                <td className="p-2">${(r.cost_usd ?? 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


