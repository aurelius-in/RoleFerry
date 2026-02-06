"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getCurrentDataMode } from "@/lib/dataMode";
import { formatCompanyName } from "@/lib/format";

type CompanyResearch = {
  company_name: string;
  overview: string;
  theme: string;
  recent_news: string;
  culture: string;
  market_position: string;
  product_launches: string;
  leadership_changes: string;
  other_hiring_signals: string;
  recent_posts: string;
  publications: string;
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

function safeText(v: any): string {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}

function extractHiringSignals(sections: any, news: any[]): CompanyResearch["hiring_signals"] {
  const sec = Array.isArray(sections) ? sections : [];
  const hiringText =
    pickSectionText(sec, "hiring") ||
    pickSectionText(sec, "team growth") ||
    pickSectionText(sec, "headcount") ||
    pickSectionText(sec, "layoffs");

  const newsItems = Array.isArray(news) ? news : [];
  const newsLines = newsItems
    .slice(0, 8)
    .map((n) => `${safeText(n?.title)} ${safeText(n?.summary)}`.trim())
    .filter(Boolean);

  const corpus = [hiringText, ...newsLines].filter(Boolean).join("\n");
  const out: CompanyResearch["hiring_signals"] = [];

  const push = (label: string, detail: string) => {
    const d = safeText(detail);
    if (!d) return;
    out.push({ label, status: "good", detail: d });
  };

  // Open roles / openings
  (() => {
    const patterns: RegExp[] = [
      /\b(\d{1,4})\+?\s+(open\s+roles|open\s+positions|job\s+openings|openings|roles\s+open)\b/i,
      /\b(\d{1,4})\+?\s+jobs\b/i,
    ];
    for (const re of patterns) {
      const m = corpus.match(re);
      if (m && m[1]) {
        push(
          "Open roles",
          `${m[1]} openings mentioned. This usually signals active hiring (and urgency to fill key roles).`
        );
        return;
      }
    }
  })();

  // Funding / financing
  (() => {
    const hit = newsItems.find((n) => /funding|raised|series\s+[a-e]|seed|financing|investor/i.test(`${n?.title || ""} ${n?.summary || ""}`));
    if (hit) {
      const title = safeText(hit?.title);
      const summary = safeText(hit?.summary);
      push(
        "Funding / runway signal",
        `${title || "Funding/news"}${summary ? ` — ${summary}` : ""} Fresh capital often correlates with headcount growth or new team build-outs.`
      );
    }
  })();

  // Expansion / growth signal
  (() => {
    const hit = newsItems.find((n) =>
      /expan(d|sion)|opening\s+(a\s+)?new\s+office|new\s+market|international|scale|hypergrowth|growth\s+plan/i.test(
        `${n?.title || ""} ${n?.summary || ""}`
      )
    );
    if (hit) {
      const title = safeText(hit?.title);
      const summary = safeText(hit?.summary);
      push(
        "Expansion signal",
        `${title || "Growth/news"}${summary ? ` — ${summary}` : ""} Expansion usually means new goals + staffing needs (good timing to reach out).`
      );
    }
  })();

  // Leadership changes
  (() => {
    const hit = newsItems.find((n) =>
      /appointed|named|joins?\s+as|new\s+(ceo|cto|cpo|cmo|cfo|vp)|leadership\s+change/i.test(`${n?.title || ""} ${n?.summary || ""}`)
    );
    if (hit) {
      const title = safeText(hit?.title);
      const summary = safeText(hit?.summary);
      push(
        "Leadership change",
        `${title || "Leadership update"}${summary ? ` — ${summary}` : ""} Leadership changes often reset priorities and create new hiring/initiative budgets.`
      );
    }
  })();

  // Layoffs / restructuring (caution but still a signal)
  (() => {
    const hit = newsItems.find((n) =>
      /layoff|restructur|headcount\s+reduc|hiring\s+freeze|downsiz/i.test(`${n?.title || ""} ${n?.summary || ""}`)
    );
    if (hit) {
      const title = safeText(hit?.title);
      const summary = safeText(hit?.summary);
      push(
        "Restructuring signal",
        `${title || "Restructuring/news"}${summary ? ` — ${summary}` : ""} This can indicate tighter budgets or role realignment—target outreach to high-priority teams.`
      );
    }
  })();

  // If we have a dedicated hiring section body, use it as an extra high-signal note (but only if it isn't redundant).
  if (safeText(hiringText) && out.length < 5) {
    const trimmed = safeText(hiringText);
    if (trimmed.length > 40) {
      push("Hiring context", trimmed);
    }
  }

  // Deduplicate by label (keep first)
  const seen = new Set<string>();
  return out.filter((s) => {
    const k = safeText(s.label).toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
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
  const [savedByCompany, setSavedByCompany] = useState<Record<string, CompanyResearch>>({});

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
    setSavedByCompany(by);
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
      const rawNews = entry?.recent_news || [];
      const themeRaw = String(entry?.theme || "").trim();
      const sections = entry?.background_report_sections || [];

      const overview = String(companySummary?.description || "").trim();
      const cultureFromModel = String(entry?.company_culture_values || "").trim();
      const marketFromModel = String(entry?.company_market_position || "").trim();
      const productLaunchesFromModel = String(entry?.company_product_launches || "").trim();
      const leadershipChangesFromModel = String(entry?.company_leadership_changes || "").trim();
      const otherHiringSignalsFromModel = String(entry?.company_other_hiring_signals || "").trim();
      const recentPostsFromModel = String(entry?.company_recent_posts || "").trim();
      const publicationsFromModel = String(entry?.company_publications || "").trim();
      const culture = cultureFromModel || pickSectionText(sections, "culture") || pickSectionText(sections, "values");
      const market = marketFromModel || pickSectionText(sections, "market") || pickSectionText(sections, "product") || pickSectionText(sections, "moves");
      const realNews = Array.isArray(rawNews)
        ? rawNews.filter((n: any) => {
            const title = String(n?.title || "").trim().toLowerCase();
            const url = String(n?.url || "").trim();
            const source = String(n?.source || "").trim().toLowerCase();
            if (!url) return false;
            if (!title) return false;
            if (title.startsWith("theme:")) return false;
            if (source === "general_knowledge") return false;
            return true;
          })
        : [];
      const themeFromNews =
        Array.isArray(rawNews)
          ? rawNews
              .filter((n: any) => String(n?.title || "").trim().toLowerCase().startsWith("theme:"))
              .map((n: any) => {
                const t = String(n?.title || "").trim();
                const s = String(n?.summary || "").trim();
                return `- ${t}${s ? `: ${s}` : ""}`;
              })
              .filter(Boolean)
              .join("\n")
          : "";

      const signals: CompanyResearch["hiring_signals"] = extractHiringSignals(sections, realNews as any[]);

      const next: CompanyResearch = {
        company_name: company,
        overview: overview || `${formatCompanyName(company)} overview (add a few lines here).`,
        theme:
          themeRaw ||
          themeFromNews ||
          "Theme: What the company likely cares about: Reference a plausible priority (customer experience, reliability, speed, cost) and offer a 2–3 bullet mini-plan—without claiming a specific news event.\n- \n- \n- ",
        recent_news: joinNews(realNews as any[]) || "",
        culture: culture || "",
        market_position: market || "",
        product_launches: productLaunchesFromModel || "",
        leadership_changes: leadershipChangesFromModel || "",
        other_hiring_signals: otherHiringSignalsFromModel || "",
        recent_posts: recentPostsFromModel || "",
        publications: publicationsFromModel || "",
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
    setSavedByCompany(by);
    localStorage.setItem(STORAGE_ACTIVE_COMPANY, draft.company_name);
    localStorage.setItem("company_research", JSON.stringify(by[draft.company_name])); // single active snapshot
    localStorage.setItem("selected_company_name", draft.company_name);
    setNotice("Company research saved. Ready for Decision Makers.");
    window.setTimeout(() => setNotice(null), 2500);
  }

  function exportCsv() {
    // Export ALL saved research rows (library), not just the active draft.
    const by = safeJson<Record<string, CompanyResearch>>(localStorage.getItem(STORAGE_BY_COMPANY), {});
    const rows = Object.values(by || {}).filter((x) => x && x.company_name);
    if (!rows.length) return;

    const serializeSignals = (signals: CompanyResearch["hiring_signals"] | undefined) => {
      const list = Array.isArray(signals) ? signals : [];
      return list
        .slice(0, 20)
        .map((s) => `${safeText(s?.label)}: ${safeText(s?.detail)}`.trim())
        .filter(Boolean)
        .join("\n");
    };
    const serializeHooks = (hooks: string[] | undefined) => {
      const list = Array.isArray(hooks) ? hooks : [];
      return list
        .slice(0, 30)
        .map((h) => safeText(h))
        .filter(Boolean)
        .map((h) => `- ${h}`)
        .join("\n");
    };

    const header = [
      "company_name",
      "overview",
      "theme",
      "recent_news",
      "culture",
      "market_position",
      "product_launches",
      "leadership_changes",
      "other_hiring_signals",
      "recent_posts",
      "publications",
      "hiring_signals",
      "hooks",
      "updated_at",
    ];
    const csv =
      [toCsvRow(header)].concat(
        rows
          .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")))
          .map((r) =>
            toCsvRow([
              String(r.company_name || ""),
              String(r.overview || ""),
              String((r as any).theme || ""),
              String(r.recent_news || ""),
              String(r.culture || ""),
              String(r.market_position || ""),
              String((r as any).product_launches || ""),
              String((r as any).leadership_changes || ""),
              String((r as any).other_hiring_signals || ""),
              String((r as any).recent_posts || ""),
              String((r as any).publications || ""),
              serializeSignals((r as any).hiring_signals),
              serializeHooks((r as any).hooks),
              String(r.updated_at || ""),
            ])
          )
      ).join("\n") + "\n";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `company-research_all-saved_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const isSavedActive = Boolean(draft?.company_name && savedByCompany?.[draft.company_name]);
  const canContinue = Boolean(draft?.company_name && isSavedActive);

  const savedCompanies = useMemo(() => {
    const list = Object.values(savedByCompany || {}).filter((x) => x && x.company_name);
    return list.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  }, [savedByCompany]);

  const fmtUpdated = (iso: string) => {
    try {
      const t = new Date(iso);
      if (Number.isNaN(t.getTime())) return "";
      const mins = Math.round((Date.now() - t.getTime()) / 60000);
      if (mins < 1) return "just now";
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.round(mins / 60);
      if (hrs < 48) return `${hrs}h ago`;
      const days = Math.round(hrs / 24);
      return `${days}d ago`;
    } catch {
      return "";
    }
  };

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
                <div className="text-xs text-white/60">Pick a company from your imported roles (or type one).</div>
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
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Saved library */}
            <div className="lg:col-span-3">
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-white">Saved research</div>
                    <div className="text-xs text-white/60">Click a company to load its saved briefing.</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={!savedCompanies.length}
                      onClick={exportCsv}
                      className="text-xs font-semibold rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-white/80 hover:bg-white/10 disabled:opacity-50"
                      title="Downloads all saved company research rows as a CSV."
                    >
                      Export all CSV
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const by = safeJson<Record<string, CompanyResearch>>(localStorage.getItem(STORAGE_BY_COMPANY), {});
                        setSavedByCompany(by);
                        setNotice("Saved library refreshed.");
                        window.setTimeout(() => setNotice(null), 1200);
                      }}
                      className="text-xs underline text-white/70 hover:text-white"
                    >
                      Refresh
                    </button>
                  </div>
                </div>

                {savedCompanies.length ? (
                  <div className="mt-3 space-y-2 max-h-[520px] overflow-auto pr-1">
                    {savedCompanies.slice(0, 30).map((c) => {
                      const name = String(c.company_name || "").trim();
                      const isActive = name && name === String(draft?.company_name || "").trim();
                      return (
                        <button
                          key={`saved_${name}`}
                          type="button"
                          onClick={() => {
                            if (!name) return;
                            setActiveCompany(name);
                            setCompanyQuery(name);
                            setDraft(c);
                            localStorage.setItem(STORAGE_ACTIVE_COMPANY, name);
                            localStorage.setItem("selected_company_name", name);
                          }}
                          className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                            isActive ? "border-blue-400/60 bg-blue-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                          }`}
                        >
                          <div className="text-sm font-semibold text-white/85 truncate">{formatCompanyName(name)}</div>
                          <div className="mt-1 text-[11px] text-white/55">
                            {c.updated_at ? `updated ${fmtUpdated(c.updated_at)}` : ""}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-white/60">No saved companies yet. Run research, then click “Save research”.</div>
                )}
              </div>
            </div>

            {/* Right: Draft details */}
            <div className="lg:col-span-9">
              {draft ? (
                <>
                  {!isSavedActive ? (
                    <div className="mb-4 rounded-md border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                      Draft generated but <span className="font-semibold">not saved</span> yet. Click <span className="font-semibold">Save research</span> to add it to the library.
                    </div>
                  ) : null}

                  <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <div className="text-sm font-bold text-white mb-1">Hiring Signals</div>
                    <div className="text-xs text-white/60 mb-3">
                      Quick, outreach-relevant signals for <span className="font-semibold text-white/80">{activeCompanyDisplay}</span>.
                    </div>
                    {(draft.hiring_signals || []).length ? (
                      <div className="space-y-2">
                        {(draft.hiring_signals || []).slice(0, 8).map((s, idx) => (
                          <div key={`sig_${idx}`} className="rounded-md border border-white/10 bg-white/5 p-3">
                            <div className="text-sm font-semibold text-white/85">{s.label}</div>
                            <div className="mt-1 text-sm text-white/75 whitespace-pre-wrap">{s.detail}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-white/60">No hiring signals captured in this run yet. Try Live mode for richer results.</div>
                    )}

                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">
                        Recent posts (blog/press/LinkedIn topics)
                      </div>
                      <textarea
                        value={draft.recent_posts || ""}
                        onChange={(e) => setDraft({ ...draft, recent_posts: e.target.value })}
                        rows={6}
                        className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="- Post/topic: … (include URL when possible)"
                      />
                      <div className="mt-2 text-[11px] text-white/60">
                        Variable:{" "}
                        <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                          {"{{company_recent_posts}}"}
                        </code>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">
                        Publications (case studies / reports)
                      </div>
                      <textarea
                        value={draft.publications || ""}
                        onChange={(e) => setDraft({ ...draft, publications: e.target.value })}
                        rows={6}
                        className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="- Publication: … (include URL when possible)"
                      />
                      <div className="mt-2 text-[11px] text-white/60">
                        Variable:{" "}
                        <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                          {"{{company_publications}}"}
                        </code>
                      </div>
                    </div>
                  </div>
                  </div>

                  {/* Company Briefing */}
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
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Theme (not news)</div>
                  <textarea
                    value={draft.theme}
                    onChange={(e) => setDraft({ ...draft, theme: e.target.value })}
                    rows={6}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="- Theme + mini-plan…"
                  />
                  <div className="mt-2 text-[11px] text-white/60">
                    Variable:{" "}
                    <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                      {"{{company_theme}}"}
                    </code>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Recent News (actual)</div>
                  <textarea
                    value={draft.recent_news}
                    onChange={(e) => setDraft({ ...draft, recent_news: e.target.value })}
                    rows={6}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="- Headline: short summary"
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
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Product launches</div>
                  <textarea
                    value={draft.product_launches}
                    onChange={(e) => setDraft({ ...draft, product_launches: e.target.value })}
                    rows={6}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="- Launch: … (include URL when possible)"
                  />
                  <div className="mt-2 text-[11px] text-white/60">
                    Variable:{" "}
                    <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                      {"{{company_product_launches}}"}
                    </code>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Leadership changes</div>
                  <textarea
                    value={draft.leadership_changes}
                    onChange={(e) => setDraft({ ...draft, leadership_changes: e.target.value })}
                    rows={6}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="- Change: … (include URL when possible)"
                  />
                  <div className="mt-2 text-[11px] text-white/60">
                    Variable:{" "}
                    <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                      {"{{company_leadership_changes}}"}
                    </code>
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Other hiring signals</div>
                  <textarea
                    value={draft.other_hiring_signals}
                    onChange={(e) => setDraft({ ...draft, other_hiring_signals: e.target.value })}
                    rows={6}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="- Signal: … (include URL when possible)"
                  />
                  <div className="mt-2 text-[11px] text-white/60">
                    Variable:{" "}
                    <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                      {"{{company_other_hiring_signals}}"}
                    </code>
                  </div>
                </div>

                <div className="lg:col-span-2">
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
                </>
              ) : (
                <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-sm text-white/70">
                  Pick a company above and click <span className="font-semibold text-white">Run Company Research</span>.
                </div>
              )}

              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={!canContinue}
                  onClick={() => router.push("/find-contact")}
                  className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  title={!canContinue ? "Save company research first." : "Continue to Decision Makers"}
                >
                  Continue to Decision Makers →
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

