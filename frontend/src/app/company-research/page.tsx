"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getCurrentDataMode } from "@/lib/dataMode";
import { formatCompanyName } from "@/lib/format";

type CompanyResearch = {
  company_name: string;
  overview: string;
  recent_news: string;
  culture: string;
  market_position: string;
  hiring_signals: Array<{ label: string; status: "good" | "unknown"; detail: string }>;
  hooks?: string[];
  updated_at: string;
};

type ResearchResponse = {
  success: boolean;
  message: string;
  research_by_contact?: Record<string, any>;
  helper?: { hooks?: string[]; research_scope?: string; scope_target?: string };
};

const STORAGE_BY_COMPANY = "company_research_by_company";
const STORAGE_ACTIVE_COMPANY = "company_research_active_company";

function safeJson<T>(raw: string | null, fallback: T): T {
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    return (parsed as T) ?? fallback;
  } catch {
    return fallback;
  }
}

function pickSectionText(sections: any, needle: string): string {
  const list = Array.isArray(sections) ? sections : [];
  const n = String(needle || "").toLowerCase();
  const hit = list.find((s: any) => String(s?.heading || "").toLowerCase().includes(n));
  return String(hit?.body || "").trim();
}

function joinNews(news: any[]): string {
  const items = Array.isArray(news) ? news : [];
  const lines = items
    .slice(0, 6)
    .map((n) => {
      const t = String(n?.title || "").trim();
      const s = String(n?.summary || "").trim();
      if (!t && !s) return "";
      return t ? `- ${t}${s ? `: ${s}` : ""}` : `- ${s}`;
    })
    .filter(Boolean);
  return lines.join("\n");
}

function toCsvRow(cols: string[]): string {
  const esc = (v: string) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  return cols.map(esc).join(",");
}

