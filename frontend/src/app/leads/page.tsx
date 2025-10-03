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
  const [compare, setCompare] = useState<{ roleferry: number; clay: number } | null>(null);
  const [temperature, setTemperature] = useState<number>(0.2);
  const [sheetPulled, setSheetPulled] = useState<boolean>(false);
  const [meshEnabled, setMeshEnabled] = useState<boolean>(true);

  async function onRun() {
    const domains = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.toLowerCase().includes("domain"));
    const resp = await api<{ ok: boolean; results: Prospect[]; summary: any }>(
      "/lead-qual/pipeline/run",
      "POST",
      { domains, role_query: roleQuery, temperature }
    );
    setResults(resp.results || []);
    setAvgCost(resp.summary?.avg_cost_per_qualified ?? null);
  }

  // no visible mock-mode checks in demo UI

  async function pullFromSheets() {
    const r = await api<{ inserted: number; domains: string[] }>("/lead-qual/lead-domains/import-sheets", "POST", {});
    setCsv(["domain", ...r.domains].join("\n"));
    setSheetPulled(true);
  }

  function downloadSampleCsv() {
    const rows = ["domain","acme.com","globex.com","initech.com","umbrella.com","hooli.com"]; 
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "domains.sample.csv";
    a.click();
  }

  async function loadCompare() {
    const c = await api<{ per_lead: { roleferry: number; clay: number } }>("/costs/compare?sample=10", "GET");
    setCompare({ roleferry: c.per_lead.roleferry, clay: c.per_lead.clay });
  }

  // Gating: hide feature if Mesh is disabled
  (async () => {
    try {
      const s = await api<any>("/settings", "GET");
      if (typeof s.mesh_clone_enabled === "boolean") setMeshEnabled(Boolean(s.mesh_clone_enabled));
    } catch (_) {}
  })();

  // Keyboard shortcut: Ctrl/Cmd+Enter to run
  if (typeof window !== "undefined") {
    window.onkeydown = (e: KeyboardEvent) => {
      const isRun = (e.ctrlKey || e.metaKey) && e.key === "Enter";
      if (isRun) { onRun(); }
    };
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lead Qualification</h1>
      </div>

      <div className="sticky top-0 z-10 backdrop-blur supports-backdrop-blur:bg-white/5 bg-black/20 border border-white/10 rounded p-3 grid gap-3 sm:grid-cols-3">
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
            <button className="px-2 py-1 rounded bg-white/10 border border-white/15" onClick={downloadSampleCsv}>Download sample CSV</button>
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">Role Query</label>
          <input
            className="w-full p-2 rounded border border-white/10 bg-white/5"
            value={roleQuery}
            onChange={(e) => setRoleQuery(e.target.value)}
          />
          <div className="mt-2 text-xs">
            <label className="block mb-1">Qualifier temperature: {temperature.toFixed(2)}</label>
            <input type="range" min={0} max={1} step={0.05} value={temperature} onChange={(e)=>setTemperature(parseFloat(e.target.value))} />
          </div>
          <button className="mt-3 px-3 py-2 rounded bg-blue-600" onClick={onRun}>
            Run Lead-Qual Pipeline
          </button>
          <button className="mt-3 ml-2 px-3 py-2 rounded bg-white/10 border border-white/15" onClick={loadCompare}>
            Load Cost Compare
          </button>
        </div>
      </div>

      {avgCost !== null && (
        <div className="p-3 rounded border border-white/10 bg-white/5 text-sm">
          <strong>Avg cost per qualified prospect (last run):</strong> ${Number(avgCost).toFixed(4)}
        </div>
      )}

      {compare && (
        <div className="p-3 rounded border border-white/10 bg-white/5 text-sm">
          <strong>Cost per qualified lead (est):</strong> RoleFerry ${compare.roleferry.toFixed(4)} vs Benchmark ${compare.clay.toFixed(2)}
        </div>
      )}

      {meshEnabled ? (
        <ProspectTable />
      ) : (
        <div className="p-3 rounded border border-white/10 bg-white/5 text-sm">This feature is not enabled on this deployment.</div>
      )}
    </div>
  );
}


