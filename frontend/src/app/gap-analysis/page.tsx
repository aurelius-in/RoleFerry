"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import StarRating from "@/components/StarRating";
import { formatCompanyName } from "@/lib/format";
import InlineSpinner from "@/components/InlineSpinner";

type JobPreferences = {
  values: string[];
  roleCategories: string[];
  locationPreferences: string[];
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

type GapAnalysisItem = {
  job_id: string;
  title: string;
  company: string;
  score: number;
  recommendation: "pursue" | "maybe" | "skip";
  matched_skills: string[];
  missing_skills: string[];
  resume_gaps: Array<{ gap: string; severity: "low" | "medium" | "high"; evidence: string[]; how_to_close: string }>;
  personality_gaps: Array<{ gap: string; severity: "low" | "medium" | "high"; evidence: string[]; how_to_close: string }>;
  preference_gaps: Array<{ gap: string; severity: "low" | "medium" | "high"; evidence: string[]; how_to_close: string }>;
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

function pillColor(rec: GapAnalysisItem["recommendation"]) {
  if (rec === "pursue") return "bg-emerald-500/15 border-emerald-500/30 text-emerald-200";
  if (rec === "maybe") return "bg-yellow-500/15 border-yellow-500/30 text-yellow-200";
  return "bg-red-500/15 border-red-500/30 text-red-200";
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
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!resumeExtract) missing.push({ key: "resume", label: "Resume (Step 3)", href: "/resume" });
    if (jobDescriptions.length === 0) missing.push({ key: "jobs", label: "Role Descriptions (Step 2)", href: "/job-descriptions" });
    return missing;
  }, [jobDescriptions.length, preferences, resumeExtract]);

  const topSummary = useMemo(() => {
    const top = ranked[0];
    if (!top) return null;
    return `${top.title} @ ${formatCompanyName(top.company)} (${top.score}/100)`;
  }, [ranked]);

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
      const firstId = (resp.ranked || [])[0]?.job_id || null;
      setSelectedJobId(firstId);
    } catch (e: any) {
      setError(e?.message || "Failed to run gap analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  const selected = useMemo(() => ranked.find((r) => r.job_id === selectedJobId) || ranked[0] || null, [ranked, selectedJobId]);

  function severityPill(sev: "low" | "medium" | "high") {
    if (sev === "high") return "bg-red-500/15 border-red-500/30 text-red-200";
    if (sev === "medium") return "bg-yellow-500/15 border-yellow-500/30 text-yellow-200";
    return "bg-emerald-500/15 border-emerald-500/30 text-emerald-200";
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
          <span className="mr-2">←</span> Back to Role Descriptions
        </a>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Gap Analysis</h1>
              <p className="text-white/70">
                Compare your preferences + resume against imported role descriptions to rank the best fits and highlight gaps.
              </p>
            </div>
            <div className="bg-gray-900/70 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-lg border border-white/10">
              Step 4 of 12
            </div>
          </div>

          {!canAnalyze ? (
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-100">
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
              <div className="text-sm text-white/70">
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

          {ranked.length > 0 ? (
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-4">
                <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-xs font-semibold text-white/70 px-2 py-2">Ranked jobs</div>
                  <div className="max-h-[560px] overflow-auto">
                    {ranked.map((r) => (
                      <button
                        key={r.job_id}
                        type="button"
                        onClick={() => setSelectedJobId(r.job_id)}
                        className={`w-full text-left px-3 py-3 border-t border-white/10 hover:bg-white/5 transition-colors ${
                          selectedJobId === r.job_id ? "bg-white/5" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white truncate">{r.title}</div>
                              <div className="text-xs text-white/60 truncate">{formatCompanyName(r.company)}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-white font-bold text-xs">{r.score}/100</div>
                            <div className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] ${pillColor(r.recommendation)}`}>
                              {r.recommendation}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-8">
                {selected ? (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xl font-bold text-white">{selected.title}</div>
                        <div className="text-sm text-white/70">{formatCompanyName(selected.company)}</div>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="text-white font-bold">{selected.score}/100</div>
                          <StarRating value={selected.score} scale="percent" showNumeric={false} className="text-[10px]" />
                          <div className={`inline-flex items-center px-2 py-1 rounded-full border text-xs ${pillColor(selected.recommendation)}`}>
                            {selected.recommendation}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { title: "Resume gaps", kind: "resume" as const, items: selected.resume_gaps || [] },
                        { title: "Personality gaps", kind: "personality" as const, items: selected.personality_gaps || [] },
                        { title: "Preference gaps", kind: "prefs" as const, items: selected.preference_gaps || [] },
                      ].map((col) => (
                        <div key={col.title} className="rounded-lg border border-white/10 bg-white/5 p-4">
                          <div className="flex items-center gap-2 text-white/80 mb-2">
                            <span className="text-white/70"><Icon kind={col.kind} /></span>
                            <div className="text-xs font-semibold">{col.title}</div>
                          </div>
                          {col.items.length ? (
                            <div className="space-y-2">
                              {col.items.slice(0, 6).map((g, idx) => (
                                <div key={`${col.title}_${idx}`} className="rounded-md border border-white/10 bg-black/20 p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="text-sm text-white/90">{g.gap}</div>
                                    <div className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] ${severityPill(g.severity)}`}>
                                      {g.severity}
                                    </div>
                                  </div>
                                  {g.how_to_close ? (
                                    <div className="mt-1 text-xs text-white/60">
                                      {g.how_to_close}
                                    </div>
                                  ) : null}
                                  {(g.evidence || []).length ? (
                                    <div className="mt-2 text-[11px] text-white/50">
                                      Evidence: {(g.evidence || []).slice(0, 2).join(" · ")}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-white/50">No major gaps detected.</div>
                          )}
                        </div>
                      ))}
                    </div>

                    {(selected.matched_skills?.length || selected.missing_skills?.length) ? (
                      <div className="mt-5">
                        <div className="text-xs font-semibold text-white/70 mb-2">Skill fit (from job required skills)</div>
                        <div className="flex flex-wrap gap-2">
                          {(selected.matched_skills || []).slice(0, 12).map((s) => (
                            <span key={`ms_${s}`} className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/80 text-xs">
                              {s}
                            </span>
                          ))}
                          {(selected.missing_skills || []).slice(0, 12).map((s) => (
                            <span key={`xs_${s}`} className="px-2 py-1 rounded-full border border-red-500/20 bg-red-500/10 text-red-200 text-xs">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
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


