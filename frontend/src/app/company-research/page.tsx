"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getCurrentDataMode } from "@/lib/dataMode";
import { formatCompanyName } from "@/lib/format";
import InlineSpinner from "@/components/InlineSpinner";

type StructuredSignal = {
  signal_type: string;
  source_type: string;
  signal_title: string;
  signal_source: string;
  signal_content: string;
  signal_date: string;
  confidence_score: number;
  metadata?: Record<string, any>;
};

type SequenceStep = {
  email_number: number;
  angle: string;
  subject_line: string;
  key_point: string;
};

type OutreachSummaryType = {
  one_liner_hook: string;
  strongest_signal: string;
  recommended_angle: string;
  conversation_starters: string[];
  signal_relevance: string[];
  sequence_strategy?: SequenceStep[];
};

type CompanyIntelligence = {
  signals: StructuredSignal[];
  outreach_summary?: OutreachSummaryType;
  executive_summary: string;
  overall_relevance_score: number;
};

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
  intelligence?: CompanyIntelligence;
  updated_at: string;
};

type CompanySignal = {
  id: string;
  category: string;
  text: string;
  priority: number;
};

function extractTopSignals(d: CompanyResearch | null, max = 5): CompanySignal[] {
  if (!d) return [];
  const candidates: CompanySignal[] = [];
  const add = (id: string, cat: string, raw: string, priority: number) => {
    const t = String(raw || "").replace(/no\s+(data|info|information)\s+found/gi, "").trim();
    if (!t || t.length < 10) return;
    const firstLine = t.split(/\n/).map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean)[0] || t;
    candidates.push({ id, category: cat, text: firstLine.slice(0, 280), priority });
  };
  add("product_launches", "Product Launch", d.product_launches, 100);
  add("leadership_changes", "Leadership Change", d.leadership_changes, 95);
  add("recent_news", "Recent News", d.recent_news, 90);
  add("recent_posts", "Recent Post", d.recent_posts, 85);
  add("culture", "Culture & Values", d.culture, 60);
  add("market_position", "Market Position", d.market_position, 55);
  add("other_hiring_signals", "Hiring Signal", d.other_hiring_signals, 50);
  add("publications", "Publication", d.publications, 45);
  for (const sig of (d.hiring_signals || []).slice(0, 3)) {
    if (sig.detail && sig.detail.length > 15) {
      candidates.push({ id: `hs_${sig.label}`, category: sig.label, text: sig.detail.slice(0, 280), priority: 75 });
    }
  }
  candidates.sort((a, b) => b.priority - a.priority);
  return candidates.slice(0, max);
}

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

function scrubModePlaceholders(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  // Never show mode/config instructional strings inside user-facing "data" fields.
  if (lower.includes("not available in stub mode")) return "No data found";
  if (lower.includes("try live mode")) return "No data found";
  if (lower.includes("serper configured")) return "No data found";
  if (lower.includes("serper_api_key")) return "No data found";
  if (lower.startsWith("no ") && lower.includes("captured in this run")) return "No data found";
  if (lower.includes("replace with real sources in live mode")) return "No data found";
  if (lower.includes("no external web sources in this run")) return "No data found";
  if (lower.includes("live mode") && lower.includes("summarize")) return "No data found";
  // Never show theme prompt-instructions in the Theme field.
  if (lower.startsWith("theme: what the company likely cares about")) return "";
  if (lower.includes("what the company likely cares about") && lower.includes("mini-plan")) return "";
  return s;
}

function hasRealData(raw: string): boolean {
  const s = scrubModePlaceholders(String(raw || "")).trim().toLowerCase();
  if (!s) return false;
  if (s === "no data found") return false;
  if (s === "unknown") return false;
  if (s.startsWith("no ") && s.includes("found")) return false;
  return true;
}

function scrubRecentNews(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const lines = s.split(/\r?\n/).map((l) => String(l || "").trim());
  const cleaned = lines.filter((l) => {
    const low = l.toLowerCase();
    // Never show theme-instruction text inside Recent News.
    if (low.startsWith("- theme:")) return false;
    if (low.startsWith("theme:")) return false;
    if (low.includes("what the company likely cares about") && low.includes("mini-plan")) return false;
    return Boolean(l);
  });
  return cleaned.join("\n").trim();
}

function cleanThemeText(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s
    .replace(/\blikely\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/:\s*\n/g, ":\n")
    .trim();
}

