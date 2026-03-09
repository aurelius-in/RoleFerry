"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type ImportedRole = {
  id: string;
  title: string;
  company: string;
  url: string;
  location?: string | null;
  match_score?: number | null;
  salary_range?: string | null;
  posted_date?: string | null;
  posted_text?: string | null;
  requirements_summary?: string | null;
};

type CsvImportResponse = {
  success: boolean;
  message: string;
  imported_roles: ImportedRole[];
  helper?: {
    input_rows?: number;
    imported?: number;
    dropped?: number;
  };
};

type StudioScrapedRole = {
  id: string;
  title: string;
  company: string;
  url: string;
  source: string;
  location?: string | null;
  salary_range?: string | null;
  snippet?: string;
  match_score?: number;
  posted_text?: string | null;
  match_reasons?: string[] | null;
};

type ScrapedRolesResponse = {
  success: boolean;
  message: string;
  roles: StudioScrapedRole[];
};

const STUDIO_NOTES_KEY = "rf_apply_studio_notes_v1";
const STUDIO_RANKS_KEY = "rf_apply_studio_ranks_v1";
const STUDIO_FILTERS_KEY = "rf_apply_studio_filters_v1";
const STUDIO_FAVORITES_KEY = "rf_apply_studio_favorites_v1";

function safeJson<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeKeyword(v: unknown): string {
  return String(v || "").split(/\s+/).join(" ").trim();
}

