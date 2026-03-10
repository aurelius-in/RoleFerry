"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatCompanyName } from "@/lib/format";
import InlineSpinner from "@/components/InlineSpinner";

interface PainPointMatch {
  painpoint_1: string;
  jd_evidence_1?: string;
  solution_1: string;
  resume_evidence_1?: string;
  metric_1: string;
  overlap_1?: string;
  painpoint_2: string;
  jd_evidence_2?: string;
  solution_2: string;
  resume_evidence_2?: string;
  metric_2: string;
  overlap_2?: string;
  painpoint_3: string;
  jd_evidence_3?: string;
  solution_3: string;
  resume_evidence_3?: string;
  metric_3: string;
  overlap_3?: string;
  alignment_score: number;
  alignments?: Array<{
    painpoint: string;
    jd_evidence?: string;
    solution: string;
    resume_evidence?: string;
    overlap?: string;
    metric?: string;
  }>;
}

interface JobDescription {
  id: string;
  title: string;
  company: string;
  painPoints: string[];
  requiredSkills: string[];
  successMetrics: string[];
  responsibilities?: string[];
  requirements?: string[];
}

interface BackendJobDescription {
  id: string;
  title: string;
  company: string;
  url?: string | null;
  content: string | null;
  pain_points: string[];
  required_skills: string[];
  success_metrics: string[];
  parsed_at: string;
}

interface JobDescriptionsListResponse {
  success: boolean;
  message: string;
  job_descriptions: BackendJobDescription[];
}

interface BackendPainPointMatch {
  painpoint_1: string;
  jd_evidence_1?: string | null;
  solution_1: string;
  resume_evidence_1?: string | null;
  metric_1: string;
  overlap_1?: string | null;
  painpoint_2: string;
  jd_evidence_2?: string | null;
  solution_2: string;
  resume_evidence_2?: string | null;
  metric_2: string;
  overlap_2?: string | null;
  painpoint_3: string;
  jd_evidence_3?: string | null;
  solution_3: string;
  resume_evidence_3?: string | null;
  metric_3: string;
  overlap_3?: string | null;
  alignment_score: number;
  alignments?: Array<{
    painpoint: string;
    jd_evidence?: string | null;
    solution: string;
    resume_evidence?: string | null;
    overlap?: string | null;
    metric?: string | null;
  }> | null;
}

interface PainPointMatchResponse {
  success: boolean;
  message: string;
  matches: BackendPainPointMatch[];
}

interface BatchPainPointMatchResponse {
  success: boolean;
  message: string;
  matches_by_job_id: Record<string, BackendPainPointMatch[]>;
  errors_by_job_id?: Record<string, string> | null;
}

interface ResumeExtract {
  positions: Array<{
    company: string;
    title: string;
    description: string;
  }>;
  keyMetrics: Array<{
    metric: string;
    value: string;
    context: string;
  }>;
  skills: string[];
  accomplishments: string[];
}

function normalizeJobDescriptions(raw: any[]): JobDescription[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((jd: any, idx: number) => {
      const id = String(jd?.id || jd?.job_id || `${jd?.company || "company"}:${jd?.title || "role"}:${idx}`).trim();
      if (!id) return null;
      return {
        id,
        title: String(jd?.title || "").trim(),
        company: String(jd?.company || "").trim(),
        painPoints: Array.isArray(jd?.painPoints) ? jd.painPoints : Array.isArray(jd?.pain_points) ? jd.pain_points : [],
        requiredSkills: Array.isArray(jd?.requiredSkills) ? jd.requiredSkills : Array.isArray(jd?.required_skills) ? jd.required_skills : [],
        successMetrics: Array.isArray(jd?.successMetrics) ? jd.successMetrics : Array.isArray(jd?.success_metrics) ? jd.success_metrics : [],
        responsibilities: Array.isArray(jd?.responsibilities) ? jd.responsibilities : [],
        requirements: Array.isArray(jd?.requirements) ? jd.requirements : [],
      } as JobDescription;
    })
    .filter((x): x is JobDescription => Boolean(x && x.id && x.title));
}

