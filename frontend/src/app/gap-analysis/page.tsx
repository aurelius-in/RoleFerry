"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatCompanyName } from "@/lib/format";
import InlineSpinner from "@/components/InlineSpinner";

type JobPreferences = {
  values: string[];
  roleCategories: string[];
  locationPreferences: string[];
  locationText?: string;
  workType: string[];
  roleType: string[];
  companySize: string[];
  industries: string[];
  skills: string[];
  minimumSalary: string;
  jobSearchStatus: string;
  state?: string;
};

type ResumeExtract = {
  positions?: Array<{ company: string; title: string; description: string }>;
  keyMetrics?: Array<{ metric: string; value: string; context: string }>;
  skills?: string[];
  accomplishments?: string[];
  education?: Array<{ school: string; degree: string; field?: string; startYear?: string; endYear?: string; notes?: string }>;
};

type PersonalityProfile = Record<string, any>;
type TemperamentProfile = Record<string, any>;

type JobDescription = {
  id: string;
  title: string;
  company: string;
  url?: string;
  content?: string;
  painPoints?: string[];
  requiredSkills?: string[];
  successMetrics?: string[];
  grade?: "Shoo-in" | "Stretch" | "Ideal";
  parsedAt?: string;
};

type GapSeverity = "small" | "medium" | "large" | "low" | "high";

type GapAnalysisItem = {
  job_id: string;
  title: string;
  company: string;
  score: number;
  recommendation: "pursue" | "maybe" | "skip";
  matched_skills: string[];
  missing_skills: string[];
  resume_gaps: Array<{ gap: string; severity: GapSeverity; evidence: string[]; how_to_close: string }>;
  personality_gaps: Array<{ gap: string; severity: GapSeverity; evidence: string[]; how_to_close: string }>;
  preference_gaps: Array<{ gap: string; severity: GapSeverity; evidence: string[]; how_to_close: string }>;
  notes: string[];
};

type GapAnalysisResponse = {
  success: boolean;
  message: string;
  ranked: GapAnalysisItem[];
  overall?: any;
  helper?: {
    used_llm: boolean;
    model?: string;
    notes?: string[];
  };
};

