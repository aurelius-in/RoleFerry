"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import ProspectTable from "@/components/ProspectTable";

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
  const [avgCost, setAvgCost] = useState<number | null>(null);
  const [mockMode, setMockMode] = useState<boolean | null>(null);
  const [sheetPulled, setSheetPulled] = useState<boolean>(false);

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
    setAvgCost(resp.summary?.avg_cost_per_qualified ?? null);
  }

  async function checkHealth() {
    const h = await api<any>("/health", "GET");
    setMockMode(Boolean(h.mock_mode));
  }

  async function pullFromSheets() {
    const r = await api<{ inserted: number; domains: string[] }>("/lead-qual/lead-domains/import-sheets", "POST", {});
    setCsv(["domain", ...r.domains].join("\n"));
    setSheetPulled(true);
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
          <div className="mt-2 flex items-center gap-2 text-xs">
            <button className="px-2 py-1 rounded bg-white/10 border border-white/15" onClick={pullFromSheets}>Pull from Google Sheets</button>
            {sheetPulled && <span className="opacity-70">Filled from Sheets</span>}
          </div>
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

      {avgCost !== null && (
        <div className="p-3 rounded border border-white/10 bg-white/5 text-sm">
          <strong>Avg cost per qualified prospect (last run):</strong> ${Number(avgCost).toFixed(4)}
        </div>
      )}

      <ProspectTable />
    </div>
  );
}


