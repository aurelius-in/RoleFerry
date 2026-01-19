"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import StarRating from "@/components/StarRating";

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
      return <span className="text-red-700 font-semibold">Missing details</span>;
    }
    return <span className={className}>{v}</span>;
  };

  useEffect(() => {
    // Load data from localStorage for initial render
    try {
      const savedJDs = typeof window !== "undefined" ? localStorage.getItem("job_descriptions") : null;
      const savedResume = typeof window !== "undefined" ? localStorage.getItem("resume_extract") : null;
      const savedByJob = typeof window !== "undefined" ? localStorage.getItem("painpoint_matches_by_job") : null;

      if (savedJDs) {
        setJobDescriptions(JSON.parse(savedJDs));
      }
      if (savedResume) {
        setResumeExtract(JSON.parse(savedResume));
      }
      if (savedByJob) {
        const parsed = JSON.parse(savedByJob);
        if (parsed && typeof parsed === "object") setMatchesByJobId(parsed);
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

  const generateMatches = async () => {
    if (!selectedJD || !resumeExtract) return;
    
    setIsGenerating(true);
    setError(null);

    try {
      // Persist the selected JD for downstream steps (Offer/Compose context).
      if (typeof window !== "undefined" && selectedJD) {
        localStorage.setItem("selected_job_description", JSON.stringify(selectedJD));
        localStorage.setItem("selected_job_description_id", selectedJD.id);
      }

      const resp = await api<PainPointMatchResponse>("/painpoint-match/generate", "POST", {
        job_description_id: selectedJD.id,
        resume_extract_id: "latest",
        job_description: {
          title: selectedJD.title,
          company: selectedJD.company,
          pain_points: selectedJD.painPoints || [],
          required_skills: selectedJD.requiredSkills || [],
          success_metrics: selectedJD.successMetrics || [],
          responsibilities: selectedJD.responsibilities || [],
          requirements: selectedJD.requirements || [],
        },
        resume_extract: resumeExtract
          ? {
              positions: resumeExtract.positions || [],
              skills: resumeExtract.skills || [],
              accomplishments: resumeExtract.accomplishments || [],
              keyMetrics: resumeExtract.keyMetrics || [],
            }
          : undefined,
      });
      const backendMatches = resp.matches || [];
      const mapped: PainPointMatch[] = backendMatches.map((m) => ({
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
      }));
      setMatches(mapped);
      setMatchesByJobId((prev) => {
        const next = { ...prev, [selectedJD.id]: mapped };
        if (typeof window !== "undefined") {
          localStorage.setItem("painpoint_matches_by_job", JSON.stringify(next));
        }
        return next;
      });
      if (typeof window !== "undefined") {
        // Keep the existing single-key for downstream steps (represents CURRENT selected job).
        localStorage.setItem("painpoint_matches", JSON.stringify(mapped));
      }
    } catch (e: any) {
      setError("Failed to generate matches. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleContinue = () => {
    // Be permissive: if localStorage is blocked or something is missing,
    // still navigate, but show a clear message when we truly can't.
    const jd = selectedJD;
    if (!jd) {
      setError("Select a job before continuing.");
      return;
    }

    const saved = matchesByJobId[jd.id] || matches;
    if (!saved || saved.length === 0) {
      setError("Generate pain point matches for this job before continuing.");
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

    router.push("/find-contact");
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
            <span className="mr-2">←</span> Back to Jobs
          </a>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Pain Point Match</h1>
            <p className="text-white/70">
              Compare your solutions to the job's pain points to find the best alignment.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
                Please complete the Resume and Job Descriptions steps first.
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
                  Go to Job Descriptions
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: persistent saved pain points across jobs */}
              <aside className="lg:col-span-4">
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-white">Saved pain points</h2>
                    <div className="text-xs text-white/60">
                      {Object.keys(matchesByJobId).length} jobs
                    </div>
                  </div>
                  <div className="space-y-3 max-h-[520px] overflow-auto pr-1">
                    {jobDescriptions.map((jd) => {
                      const saved = matchesByJobId[jd.id]?.[0];
                      const alignments = saved ? renderableAlignments(saved) : [];
                      const isSel = selectedJD?.id === jd.id;
                      return (
                        <button
                          key={`sidebar_${jd.id}`}
                          type="button"
                          onClick={() => setSelectedJD(jd)}
                          className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                            isSel ? "border-blue-500 bg-blue-500/10" : "border-white/10 hover:border-white/20 bg-black/10"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white truncate">{jd.title}</div>
                              <div className="text-[11px] text-white/60 truncate">{jd.company}</div>
                            </div>
                            <div className="shrink-0 text-[11px] text-white/60">
                              {saved ? `${Math.round((saved.alignment_score || 0) * 100)}%` : "—"}
                            </div>
                          </div>
                          {saved ? (
                            alignments.length > 0 ? (
                              <ul className="mt-2 space-y-1">
                                {alignments.slice(0, 3).map((a) => (
                                  <li key={`pp_${jd.id}_${a.n}`} className="text-[11px] text-white/75 line-clamp-2">
                                    - {a.painpoint}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="mt-2 text-[11px] text-white/50 italic">
                                Saved match found, but no alignments were generated for this job.
                              </div>
                            )
                          ) : (
                            <div className="mt-2 text-[11px] text-white/45">No matches generated yet</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 text-[11px] text-white/50">
                    Tip: Click any job to revisit its saved matches.
                  </div>
                </div>
              </aside>

              {/* Right: selection + generation + results */}
              <div className="lg:col-span-8 space-y-8">
                {/* Job Description Selection */}
                <div>
                  <h2 className="text-xl font-semibold mb-4">Select Job Description</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {jobDescriptions.map((jd) => (
                      <div
                        key={jd.id}
                        className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                          selectedJD?.id === jd.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-white/10 hover:border-white/20 bg-black/20'
                        }`}
                        onClick={() => setSelectedJD(jd)}
                      >
                        <h3 className="font-semibold text-white">{jd.title}</h3>
                        <p className="text-white/70">{jd.company}</p>
                        {matchesByJobId[jd.id]?.length ? (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-300 border border-green-500/20">
                              Saved matches
                            </span>
                            <span className="text-xs text-white/60">
                              {Math.round((matchesByJobId[jd.id][0]?.alignment_score ?? 0) * 100)}%
                            </span>
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-white/50">No matches yet</div>
                        )}
                        <div className="mt-2">
                          <p className="text-sm text-white/60">
                            {jd.painPoints.length} pain points identified
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              {/* Generate Matches Button */}
              {selectedJD && (
                <div className="text-center">
                  <button
                    onClick={generateMatches}
                    disabled={isGenerating}
                    className="bg-blue-600 text-white px-8 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isGenerating ? "Generating Matches..." : "Generate Pain Point Matches"}
                  </button>
                </div>
              )}

              {/* Matches Results */}
              {matches.length > 0 && (
                <div className="space-y-6">
                  <div className="text-center">
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">Match Results</h2>
                    <div className="flex items-center justify-center space-x-4">
                      <div className="text-3xl font-bold text-blue-600">
                        {Math.round(matches[0].alignment_score * 100)}%
                      </div>
                      <div>
                        <div className={`font-semibold ${getScoreColor(matches[0].alignment_score)}`}>
                          {getScoreLabel(matches[0].alignment_score)}
                        </div>
                        <div className="text-sm text-gray-500">Alignment Score</div>
                            <div className="mt-1 flex justify-center">
                              <StarRating value={matches[0].alignment_score} scale="fraction" showNumeric />
                            </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {matches.map((match, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-6">
                        <h3 className="text-lg font-semibold mb-1">Alignments</h3>
                        <div className="text-xs text-gray-500 mb-4">Showing up to 3 best matches for this job.</div>
                        
                        <div className="space-y-6">
                          {renderableAlignments(match).length === 0 ? (
                            <div className="text-sm text-gray-600 italic">No alignments were found for this job.</div>
                          ) : (
                            renderableAlignments(match).map((a) => (
                              <div key={`align_${index}_${a.n}`} className="bg-red-50 border border-red-200 rounded-lg p-4">
                                <div className="flex items-start space-x-3">
                                  <div className="flex-shrink-0">
                                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                                      <span className="text-red-600 font-semibold">{a.n}</span>
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="font-semibold text-red-900 mb-2">Pain Point</h4>
                                    <p className="text-red-800 mb-3">{a.painpoint}</p>
                                    {String(a.jdEvidence || "").trim() ? (
                                      <div className="mb-3 text-xs text-red-800/80">
                                        <span className="font-semibold">From JD:</span>{" "}
                                        <span className="italic">“{sanitizeForUi(String(a.jdEvidence), "Missing details")}”</span>
                                      </div>
                                    ) : (
                                      <div className="mb-3 text-xs text-red-800/80">
                                        <span className="font-semibold">From JD:</span>{" "}
                                        <span className="text-red-700 font-semibold">Missing details</span>
                                      </div>
                                    )}

                                    <h4 className="font-semibold text-green-900 mb-2">Your Solution</h4>
                                    <p className="mb-3">{renderValueOrMissing(String(a.solution || ""), "text-green-800")}</p>
                                    {String(a.resumeEvidence || "").trim() ? (
                                      <div className="mb-3 text-xs text-green-800/80">
                                        <span className="font-semibold">From resume:</span>{" "}
                                        <span className="italic">“{sanitizeForUi(String(a.resumeEvidence), "Missing details")}”</span>
                                      </div>
                                    ) : (
                                      <div className="mb-3 text-xs text-green-800/80">
                                        <span className="font-semibold">From resume:</span>{" "}
                                        <span className="text-red-700 font-semibold">Missing details</span>
                                      </div>
                                    )}
                                    {String(a.overlap || "").trim() ? (
                                      <div className="mb-3 text-xs text-slate-700">
                                        <span className="font-semibold">Why it matches:</span>{" "}
                                        {sanitizeForUi(String(a.overlap), "Missing details")}
                                      </div>
                                    ) : null}

                                    <h4 className="font-semibold text-blue-900 mb-2">Impact Metric</h4>
                                    <p className="text-blue-800">{renderValueOrMissing(String(a.metric || ""), "text-blue-800")}</p>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end space-x-4">
                    <button
                      onClick={() => router.push('/job-descriptions')}
                      className="bg-gray-100 text-gray-700 px-6 py-3 rounded-md font-medium hover:bg-gray-200 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleContinue}
                      className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                    >
                      Continue to Find Contact
                    </button>
                  </div>
                </div>
              )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