export default function ApplyStudioPage() {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [csvPreviewName, setCsvPreviewName] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState("");
  const [importedCount, setImportedCount] = useState(0);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [roleErr, setRoleErr] = useState<string | null>(null);
  const [roles, setRoles] = useState<StudioScrapedRole[]>([]);
  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [rankById, setRankById] = useState<Record<string, number>>({});
  const [funnelMode, setFunnelMode] = useState<"strict" | "broad">("broad");
  const [limit, setLimit] = useState<120 | 220 | 300>(220);
  const [positiveKeywords, setPositiveKeywords] = useState<string[]>([]);
  const [negativeKeywords, setNegativeKeywords] = useState<string[]>([]);
  const [positiveInput, setPositiveInput] = useState("");
  const [negativeInput, setNegativeInput] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Record<string, boolean>>({});
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const [shareUrl, setShareUrl] = useState("/tools/apply-studio");
  useEffect(() => {
    setShareUrl(`${window.location.origin}/tools/apply-studio`);
  }, []);

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    const notes = safeJson<Record<string, string>>(localStorage.getItem(STUDIO_NOTES_KEY), {});
    const ranks = safeJson<Record<string, number>>(localStorage.getItem(STUDIO_RANKS_KEY), {});
    const favs = safeJson<Record<string, boolean>>(localStorage.getItem(STUDIO_FAVORITES_KEY), {});
    const filters = safeJson<{ positive: string[]; negative: string[] }>(
      localStorage.getItem(STUDIO_FILTERS_KEY),
      { positive: [], negative: [] }
    );
    let pos = Array.isArray(filters.positive) ? filters.positive.map(normalizeKeyword).filter(Boolean).slice(0, 20) : [];
    let neg = Array.isArray(filters.negative) ? filters.negative.map(normalizeKeyword).filter(Boolean).slice(0, 20) : [];

    if (!pos.length && !neg.length) {
      const rolesPos = safeJson<string[]>(localStorage.getItem("rf_auto_roles_positive_keywords_v1"), []);
      const rolesNeg = safeJson<string[]>(localStorage.getItem("rf_auto_roles_negative_keywords_v1"), []);
      if (rolesPos.length) pos = rolesPos.map(normalizeKeyword).filter(Boolean).slice(0, 20);
      if (rolesNeg.length) neg = rolesNeg.map(normalizeKeyword).filter(Boolean).slice(0, 20);
    }

    setNotesById(notes);
    setRankById(ranks);
    setFavoriteIds(favs);
    setPositiveKeywords(pos);
    setNegativeKeywords(neg);
  }, []);

  useEffect(() => {
    localStorage.setItem(STUDIO_NOTES_KEY, JSON.stringify(notesById));
  }, [notesById]);

  useEffect(() => {
    localStorage.setItem(STUDIO_RANKS_KEY, JSON.stringify(rankById));
  }, [rankById]);

  useEffect(() => {
    localStorage.setItem(STUDIO_FILTERS_KEY, JSON.stringify({ positive: positiveKeywords, negative: negativeKeywords }));
  }, [positiveKeywords, negativeKeywords]);

  useEffect(() => {
    localStorage.setItem(STUDIO_FAVORITES_KEY, JSON.stringify(favoriteIds));
  }, [favoriteIds]);

  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (!next[id]) delete next[id];
      return next;
    });
  };

  const visibleRoles = useMemo(() => {
    if (!favoritesOnly) return roles;
    return roles.filter((r) => favoriteIds[r.id]);
  }, [roles, favoritesOnly, favoriteIds]);

  const exportStudioCsv = () => {
    if (!roles.length) return;
    const headers = [
      "Job Title",
      "Company",
      "Location",
      "Match %",
      "Posted",
      "Job URL",
      "Source",
      "Rank",
      "Favorite",
      "Notes",
      "Snippet",
    ];
    const esc = (v: string) => {
      const s = String(v || "").replace(/"/g, '""');
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
    };
    const rows = roles.map((r) => [
      esc(r.title),
      esc(r.company),
      esc(r.location || ""),
      Number.isFinite(Number(r.match_score)) ? String(Math.round(Number(r.match_score))) : "",
      esc(r.posted_text || ""),
      esc(r.url),
      esc(r.source || ""),
      rankById[r.id] ? String(rankById[r.id]) : "",
      favoriteIds[r.id] ? "Yes" : "",
      esc(notesById[r.id] || ""),
      esc(r.snippet || ""),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const name = (() => {
      try {
        const raw = localStorage.getItem("resume_extract");
        const resume = raw ? JSON.parse(raw) : null;
        const n = String(resume?.name || "").trim().replace(/\s+/g, "_");
        if (n) return `${n}_apply_studio_${new Date().toISOString().slice(0, 10)}.csv`;
      } catch {}
      return `roleferry_apply_studio_${new Date().toISOString().slice(0, 10)}.csv`;
    })();
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const addFromInput = (kind: "positive" | "negative", rawInput: string): number => {
    const parts = String(rawInput || "")
      .split(/[,\n;]+/)
      .map((x) => normalizeKeyword(x))
      .filter(Boolean);
    if (!parts.length) return 0;
    if (kind === "positive") {
      const merged = Array.from(new Set([...positiveKeywords, ...parts].map((x) => normalizeKeyword(x).toLowerCase()))).slice(0, 20);
      const canonical = merged.map((x) => parts.find((p) => normalizeKeyword(p).toLowerCase() === x) || positiveKeywords.find((p) => normalizeKeyword(p).toLowerCase() === x) || x);
      const before = new Set(positiveKeywords.map((x) => normalizeKeyword(x).toLowerCase()));
      const added = canonical.filter((x) => !before.has(normalizeKeyword(x).toLowerCase())).length;
      setPositiveKeywords(canonical);
      return added;
    }
    const merged = Array.from(new Set([...negativeKeywords, ...parts].map((x) => normalizeKeyword(x).toLowerCase()))).slice(0, 20);
    const canonical = merged.map((x) => parts.find((p) => normalizeKeyword(p).toLowerCase() === x) || negativeKeywords.find((p) => normalizeKeyword(p).toLowerCase() === x) || x);
    const before = new Set(negativeKeywords.map((x) => normalizeKeyword(x).toLowerCase()));
    const added = canonical.filter((x) => !before.has(normalizeKeyword(x).toLowerCase())).length;
    setNegativeKeywords(canonical);
    return added;
  };

  const loadRoles = async () => {
    setRoleErr(null);
    setMsg(null);
    setIsLoadingRoles(true);
    try {
      const build = (simple = false) => {
        const params = new URLSearchParams({
          limit: String(simple ? Math.min(limit, 180) : limit),
          funnel_mode: funnelMode,
        });
        if (!simple) {
          if (positiveKeywords.length) params.set("positive_keywords", positiveKeywords.join(", "));
          if (negativeKeywords.length) params.set("negative_keywords", negativeKeywords.join(", "));
        }
        try {
          const prefs = JSON.parse(localStorage.getItem("job_preferences") || "{}");
          if (prefs.role_categories?.length) params.set("role_categories", prefs.role_categories.join(", "));
          if (prefs.skills?.length) params.set("skills", prefs.skills.join(", "));
          if (prefs.industries?.length) params.set("industries", prefs.industries.join(", "));
          if (prefs.location_preferences?.length) params.set("location_preferences", prefs.location_preferences.join(", "));
          if (prefs.state) params.set("state", prefs.state);
          if (prefs.minimum_salary) params.set("minimum_salary_pref", String(prefs.minimum_salary));
        } catch {}
        try {
          const resume = JSON.parse(localStorage.getItem("resume_extract") || "{}");
          const skills = resume?.skills || resume?.Skills || [];
          if (Array.isArray(skills) && skills.length) params.set("resume_skills", skills.join(", "));
        } catch {}
        return params;
      };
      let resp: ScrapedRolesResponse;
      try {
        resp = await api<ScrapedRolesResponse>(`/job-descriptions/scraped-roles?${build(false).toString()}`, "GET");
      } catch {
        resp = await api<ScrapedRolesResponse>(`/job-descriptions/scraped-roles?${build(true).toString()}`, "GET");
      }
      const list = Array.isArray(resp?.roles) ? resp.roles : [];
      setRoles(list);
      setSelectedIds((prev) => {
        const next: Record<string, boolean> = { ...prev };
        for (const r of list) if (next[r.id] === undefined) next[r.id] = true;
        return next;
      });
      setMsg(`Loaded ${list.length} roles. Expand any row to rank and add notes.`);
    } catch (e: unknown) {
      setRoles([]);
      setRoleErr(e instanceof Error ? e.message : "Failed to load roles.");
    } finally {
      setIsLoadingRoles(false);
    }
  };

  const onPickCsv = async (f: File | null) => {
    setErr(null);
    setMsg(null);
    if (!f) return;
    try {
      const text = await f.text();
      setCsvContent(String(text || ""));
      setCsvPreviewName(f.name || "matches.csv");
    } catch (e: any) {
      setErr(String(e?.message || "Failed to read CSV file."));
    }
  };

  const importCsvIntoRoles = async () => {
    setErr(null);
    setMsg(null);
    if (!csvContent.trim()) {
      setErr("Pick a CSV file first.");
      return;
    }
    setBusy(true);
    try {
      const resp = await api<CsvImportResponse>("/applications/import/matches-csv", "POST", {
        csv_content: csvContent,
      });
      const rows = Array.isArray(resp?.imported_roles) ? resp.imported_roles : [];
      if (!rows.length) {
        setImportedCount(0);
        setMsg("No importable rows found.");
        return;
      }
      const existing = (() => {
        try {
          const raw = localStorage.getItem("job_descriptions");
          const arr = raw ? JSON.parse(raw) : [];
          return Array.isArray(arr) ? arr : [];
        } catch {
          return [];
        }
      })();
      const byId: Record<string, any> = {};
      for (const r of existing) {
        const id = String(r?.id || "").trim();
        if (!id) continue;
        byId[id] = r;
      }
      for (const r of rows) {
        byId[r.id] = {
          ...(byId[r.id] || {}),
          id: r.id,
          title: String(r.title || "").trim(),
          company: String(r.company || "").trim(),
          url: String(r.url || "").trim(),
          content: String(r.requirements_summary || "").trim(),
          painPoints: Array.isArray((byId[r.id] || {}).painPoints) ? (byId[r.id] || {}).painPoints : [],
          requiredSkills: String(r.requirements_summary || "")
            .split(/[;,]/)
            .map((x) => String(x || "").trim())
            .filter(Boolean)
            .slice(0, 12),
          successMetrics: Array.isArray((byId[r.id] || {}).successMetrics) ? (byId[r.id] || {}).successMetrics : [],
          location: String(r.location || "").trim(),
          salaryRange: String(r.salary_range || "").trim() || undefined,
          parsedAt: new Date().toISOString(),
          postedDate: String(r.posted_date || "").trim() || undefined,
          postedText: String(r.posted_text || "").trim() || undefined,
          matchScore: Number.isFinite(Number(r.match_score)) ? Number(r.match_score) : undefined,
        };
      }
      const merged = Object.values(byId);
      localStorage.setItem("job_descriptions", JSON.stringify(merged));
      setImportedCount(rows.length);
      setMsg(`Imported ${rows.length} jobs into Roles. Open Roles to review and rank.`);
    } catch (e: any) {
      setErr(String(e?.message || "CSV import failed."));
    } finally {
      setBusy(false);
    }
  };

  const importSelectedToRoles = () => {
    const picked = roles.filter((r) => selectedIds[r.id]);
    if (!picked.length) {
      setRoleErr("Select at least one role first.");
      return;
    }
    const existing = safeJson<any[]>(localStorage.getItem("job_descriptions"), []);
    const byId: Record<string, any> = {};
    for (const row of existing) {
      const id = String(row?.id || "").trim();
      if (id) byId[id] = row;
    }
    for (const r of picked) {
      const note = String(notesById[r.id] || "").trim();
      const rank = Number(rankById[r.id] || 0);
      const isFav = !!favoriteIds[r.id];
      byId[r.id] = {
        ...(byId[r.id] || {}),
        id: r.id,
        title: r.title,
        company: r.company,
        url: r.url,
        location: r.location || "",
        salaryRange: r.salary_range || undefined,
        matchScore: Number(r.match_score || 0) || undefined,
        content: note || r.snippet || "",
        painPoints: Array.isArray((byId[r.id] || {}).painPoints) ? (byId[r.id] || {}).painPoints : [],
        requiredSkills: [],
        successMetrics: Array.isArray((byId[r.id] || {}).successMetrics) ? (byId[r.id] || {}).successMetrics : [],
        postedText: r.posted_text || undefined,
        parsedAt: new Date().toISOString(),
        preferenceStars: rank >= 1 && rank <= 5 ? rank : undefined,
        isFavorite: isFav || undefined,
        favoriteRank: isFav ? 1 : undefined,
      };
    }
    localStorage.setItem("job_descriptions", JSON.stringify(Object.values(byId)));
    setMsg(`Imported ${picked.length} roles into workflow. Continue to Gap Analysis.`);
  };

  return (
    <main className="max-w-5xl mx-auto px-6 py-8 text-slate-100">
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-200">RoleFerry Tool</div>
            <h1 className="mt-1 text-3xl font-bold">Apply Studio</h1>
            <p className="mt-2 text-sm text-white/70">
              A standalone, linkable workflow for job import, fit validation, and one-click apply execution.
            </p>
          </div>
          <div />
        </div>

        <div className="mt-6 rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="text-sm font-semibold">Top-of-Funnel Workspace</div>
          <p className="mt-1 text-xs text-white/70">
            Regenerate job lists, tweak filters, rank and annotate each role, then import selected roles to continue.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <div className="inline-flex rounded border border-white/15 bg-black/20 p-1">
              <button type="button" onClick={() => setFunnelMode("strict")} className={`rounded px-2 py-1 ${funnelMode === "strict" ? "bg-white/20 text-white" : "text-white/70"}`}>Strict</button>
              <button type="button" onClick={() => setFunnelMode("broad")} className={`rounded px-2 py-1 ${funnelMode === "broad" ? "bg-emerald-500/25 text-emerald-100" : "text-white/70"}`}>Broad</button>
            </div>
            {[120, 220, 300].map((n) => (
              <button key={`l_${n}`} type="button" onClick={() => setLimit(n as 120 | 220 | 300)} className={`rounded border px-2 py-1 ${limit === n ? "border-white/30 bg-white/15" : "border-white/10 bg-black/20 text-white/70"}`}>{n}</button>
            ))}
            <button type="button" onClick={loadRoles} disabled={isLoadingRoles} className="rounded border border-white/15 bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/15 disabled:opacity-50">
              {isLoadingRoles ? "Loading..." : "Regenerate"}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <div className="flex gap-2">
              <input value={positiveInput} onChange={(e) => setPositiveInput(e.target.value)} placeholder="Positive keywords (comma separated)" className="flex-1 rounded border border-white/15 bg-black/30 px-2.5 py-1.5 text-xs" />
              <button type="button" onClick={() => { const n = addFromInput("positive", positiveInput); setPositiveInput(""); setMsg(n ? `Added ${n} positive keyword${n === 1 ? "" : "s"}.` : "No new positive keywords."); }} className="rounded border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-semibold">Add</button>
            </div>
            <div className="flex gap-2">
              <input value={negativeInput} onChange={(e) => setNegativeInput(e.target.value)} placeholder="Negative keywords (comma separated)" className="flex-1 rounded border border-white/15 bg-black/30 px-2.5 py-1.5 text-xs" />
              <button type="button" onClick={() => { const n = addFromInput("negative", negativeInput); setNegativeInput(""); setMsg(n ? `Added ${n} negative keyword${n === 1 ? "" : "s"}.` : "No new negative keywords."); }} className="rounded border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-semibold">Add</button>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-white/70">
            {positiveKeywords.length ? `Positive: ${positiveKeywords.join(", ")}` : "Positive: none"}{" | "}
            {negativeKeywords.length ? `Negative: ${negativeKeywords.join(", ")}` : "Negative: none"}
          </div>
          {roleErr ? <div className="mt-2 text-xs text-red-200">{roleErr}</div> : null}
          {msg ? <div className="mt-2 text-xs text-emerald-200">{msg}</div> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFavoritesOnly((v) => !v)}
              className={`rounded border px-2 py-1 text-xs font-semibold ${
                favoritesOnly ? "border-yellow-400/40 bg-yellow-500/20 text-yellow-100" : "border-white/10 bg-black/20 text-white/70 hover:bg-white/10"
              }`}
            >
              {favoritesOnly ? "★ Favorites only" : "☆ Favorites only"}
            </button>
            {roles.length > 0 ? (
              <button
                type="button"
                onClick={exportStudioCsv}
                className="rounded border border-blue-400/35 bg-blue-500/20 px-2 py-1 text-xs font-semibold text-blue-100 hover:bg-blue-500/30 inline-flex items-center gap-1"
              >
                <span>⬇</span> Download CSV
              </button>
            ) : null}
            {roles.length > 0 ? (
              <span className="text-[11px] text-white/60">{visibleRoles.length} of {roles.length} shown</span>
            ) : null}
          </div>
          <div className="mt-3 max-h-[520px] overflow-auto rounded border border-white/10">
            {visibleRoles.length === 0 ? (
              <div className="p-3 text-xs text-white/70">{roles.length === 0 ? "No roles loaded yet. Click Regenerate." : "No favorites yet. Star some roles first."}</div>
            ) : (
              <div className="space-y-2 p-2">
                {visibleRoles.map((r) => {
                  const expanded = !!expandedById[r.id];
                  const isFav = !!favoriteIds[r.id];
                  return (
                    <div key={r.id} className={`rounded border p-2 ${isFav ? "border-yellow-400/30 bg-yellow-900/10" : "border-white/10 bg-black/20"}`}>
                      <div className="flex items-start gap-2">
                        <input type="checkbox" checked={!!selectedIds[r.id]} onChange={(e) => setSelectedIds((p) => ({ ...p, [r.id]: e.target.checked }))} />
                        <button
                          type="button"
                          onClick={() => toggleFavorite(r.id)}
                          className={`text-lg leading-none ${isFav ? "text-yellow-300" : "text-white/25 hover:text-yellow-200"}`}
                          title={isFav ? "Remove from favorites" : "Add to favorites"}
                        >
                          {isFav ? "★" : "☆"}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold leading-tight">{r.title}</div>
                          <div className="text-xs text-white/70">{r.company} {r.location ? `• ${r.location}` : ""} {r.posted_text ? `• Posted ${r.posted_text}` : ""}</div>
                        </div>
                        <div className="text-[11px] font-bold text-amber-200">{Number.isFinite(Number(r.match_score)) ? `${Math.round(Number(r.match_score))}%` : "—"}</div>
                        <button type="button" onClick={() => setExpandedById((p) => ({ ...p, [r.id]: !expanded }))} className="rounded border border-white/10 bg-white/5 px-2 py-1 text-[11px]">{expanded ? "Hide" : "Details"}</button>
                      </div>
                      {expanded ? (
                        <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
                          <div className="text-xs text-white/75">{r.snippet || "No summary provided."}</div>
                          <div className="flex flex-wrap items-center gap-2">
                            <a href={r.url} target="_blank" rel="noopener noreferrer" className="rounded border border-white/15 bg-white/10 px-2 py-1 text-[11px]">Open link</a>
                            <span className="text-[11px] text-white/60">Source: {r.source || "Unknown"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] text-white/70">Rank</label>
                            <select value={String(rankById[r.id] || 0)} onChange={(e) => setRankById((p) => ({ ...p, [r.id]: Number(e.target.value) || 0 }))} className="rounded border border-white/15 bg-black/30 px-2 py-1 text-xs">
                              <option value="0">None</option>
                              <option value="5">5 - Best</option>
                              <option value="4">4 - Strong</option>
                              <option value="3">3 - Good</option>
                              <option value="2">2 - Fair</option>
                              <option value="1">1 - Low</option>
                            </select>
                          </div>
                          <textarea value={notesById[r.id] || ""} onChange={(e) => setNotesById((p) => ({ ...p, [r.id]: e.target.value }))} placeholder="Notes for this role..." className="min-h-[70px] w-full rounded border border-white/15 bg-black/30 px-2.5 py-1.5 text-xs" />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={importSelectedToRoles} className="rounded border border-emerald-400/35 bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30">
              Import Selected Into Workflow
            </button>
            <button type="button" onClick={() => router.push("/gap-analysis")} className="rounded border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15">
              Continue to Gap Analysis
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="text-sm font-semibold">Quick Launch</div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Link href="/job-descriptions" className="rounded-md border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15">
              Start at Roles
            </Link>
            <Link href="/apply" className="rounded-md border border-emerald-400/35 bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30">
              Open Apply Step
            </Link>
            <Link href="/tracker" className="rounded-md border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15">
              View Tracker
            </Link>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="text-sm font-semibold">Bring Your Existing Job Funnel (CSV)</div>
          <p className="mt-1 text-xs text-white/70">
            Import SimplyApply-style CSV rows directly into RoleFerry, then continue with gaps, match, apply, tracker, and outreach.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center rounded-md border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15">
              Choose CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => onPickCsv((e.target.files && e.target.files[0]) || null)}
              />
            </label>
            <button
              type="button"
              onClick={importCsvIntoRoles}
              disabled={busy || !csvContent.trim()}
              className="rounded-md border border-emerald-400/35 bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50"
            >
              {busy ? "Importing..." : "Import Into Roles"}
            </button>
            {csvPreviewName ? <span className="text-xs text-white/70">File: {csvPreviewName}</span> : null}
            {importedCount > 0 ? <span className="text-xs text-emerald-200">Imported: {importedCount}</span> : null}
          </div>
          {msg ? <div className="mt-2 text-xs text-emerald-200">{msg}</div> : null}
          {err ? <div className="mt-2 text-xs text-red-200">{err}</div> : null}
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
          <div className="text-sm font-semibold">Share This Tool</div>
          <div className="mt-2 flex items-center gap-2">
            <input
              value={shareUrl}
              readOnly
              className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-xs text-white/80"
            />
            <button
              type="button"
              onClick={copyShareUrl}
              className="rounded-md border border-white/15 bg-white/10 px-3 py-2 text-xs font-semibold hover:bg-white/15"
            >
              {copied ? "Copied" : "Copy URL"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}