function safeJson<T>(raw: string | null, fallback: T): T {
  try {
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeJsonUnknown(raw: string | null): any {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function buildMinimalPersonalityProfileFromAnswers(rawAnswers: any): PersonalityProfile | null {
  // `personality_answers_v1` is stored as a map: { q1: -2..2, q2: ..., ... }.
  if (!rawAnswers || typeof rawAnswers !== "object") return null;
  const asNum = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const axisByQ: Record<string, "energy" | "info" | "decisions" | "structure"> = {
    q1: "energy",
    q2: "energy",
    q3: "info",
    q4: "info",
    q5: "decisions",
    q6: "decisions",
    q7: "structure",
    q8: "structure",
    q9: "energy",
    q10: "info",
    q11: "decisions",
    q12: "structure",
  };
  const scores: Record<string, number> = { energy: 0, info: 0, decisions: 0, structure: 0 };
  let hasAny = false;
  for (const [qid, axis] of Object.entries(axisByQ)) {
    if (!(qid in rawAnswers)) continue;
    hasAny = true;
    scores[axis] += asNum((rawAnswers as any)[qid]);
  }
  if (!hasAny) return null;
  return { version: "answers-v1", completed_at: new Date().toISOString(), scores };
}

function buildMinimalTemperamentProfileFromAnswers(rawAnswers: any): TemperamentProfile | null {
  // `temperament_answers_v1` is stored as a map: { t1: -2..2, ... }.
  if (!rawAnswers || typeof rawAnswers !== "object") return null;
  const asNum = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const axisByQ: Record<string, "communication" | "action"> = {
    t1: "communication",
    t2: "communication",
    t3: "communication",
    t4: "communication",
    t5: "action",
    t6: "action",
    t7: "action",
    t8: "action",
  };
  const scores: Record<string, number> = { communication: 0, action: 0 };
  let hasAny = false;
  for (const [qid, axis] of Object.entries(axisByQ)) {
    if (!(qid in rawAnswers)) continue;
    hasAny = true;
    scores[axis] += asNum((rawAnswers as any)[qid]);
  }
  if (!hasAny) return null;
  return { version: "answers-v1", completed_at: new Date().toISOString(), scores };
}

function gapTierBadge(totalGaps: number) {
  if (totalGaps <= 2) return { label: "Minor Gaps", cls: "bg-emerald-500/15 border-emerald-500/30 text-emerald-200" };
  if (totalGaps <= 5) return { label: "Moderate Gaps", cls: "bg-yellow-500/15 border-yellow-500/30 text-yellow-200" };
  return { label: "Major Gaps", cls: "bg-red-500/15 border-red-500/30 text-red-200" };
}

export default function GapAnalysisPage() {
  const router = useRouter();
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [preferences, setPreferences] = useState<JobPreferences | null>(null);
  const [resumeExtract, setResumeExtract] = useState<ResumeExtract | null>(null);
  const [personalityProfile, setPersonalityProfile] = useState<PersonalityProfile | null>(null);
  const [temperamentProfile, setTemperamentProfile] = useState<TemperamentProfile | null>(null);

  const [ranked, setRanked] = useState<GapAnalysisItem[]>([]);
  const [helper, setHelper] = useState<GapAnalysisResponse["helper"] | null>(null);
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setJobDescriptions(safeJson<JobDescription[]>(localStorage.getItem("job_descriptions"), []));
    setPreferences(safeJson<JobPreferences | null>(localStorage.getItem("job_preferences"), null));
    setResumeExtract(safeJson<ResumeExtract | null>(localStorage.getItem("resume_extract"), null));
    const p = safeJson<PersonalityProfile | null>(localStorage.getItem("personality_profile"), null);
    const t = safeJson<TemperamentProfile | null>(localStorage.getItem("temperament_profile"), null);

    // If the user didn't finish the full quiz, we still persist raw answers.
    // Build a minimal profile from those answers so Gap Analysis can genuinely cross-reference personality.
    const pFromAnswers = p || buildMinimalPersonalityProfileFromAnswers(safeJsonUnknown(localStorage.getItem("personality_answers_v1")));
    const tFromAnswers = t || buildMinimalTemperamentProfileFromAnswers(safeJsonUnknown(localStorage.getItem("temperament_answers_v1")));
    setPersonalityProfile(pFromAnswers);
    setTemperamentProfile(tFromAnswers);
    try {
      if (!p && pFromAnswers) localStorage.setItem("personality_profile", JSON.stringify(pFromAnswers));
    } catch {}
    try {
      if (!t && tFromAnswers) localStorage.setItem("temperament_profile", JSON.stringify(tFromAnswers));
    } catch {}
  }, []);

  // Allow analysis even without personality; personality gaps will be empty in that case.
  const canAnalyze = jobDescriptions.length > 0 && Boolean(preferences) && Boolean(resumeExtract);
  const missingSteps = useMemo(() => {
    const missing: Array<{ key: string; label: string; href: string }> = [];
    if (!preferences) missing.push({ key: "prefs", label: "Role Preferences (Step 1)", href: "/job-preferences" });
    if (!resumeExtract) missing.push({ key: "resume", label: "Resume (Step 2)", href: "/resume" });
    if (jobDescriptions.length === 0) missing.push({ key: "jobs", label: "Role Search (Step 4)", href: "/job-descriptions" });
    return missing;
  }, [jobDescriptions.length, preferences, resumeExtract]);

  const topSummary = useMemo(() => {
    const top = ranked[0];
    if (!top) return null;
    return `${top.title} @ ${formatCompanyName(top.company)}`;
  }, [ranked]);

  const rankedUi = useMemo(() => Array.isArray(ranked) ? ranked : [], [ranked]);

  async function runAnalysis() {
    setError(null);
    setIsAnalyzing(true);
    try {
      // IMPORTANT: backend expects snake_case keys (GapAnalysisPreferences).
      // Our localStorage shape is camelCase, so map it here.
      const prefsPayload = preferences
        ? {
            values: preferences.values || [],
            role_categories: preferences.roleCategories || [],
            location_preferences: preferences.locationPreferences || [],
            // Omit when blank; backend accepts null/empty but this avoids validation issues.
            location_text: String(preferences.locationText || "").trim() || undefined,
            work_type: preferences.workType || [],
            role_type: preferences.roleType || [],
            company_size: preferences.companySize || [],
            industries: preferences.industries || [],
            skills: preferences.skills || [],
            minimum_salary: preferences.minimumSalary || "",
            job_search_status: preferences.jobSearchStatus || "",
            // Only send state when the Role Preferences UI could have collected it (In-Person selected).
            state: (preferences.locationPreferences || []).includes("In-Person") ? (preferences.state || null) : null,
            user_mode: "job-seeker",
          }
        : null;

      const resp = await api<GapAnalysisResponse>("/gap-analysis/analyze", "POST", {
        preferences: prefsPayload,
        resume_extract: resumeExtract,
        personality_profile: personalityProfile,
        temperament_profile: temperamentProfile,
        job_descriptions: jobDescriptions,
      });
      if (!resp.success) throw new Error(resp.message || "Analysis failed");
      setRanked(resp.ranked || []);
      setHelper(resp.helper || null);
    } catch (e: any) {
      setError(e?.message || "Failed to run gap analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  const toggleExpand = (jobId: string) => {
    setExpandedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId); else next.add(jobId);
      return next;
    });
  };

  const getJobById = (jobId: string) => {
    const id = String(jobId || "");
    return jobDescriptions.find((j) => String(j.id || "") === id) || null;
  };

  const persistSelectedRole = (jobId: string) => {
    const jd = getJobById(jobId);
    if (!jd) return false;
    try {
      localStorage.setItem("selected_job_description", JSON.stringify(jd));
      localStorage.setItem("selected_job_description_id", String(jd.id || ""));
      return true;
    } catch {
      return false;
    }
  };

  const dropRole = (jobId: string) => {
    const id = String(jobId || "");
    // Remove from job descriptions (source of truth) and persist.
    setJobDescriptions((prev) => {
      const next = (prev || []).filter((j) => String(j.id || "") !== id);
      try {
        localStorage.setItem("job_descriptions", JSON.stringify(next));
      } catch {}
      return next;
    });
    setRanked((prev) => (prev || []).filter((r) => String(r.job_id || "") !== id));
    setExpandedJobIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    // If we dropped the persisted selected role, clear it.
    try {
      const cur = String(localStorage.getItem("selected_job_description_id") || "");
      if (cur && cur === id) {
        localStorage.removeItem("selected_job_description");
        localStorage.removeItem("selected_job_description_id");
      }
    } catch {}
  };

  function normalizeSeverity(sev: GapSeverity): "small" | "medium" | "large" {
    if (sev === "low") return "small";
    if (sev === "high") return "large";
    if (sev === "small" || sev === "medium" || sev === "large") return sev;
    return "medium";
  }

  function severityPill(sev: GapSeverity) {
    const s = normalizeSeverity(sev);
    if (s === "large") return "bg-red-500/15 border-red-500/30 text-red-200";
    if (s === "medium") return "bg-yellow-500/15 border-yellow-500/30 text-yellow-200";
    return "bg-emerald-500/15 border-emerald-500/30 text-emerald-200";
  }

  function severityLabel(sev: GapSeverity): "small" | "medium" | "large" {
    return normalizeSeverity(sev);
  }

  function Icon({ kind }: { kind: "resume" | "personality" | "prefs" }) {
    const base = "w-4 h-4";
    if (kind === "resume") {
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M7 4h7l3 3v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.6" />
          <path d="M14 4v4h4" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 12h8M8 16h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    }
    if (kind === "personality") {
      return (
        <svg className={base} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2l1.4 4.6L18 8l-4.6 1.4L12 14l-1.4-4.6L6 8l4.6-1.4L12 2Z" fill="currentColor" opacity="0.9" />
          <path d="M18.5 12.5l.9 2.9 2.9.9-2.9.9-.9 2.9-.9-2.9-2.9-.9 2.9-.9.9-2.9Z" fill="currentColor" opacity="0.7" />
        </svg>
      );
    }
    return (
      <svg className={base} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7h16M7 7v10M17 7v10M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M9 12h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 mb-4">
        <a href="/job-descriptions" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
          <span className="mr-2">←</span> Back to Role Search
        </a>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Gap Analysis</h1>
              <p className="text-sm text-white/70">
                Rank imported roles by fit and quickly spot what to close.
              </p>
            </div>
            <div className="bg-gray-900/70 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-lg border border-white/10">
              Step 5 of 12
            </div>
          </div>

          {!canAnalyze ? (
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4 text-xs text-yellow-100">
              <div className="font-semibold">Gap Analysis isn’t ready yet.</div>
              <div className="mt-1 text-white/80">
                Missing {missingSteps.length === 1 ? "step" : "steps"}:
              </div>
              <ul className="mt-2 list-disc list-inside text-white/80 space-y-1">
                {missingSteps.map((s) => (
                  <li key={s.key}>
                    <a href={s.href} className="underline text-white hover:text-white/90">
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={runAnalysis}
              disabled={!canAnalyze || isAnalyzing}
              className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <InlineSpinner />
                  <span>Analyzing</span>
                </>
              ) : (
                "Run Gap Analysis"
              )}
            </button>

            {topSummary ? (
              <div className="text-xs text-white/70">
                Top recommendation: <span className="font-semibold text-white">{topSummary}</span>
              </div>
            ) : null}
          </div>

          {helper?.notes?.length ? (
            <div className="mt-4 text-xs text-white/60">
              {helper.notes.slice(0, 3).join(" · ")}
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="mt-4 text-[11px] text-emerald-300 font-medium">{notice}</div>
          ) : null}

          {rankedUi.length > 0 ? (
            <div className="mt-8 space-y-1">
              {rankedUi.map((r) => {
                const isOpen = expandedJobIds.has(r.job_id);
                const totalGaps = (r.resume_gaps?.length || 0) + (r.personality_gaps?.length || 0) + (r.preference_gaps?.length || 0);
                const badge = gapTierBadge(totalGaps);
                return (
                  <div key={r.job_id} className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleExpand(r.job_id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
                    >
                      <svg className={`w-3 h-3 text-white/40 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white truncate">{r.title}</span>
                          <span className="text-xs text-white/50 truncate">{formatCompanyName(r.company)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-white/40">{totalGaps} gap{totalGaps !== 1 ? "s" : ""}</span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] ${badge.cls}`}>{badge.label}</span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-white/5">
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            className="px-2.5 py-1 rounded-md border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 text-[10px] font-semibold"
                            onClick={() => {
                              const ok = persistSelectedRole(r.job_id);
                              setNotice(ok ? "Saved role for downstream steps." : "Couldn\u2019t save role.");
                              window.setTimeout(() => setNotice(null), 1600);
                            }}
                          >
                            Save Role
                          </button>
                          <button
                            type="button"
                            className="px-2.5 py-1 rounded-md border border-red-500/25 bg-red-500/10 text-red-200 hover:bg-red-500/15 text-[10px] font-semibold"
                            onClick={() => {
                              dropRole(r.job_id);
                              setNotice("Dropped role from your list.");
                              window.setTimeout(() => setNotice(null), 1600);
                            }}
                          >
                            Drop Role
                          </button>
                        </div>

                        <div className="mt-4 space-y-3">
                          {[
                            { title: "Resume gaps", kind: "resume" as const, items: r.resume_gaps || [] },
                            { title: "Personality gaps", kind: "personality" as const, items: r.personality_gaps || [] },
                            { title: "Preference gaps", kind: "prefs" as const, items: r.preference_gaps || [] },
                          ].map((col) => (
                            <div key={col.title} className="rounded-lg border border-white/10 bg-white/5 p-3">
                              <div className="flex items-center gap-2 text-white/80 mb-2">
                                <span className="text-white/70"><Icon kind={col.kind} /></span>
                                <div className="text-[11px] font-semibold uppercase tracking-wider">{col.title}</div>
                                <span className="text-[10px] text-white/40">{col.items.length}</span>
                              </div>
                              {col.items.length ? (
                                <div className="space-y-2">
                                  {col.items.slice(0, 6).map((g, idx) => (
                                    <div key={`${col.title}_${idx}`} className="rounded-md border border-white/10 bg-black/20 p-3">
                                      <div className="flex items-start gap-3">
                                        <div className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] ${severityPill(g.severity)}`}>
                                          {severityLabel(g.severity)}
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-xs text-white/90">{g.gap}</div>
                                          {g.how_to_close ? (
                                            <div className="mt-1 text-[11px] text-white/60">{g.how_to_close}</div>
                                          ) : null}
                                          {(g.evidence || []).length ? (
                                            <div className="mt-2 text-[11px] text-white/50">Evidence: {(g.evidence || []).slice(0, 2).join(" \u00b7 ")}</div>
                                          ) : null}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-[11px] text-white/50">No major gaps detected.</div>
                              )}
                            </div>
                          ))}
                        </div>

                        {(r.matched_skills?.length || r.missing_skills?.length) ? (
                          <div className="mt-4">
                            <div className="text-xs font-semibold text-white/70 mb-2">Skill fit (from role required skills)</div>
                            <div className="flex flex-wrap gap-2">
                              {(r.matched_skills || []).slice(0, 12).map((s) => (
                                <span key={`ms_${s}`} className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/80 text-xs">{s}</span>
                              ))}
                              {(r.missing_skills || []).slice(0, 12).map((s) => (
                                <span key={`xs_${s}`} className="px-2 py-1 rounded-full border border-red-500/20 bg-red-500/10 text-red-200 text-xs">{s}</span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/painpoint-match")}
              className="px-4 py-2 rounded-md bg-white/10 border border-white/10 text-white font-semibold hover:bg-white/15"
            >
              Save &amp; Continue
            </button>
          </div>
</div>
      </div>
    </div>
  );
}