function buildThemeFallback(input: {
  company: string;
  selectedJD: any;
  painpointMatches: any[];
  resumeExtract: any;
}): string {
  const company = formatCompanyName(String(input.company || "").trim());
  const jd = input.selectedJD || {};
  const title = String(jd?.title || "").trim();
  const pains =
    (Array.isArray(jd?.painPoints) ? jd.painPoints : [])
      .map((x: any) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, 3);

  const match0 = Array.isArray(input.painpointMatches) ? input.painpointMatches[0] : null;
  const matchPains = [match0?.painpoint_1, match0?.painpoint_2, match0?.painpoint_3]
    .map((x: any) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, 2);
  const matchSolutions = [match0?.solution_1, match0?.solution_2, match0?.solution_3]
    .map((x: any) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, 2);

  const skills =
    (Array.isArray(jd?.requiredSkills) ? jd.requiredSkills : [])
      .map((x: any) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, 4);

  const succ =
    (Array.isArray(jd?.successMetrics) ? jd.successMetrics : [])
      .map((x: any) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, 2);

  const km = Array.isArray(input.resumeExtract?.keyMetrics) ? input.resumeExtract.keyMetrics : [];
  const metricLine = km
    .slice(0, 1)
    .map((m: any) => [m?.metric, m?.value, m?.context].filter(Boolean).join(" — "))
    .map((s: string) => safeText(s))
    .filter(Boolean)[0];

  const priorities = (matchPains.length ? matchPains : pains).slice(0, 2);
  const roleHint = title ? `for the ${title} role` : "for this role";

  const lines: string[] = [];
  lines.push(`Priorities at ${company} ${roleHint}:`);
  if (priorities.length) {
    for (const p of priorities) lines.push(`- ${p}`);
  } else {
    lines.push(`- Execution speed + measurable impact (based on the role requirements)`);
  }

  lines.push("");
  lines.push("Mini-plan (no specific news claims):");
  if (matchSolutions.length) {
    for (const s of matchSolutions.slice(0, 3)) lines.push(`- ${s}`);
  } else {
    if (skills.length) lines.push(`- Align on success metrics, then de-risk delivery using ${skills.slice(0, 2).join(" + ")}.`);
    if (succ.length) lines.push(`- Define what “good” looks like (${succ[0]}), then ship a quick-win in the first 2–3 weeks.`);
    lines.push(`- Build a tight stakeholder cadence (weekly priorities + blockers) to keep momentum.`);
  }

  if (metricLine) {
    lines.push("");
    lines.push(`Proof angle to reference: ${metricLine}`);
  }

  return lines.join("\n").trim();
}

