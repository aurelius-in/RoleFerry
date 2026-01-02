"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import StarRating from "@/components/StarRating";

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
};

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
  preference_gaps: string[];
  notes: string[];
};

type GapAnalysisResponse = {
  success: boolean;
  message: string;
  ranked: GapAnalysisItem[];
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

  const [ranked, setRanked] = useState<GapAnalysisItem[]>([]);
  const [helper, setHelper] = useState<GapAnalysisResponse["helper"] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setJobDescriptions(safeJson<JobDescription[]>(localStorage.getItem("job_descriptions"), []));
    setPreferences(safeJson<JobPreferences | null>(localStorage.getItem("job_preferences"), null));
    setResumeExtract(safeJson<ResumeExtract | null>(localStorage.getItem("resume_extract"), null));
  }, []);

  const canAnalyze = jobDescriptions.length > 0 && Boolean(preferences) && Boolean(resumeExtract);
  const missingSteps = useMemo(() => {
    const missing: Array<{ key: string; label: string; href: string }> = [];
    if (!preferences) missing.push({ key: "prefs", label: "Job Preferences (Step 1)", href: "/job-preferences" });
    if (!resumeExtract) missing.push({ key: "resume", label: "Resume (Step 3)", href: "/resume" });
    if (jobDescriptions.length === 0) missing.push({ key: "jobs", label: "Job Descriptions (Step 2)", href: "/job-descriptions" });
    return missing;
  }, [jobDescriptions.length, preferences, resumeExtract]);

  const topSummary = useMemo(() => {
    const top = ranked[0];
    if (!top) return null;
    return `${top.title} @ ${top.company} (${top.score}/100)`;
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
            state: preferences.state || null,
            user_mode: "job-seeker",
          }
        : null;

      const resp = await api<GapAnalysisResponse>("/gap-analysis/analyze", "POST", {
        preferences: prefsPayload,
        resume_extract: resumeExtract,
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

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 mb-4">
        <a href="/job-descriptions" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
          <span className="mr-2">←</span> Back to Job Descriptions
        </a>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Gap Analysis</h1>
              <p className="text-white/70">
                Compare your preferences + resume against imported job descriptions to rank the best fits and highlight gaps.
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
              className="px-4 py-2 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {isAnalyzing ? "Analyzing…" : "Run Gap Analysis"}
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
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {ranked.map((r) => (
                <div key={r.job_id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-bold text-white">{r.title}</div>
                      <div className="text-sm text-white/70">{r.company}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold">{r.score}/100</div>
                      <div className="mt-1 flex justify-end">
                        <StarRating value={r.score} scale="percent" showNumeric={false} className="text-[10px]" />
                      </div>
                      <div className={`mt-1 inline-flex items-center px-2 py-1 rounded-full border text-xs ${pillColor(r.recommendation)}`}>
                        {r.recommendation}
                      </div>
                    </div>
                  </div>

                  {r.matched_skills?.length ? (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-white/70 mb-1">Skillset matches</div>
                      <div className="flex flex-wrap gap-2">
                        {r.matched_skills.slice(0, 10).map((s) => (
                          <span key={s} className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/80 text-xs">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {r.missing_skills?.length ? (
                    <div className="mt-3">
                      <div className="text-xs font-semibold text-white/70 mb-1">Skillset gaps (missing skills)</div>
                      <div className="flex flex-wrap gap-2">
                        {r.missing_skills.slice(0, 10).map((s) => (
                          <span key={s} className="px-2 py-1 rounded-full border border-red-500/20 bg-red-500/10 text-red-200 text-xs">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {(r.preference_gaps || []).length ? (
                    <div className="mt-3 text-sm text-white/70">
                      <div className="text-xs font-semibold text-white/70 mb-1">Preference alignment gaps</div>
                      <ul className="list-disc list-inside space-y-1">
                        {r.preference_gaps.slice(0, 3).map((g, i) => (
                          <li key={`pg_${i}`}>{g}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {(r.notes || []).length ? (
                    <div className="mt-3 text-xs text-white/60">
                      {r.notes.slice(0, 3).join(" · ")}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/painpoint-match")}
              className="px-4 py-2 rounded-md bg-white/10 border border-white/10 text-white font-semibold hover:bg-white/15"
            >
              Continue to Pain Point Match →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