export default function CompanyResearchPage() {
  const router = useRouter();
  const [companyQuery, setCompanyQuery] = useState("");
  const [activeCompany, setActiveCompany] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CompanyResearch | null>(null);

  const companyOptions = useMemo(() => {
    const companies = new Set<string>();
    try {
      const jds = safeJson<any[]>(localStorage.getItem("job_descriptions"), []);
      for (const jd of jds || []) {
        const c = String(jd?.company || "").trim();
        if (c) companies.add(c);
      }
    } catch {}
    try {
      const apps = safeJson<any[]>(localStorage.getItem("tracker_applications"), []);
      for (const a of apps || []) {
        const c = String(a?.company?.name || "").trim();
        if (c) companies.add(c);
      }
    } catch {}
    return Array.from(companies).sort((a, b) => a.localeCompare(b));
  }, []);

  const activeCompanyDisplay = formatCompanyName(activeCompany);

  useEffect(() => {
    // Restore last company + saved research
    const savedActive = String(localStorage.getItem(STORAGE_ACTIVE_COMPANY) || "").trim();
    const by = safeJson<Record<string, CompanyResearch>>(localStorage.getItem(STORAGE_BY_COMPANY), {});
    const pick = savedActive && by?.[savedActive] ? savedActive : "";
    if (pick) {
      setActiveCompany(pick);
      setCompanyQuery(pick);
      setDraft(by[pick]);
      localStorage.setItem("selected_company_name", pick);
    }
  }, []);

  async function runResearch(companyName: string) {
    const company = String(companyName || "").trim();
    if (!company) return;
    setIsRunning(true);
    setError(null);
    setNotice(null);
    try {
      const selectedJD = safeJson<any>(localStorage.getItem("selected_job_description"), null);
      const resumeExtract = safeJson<any>(localStorage.getItem("resume_extract"), null);
      const selectedJobId = String(localStorage.getItem("selected_job_description_id") || "").trim();
      const matchesByJob = safeJson<Record<string, any[]>>(localStorage.getItem("painpoint_matches_by_job"), {});
      const painpointMatches = (selectedJobId && matchesByJob?.[selectedJobId]) ? matchesByJob[selectedJobId] : [];

      // Use the existing backend research engine, but treat this as "company only".
      // We send a single dummy contact id so the backend returns a stable shape.
      const resp = await api<ResearchResponse>("/context-research/research", "POST", {
        contact_ids: ["company"],
        company_name: company,
        selected_job_description: selectedJD,
        resume_extract: resumeExtract,
        painpoint_matches: painpointMatches,
        contacts: [{ id: "company", name: formatCompanyName(company), title: "Company", company }],
        data_mode: getCurrentDataMode(),
      });

      if (!resp?.success) throw new Error(resp?.message || "Company research failed");
      const byContact = resp.research_by_contact || {};
      const entry = byContact["company"] || Object.values(byContact)[0] || {};
      const companySummary = entry?.company_summary || {};
      const news = entry?.recent_news || [];
      const sections = entry?.background_report_sections || [];

      const overview = String(companySummary?.description || "").trim();
      const culture = pickSectionText(sections, "culture") || pickSectionText(sections, "values");
      const market = pickSectionText(sections, "market") || pickSectionText(sections, "product") || pickSectionText(sections, "moves");
      const hiring = pickSectionText(sections, "hiring") || pickSectionText(sections, "team growth");

      const signals: CompanyResearch["hiring_signals"] = [
        { label: "Hiring / team growth", status: hiring ? "good" : "unknown", detail: hiring || "No clear hiring signal found yet." },
        { label: "Recent news", status: Array.isArray(news) && news.length ? "good" : "unknown", detail: Array.isArray(news) && news.length ? "Recent items found." : "No recent items found yet." },
        { label: "Company culture / values", status: culture ? "good" : "unknown", detail: culture || "No clear culture signal found yet." },
      ];

      const next: CompanyResearch = {
        company_name: company,
        overview: overview || `${formatCompanyName(company)} overview (add a few lines here).`,
        recent_news: joinNews(news as any[]) || "",
        culture: culture || "",
        market_position: market || "",
        hiring_signals: signals,
        hooks: Array.isArray(resp?.helper?.hooks) ? resp.helper!.hooks : undefined,
        updated_at: new Date().toISOString(),
      };

      setDraft(next);
      setActiveCompany(company);
      setCompanyQuery(company);
      localStorage.setItem(STORAGE_ACTIVE_COMPANY, company);
      localStorage.setItem("selected_company_name", company);
      setNotice("Company research generated. Review/edit, then Save.");
      window.setTimeout(() => setNotice(null), 2500);
    } catch (e: any) {
      setError(String(e?.message || "Failed to run company research."));
    } finally {
      setIsRunning(false);
    }
  }

  function saveResearch() {
    if (!draft?.company_name) return;
    const by = safeJson<Record<string, CompanyResearch>>(localStorage.getItem(STORAGE_BY_COMPANY), {});
    by[draft.company_name] = { ...draft, updated_at: new Date().toISOString() };
    localStorage.setItem(STORAGE_BY_COMPANY, JSON.stringify(by));
    localStorage.setItem(STORAGE_ACTIVE_COMPANY, draft.company_name);
    localStorage.setItem("company_research", JSON.stringify(by[draft.company_name])); // single active snapshot
    localStorage.setItem("selected_company_name", draft.company_name);
    setNotice("Company research saved. Ready for Decision Makers.");
    window.setTimeout(() => setNotice(null), 2500);
  }

  function exportCsv() {
    if (!draft) return;
    const csv =
      [
        toCsvRow(["company_name", "overview", "recent_news", "culture", "market_position", "updated_at"]),
        toCsvRow([
          draft.company_name,
          draft.overview,
          draft.recent_news,
          draft.culture,
          draft.market_position,
          draft.updated_at,
        ]),
      ].join("\n") + "\n";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `company-research_${draft.company_name.toLowerCase().replace(/\s+/g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const canContinue = Boolean(draft?.company_name);

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-4">
          <a href="/painpoint-match" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
            <span className="mr-2">←</span> Back to Match
          </a>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">Company Research</h1>
            <p className="text-white/70">
              Hiring signals and company intelligence to contextualize your outreach. Select a company (not a person).
            </p>
          </div>

          {error ? (
            <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}
          {notice ? (
            <div className="mb-6 rounded-md border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {notice}
            </div>
          ) : null}

          {/* Company chooser */}
          <div className="rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
              <div>
                <div className="text-sm font-bold text-white">Company</div>
                <div className="text-xs text-white/60">Pick a company from your imported jobs (or type one).</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isRunning || !companyQuery.trim()}
                  onClick={() => runResearch(companyQuery)}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isRunning ? "Researching…" : "Run Company Research"}
                </button>
                <button
                  type="button"
                  disabled={!draft}
                  onClick={exportCsv}
                  className="rounded-md border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50"
                >
                  Export CSV
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
              <div className="md:col-span-8">
                <input
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                  placeholder="Type a company name (e.g., Zapier)…"
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-4">
                <select
                  value={activeCompany}
                  onChange={(e) => {
                    const v = String(e.target.value || "").trim();
                    if (!v) return;
                    setActiveCompany(v);
                    setCompanyQuery(v);
                    const by = safeJson<Record<string, CompanyResearch>>(localStorage.getItem(STORAGE_BY_COMPANY), {});
                    if (by?.[v]) setDraft(by[v]);
                  }}
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select from imported…</option>
                  {companyOptions.slice(0, 80).map((c) => (
                    <option key={`co_${c}`} value={c}>
                      {formatCompanyName(c)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Hiring Signals */}
          {draft ? (
            <div className="mt-6 rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-bold text-white mb-1">Hiring Signals</div>
              <div className="text-xs text-white/60 mb-3">
                Quick, outreach-relevant signals for <span className="font-semibold text-white/80">{activeCompanyDisplay}</span>.
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left text-white/70 text-[11px] uppercase tracking-wider">
                      <th className="border-b border-white/10 py-2 pr-3">Signal</th>
                      <th className="border-b border-white/10 py-2 pr-3">Status</th>
                      <th className="border-b border-white/10 py-2">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(draft.hiring_signals || []).map((s, idx) => (
                      <tr key={`sig_${idx}`} className="align-top">
                        <td className="border-b border-white/10 py-2 pr-3 font-semibold text-white/85">{s.label}</td>
                        <td className="border-b border-white/10 py-2 pr-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                              s.status === "good"
                                ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/25"
                                : "bg-white/5 text-white/60 border-white/10"
                            }`}
                          >
                            {s.status === "good" ? "Signal" : "Unknown"}
                          </span>
                        </td>
                        <td className="border-b border-white/10 py-2 text-white/75 whitespace-pre-wrap">{s.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Company Briefing */}
          {draft ? (
            <div className="mt-6 rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-white">Company Briefing</div>
                  <div className="text-xs text-white/60">Edit these to refine your knowledge base (used downstream).</div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isRunning || !draft.company_name}
                    onClick={() => runResearch(draft.company_name)}
                    className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50"
                  >
                    Regenerate briefing
                  </button>
                  <button
                    type="button"
                    onClick={saveResearch}
                    className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Save research
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Company Overview</div>
                  <textarea
                    value={draft.overview}
                    onChange={(e) => setDraft({ ...draft, overview: e.target.value })}
                    rows={6}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="mt-2 text-[11px] text-white/60">
                    Variables:{" "}
                    <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                      {"{{company_summary}}"}
                    </code>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Recent News</div>
                  <textarea
                    value={draft.recent_news}
                    onChange={(e) => setDraft({ ...draft, recent_news: e.target.value })}
                    rows={6}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="- News item…"
                  />
                  <div className="mt-2 text-[11px] text-white/60">
                    Variable:{" "}
                    <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                      {"{{recent_news}}"}
                    </code>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Company Culture & Values</div>
                  <textarea
                    value={draft.culture}
                    onChange={(e) => setDraft({ ...draft, culture: e.target.value })}
                    rows={6}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="What do they value? How do they operate?"
                  />
                  <div className="mt-2 text-[11px] text-white/60">
                    Variable:{" "}
                    <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                      {"{{company_culture}}"}
                    </code>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Market Position</div>
                  <textarea
                    value={draft.market_position}
                    onChange={(e) => setDraft({ ...draft, market_position: e.target.value })}
                    rows={6}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Competitors, positioning, and what matters right now."
                  />
                  <div className="mt-2 text-[11px] text-white/60">
                    Variable:{" "}
                    <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                      {"{{company_market_position}}"}
                    </code>
                  </div>
                </div>
              </div>

              {Array.isArray(draft.hooks) && draft.hooks.length ? (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
                    Outreach angles (auto)
                  </div>
                  <ul className="space-y-1 text-sm text-white/75">
                    {draft.hooks.slice(0, 8).map((h, i) => (
                      <li key={`hk_${i}`}>- {h}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => router.push("/find-contact")}
              className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              title={!canContinue ? "Run and save company research first." : "Continue to Decision Makers"}
            >
              Continue to Decision Makers →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