function sanitizeDraft(d: CompanyResearch | null): CompanyResearch | null {
  if (!d) return null;
  return {
    ...d,
    theme: scrubModePlaceholders(String(d.theme || "")) || "",
    recent_news: scrubRecentNews(String(d.recent_news || "")) || "",
  };
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
  const [activeCompany, setActiveCompany] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CompanyResearch | null>(null);
  const [savedByCompany, setSavedByCompany] = useState<Record<string, CompanyResearch>>({});
  const [selectedSignalIds, setSelectedSignalIds] = useState<Set<string>>(new Set());
  const [briefingOpen, setBriefingOpen] = useState(false);

  const topSignals = useMemo(() => extractTopSignals(draft), [draft]);

  const toggleSignal = (id: string) => {
    setSelectedSignalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try {
        const selected = topSignals.filter((s) => next.has(s.id));
        localStorage.setItem(
          "rf_selected_company_signals",
          JSON.stringify(selected.map((s) => ({ category: s.category, text: s.text }))),
        );
      } catch {}
      return next;
    });
  };

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
      setDraft(sanitizeDraft(by[pick]));
      localStorage.setItem("selected_company_name", pick);
    }
  }, []);

  useEffect(() => {
    // If no active company yet, pick the first available from prior role selections.
    if (activeCompany) return;
    if (!companyOptions.length) return;
    const first = String(companyOptions[0] || "").trim();
    if (!first) return;
    setActiveCompany(first);
  }, [activeCompany, companyOptions]);

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
      const serperHits = (resp as any)?.helper?.corpus_preview?.serper_hits;
      const hasWebSources = Array.isArray(serperHits) && serperHits.length > 0;

      const overview = String(companySummary?.description || "").trim();
      const cultureFromModel = String(entry?.company_culture_values || "").trim();
      const marketFromModel = String(entry?.company_market_position || "").trim();
      const productLaunchesFromModel = scrubModePlaceholders(String(entry?.company_product_launches || ""));
      const leadershipChangesFromModel = scrubModePlaceholders(String(entry?.company_leadership_changes || ""));
      const otherHiringSignalsFromModel = scrubModePlaceholders(String(entry?.company_other_hiring_signals || ""));
      const recentPostsFromModel = scrubModePlaceholders(String(entry?.company_recent_posts || ""));
      const publicationsFromModel = scrubModePlaceholders(String(entry?.company_publications || ""));
      const culture = cultureFromModel || pickSectionText(sections, "culture") || pickSectionText(sections, "values");
      // Market position should be sourced. If we don't have web sources (SERPER), avoid generic "likely/may" output.
      const market = hasWebSources
        ? (marketFromModel || pickSectionText(sections, "market") || pickSectionText(sections, "product") || pickSectionText(sections, "moves"))
        : "";
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
          cleanThemeText(scrubModePlaceholders(themeRaw)) ||
          cleanThemeText(scrubModePlaceholders(themeFromNews)) ||
          cleanThemeText(buildThemeFallback({ company, selectedJD, painpointMatches, resumeExtract })) ||
          "",
        recent_news: scrubRecentNews(joinNews(realNews as any[])) || "",
        culture: culture || "",
        market_position: market || "",
        product_launches: productLaunchesFromModel || "",
        leadership_changes: leadershipChangesFromModel || "",
        other_hiring_signals: otherHiringSignalsFromModel || "",
        recent_posts: recentPostsFromModel || "",
        publications: publicationsFromModel || "",
        hiring_signals: signals,
        hooks: Array.isArray(resp?.helper?.hooks) ? resp.helper!.hooks : undefined,
        intelligence: entry?.intelligence || undefined,
        updated_at: new Date().toISOString(),
      };

      if (!hasWebSources) {
        setNotice("Research generated. Some data may not be available for this company.");
      }

      setDraft(sanitizeDraft(next));
      setActiveCompany(company);
      localStorage.setItem(STORAGE_ACTIVE_COMPANY, company);
      localStorage.setItem("selected_company_name", company);
      if (hasWebSources) setNotice("Company research generated. Review/edit, then Save.");
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
          <a href="/offer" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
            <span className="mr-2">←</span> Back to Offer
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
                <div className="text-xs text-white/60">Pick a company from roles you selected in earlier steps.</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isRunning || !activeCompany.trim()}
                  onClick={() => runResearch(activeCompany)}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isRunning ? (
                    <>
                      <InlineSpinner />
                      <span>Researching</span>
                    </>
                  ) : (
                    "Run Company Research"
                  )}
                </button>
              </div>
            </div>

            <div className="mt-3">
              {companyOptions.length ? (
                <div className="flex flex-wrap gap-2">
                  {companyOptions.slice(0, 100).map((c) => {
                    const isActive = String(activeCompany || "").trim() === String(c || "").trim();
                    return (
                      <button
                        key={`co_chip_${c}`}
                        type="button"
                        onClick={() => {
                          const v = String(c || "").trim();
                          if (!v) return;
                          setActiveCompany(v);
                          const by = safeJson<Record<string, CompanyResearch>>(localStorage.getItem(STORAGE_BY_COMPANY), {});
                          if (by?.[v]) setDraft(sanitizeDraft(by[v]));
                        }}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          isActive
                            ? "border-blue-400/60 bg-blue-500/15 text-blue-100"
                            : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"
                        }`}
                      >
                        {formatCompanyName(c)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-white/60">
                  No companies found from previous role selections yet. Add/select roles first.
                </div>
              )}
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
                            setDraft(sanitizeDraft(c));
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
                    ) : null}

                  {(hasRealData(draft.recent_posts || "") || hasRealData(draft.publications || "")) ? (
                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {hasRealData(draft.recent_posts || "") ? (
                    <div>
                      <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">
                        Recent posts (blog/press/LinkedIn topics)
                      </div>
                      <textarea
                        value={scrubModePlaceholders(draft.recent_posts || "")}
                        onChange={(e) => setDraft({ ...draft, recent_posts: e.target.value })}
                        rows={6}
                        className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="- Post/topic: … (include URL when possible)"
                      />
                    </div>
                    ) : null}
                    {hasRealData(draft.publications || "") ? (
                    <div>
                      <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">
                        Publications (case studies / reports)
                      </div>
                      <textarea
                        value={scrubModePlaceholders(draft.publications || "")}
                        onChange={(e) => setDraft({ ...draft, publications: e.target.value })}
                        rows={6}
                        className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="- Publication: … (include URL when possible)"
                      />
                    </div>
                    ) : null}
                  </div>
                  ) : null}
                  </div>

                  {/* Top Signals for outreach */}
                  {topSignals.length > 0 ? (
                  <div className="mt-6 rounded-lg border border-white/10 bg-black/20 p-4">
                    <div className="text-sm font-bold text-white mb-1">Signals to Include in Outreach</div>
                    <div className="text-xs text-white/60 mb-3">
                      The best facts we found about <span className="font-semibold text-white/80">{activeCompanyDisplay}</span>. Select which to include in your messages.
                    </div>
                    <div className="space-y-1.5">
                      {topSignals.map((sig) => {
                        const on = selectedSignalIds.has(sig.id);
                        const catColors: Record<string, string> = {
                          "Product Launch": "bg-blue-500/20 text-blue-300 border-blue-500/30",
                          "Leadership Change": "bg-purple-500/20 text-purple-300 border-purple-500/30",
                          "Recent News": "bg-amber-500/20 text-amber-300 border-amber-500/30",
                          "Recent Post": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
                          "Culture & Values": "bg-pink-500/20 text-pink-300 border-pink-500/30",
                          "Market Position": "bg-white/10 text-white/70 border-white/20",
                          "Hiring Signal": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
                          "Publication": "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
                        };
                        const badgeClass = catColors[sig.category] || "bg-white/10 text-white/70 border-white/20";
                        return (
                          <button
                            key={sig.id}
                            type="button"
                            onClick={() => toggleSignal(sig.id)}
                            className={`w-full text-left rounded-md border p-2.5 transition-colors ${
                              on
                                ? "border-emerald-400/50 bg-emerald-500/15"
                                : "border-white/10 bg-white/5 hover:bg-white/10"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                                on ? "border-emerald-400 bg-emerald-500 text-black" : "border-white/30 text-white/40"
                              }`}>
                                {on ? "✓" : ""}
                              </span>
                              <div className="min-w-0 flex-1">
                                <span className={`inline-block rounded-full border px-1.5 py-0.5 text-[9px] font-semibold mb-1 ${badgeClass}`}>
                                  {sig.category}
                                </span>
                                <div className="text-[13px] text-white/80 leading-tight">{sig.text}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  ) : null}

                  {/* Structured Intelligence */}
                  {draft?.intelligence?.signals?.length ? (
                    <div className="mt-6 rounded-lg border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-bold text-white">Company Intelligence</div>
                        {draft.intelligence.overall_relevance_score > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-white/50">Relevance</span>
                            <span className={`text-xs font-bold ${draft.intelligence.overall_relevance_score >= 0.7 ? "text-emerald-300" : draft.intelligence.overall_relevance_score >= 0.4 ? "text-amber-300" : "text-white/50"}`}>
                              {(draft.intelligence.overall_relevance_score * 100).toFixed(0)}%
                            </span>
                          </div>
                        )}
                      </div>

                      {draft.intelligence.outreach_summary?.one_liner_hook ? (
                        <div className="mb-4 rounded-md border border-blue-500/20 bg-blue-500/10 p-3">
                          <div className="text-[10px] font-semibold text-blue-300 uppercase tracking-wider mb-1">Outreach Summary</div>
                          <div className="text-sm text-white/90 font-medium mb-2">{draft.intelligence.outreach_summary.one_liner_hook}</div>
                          {draft.intelligence.outreach_summary.strongest_signal && (
                            <div className="text-xs text-white/60 mb-1.5">
                              <span className="text-amber-300 font-semibold">Strongest signal:</span> {draft.intelligence.outreach_summary.strongest_signal}
                            </div>
                          )}
                          {draft.intelligence.outreach_summary.recommended_angle && (
                            <div className="text-xs text-white/60 mb-2">
                              <span className="text-emerald-300 font-semibold">Recommended angle:</span> {draft.intelligence.outreach_summary.recommended_angle}
                            </div>
                          )}
                          {draft.intelligence.outreach_summary.conversation_starters?.length ? (
                            <div className="mt-2 pt-2 border-t border-blue-500/15">
                              <div className="text-[10px] font-semibold text-blue-200/70 mb-1">Conversation starters</div>
                              {draft.intelligence.outreach_summary.conversation_starters.map((s, i) => (
                                <div key={`cs_${i}`} className="text-xs text-white/60 mt-0.5 flex items-start gap-1.5">
                                  <span className="shrink-0 text-blue-300/50 mt-0.5">→</span>
                                  <span>{s}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {draft.intelligence.outreach_summary.sequence_strategy?.length ? (
                            <div className="mt-2 pt-2 border-t border-blue-500/15">
                              <div className="text-[10px] font-semibold text-blue-200/70 mb-1.5">Email Sequence Strategy</div>
                              <div className="space-y-2">
                                {draft.intelligence.outreach_summary.sequence_strategy.map((step) => (
                                  <div key={`seq_${step.email_number}`} className="rounded border border-white/10 bg-white/[0.02] p-2">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="inline-block rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 text-[9px] font-bold">
                                        Email {step.email_number}
                                      </span>
                                      <span className="text-[10px] text-white/70 font-medium">{step.angle}</span>
                                    </div>
                                    {step.subject_line && (
                                      <div className="text-[10px] text-white/50 mt-0.5">
                                        <span className="text-white/30">Subject:</span> {step.subject_line}
                                      </div>
                                    )}
                                    {step.key_point && (
                                      <div className="text-[10px] text-white/45 mt-0.5">{step.key_point}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {draft.intelligence.executive_summary && (
                        <div className="mb-4 text-xs text-white/60 leading-relaxed">
                          {draft.intelligence.executive_summary}
                        </div>
                      )}

                      <div className="space-y-2">
                        {draft.intelligence.signals.map((sig, idx) => {
                          const typeLabels: Record<string, string> = {
                            leadership_change: "Leadership",
                            product_launch: "Product",
                            hiring_signal: "Hiring",
                            funding_event: "Funding",
                            partnership: "Partnership",
                            market_expansion: "Market",
                            regulatory: "Regulatory",
                            technology_adoption: "Technology",
                            technology: "Technology",
                            earnings: "Earnings",
                            restructuring: "Restructuring",
                            expansion: "Expansion",
                            news: "News",
                            workforce: "Workforce",
                            intent: "Intent",
                            firmographics: "Firmographics",
                            funding: "Funding",
                          };
                          const typeColors: Record<string, string> = {
                            leadership_change: "bg-purple-500/20 text-purple-300 border-purple-500/30",
                            product_launch: "bg-blue-500/20 text-blue-300 border-blue-500/30",
                            hiring_signal: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
                            funding_event: "bg-amber-500/20 text-amber-300 border-amber-500/30",
                            partnership: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
                            market_expansion: "bg-pink-500/20 text-pink-300 border-pink-500/30",
                            regulatory: "bg-red-500/20 text-red-300 border-red-500/30",
                            technology_adoption: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
                            technology: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
                            earnings: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
                            restructuring: "bg-orange-500/20 text-orange-300 border-orange-500/30",
                            expansion: "bg-pink-500/20 text-pink-300 border-pink-500/30",
                            news: "bg-sky-500/20 text-sky-300 border-sky-500/30",
                            workforce: "bg-teal-500/20 text-teal-300 border-teal-500/30",
                            intent: "bg-violet-500/20 text-violet-300 border-violet-500/30",
                            firmographics: "bg-slate-500/20 text-slate-300 border-slate-500/30",
                            funding: "bg-amber-500/20 text-amber-300 border-amber-500/30",
                          };
                          const badge = typeColors[sig.signal_type] || "bg-white/10 text-white/60 border-white/20";
                          const confColor = sig.confidence_score >= 0.8 ? "text-emerald-300" : sig.confidence_score >= 0.5 ? "text-amber-300" : "text-white/40";
                          return (
                            <div key={`intel_${idx}`} className="rounded-md border border-white/10 bg-white/[0.03] p-3">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className={`inline-block rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${badge}`}>
                                  {typeLabels[sig.signal_type] || sig.signal_type}
                                </span>
                                {sig.signal_source?.startsWith("signaliz::") ? (
                                  <span className="text-[9px] text-violet-400/80 font-medium border border-violet-500/30 rounded-full px-1.5">Signaliz</span>
                                ) : sig.source_type === "web_source" ? (
                                  <span className="text-[9px] text-emerald-400/60 font-medium">Sourced</span>
                                ) : null}
                                <span className={`text-[9px] font-bold ml-auto ${confColor}`}>
                                  {(sig.confidence_score * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="text-sm font-medium text-white/90 mb-1">{sig.signal_title}</div>
                              {sig.signal_content && (
                                <div className="text-xs text-white/55 leading-relaxed">{sig.signal_content}</div>
                              )}
                              <div className="flex items-center gap-3 mt-1.5">
                                {sig.signal_date && (
                                  <span className="text-[10px] text-white/35">{sig.signal_date.split("T")[0]}</span>
                                )}
                                {sig.signal_source && !sig.signal_source.startsWith("signaliz::") && (
                                  <a href={sig.signal_source} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-300/60 hover:text-blue-300 underline truncate max-w-[200px]">
                                    {(() => { try { return new URL(sig.signal_source).hostname.replace("www.", ""); } catch { return "source"; } })()}
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {/* Company Briefing */}
                  <div className="mt-6 rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setBriefingOpen((v) => !v)}
                  className="flex items-center gap-2 text-sm font-bold text-white hover:text-white/90"
                >
                  <span>Company Briefing</span>
                  <span className="text-white/50 text-xs">{briefingOpen ? "▲" : "▼"}</span>
                </button>
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

              {briefingOpen ? (
              <>
              {(() => {
                const emptySections: string[] = [];
                const cn = activeCompanyDisplay;
                if (!hasRealData(draft.recent_news)) emptySections.push("recent news");
                if (!hasRealData(draft.culture)) emptySections.push("culture & values");
                if (!hasRealData(draft.product_launches)) emptySections.push("product launches");
                if (!hasRealData(draft.leadership_changes)) emptySections.push("leadership changes");
                if (!hasRealData(draft.other_hiring_signals)) emptySections.push("other hiring signals");
                if (!hasRealData(draft.publications)) emptySections.push("publications");
                if (!hasRealData(draft.market_position)) emptySections.push("market position");
                return (
                  <>
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Overview and Theme are always shown */}
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
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Theme</div>
                  <textarea
                    value={cleanThemeText(draft.theme)}
                    onChange={(e) => setDraft({ ...draft, theme: cleanThemeText(e.target.value) })}
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

                {hasRealData(draft.recent_news) ? (
                <div>
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Recent News</div>
                  <textarea
                    value={draft.recent_news}
                    onChange={(e) => setDraft({ ...draft, recent_news: e.target.value })}
                    rows={6}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="- Headline: short summary"
                  />
                </div>
                ) : null}

                {hasRealData(draft.culture) ? (
                <div>
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Company Culture & Values</div>
                  <textarea
                    value={draft.culture}
                    onChange={(e) => setDraft({ ...draft, culture: e.target.value })}
                    rows={6}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="What do they value? How do they operate?"
                  />
                </div>
                ) : null}

                {hasRealData(draft.product_launches) ? (
                <div>
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Product launches</div>
                  <textarea
                    value={scrubModePlaceholders(draft.product_launches)}
                    onChange={(e) => setDraft({ ...draft, product_launches: e.target.value })}
                    rows={6}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="- Launch: … (include URL when possible)"
                  />
                </div>
                ) : null}

                {hasRealData(draft.leadership_changes) ? (
                <div>
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Leadership changes</div>
                  <textarea
                    value={scrubModePlaceholders(draft.leadership_changes)}
                    onChange={(e) => setDraft({ ...draft, leadership_changes: e.target.value })}
                    rows={6}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="- Change: … (include URL when possible)"
                  />
                </div>
                ) : null}

                {hasRealData(draft.other_hiring_signals) ? (
                <div className="lg:col-span-2">
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Other hiring signals</div>
                  <textarea
                    value={scrubModePlaceholders(draft.other_hiring_signals)}
                    onChange={(e) => setDraft({ ...draft, other_hiring_signals: e.target.value })}
                    rows={6}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="- Signal: … (include URL when possible)"
                  />
                </div>
                ) : null}

                {hasRealData(draft.market_position) ? (
                <div className="lg:col-span-2">
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Market Position</div>
                  <textarea
                    value={draft.market_position}
                    onChange={(e) => setDraft({ ...draft, market_position: e.target.value })}
                    rows={6}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Competitors, positioning, and what matters right now."
                  />
                </div>
                ) : null}
              </div>

              {emptySections.length > 0 ? (
                <div className="mt-4 rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
                  No {emptySections.join(", ")} information found for {cn}. Try running research in live mode for richer results.
                </div>
              ) : null}
                  </>
                );
              })()}

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
              </>
              ) : (
                <div className="mt-2 text-xs text-white/50">Click to expand and edit full briefing details.</div>
              )}
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
                  title={!canContinue ? "Save company research first." : "Save & Continue"}
                >
                  Save &amp; Continue
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

