"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface PinpointMatch {
  pinpoint_1: string;
  solution_1: string;
  metric_1: string;
  pinpoint_2: string;
  solution_2: string;
  metric_2: string;
  pinpoint_3: string;
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

export default function PinpointMatchPage() {
  const router = useRouter();
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [resumeExtract, setResumeExtract] = useState<ResumeExtract | null>(null);
  const [matches, setMatches] = useState<PinpointMatch[]>([]);
  const [selectedJD, setSelectedJD] = useState<JobDescription | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    // Load data from localStorage
    const savedJDs = localStorage.getItem('job_descriptions');
    const savedResume = localStorage.getItem('resume_extract');
    
    if (savedJDs) {
      setJobDescriptions(JSON.parse(savedJDs));
    }
    if (savedResume) {
      setResumeExtract(JSON.parse(savedResume));
    }
  }, []);

  const generateMatches = async () => {
    if (!selectedJD || !resumeExtract) return;
    
    setIsGenerating(true);
    
    // Simulate AI matching
    setTimeout(() => {
      const mockMatches: PinpointMatch[] = [
        {
          pinpoint_1: "Need to reduce time-to-fill for engineering roles",
          solution_1: "Reduced TTF by 40% using ATS optimization and streamlined hiring process",
          metric_1: "40% reduction, 18 vs 30 days average",
          pinpoint_2: "Struggling with candidate quality and cultural fit",
          solution_2: "Implemented structured interview process with cultural fit assessment",
          metric_2: "Improved candidate quality scores by 35%",
          pinpoint_3: "High turnover in engineering team affecting project delivery",
          solution_3: "Built team retention program with career development focus",
          metric_3: "Reduced turnover by 25% in 6 months",
          alignment_score: 0.85
        }
      ];
      
      setMatches(mockMatches);
      setIsGenerating(false);
    }, 2000);
  };

  const handleContinue = () => {
    if (matches.length > 0) {
      localStorage.setItem('pinpoint_matches', JSON.stringify(matches));
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Pinpoint Match</h1>
            <p className="text-gray-600">
              Compare your solutions to the job's pain points to find the best alignment.
            </p>
          </div>

          {jobDescriptions.length === 0 || !resumeExtract ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Missing Data</h3>
              <p className="text-gray-600 mb-6">
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
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-md font-medium hover:bg-gray-200 transition-colors"
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
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedJD(jd)}
                    >
                      <h3 className="font-semibold text-gray-900">{jd.title}</h3>
                      <p className="text-gray-600">{jd.company}</p>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
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
                    {isGenerating ? "Generating Matches..." : "Generate Pinpoint Matches"}
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
                                <p className="text-red-800 mb-3">{match.pinpoint_1}</p>
                                
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
                                <p className="text-red-800 mb-3">{match.pinpoint_2}</p>
                                
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
                                <p className="text-red-800 mb-3">{match.pinpoint_3}</p>
                                
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
