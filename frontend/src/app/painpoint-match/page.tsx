"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import StarRating from "@/components/StarRating";
import { formatCompanyName } from "@/lib/format";

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

export default function PainPointMatchPage() {
  const router = useRouter();
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [resumeExtract, setResumeExtract] = useState<ResumeExtract | null>(null);
  const [matches, setMatches] = useState<PainPointMatch[]>([]);
  const [matchesByJobId, setMatchesByJobId] = useState<Record<string, PainPointMatch[]>>({});
  const [selectedJD, setSelectedJD] = useState<JobDescription | null>(null);
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
        setJobDescriptions(JSON.parse(savedJDs));
      }
      if (savedResume) {
        setResumeExtract(JSON.parse(savedResume));
      }
    } catch {
      // ignore malformed cache
    }
  }, []);

  useEffect(() => {
    // When switching selected JD, show its saved matches (if any) without losing others.
    if (!selectedJD) return;
    const existing = matchesByJobId[selectedJD.id] || [];
    setMatches(existing);
  }, [selectedJD, matchesByJobId]);

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
    };
  };

  const selectJobForDownstream = (jd: JobDescription) => {
    const saved = matchesByJobId[jd.id] || [];
    setSelectedJD(jd);
    setMatches(saved);
    try {
      localStorage.setItem("selected_job_description", JSON.stringify(jd));
      localStorage.setItem("selected_job_description_id", jd.id);
      localStorage.setItem("painpoint_matches", JSON.stringify(saved));
      localStorage.setItem("painpoint_matches_by_job", JSON.stringify(matchesByJobId));
    } catch {
      // ignore storage failures
    }
  };

  const runPainPointMatchAnalysis = async () => {
    if (!resumeExtract || jobDescriptions.length === 0) return;

    setIsGenerating(true);
    setError(null);
    setProgress({ done: 0, total: jobDescriptions.length });

    // Start blank every time until the user runs it (presentation-friendly).
    setMatches([]);
    setMatchesByJobId({});
    setSelectedJD(null);

    try {
      setProgress({ done: 0, total: jobDescriptions.length, current: "Generating matches for all roles…" });

      const resp = await api<BatchPainPointMatchResponse>("/painpoint-match/generate-batch", "POST", {
        resume_extract_id: "latest",
        job_descriptions: jobDescriptions.map((jd) => ({
          id: jd.id,
          title: jd.title,
          company: jd.company,
          pain_points: jd.painPoints || [],
          required_skills: jd.requiredSkills || [],
          success_metrics: jd.successMetrics || [],
          responsibilities: jd.responsibilities || [],
          requirements: jd.requirements || [],
        })),
        resume_extract: {
          positions: resumeExtract.positions || [],
          skills: resumeExtract.skills || [],
          accomplishments: resumeExtract.accomplishments || [],
          keyMetrics: resumeExtract.keyMetrics || [],
        },
      });

      const nextByJob: Record<string, PainPointMatch[]> = {};
      const rawMap = resp?.matches_by_job_id || {};
      for (const jd of jobDescriptions) {
        const rawMatches = rawMap[jd.id] || [];
        nextByJob[jd.id] = rawMatches.map(mapBackendMatch);
      }

      setMatchesByJobId(nextByJob);
      try {
        localStorage.setItem("painpoint_matches_by_job", JSON.stringify(nextByJob));
      } catch {}

      if (resp?.errors_by_job_id && Object.keys(resp.errors_by_job_id).length) {
        // Keep it short; this is a UX hint, not a hard stop.
        setError("Some roles failed to generate matches. You can re-run to try again.");
      }

      setProgress({ done: jobDescriptions.length, total: jobDescriptions.length });

      const first = jobDescriptions[0] || null;
      if (first) {
        setSelectedJD(first);
        setMatches(nextByJob[first.id] || []);
        try {
          localStorage.setItem("painpoint_matches", JSON.stringify(nextByJob[first.id] || []));
        } catch {}
      }
    } catch {
      setError("Failed to run pain point match analysis. Please try again.");
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const handleContinue = () => {
    // Be permissive: if localStorage is blocked or something is missing,
    // still navigate, but show a clear message when we truly can't.
    const jd = selectedJD;
    if (!jd) {
      setError("Select a role before continuing.");
      return;
    }

    const saved = matchesByJobId[jd.id] || matches;
    if (!saved || saved.length === 0) {
      setError("Generate pain point matches for this role before continuing.");
      return;
    }

    try {
      // Persist "current" selection for downstream steps AND keep the per-job map.
      localStorage.setItem("selected_job_description", JSON.stringify(jd));
      localStorage.setItem("selected_job_description_id", jd.id);
      localStorage.setItem("painpoint_matches", JSON.stringify(saved));
      localStorage.setItem("painpoint_matches_by_job", JSON.stringify(matchesByJobId));
    } catch {
      // Ignore storage failures (private mode/quota); navigation still works.
    }

    router.push("/company-research");
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
          <a href="/job-descriptions" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
            <span className="mr-2">←</span> Back to Roles
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
                    Starts blank. Click Run to generate matches for all roles.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={runPainPointMatchAnalysis}
                  disabled={isGenerating}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isGenerating ? "Running…" : "Run Pain Point Match Analysis"}
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
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Left column: role list */}
                  <div className="lg:col-span-4">
                    <div className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
                      <div className="px-3 py-2 border-b border-white/10 bg-white/5">
                        <div className="text-xs font-semibold text-white/70 uppercase tracking-wider">Roles</div>
                      </div>
                      <div className="max-h-[640px] overflow-auto">
                        {jobDescriptions.map((jd) => {
                          const jobMatches = matchesByJobId[jd.id] || [];
                          const alignCount = jobMatches.reduce((sum, m) => sum + renderableAlignments(m).length, 0);
                          const isSelected = selectedJD?.id === jd.id;
                          return (
                            <button
                              key={`role_row_${jd.id}`}
                              type="button"
                              onClick={() => {
                                setSelectedJD(jd);
                                // Also keep downstream selection consistent with the existing helper.
                                try { selectJobForDownstream(jd); } catch {}
                              }}
                              className={`w-full text-left px-3 py-3 border-b border-white/10 hover:bg-white/5 transition-colors ${
                                isSelected ? "bg-white/5" : ""
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-white truncate">{jd.title}</div>
                                  <div className="text-xs text-white/60 truncate">{formatCompanyName(jd.company)}</div>
                                </div>
                                <div className="shrink-0 text-right">
                                  <div className="text-[11px] text-white/60">Pain points</div>
                                  <div className="text-sm font-extrabold text-white tabular-nums">
                                    {alignCount || 0}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Middle: detailed report */}
                  <div className="lg:col-span-8">
                    {(() => {
                      const jd = selectedJD || jobDescriptions[0] || null;
                      if (!jd) return null;
                      const jobMatches = matchesByJobId[jd.id] || [];
                      const first = jobMatches[0] || null;
                      const score = first?.alignment_score ?? null;
                      return (
                        <div className="rounded-lg border border-white/10 bg-black/20 p-5">
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xl font-extrabold text-white">{jd.title}</div>
                              <div className="text-sm text-white/70">{formatCompanyName(jd.company)}</div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                              {score === null ? (
                                <div className="text-xs text-white/60">Alignment: —</div>
                              ) : (
                                <div className="inline-flex items-center gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                                  <div className="text-sm font-bold text-white">{Math.round(score * 100)}%</div>
                                  <StarRating value={score} scale="fraction" showNumeric />
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => selectJobForDownstream(jd)}
                                className="rounded-md px-3 py-2 text-sm font-semibold border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 transition-colors"
                                title="Select this role for downstream steps (Research, Contact, Bio, Campaign)"
                              >
                                Use this role downstream
                              </button>
                            </div>
                          </div>

                          {jobMatches.length === 0 ? (
                            <div className="mt-4 text-sm text-white/60 italic">
                              No matches generated for this role yet. Click <span className="font-semibold text-white/80">Run Pain Point Match Analysis</span> above.
                            </div>
                          ) : (
                            <div className="mt-5 space-y-6">
                              {jobMatches.map((match, index) => (
                                <div key={`match_${jd.id}_${index}`} className="rounded-lg border border-white/10 bg-white/5 p-4">
                                  <div className="text-xs text-white/60 mb-3">Showing up to 3 best matches for this role.</div>
                                  <div className="space-y-6">
                                    {renderableAlignments(match).length === 0 ? (
                                      <div className="text-sm text-white/60 italic">No alignments were found for this role.</div>
                                    ) : (
                                      renderableAlignments(match).map((a) => (
                                        <div
                                          key={`align_${jd.id}_${index}_${a.n}`}
                                          className="rounded-lg p-4 border border-white/10 bg-black/20"
                                        >
                                          <div className="flex items-start space-x-3">
                                            <div className="flex-shrink-0">
                                              <div className="w-8 h-8 bg-red-500/15 rounded-full flex items-center justify-center border border-red-400/25">
                                                <span className="text-white/85 font-semibold">{a.n}</span>
                                              </div>
                                            </div>
                                            <div className="flex-1">
                                              <h4 className="font-semibold text-white/85 mb-2">Pain Point</h4>
                                              <p className="text-white/85 mb-3">{a.painpoint}</p>
                                              {String(a.jdEvidence || "").trim() ? (
                                                <div className="mb-3 text-xs text-white/75">
                                                  <span className="font-semibold text-white/70">From JD:</span>{" "}
                                                  <span className="italic text-white/85">“{sanitizeForUi(String(a.jdEvidence), "Missing details")}”</span>
                                                </div>
                                              ) : (
                                                <div className="mb-3 text-xs text-white/75">
                                                  <span className="font-semibold text-white/70">From JD:</span>{" "}
                                                  <span className="text-white/60 font-semibold">Missing details</span>
                                                </div>
                                              )}

                                              <h4 className="font-semibold text-emerald-200 mb-2">Your Solution</h4>
                                              <p className="mb-3">{renderValueOrMissing(String(a.solution || ""), "text-white/85")}</p>
                                              {String(a.resumeEvidence || "").trim() ? (
                                                <div className="mb-3 text-xs text-white/75">
                                                  <span className="font-semibold text-emerald-200">From resume:</span>{" "}
                                                  <span className="italic text-white/85">“{sanitizeForUi(String(a.resumeEvidence), "Missing details")}”</span>
                                                </div>
                                              ) : (
                                                <div className="mb-3 text-xs text-white/75">
                                                  <span className="font-semibold text-emerald-200">From resume:</span>{" "}
                                                  <span className="text-white/60 font-semibold">Missing details</span>
                                                </div>
                                              )}
                                              {String(a.overlap || "").trim() ? (
                                                <div className="mb-3 text-xs text-white/75">
                                                  <span className="font-semibold text-white/85">Why it matches:</span>{" "}
                                                  <span className="text-white/80">{sanitizeForUi(String(a.overlap), "Missing details")}</span>
                                                </div>
                                              ) : null}

                                              <h4 className="font-semibold text-sky-200 mb-2">Impact Metric</h4>
                                              <p className="text-white/85">{renderValueOrMissing(String(a.metric || ""), "text-white/85")}</p>
                                            </div>
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

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
                        Continue to Research
                      </button>
                    </div>
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
