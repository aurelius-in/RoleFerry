"use client";
import { useState } from "react";
import { api } from "@/lib/api";

type Prospect = {
  domain: string;
  top_prospect: {
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
};

export default function LeadsPage() {
  const [csv, setCsv] = useState<string>("");
  const [roleQuery, setRoleQuery] = useState<string>("CEO");
  const [results, setResults] = useState<Prospect[]>([]);
  const [mockMode, setMockMode] = useState<boolean | null>(null);

  async function onRun() {
    const domains = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.toLowerCase().includes("domain"));
    const resp = await api<{ ok: boolean; results: Prospect[]; summary: any }>(
      "/lead-qual/pipeline/run",
      "POST",
      { domains, role_query: roleQuery }
    );
    setResults(resp.results || []);
  }

  async function checkHealth() {
    const h = await api<any>("/health", "GET");
    setMockMode(Boolean(h.mock_mode));
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lead Qualification</h1>
        <button className="text-sm underline" onClick={checkHealth}>
          Check Mock Mode
        </button>
        {mockMode !== null && (
          <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 border border-yellow-500/40">
            Mock Mode {mockMode ? "ON" : "OFF"}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className="block text-sm mb-1">Domains CSV</label>
          <textarea
            className="w-full h-32 p-2 rounded border border-white/10 bg-white/5"
            placeholder="domain\nacme.com\nglobex.com"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Role Query</label>
          <input
            className="w-full p-2 rounded border border-white/10 bg-white/5"
            value={roleQuery}
            onChange={(e) => setRoleQuery(e.target.value)}
          />
          <button className="mt-3 px-3 py-2 rounded bg-blue-600" onClick={onRun}>
            Run Lead-Qual Pipeline
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left opacity-70">
              <th className="p-2">Domain</th>
              <th className="p-2">Top Prospect</th>
              <th className="p-2">Decision</th>
              <th className="p-2">Verification</th>
              <th className="p-2">Cost $</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.domain} className="border-t border-white/10">
                <td className="p-2">{r.domain}</td>
                <td className="p-2">
                  <div className="flex flex-col">
                    <a className="underline" href={r.top_prospect.linkedin_url} target="_blank">
                      {r.top_prospect.name}
                    </a>
                    <span className="opacity-70">{r.top_prospect.title}</span>
                  </div>
                </td>
                <td className="p-2">
                  {r.top_prospect.decision === "yes" ? "✅ yes" : r.top_prospect.decision === "no" ? "❌ no" : "❔ maybe"}
                  <div className="opacity-70">{r.top_prospect.reason}</div>
                </td>
                <td className="p-2">
                  {r.top_prospect.email ? (
                    <div>
                      <div>{r.top_prospect.email}</div>
                      <div className="opacity-70">
                        {r.top_prospect.verification_status} {r.top_prospect.verification_score ?? ""}
                      </div>
                    </div>
                  ) : (
                    <span className="opacity-70">No email</span>
                  )}
                </td>
                <td className="p-2">${r.top_prospect.cost_usd.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


