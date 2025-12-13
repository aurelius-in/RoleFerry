"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface PainPointMatch {
  painpoint_1: string;
  solution_1: string;
  metric_1: string;
  painpoint_2: string;
  solution_2: string;
  metric_2: string;
  painpoint_3: string;
  solution_3: string;
  metric_3: string;
  alignment_score: number;
}

interface JobDescription {
  id: string;
  title: string;
  company: string;
  painPoints: string[];
  requiredSkills: string[];
  successMetrics: string[];
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
  solution_1: string;
  metric_1: string;
  painpoint_2: string;
  solution_2: string;
  metric_2: string;
  painpoint_3: string;
  solution_3: string;
  metric_3: string;
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
  const [selectedJD, setSelectedJD] = useState<JobDescription | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      });
      const backendMatches = resp.matches || [];
      const mapped: PainPointMatch[] = backendMatches.map((m) => ({
        painpoint_1: m.painpoint_1,
        solution_1: m.solution_1,
        metric_1: m.metric_1,
        painpoint_2: m.painpoint_2,
        solution_2: m.solution_2,
        metric_2: m.metric_2,
        painpoint_3: m.painpoint_3,
        solution_3: m.solution_3,
        metric_3: m.metric_3,
        alignment_score: m.alignment_score,
      }));
      setMatches(mapped);
      if (typeof window !== "undefined") {
        // New Week 10+ key:
        localStorage.setItem("painpoint_matches", JSON.stringify(mapped));
      }
    } catch (e: any) {
      setError("Failed to generate matches. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleContinue = () => {
    if (matches.length > 0) {
      localStorage.setItem("painpoint_matches", JSON.stringify(matches));
      router.push('/find-contact');
    }
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

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-6xl mx-auto px-4">
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
            <div className="space-y-8">
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
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {matches.map((match, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-6">
                        <h3 className="text-lg font-semibold mb-4">Top 3 Alignments</h3>
                        
                        <div className="space-y-6">
                          {/* Alignment 1 */}
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                                  <span className="text-red-600 font-semibold">1</span>
                                </div>
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-red-900 mb-2">Pain Point</h4>
                                <p className="text-red-800 mb-3">{match.painpoint_1}</p>
                                
                                <h4 className="font-semibold text-green-900 mb-2">Your Solution</h4>
                                <p className="text-green-800 mb-3">{match.solution_1}</p>
                                
                                <h4 className="font-semibold text-blue-900 mb-2">Impact Metric</h4>
                                <p className="text-blue-800">{match.metric_1}</p>
                              </div>
                            </div>
                          </div>

                          {/* Alignment 2 */}
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                                  <span className="text-red-600 font-semibold">2</span>
                                </div>
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-red-900 mb-2">Pain Point</h4>
                                <p className="text-red-800 mb-3">{match.painpoint_2}</p>
                                
                                <h4 className="font-semibold text-green-900 mb-2">Your Solution</h4>
                                <p className="text-green-800 mb-3">{match.solution_2}</p>
                                
                                <h4 className="font-semibold text-blue-900 mb-2">Impact Metric</h4>
                                <p className="text-blue-800">{match.metric_2}</p>
                              </div>
                            </div>
                          </div>

                          {/* Alignment 3 */}
                          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0">
                                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                                  <span className="text-red-600 font-semibold">3</span>
                                </div>
                              </div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-red-900 mb-2">Pain Point</h4>
                                <p className="text-red-800 mb-3">{match.painpoint_3}</p>
                                
                                <h4 className="font-semibold text-green-900 mb-2">Your Solution</h4>
                                <p className="text-green-800 mb-3">{match.solution_3}</p>
                                
                                <h4 className="font-semibold text-blue-900 mb-2">Impact Metric</h4>
                                <p className="text-blue-800">{match.metric_3}</p>
                              </div>
                            </div>
                          </div>
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
          )}
        </div>
      </div>
    </div>
  );
}