export default function PainPointMatchPage() {
  const router = useRouter();
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [resumeExtract, setResumeExtract] = useState<ResumeExtract | null>(null);
  const [matches, setMatches] = useState<PainPointMatch[]>([]);
  const [matchesByJobId, setMatchesByJobId] = useState<Record<string, PainPointMatch[]>>({});
  const [expandedJobIds, setExpandedJobIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; current?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const looksLikePdfGarbage = (s: string) => {
    const t = (s || "").trim();
    if (!t) return true;
    // Common PDF / binary extraction artifacts we never want to show in UI.
    if (t.startsWith("%PDF-")) return true;
    if (/\b\d+\s+\d+\s+obj\b/.test(t)) return true;
    if (t.includes("/Creator") || t.includes("/Producer")) return true;
    if (t.includes("endobj") || t.includes("stream") || t.includes("xref")) return true;
    return false;
  };

  const sanitizeForUi = (raw: string, fallback: string) => {
    const s = String(raw ?? "").trim();
    // Strip non-printable chars (keeps unicode) to avoid odd control chars.
    const cleaned = s.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, "").trim();
    if (!cleaned || looksLikePdfGarbage(cleaned)) return fallback;
    return cleaned;
  };

  const renderValueOrMissing = (raw: string, className: string) => {
    const v = sanitizeForUi(raw, "Missing details");
    if (v === "Missing details") {
      // Needs to be readable on both light + dark sections of this page.
      return <span className="text-white/60 font-semibold">Missing details</span>;
    }
    return <span className={className}>{v}</span>;
  };

  useEffect(() => {
    // Load data from localStorage for initial render
    try {
      const savedJDs = typeof window !== "undefined" ? localStorage.getItem("job_descriptions") : null;
      const savedResume = typeof window !== "undefined" ? localStorage.getItem("resume_extract") : null;

      if (savedJDs) {
        setJobDescriptions(normalizeJobDescriptions(JSON.parse(savedJDs)));
      }
      if (savedResume) {
        setResumeExtract(JSON.parse(savedResume));
      }
    } catch {
      // ignore malformed cache
    }
  }, []);

  useEffect(() => {
    const first = jobDescriptions[0];
    if (first && Object.keys(matchesByJobId).length > 0) {
      setMatches(matchesByJobId[first.id] || []);
    }
  }, [jobDescriptions, matchesByJobId]);

  const mapBackendMatch = (m: BackendPainPointMatch): PainPointMatch => {
    return {
      painpoint_1: m.painpoint_1,
      jd_evidence_1: m.jd_evidence_1 || "",
      solution_1: m.solution_1,
      resume_evidence_1: m.resume_evidence_1 || "",
      metric_1: m.metric_1,
      overlap_1: m.overlap_1 || "",
      painpoint_2: m.painpoint_2,
      jd_evidence_2: m.jd_evidence_2 || "",
      solution_2: m.solution_2,
      resume_evidence_2: m.resume_evidence_2 || "",
      metric_2: m.metric_2,
      overlap_2: m.overlap_2 || "",
      painpoint_3: m.painpoint_3,
      jd_evidence_3: m.jd_evidence_3 || "",
      solution_3: m.solution_3,
      resume_evidence_3: m.resume_evidence_3 || "",
      metric_3: m.metric_3,
      overlap_3: m.overlap_3 || "",
      alignment_score: m.alignment_score,
      alignments: Array.isArray(m.alignments)
        ? m.alignments.map((a) => ({
            painpoint: String(a?.painpoint || ""),
            jd_evidence: String(a?.jd_evidence || ""),
            solution: String(a?.solution || ""),
            resume_evidence: String(a?.resume_evidence || ""),
            overlap: String(a?.overlap || ""),
            metric: String(a?.metric || ""),
          }))
        : undefined,
    };
  };

  // Note: we intentionally do NOT let users pick a single "downstream role" here.
  // Dropping roles happens in Gap Analysis; this step carries all roles forward.

  const runPainPointMatchAnalysis = async () => {
    if (!resumeExtract || jobDescriptions.length === 0) return;

    setIsGenerating(true);
    setError(null);
    setProgress({ done: 0, total: jobDescriptions.length });

    setMatches([]);
    setMatchesByJobId({});
    setExpandedJobIds(new Set());

    try {
      const nextByJob: Record<string, PainPointMatch[]> = {};
      const resumePayload = {
        positions: resumeExtract.positions || [],
        skills: resumeExtract.skills || [],
        accomplishments: resumeExtract.accomplishments || [],
        keyMetrics: resumeExtract.keyMetrics || [],
      };

      const CHUNK_SIZE = 3;
      const chunks: typeof jobDescriptions[] = [];
      for (let i = 0; i < jobDescriptions.length; i += CHUNK_SIZE) {
        chunks.push(jobDescriptions.slice(i, i + CHUNK_SIZE));
      }

      let completed = 0;
      let hadErrors = false;

      for (const chunk of chunks) {
        setProgress({ done: completed, total: jobDescriptions.length, current: `Analyzing ${completed + 1}–${Math.min(completed + chunk.length, jobDescriptions.length)} of ${jobDescriptions.length} roles…` });

        try {
          const resp = await api<BatchPainPointMatchResponse>("/painpoint-match/generate-batch", "POST", {
            resume_extract_id: "latest",
            job_descriptions: chunk.map((jd) => ({
              id: jd.id,
              title: jd.title,
              company: jd.company,
              pain_points: jd.painPoints || [],
              required_skills: jd.requiredSkills || [],
              success_metrics: jd.successMetrics || [],
              responsibilities: jd.responsibilities || [],
              requirements: jd.requirements || [],
            })),
            resume_extract: resumePayload,
          });

          const rawMap = resp?.matches_by_job_id || {};
          for (const jd of chunk) {
            const key = String(jd.id || "").trim();
            const rawMatches = (key ? rawMap[key] : undefined) || [];
            nextByJob[jd.id] = rawMatches.map(mapBackendMatch);
          }
          if (resp?.errors_by_job_id && Object.keys(resp.errors_by_job_id).length) {
            hadErrors = true;
          }
        } catch {
          for (const jd of chunk) {
            try {
              const single = await api<PainPointMatchResponse>("/painpoint-match/generate", "POST", {
                job_description_id: String(jd.id || ""),
                resume_extract_id: "latest",
                job_description: {
                  id: jd.id, title: jd.title, company: jd.company,
                  pain_points: jd.painPoints || [], required_skills: jd.requiredSkills || [],
                  success_metrics: jd.successMetrics || [], responsibilities: jd.responsibilities || [],
                  requirements: jd.requirements || [],
                },
                resume_extract: resumePayload,
              });
              nextByJob[jd.id] = Array.isArray(single?.matches) ? single.matches.map(mapBackendMatch) : [];
            } catch {
              nextByJob[jd.id] = [];
              hadErrors = true;
            }
          }
        }

        completed += chunk.length;
        setMatchesByJobId((prev) => ({ ...prev, ...nextByJob }));
      }

      setMatchesByJobId(nextByJob);
      try {
        localStorage.setItem("painpoint_matches_by_job", JSON.stringify(nextByJob));
      } catch {}

      if (hadErrors) {
        setError("Some roles failed to generate matches. You can re-run to try again.");
      }

      setProgress({ done: jobDescriptions.length, total: jobDescriptions.length });

      const first = jobDescriptions[0] || null;
      if (first) {
        setMatches(nextByJob[first.id] || []);
        try {
          localStorage.setItem("painpoint_matches", JSON.stringify(nextByJob[first.id] || []));
        } catch {}
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err || "");
      if (msg.includes("fetch") || msg.includes("network") || msg.includes("ECONNRESET") || msg.includes("socket")) {
        setError("Cannot reach the analysis service. The backend may be restarting — wait a moment and try again.");
      } else {
        setError("Failed to run pain point match analysis. Please try again.");
      }
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const handleContinue = () => {
    // At this stage we carry ALL roles forward. Gaps is where you drop roles.
    // Still block if they haven't generated any matches yet.
    const hasAny =
      Object.keys(matchesByJobId || {}).some((k) => Array.isArray((matchesByJobId as any)[k]) && (matchesByJobId as any)[k].length > 0);
    if (!hasAny) {
      setError("Run Pain Point Match Analysis before continuing.");
      return;
    }

    try {
      // Keep the per-role map for downstream steps.
      localStorage.setItem("painpoint_matches_by_job", JSON.stringify(matchesByJobId));

      // Convenience: also persist a "current" selection, but do NOT override what the user saved in Gaps.
      const existingId = String(localStorage.getItem("selected_job_description_id") || "").trim();
      const fallback = jobDescriptions[0] || null;
      if (!existingId && fallback) {
        localStorage.setItem("selected_job_description", JSON.stringify(fallback));
        localStorage.setItem("selected_job_description_id", String(fallback.id || ""));
      }

      // Keep painpoint_matches populated for older downstream components (uses selected role).
      const selectedId = existingId || String(fallback?.id || "");
      const forSelected = selectedId ? (matchesByJobId as any)[selectedId] || [] : [];
      localStorage.setItem("painpoint_matches", JSON.stringify(forSelected));
    } catch {
      // Ignore storage failures (private mode/quota); navigation still works.
    }

    router.push("/apply");
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return "text-green-600";
    if (score >= 0.6) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.8) return "Excellent Match";
    if (score >= 0.6) return "Good Match";
    return "Fair Match";
  };

  const renderableAlignments = (match: PainPointMatch) => {
    const dynamic = Array.isArray(match.alignments) ? match.alignments : [];
    if (dynamic.length > 0) {
      return dynamic
        .slice(0, 6)
        .map((a, idx) => ({
          n: idx + 1,
          painpoint: String(a?.painpoint || ""),
          jdEvidence: String(a?.jd_evidence || ""),
          solution: String(a?.solution || ""),
          resumeEvidence: String(a?.resume_evidence || ""),
          overlap: String(a?.overlap || ""),
          metric: String(a?.metric || ""),
        }))
        .filter((it) => String(it.painpoint || "").trim().length > 0);
    }

    const items = [
      {
        n: 1,
        painpoint: match.painpoint_1,
        jdEvidence: match.jd_evidence_1 || "",
        solution: match.solution_1,
        resumeEvidence: match.resume_evidence_1 || "",
        overlap: match.overlap_1 || "",
        metric: match.metric_1,
      },
      {
        n: 2,
        painpoint: match.painpoint_2,
        jdEvidence: match.jd_evidence_2 || "",
        solution: match.solution_2,
        resumeEvidence: match.resume_evidence_2 || "",
        overlap: match.overlap_2 || "",
        metric: match.metric_2,
      },
      {
        n: 3,
        painpoint: match.painpoint_3,
        jdEvidence: match.jd_evidence_3 || "",
        solution: match.solution_3,
        resumeEvidence: match.resume_evidence_3 || "",
        overlap: match.overlap_3 || "",
        metric: match.metric_3,
      },
    ];
    return items.filter((it) => String(it.painpoint || "").trim().length > 0);
  };

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-4">
          <a href="/gap-analysis" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
            <span className="mr-2">←</span> Back to Gaps
          </a>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Pain Point Match</h1>
            <p className="text-white/70">
              Compare your solutions to each role's pain points to find the best alignment.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
              {error}
            </div>
          )}

          {jobDescriptions.length === 0 || !resumeExtract ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Missing Data</h3>
              <p className="text-white/70 mb-6">
                Please complete the Resume and Role Descriptions steps first.
              </p>
              <div className="space-x-4">
                <button
                  onClick={() => router.push('/resume')}
                  className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                >
                  Go to Resume
                </button>
                <button
                  onClick={() => router.push('/job-descriptions')}
                  className="bg-white/10 text-white px-6 py-3 rounded-md font-medium hover:bg-white/15 transition-colors border border-white/10"
                >
                  Go to Role Descriptions
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white/80">Pain Point Match Analysis</div>
                  <div className="text-xs text-white/60">
                    Click Run to generate matches for all roles.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={runPainPointMatchAnalysis}
                  disabled={isGenerating}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <InlineSpinner />
                      <span>Running</span>
                    </>
                  ) : (
                    "Run Pain Point Match Analysis"
                  )}
                </button>
              </div>

              {isGenerating && progress ? (
                <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-white/80">
                  <div className="font-semibold">Generating matches…</div>
                  <div className="mt-1 text-white/70">
                    {progress.current ? (
                      <>
                        {progress.current} ({progress.done + 1}/{progress.total})
                      </>
                    ) : (
                      <>
                        {progress.done}/{progress.total}
                      </>
                    )}
                  </div>
                </div>
              ) : null}

              {Object.keys(matchesByJobId).length === 0 && !isGenerating ? (
                <div className="rounded-lg border border-white/10 bg-black/20 p-8 text-center">
                  <div className="text-lg font-semibold text-white mb-2">Ready when you are</div>
                  <div className="text-white/70">
                    Click <span className="font-semibold text-white">Run Pain Point Match Analysis</span> to generate
                    pain-point alignments for all {jobDescriptions.length} role{jobDescriptions.length === 1 ? "" : "s"}.
                  </div>
                </div>
              ) : null}

              {Object.keys(matchesByJobId).length > 0 ? (
                <div className="space-y-1">
                  {jobDescriptions.map((jd) => {
                    const jobMatches = matchesByJobId[jd.id] || [];
                    const alignCount = jobMatches.reduce((sum, m) => sum + renderableAlignments(m).length, 0);
                    const isOpen = expandedJobIds.has(jd.id);
                    const first = jobMatches[0] || null;
                    const score = first?.alignment_score ?? null;
                    return (
                      <div key={`card_${jd.id}`} className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedJobIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(jd.id)) next.delete(jd.id);
                              else next.add(jd.id);
                              return next;
                            });
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-white/50 text-sm shrink-0">{isOpen ? "\u25bc" : "\u25b6"}</span>
                            <div className="min-w-0">
                              <div className="text-sm font-bold text-white truncate">{jd.title}</div>
                              <div className="text-xs text-white/60 truncate">{formatCompanyName(jd.company)}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {score !== null && (
                              <span className={`text-xs font-semibold ${getScoreColor(score)}`}>
                                {Math.round(score * 100)}%
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-white/80">
                              {alignCount} pain point{alignCount !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </button>

                        {isOpen && (
                          <div className="border-t border-white/10 px-4 py-4">
                            {jobMatches.length === 0 ? (
                              <div className="text-sm text-white/60 italic">
                                No matches generated for this role yet.
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {jobMatches.map((match, mIdx) =>
                                  renderableAlignments(match).length === 0 ? (
                                    <div key={`match_${jd.id}_${mIdx}`} className="text-sm text-white/60 italic">No alignments found.</div>
                                  ) : (
                                    renderableAlignments(match).map((a) => (
                                      <div
                                        key={`align_${jd.id}_${mIdx}_${a.n}`}
                                        className="rounded-lg p-4 border border-white/10 bg-white/5"
                                      >
                                        <div className="flex items-start space-x-3">
                                          <div className="flex-shrink-0">
                                            <div className="w-7 h-7 bg-red-500/15 rounded-full flex items-center justify-center border border-red-400/25">
                                              <span className="text-white/85 text-xs font-semibold">{a.n}</span>
                                            </div>
                                          </div>
                                          <div className="flex-1 space-y-2">
                                            <div>
                                              <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider">Pain Point</h4>
                                              <p className="text-sm text-white/85">{a.painpoint}</p>
                                            </div>
                                            {String(a.jdEvidence || "").trim() ? (
                                              <div className="text-sm text-white/85">
                                                <span className="font-semibold text-sky-200">From JD:</span>{" "}
                                                <span className="italic text-white/80">&ldquo;{sanitizeForUi(String(a.jdEvidence), "Missing details")}&rdquo;</span>
                                              </div>
                                            ) : null}
                                            {String(a.resumeEvidence || "").trim() ? (
                                              <div className="text-sm text-white/85">
                                                <span className="font-semibold text-violet-200">From Resume:</span>{" "}
                                                <span className="italic text-white/80">&ldquo;{sanitizeForUi(String(a.resumeEvidence), "Missing details")}&rdquo;</span>
                                              </div>
                                            ) : null}
                                            {String(a.overlap || "").trim() ? (
                                              <div className="text-sm text-white/85">
                                                <span className="font-semibold text-white/85">Why it matches:</span>{" "}
                                                <span className="text-white/80">{sanitizeForUi(String(a.overlap), "Missing details")}</span>
                                              </div>
                                            ) : null}
                                            <div>
                                              <h4 className="text-xs font-semibold text-sky-200">Impact Metric</h4>
                                              <p className="text-sm text-white/85">{renderValueOrMissing(String(a.metric || ""), "text-white/85")}</p>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <div className="mt-5 flex justify-end gap-3">
                    <button
                      onClick={() => router.push('/job-descriptions')}
                      className="bg-white/10 text-white px-6 py-3 rounded-md font-medium hover:bg-white/15 transition-colors border border-white/10"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleContinue}
                      className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                    >
                      Save &amp; Continue
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
