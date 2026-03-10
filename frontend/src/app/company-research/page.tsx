"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getCurrentDataMode } from "@/lib/dataMode";
import { formatCompanyName } from "@/lib/format";
import InlineSpinner from "@/components/InlineSpinner";
import CollapsibleSection from "@/components/CollapsibleSection";

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

type PdlCompanySignal = {
  label: string;
  value: string;
  category: string;
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
  pdl_company_signals?: PdlCompanySignal[];
};

type CompanySignal = {
  id: string;
  category: string;
  text: string;
  priority: number;
  confidence: number;
};

function extractTopSignals(d: CompanyResearch | null, max = 12): CompanySignal[] {
  if (!d) return [];
  const candidates: CompanySignal[] = [];
  const add = (id: string, cat: string, raw: string, priority: number) => {
    const t = String(raw || "").replace(/no\s+(data|info|information)\s+found/gi, "").trim();
    if (!t || t.length < 10) return;
    const firstLine = t.split(/\n/).map(l => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean)[0] || t;
    candidates.push({ id, category: cat, text: firstLine.slice(0, 280), priority, confidence: Math.min(0.95, 0.5 + priority / 200) });
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
      candidates.push({ id: `hs_${sig.label}`, category: sig.label, text: sig.detail.slice(0, 280), priority: 75, confidence: 0.75 });
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
  let s = String(raw || "").trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  if (lower.includes("not available in stub mode")) return "";
  if (lower.includes("live mode")) return "";
  if (lower.includes("stub mode")) return "";
  if (lower.includes("serper")) return "";
  if (lower.includes("captured in this run")) return "";
  if (lower.includes("replace with real sources")) return "";
  if (lower.includes("no external web sources")) return "";
  if (lower.includes("imported role description")) return "";
  if (lower.includes("suggested topics to reference")) return "";
  if (lower.includes("derived from the imported")) return "";
  if (lower.startsWith("theme: what the company likely cares about")) return "";
  if (lower.includes("what the company likely cares about") && lower.includes("mini-plan")) return "";
  if (/no\s+\w+\s+(details?|data|info(rmation)?)\s*(captured|found|available|collected)/i.test(lower)) return "";
  if (/no\s+(product\s+launch|leadership\s+change|hiring\s+signal|recent\s+post)/i.test(lower)) return "";
  if (lower === "no data found") return "";
  s = s
    .replace(/\blikely\b/gi, "")
    .replace(/\bprobably\b/gi, "")
    .replace(/\bmay be\b/gi, "is")
    .replace(/\bmight be\b/gi, "is")
    .replace(/\bappears to\b/gi, "")
    .replace(/\bseems to\b/gi, "")
    .replace(/\bpotentially\b/gi, "")
    .replace(/\bpossibly\b/gi, "")
    .replace(/\bpresumably\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return s;
}

function hasRealData(raw: string): boolean {
  const s = scrubModePlaceholders(String(raw || "")).trim().toLowerCase();
  if (!s) return false;
  if (s === "no data found") return false;
  if (s === "unknown") return false;
  if (s.startsWith("no ") && (s.includes("found") || s.includes("captured") || s.includes("available"))) return false;
  if (s.startsWith("example ") || s.includes("(replace with")) return false;
  if (/^no\s+\w+\s+(details?|data|signals?)/i.test(s)) return false;
  if (s.includes("try live mode") || s.includes("serper") || s.includes("live mode")) return false;
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
    .replace(/\bprobably\b/gi, "")
    .replace(/\bappears to\b/gi, "")
    .replace(/\bseems to\b/gi, "")
    .replace(/\bpotentially\b/gi, "")
    .replace(/\bpossibly\b/gi, "")
    .replace(/\bmay be\b/gi, "is")
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

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  leadership_change: "Leadership", product_launch: "Product", hiring_signal: "Hiring",
  funding_event: "Funding", partnership: "Partnership", market_expansion: "Market",
  regulatory: "Regulatory", technology_adoption: "Technology", technology: "Technology",
  earnings: "Earnings", restructuring: "Restructuring", expansion: "Expansion",
  news: "News", workforce: "Workforce", intent: "Intent", firmographics: "Firmographics",
  funding: "Funding",
};

const SIGNAL_CAT_COLORS: Record<string, string> = {
  "Product Launch": "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Product": "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Leadership Change": "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "Leadership": "bg-purple-500/20 text-purple-300 border-purple-500/30",
  "Recent News": "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "News": "bg-sky-500/20 text-sky-300 border-sky-500/30",
  "Recent Post": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "Culture & Values": "bg-pink-500/20 text-pink-300 border-pink-500/30",
  "Market Position": "bg-white/10 text-white/70 border-white/20",
  "Market": "bg-pink-500/20 text-pink-300 border-pink-500/30",
  "Hiring Signal": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "Hiring": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  "Publication": "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  "Funding": "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Partnership": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  "Technology": "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  "Expansion": "bg-pink-500/20 text-pink-300 border-pink-500/30",
  "Workforce": "bg-teal-500/20 text-teal-300 border-teal-500/30",
  "Firmographics": "bg-slate-500/20 text-slate-300 border-slate-500/30",
  "Intent": "bg-violet-500/20 text-violet-300 border-violet-500/30",
  "Restructuring": "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "Earnings": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  "Regulatory": "bg-red-500/20 text-red-300 border-red-500/30",
};

type UnifiedSignal = {
  id: string;
  category: string;
  label: string;
  text: string;
  confidence: number;
  sourceUrl?: string;
  date?: string;
};

function formatSignalText(raw: string): string {
  return String(raw || "")
    .replace(/\[Source\s*:?\s*\]/gi, "")
    .replace(/\(Source\s*:?\s*[^)]*\)/gi, "")
    .replace(/\[([^\]]*)\]/g, "$1")
    .replace(/\(\s*\)/g, "")
    .trim();
}

function friendlySourceLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    if (host.includes("google")) return "Google News";
    if (host.includes("linkedin")) return "LinkedIn";
    if (host.includes("twitter") || host.includes("x.com")) return "X";
    if (host.includes("github")) return "GitHub";
    const name = host.split(".")[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return "Source";
  }
}

function RichText({ text }: { text: string }) {
  if (!text) return null;
  const cleaned = String(text)
    .replace(/\[Source\s*:?\s*\]/gi, "")
    .replace(/\(Source\s*:?\s*[^)]*\)/gi, "")
    .replace(/\[([^\]]*)\]/g, "$1")
    .replace(/\(\s*\)/g, "");
  const lines = cleaned.split(/\n/).map((l) => l.trim()).filter(Boolean);

  function renderLine(line: string, key: number) {
    const stripped = line.replace(/^[-•*]\s*/, "").trim();
    if (!stripped) return null;
    const urlRe = /(https?:\/\/[^\s,;)>"']+)/g;
    const parts: React.ReactNode[] = [];
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    let k = 0;
    while ((m = urlRe.exec(stripped)) !== null) {
      if (m.index > lastIdx) {
        const before = stripped.slice(lastIdx, m.index).replace(/:\s*$/, "").trim();
        if (before) parts.push(<em key={`t${key}_${k}`} className="not-italic text-white/75">{before} </em>);
      }
      parts.push(
        <a key={`l${key}_${k}`} href={m[1]} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline text-[11px]">
          {friendlySourceLabel(m[1])}
        </a>
      );
      k++;
      lastIdx = m.index + m[0].length;
    }
    if (lastIdx < stripped.length) {
      const rest = stripped.slice(lastIdx).trim();
      if (rest) parts.push(<span key={`e${key}_${k}`}>{rest}</span>);
    }
    return (
      <li key={key} className="flex items-start gap-1.5 text-[11.5px] text-white/65 leading-relaxed">
        <span className="text-orange-400/50 mt-0.5 shrink-0">•</span>
        <span className="break-words">{parts.length > 0 ? parts : stripped}</span>
      </li>
    );
  }

  return <ul className="space-y-1">{lines.map((l, i) => renderLine(l, i))}</ul>;
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
  // briefingOpen removed: all sections are now independent collapsibles
  const [companyOptions, setCompanyOptions] = useState<string[]>([]);
  const SIGNAL_LIMIT = 10;

  const topSignals = useMemo(() => extractTopSignals(draft), [draft]);
  const pdlSignals = useMemo(() => draft?.pdl_company_signals || [], [draft]);

  const allSignals = useMemo((): UnifiedSignal[] => {
    const list: UnifiedSignal[] = [];
    const seen = new Set<string>();
    const dedupe = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
    for (let i = 0; i < pdlSignals.length; i++) {
      const sig = pdlSignals[i];
      const k = dedupe(sig.value);
      if (seen.has(k)) continue;
      seen.add(k);
      list.push({ id: `pdl_${i}`, category: sig.category, label: sig.label, text: sig.value, confidence: 0.8 });
    }
    const intelSigs = (draft?.intelligence?.signals || []).filter((sig) => {
      const c = (sig.signal_content || "").toLowerCase();
      const t = (sig.signal_title || "").toLowerCase();
      if (!t && !c) return false;
      for (const bad of ["no external web sources", "imported role description", "suggested topic", "derived from", "signal detected for", "live mode", "stub mode", "serper", "captured in this run"])
        if (c.includes(bad)) return false;
      if (/no\s+\w+\s+(details?|data|signals?)\s*(captured|found|available)/i.test(c)) return false;
      if (t.includes("no data") || t.includes("no information") || (t.includes("example") && t.includes(":"))) return false;
      const scrubbed = scrubModePlaceholders(sig.signal_content || "");
      if (!scrubbed && !scrubModePlaceholders(sig.signal_title || "")) return false;
      return true;
    });
    for (let i = 0; i < intelSigs.length; i++) {
      const sig = intelSigs[i];
      const title = scrubModePlaceholders(cleanThemeText(sig.signal_title));
      const content = scrubModePlaceholders(cleanThemeText(sig.signal_content || ""));
      const k = dedupe(title || content);
      if (seen.has(k)) continue;
      seen.add(k);
      list.push({
        id: `intel_${i}`,
        category: SIGNAL_TYPE_LABELS[sig.signal_type] || sig.signal_type,
        label: title,
        text: content,
        confidence: sig.confidence_score,
        sourceUrl: sig.signal_source && !sig.signal_source.startsWith("signaliz::") ? sig.signal_source : undefined,
        date: sig.signal_date ? sig.signal_date.split("T")[0] : undefined,
      });
    }
    for (const sig of topSignals) {
      const k = dedupe(sig.text);
      if (seen.has(k)) continue;
      seen.add(k);
      list.push({ id: sig.id, category: sig.category, label: sig.category, text: sig.text, confidence: sig.confidence });
    }
    return list;
  }, [draft, topSignals, pdlSignals]);

  const toggleSignal = (id: string) => {
    setSelectedSignalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < SIGNAL_LIMIT) next.add(id);
      else return prev;
      persistSelectedSignals(next);
      return next;
    });
  };

  const persistSelectedSignals = (ids: Set<string>) => {
    try {
      const selected = allSignals.filter((s) => ids.has(s.id)).map((s) => ({ category: s.category, text: s.label && s.label !== s.category ? `${s.label}: ${s.text}` : s.text }));
      localStorage.setItem("rf_selected_company_signals", JSON.stringify(selected));
    } catch {}
  };

  useEffect(() => {
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
    setCompanyOptions(Array.from(companies).sort((a, b) => a.localeCompare(b)));
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
      const overview = String(companySummary?.description || "").trim();
      const cultureFromModel = String(entry?.company_culture_values || "").trim();
      const marketFromModel = String(entry?.company_market_position || "").trim();
      const productLaunchesFromModel = scrubModePlaceholders(String(entry?.company_product_launches || ""));
      const leadershipChangesFromModel = scrubModePlaceholders(String(entry?.company_leadership_changes || ""));
      const otherHiringSignalsFromModel = scrubModePlaceholders(String(entry?.company_other_hiring_signals || ""));
      const recentPostsFromModel = scrubModePlaceholders(String(entry?.company_recent_posts || ""));
      const publicationsFromModel = scrubModePlaceholders(String(entry?.company_publications || ""));
      const culture = cultureFromModel || pickSectionText(sections, "culture") || pickSectionText(sections, "values");
      const market = marketFromModel || pickSectionText(sections, "market") || pickSectionText(sections, "product") || pickSectionText(sections, "moves") || "";
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
        pdl_company_signals: Array.isArray(entry?.company_signals) ? entry.company_signals : undefined,
      };

      setDraft(sanitizeDraft(next));
      setActiveCompany(company);
      localStorage.setItem(STORAGE_ACTIVE_COMPANY, company);
      localStorage.setItem("selected_company_name", company);
      setNotice("Company research generated. Review/edit, then Save.");
      window.setTimeout(() => setNotice(null), 2500);
    } catch (e: any) {
      const msg = String(e?.message || "Failed to run company research.");
      if (msg.includes("500") || msg.includes("502") || msg.includes("504") || msg.toLowerCase().includes("timeout") || msg.toLowerCase().includes("econnreset")) {
        setError("Research is taking longer than expected. Please try again — results are often faster on a second attempt (cached data).");
      } else {
        setError(msg);
      }
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
                {Object.keys(savedByCompany).length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem(STORAGE_BY_COMPANY);
                      localStorage.removeItem(STORAGE_ACTIVE_COMPANY);
                      localStorage.removeItem("rf_company_research_by_company");
                      localStorage.removeItem("rf_selected_company_signals");
                      localStorage.removeItem("selected_company_name");
                      localStorage.removeItem("found_contacts");
                      localStorage.removeItem("selected_contacts");
                      localStorage.removeItem("context_research_by_contact");
                      setSavedByCompany({});
                      setDraft(null);
                      setError(null);
                      setNotice(null);
                      setSelectedSignalIds(new Set());
                    }}
                    className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/20"
                  >
                    Clear All Cached Research
                  </button>
                )}
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

          {/* Main content: single column with collapsible company cards */}
          <div className="mt-6 space-y-3">
            {/* Saved companies row */}
            {savedCompanies.length > 0 && (
              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-white/70">Saved Research</span>
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={!savedCompanies.length} onClick={exportCsv} className="text-[10px] font-semibold rounded border border-white/10 bg-white/5 px-2 py-0.5 text-white/70 hover:bg-white/10 disabled:opacity-50">Export CSV</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
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
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                          isActive ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100" : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        {formatCompanyName(name)}
                        <span className="ml-1 text-[9px] text-white/40">{c.updated_at ? fmtUpdated(c.updated_at) : ""}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {draft ? (
              <>
                {!isSavedActive ? (
                  <div className="rounded-md border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
                    Draft generated but <span className="font-semibold">not saved</span> yet. Click <span className="font-semibold">Save research</span> below.
                  </div>
                ) : null}

                {/* Company card header */}
                <div className="rounded-lg border border-white/10 bg-black/20">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <h2 className="text-sm font-bold text-white">{activeCompanyDisplay}</h2>
                      {draft.intelligence?.overall_relevance_score ? (
                        <span className={`text-[11px] font-bold ${draft.intelligence.overall_relevance_score >= 0.7 ? "text-emerald-300" : draft.intelligence.overall_relevance_score >= 0.4 ? "text-amber-300" : "text-white/50"}`}>
                          {(draft.intelligence.overall_relevance_score * 100).toFixed(0)}% relevant
                        </span>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isRunning || !draft.company_name}
                        onClick={() => runResearch(draft.company_name)}
                        className="rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/10 disabled:opacity-50"
                      >
                        Regenerate
                      </button>
                      <button
                        type="button"
                        onClick={saveResearch}
                        className="rounded-md bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-700"
                      >
                        Save research
                      </button>
                    </div>
                  </div>

                  <div className="px-4 py-3 space-y-1">
                    {/* Company Intelligence */}
                    {draft.intelligence && (draft.intelligence.outreach_summary?.one_liner_hook || draft.intelligence.executive_summary) ? (
                      <div style={{paddingLeft: 10}}>
                        <CollapsibleSection title="Company Intelligence" className="mb-0">
                          {draft.intelligence.executive_summary && (
                            <div className="mb-3">
                              <div className="text-[12px] font-semibold text-orange-400 mb-1">Executive Summary</div>
                              <div className="text-[11.5px] text-white/65 leading-relaxed">{cleanThemeText(draft.intelligence.executive_summary)}</div>
                            </div>
                          )}
                          {draft.intelligence.outreach_summary?.one_liner_hook ? (
                            <div className="rounded-md border border-blue-500/20 bg-blue-500/10 p-3">
                              <div className="text-[12px] font-semibold text-orange-400 mb-1">Outreach Summary</div>
                              <div className="text-[11.5px] text-white/80 mb-2">{draft.intelligence.outreach_summary.one_liner_hook}</div>
                              {draft.intelligence.outreach_summary.strongest_signal && (
                                <div className="text-[11.5px] text-white/60 mb-1">
                                  <span className="text-amber-400 font-semibold text-[10px]">Strongest signal:</span> {draft.intelligence.outreach_summary.strongest_signal}
                                </div>
                              )}
                              {draft.intelligence.outreach_summary.recommended_angle && (
                                <div className="text-[11.5px] text-white/60 mb-2">
                                  <span className="text-emerald-400 font-semibold text-[10px]">Recommended angle:</span> {draft.intelligence.outreach_summary.recommended_angle}
                                </div>
                              )}
                              {draft.intelligence.outreach_summary.conversation_starters?.length ? (
                                <div className="mt-2 pt-2 border-t border-blue-500/15">
                                  <div className="text-[10px] font-semibold text-orange-300/80 mb-1">Conversation Starters</div>
                                  {draft.intelligence.outreach_summary.conversation_starters.map((s: string, i: number) => (
                                    <div key={`cs_${i}`} className="text-[11.5px] text-white/65 mt-0.5 flex items-start gap-1.5">
                                      <span className="shrink-0 text-blue-300/50 mt-0.5">\u2192</span>
                                      <span>{s}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              {draft.intelligence.outreach_summary.sequence_strategy?.length ? (
                                <div className="mt-2 pt-2 border-t border-blue-500/15">
                                  <div className="text-[10px] font-semibold text-orange-300/80 mb-1.5">Email Sequence Strategy</div>
                                  <div className="space-y-1.5">
                                    {draft.intelligence.outreach_summary.sequence_strategy.map((step: SequenceStep) => (
                                      <div key={`seq_${step.email_number}`} className="rounded border border-white/10 bg-white/[0.02] p-2">
                                        <div className="flex items-center gap-2 mb-0.5">
                                          <span className="inline-block rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 text-[9px] font-bold">
                                            Email {step.email_number}
                                          </span>
                                          <span className="text-[10px] text-white/70 font-medium">{step.angle}</span>
                                        </div>
                                        {step.subject_line && <div className="text-[10px] text-white/50 mt-0.5"><span className="text-white/30">Subject:</span> {step.subject_line}</div>}
                                        {step.key_point && <div className="text-[10px] text-white/45 mt-0.5">{step.key_point}</div>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </CollapsibleSection>
                      </div>
                    ) : null}

                    {/* Select Signals for Outreach Drafts */}
                    {allSignals.length > 0 ? (
                      <div style={{paddingLeft: 10}}>
                        <CollapsibleSection title="Select Signals for Outreach Drafts" count={allSignals.length} className="mb-0">
                          <p className="text-[10px] text-white/50 mb-2">
                            Pick up to {SIGNAL_LIMIT} signals to personalize your outreach. The AI considers your selections when crafting the message.
                          </p>
                          <div className="space-y-1">
                            {allSignals.map((sig) => {
                              const on = selectedSignalIds.has(sig.id);
                              const atLimit = selectedSignalIds.size >= SIGNAL_LIMIT;
                              const confColor = sig.confidence >= 0.8 ? "text-emerald-300" : sig.confidence >= 0.5 ? "text-amber-300" : "text-white/40";
                              const badgeClass = SIGNAL_CAT_COLORS[sig.category] || "bg-white/10 text-white/70 border-white/20";
                              return (
                                <button
                                  key={sig.id}
                                  type="button"
                                  disabled={!on && atLimit}
                                  onClick={() => toggleSignal(sig.id)}
                                  className={`w-full text-left rounded-md border p-2 transition-colors ${
                                    on
                                      ? "border-emerald-400/50 bg-emerald-500/15"
                                      : atLimit
                                        ? "border-white/5 bg-white/3 text-white/30 cursor-not-allowed"
                                        : "border-white/10 bg-white/5 hover:bg-white/10"
                                  }`}
                                >
                                  <div className="flex items-start gap-2">
                                    <span className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] font-bold ${
                                      on ? "border-emerald-400 bg-emerald-500 text-black" : "border-white/30 text-white/40"
                                    }`}>
                                      {on ? "\u2713" : ""}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                        <span className={`inline-block rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${badgeClass}`}>
                                          {sig.category}
                                        </span>
                                        <span className={`text-[9px] font-bold ml-auto ${confColor}`}>
                                          {(sig.confidence * 100).toFixed(0)}%
                                        </span>
                                      </div>
                                      {sig.label && sig.label !== sig.category && (
                                        <div className="text-[11.5px] text-white/80 font-medium leading-tight mb-0.5">{formatSignalText(sig.label)}</div>
                                      )}
                                      <div className="text-[11px] text-white/60 leading-relaxed break-words">{formatSignalText(sig.text)}</div>
                                      {(sig.date || sig.sourceUrl) && (
                                        <div className="flex items-center gap-3 mt-0.5">
                                          {sig.date && <span className="text-[9px] text-white/35">{sig.date}</span>}
                                          {sig.sourceUrl && (
                                            <a href={sig.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-400 hover:text-blue-300 underline" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                                              {friendlySourceLabel(sig.sourceUrl)}
                                            </a>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                          <p className="text-[9px] text-white/40 mt-1.5">{selectedSignalIds.size} of {SIGNAL_LIMIT} selected</p>
                        </CollapsibleSection>
                      </div>
                    ) : null}

                    {/* Hiring Signals */}
                    {(draft.hiring_signals || []).length > 0 ? (
                      <div style={{paddingLeft: 10}}>
                        <CollapsibleSection title="Hiring Signals" count={(draft.hiring_signals || []).length} className="mb-0">
                          <div className="space-y-1.5">
                            {(draft.hiring_signals || []).slice(0, 8).map((s, idx) => (
                              <div key={`sig_${idx}`} className="rounded-md border border-white/10 bg-white/5 p-2.5">
                                <div className="text-[11.5px] font-semibold text-orange-400">{s.label}</div>
                                <div className="mt-0.5 text-[11px] text-white/65 leading-relaxed break-words"><RichText text={s.detail} /></div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleSection>
                      </div>
                    ) : null}

                    {/* Recent Posts & Publications */}
                    {(hasRealData(draft.recent_posts || "") || hasRealData(draft.publications || "")) ? (
                      <div style={{paddingLeft: 10}}>
                        <CollapsibleSection title="Recent Posts & Publications" className="mb-0">
                          {hasRealData(draft.recent_posts || "") ? (
                            <div className={hasRealData(draft.publications || "") ? "mb-3" : ""}>
                              <div className="text-[12px] font-semibold text-orange-400 mb-1">Recent Posts</div>
                              <RichText text={scrubModePlaceholders(draft.recent_posts || "")} />
                            </div>
                          ) : null}
                          {hasRealData(draft.publications || "") ? (
                            <div>
                              <div className="text-[12px] font-semibold text-orange-400 mb-1">Publications</div>
                              <RichText text={scrubModePlaceholders(draft.publications || "")} />
                            </div>
                          ) : null}
                        </CollapsibleSection>
                      </div>
                    ) : null}

                    {/* Company Overview */}
                    {hasRealData(draft.overview) ? (
                      <div style={{paddingLeft: 10}}>
                        <CollapsibleSection title="Company Overview" className="mb-0">
                          <div className="text-[11.5px] text-white/65 leading-relaxed"><RichText text={scrubModePlaceholders(draft.overview)} /></div>
                        </CollapsibleSection>
                      </div>
                    ) : null}

                    {/* Theme */}
                    {hasRealData(draft.theme) ? (
                      <div style={{paddingLeft: 10}}>
                        <CollapsibleSection title="Theme & Mini-Plan" className="mb-0">
                          <div className="text-[11.5px] text-white/65 leading-relaxed"><RichText text={cleanThemeText(scrubModePlaceholders(draft.theme))} /></div>
                        </CollapsibleSection>
                      </div>
                    ) : null}

                    {/* Recent News */}
                    {hasRealData(draft.recent_news) ? (
                      <div style={{paddingLeft: 10}}>
                        <CollapsibleSection title="Recent News" className="mb-0">
                          <div className="text-[11.5px] text-white/65 leading-relaxed"><RichText text={scrubModePlaceholders(draft.recent_news)} /></div>
                        </CollapsibleSection>
                      </div>
                    ) : null}

                    {/* Culture & Values */}
                    {hasRealData(draft.culture) ? (
                      <div style={{paddingLeft: 10}}>
                        <CollapsibleSection title="Culture & Values" className="mb-0">
                          <div className="text-[11.5px] text-white/65 leading-relaxed"><RichText text={scrubModePlaceholders(draft.culture)} /></div>
                        </CollapsibleSection>
                      </div>
                    ) : null}

                    {/* Product Launches */}
                    {hasRealData(draft.product_launches) ? (
                      <div style={{paddingLeft: 10}}>
                        <CollapsibleSection title="Product Launches" className="mb-0">
                          <div className="text-[11.5px] text-white/65 leading-relaxed"><RichText text={scrubModePlaceholders(draft.product_launches)} /></div>
                        </CollapsibleSection>
                      </div>
                    ) : null}

                    {/* Leadership Changes */}
                    {hasRealData(draft.leadership_changes) ? (
                      <div style={{paddingLeft: 10}}>
                        <CollapsibleSection title="Leadership Changes" className="mb-0">
                          <div className="text-[11.5px] text-white/65 leading-relaxed"><RichText text={scrubModePlaceholders(draft.leadership_changes)} /></div>
                        </CollapsibleSection>
                      </div>
                    ) : null}

                    {/* Other Hiring Signals */}
                    {hasRealData(draft.other_hiring_signals) ? (
                      <div style={{paddingLeft: 10}}>
                        <CollapsibleSection title="Other Hiring Signals" className="mb-0">
                          <div className="text-[11.5px] text-white/65 leading-relaxed"><RichText text={scrubModePlaceholders(draft.other_hiring_signals)} /></div>
                        </CollapsibleSection>
                      </div>
                    ) : null}

                    {/* Market Position */}
                    {hasRealData(draft.market_position) ? (
                      <div style={{paddingLeft: 10}}>
                        <CollapsibleSection title="Market Position" className="mb-0">
                          <div className="text-[11.5px] text-white/65 leading-relaxed"><RichText text={scrubModePlaceholders(draft.market_position)} /></div>
                        </CollapsibleSection>
                      </div>
                    ) : null}

                    {/* Outreach Angles */}
                    {Array.isArray(draft.hooks) && draft.hooks.length ? (
                      <div style={{paddingLeft: 10}}>
                        <CollapsibleSection title="Outreach Angles" count={draft.hooks.length} className="mb-0">
                          <ul className="space-y-0.5 text-[11.5px] text-white/70">
                            {draft.hooks.slice(0, 8).map((h, i) => (
                              <li key={`hk_${i}`} className="flex items-start gap-1.5">
                                <span className="shrink-0 text-blue-300/50 mt-0.5">\u2192</span>
                                <span>{h}</span>
                              </li>
                            ))}
                          </ul>
                        </CollapsibleSection>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Save & Continue */}
                <div className="mt-6 flex justify-end gap-3">
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
              </>
            ) : (
              <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-sm text-white/70">
                Pick a company above and click <span className="font-semibold text-white">Run Company Research</span>.
              </div>
            )}
          </div>

          </div>

        </div>
      </div>
    </div>
  );
}

