"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface JobDescription {
  id: string;
  title: string;
  company: string;
  url?: string;
  content: string;
  painPoints: string[];
  requiredSkills: string[];
  successMetrics: string[];
  jdJargon: string[];
  grade?: 'Shoo-in' | 'Stretch' | 'Ideal';
  parsedAt: string;
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

interface JobDescriptionResponse {
  success: boolean;
  message: string;
  job_description?: BackendJobDescription;
}

export default function JobDescriptionsPage() {
  const router = useRouter();
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>(() => {
    // Seed from localStorage for snappy UX; backend fetch happens on demand via import.
    try {
      const cached = typeof window !== "undefined" ? localStorage.getItem("job_descriptions") : null;
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [isImporting, setIsImporting] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importText, setImportText] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<'url' | 'text'>('url');
  const [sortBy, setSortBy] = useState<'date' | 'grade'>('date');

  const handleImport = async () => {
    if (!importUrl && !importText) return;
    
    setIsImporting(true);

    try {
      const payload = {
        url: importType === "url" ? importUrl || null : null,
        text: importType === "text" ? importText || null : null,
      };
      const resp = await api<JobDescriptionResponse>("/job-descriptions/import", "POST", payload);
      const jd = resp.job_description;
      if (jd) {
        const mapped: JobDescription = {
          id: jd.id,
          title: jd.title,
          company: jd.company,
          url: jd.url || undefined,
          content: jd.content || "",
          painPoints: jd.pain_points || [],
          requiredSkills: jd.required_skills || [],
          successMetrics: jd.success_metrics || [],
          jdJargon: [
            "Fast-paced environment",
            "Rockstar developer",
            "Wear multiple hats",
            "Passion for excellence",
          ],
          grade: undefined,
          parsedAt: jd.parsed_at || new Date().toISOString(),
        };
        setJobDescriptions(prev => {
          const next = [...prev, mapped];
          if (typeof window !== "undefined") {
            localStorage.setItem("job_descriptions", JSON.stringify(next));
          }
          return next;
        });
      }
    } catch {
      // Fallback: keep existing state if backend import fails.
    } finally {
      setIsImporting(false);
      setShowImportModal(false);
      setImportUrl("");
      setImportText("");
    }
  };

  const handleDelete = (id: string) => {
    setJobDescriptions(prev => prev.filter(jd => jd.id !== id));
  };

  const handleGradeChange = (id: string, grade: string) => {
    setJobDescriptions(prev => prev.map(jd => 
      jd.id === id ? { ...jd, grade: grade as JobDescription['grade'] } : jd
    ));
  };

  const sortedJobDescriptions = [...jobDescriptions].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.parsedAt).getTime() - new Date(a.parsedAt).getTime();
    }
    const gradeOrder: Record<string, number> = { 'Shoo-in': 1, 'Stretch': 2, 'Ideal': 3 };
    return (gradeOrder[a.grade || ''] || 4) - (gradeOrder[b.grade || ''] || 4);
  });

  const handleContinue = () => {
    if (jobDescriptions.length > 0) {
      localStorage.setItem('job_descriptions', JSON.stringify(jobDescriptions));
      router.push('/pinpoint-match');
    }
  };

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 mb-4">
        <a href="/foundry" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
          <span className="mr-2">←</span> Back to Path
        </a>
      </div>
      <div className="max-w-6xl mx-auto px-4">
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Job Descriptions</h1>
              <p className="text-white/70">
                Import job descriptions to extract business challenges, required skills, and success metrics.
              </p>
            </div>
            <div className="bg-gray-900/70 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-lg border border-white/10">
              Step 2 of 12
            </div>
          </div>

          <div className="mb-6 flex justify-between items-center">
            <button
              onClick={() => setShowImportModal(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
            >
              Import Job Description
            </button>
            
            {jobDescriptions.length > 0 && (
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value as 'date' | 'grade')}
                className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="date">Sort by Date</option>
                <option value="grade">Sort by Grade</option>
              </select>
            )}
          </div>

          {jobDescriptions.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No Job Descriptions</h3>
              <p className="text-white/70 mb-6">
                Import job descriptions from URLs or paste text to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedJobDescriptions.map((jd) => (
                <div key={jd.id} className="rounded-lg border border-white/10 bg-black/20 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-white">{jd.title}</h3>
                      <p className="text-white/70">{jd.company}</p>
                      {jd.url && (
                        <a 
                          href={jd.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View Original
                        </a>
                      )}
                    </div>
                    <div className="flex items-center space-x-4">
                      <select
                        value={jd.grade || ""}
                        onChange={(e) => handleGradeChange(jd.id, e.target.value)}
                        className={`border rounded-md px-3 py-1 text-sm font-medium ${
                          jd.grade === 'Shoo-in' ? 'bg-green-50 text-green-700 border-green-200' :
                          jd.grade === 'Stretch' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                          jd.grade === 'Ideal' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          'bg-white/5 text-white/70 border-white/10'
                        }`}
                      >
                        <option value="" disabled>Grade this Role</option>
                        <option value="Shoo-in">1. Shoo-in Position</option>
                        <option value="Stretch">2. Stretch Position</option>
                        <option value="Ideal">3. Ideal Future Position</option>
                      </select>
                      <button
                        onClick={() => handleDelete(jd.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Pain Points */}
                    <div>
                      <h4 className="font-semibold text-white mb-3">Business Challenges</h4>
                      <ul className="space-y-2">
                        {jd.painPoints.map((point, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="text-red-500 mt-1">•</span>
                            <span className="text-sm text-white/80">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Required Skills */}
                    <div>
                      <h4 className="font-semibold text-white mb-3">Required Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {jd.requiredSkills.map((skill, index) => (
                          <span
                            key={index}
                            className="bg-blue-50 text-blue-200 px-2 py-1 rounded-full text-xs border border-white/10"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Success Metrics */}
                    <div>
                      <h4 className="font-semibold text-white mb-3">Success Metrics</h4>
                      <ul className="space-y-2">
                        {jd.successMetrics.map((metric, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="text-green-500 mt-1">•</span>
                            <span className="text-sm text-white/80">{metric}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* JD Jargon */}
                    <div>
                      <h4 className="font-semibold text-white mb-3">JD Jargon</h4>
                      <ul className="space-y-2">
                        {jd.jdJargon.map((jargon, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="text-purple-500 mt-1">•</span>
                            <span className="text-sm text-white/70 italic">{jargon}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-xs text-white/60">
                      Parsed on {new Date(jd.parsedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {jobDescriptions.length > 0 && (
            <div className="mt-8 flex justify-end space-x-4">
              <button
                onClick={() => router.push('/resume')}
                className="bg-white/10 text-white px-6 py-3 rounded-md font-medium hover:bg-white/15 transition-colors border border-white/10"
              >
                Back
              </button>
              <button
                onClick={handleContinue}
                className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                Continue to Match
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="rounded-lg border border-white/10 bg-slate-950/90 backdrop-blur max-w-2xl w-full p-6 text-slate-100 shadow-2xl shadow-black/30">
            <h2 className="text-xl font-semibold mb-4">Import Job Description</h2>
            
            <div className="mb-4">
              <div className="flex space-x-4 mb-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="importType"
                    value="url"
                    checked={importType === 'url'}
                    onChange={(e) => setImportType(e.target.value as 'url' | 'text')}
                    className="text-blue-600"
                  />
                  <span>Import from URL</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="importType"
                    value="text"
                    checked={importType === 'text'}
                    onChange={(e) => setImportType(e.target.value as 'url' | 'text')}
                    className="text-blue-600"
                  />
                  <span>Paste Text</span>
                </label>
              </div>

              {importType === 'url' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Job Description URL
                  </label>
                  <input
                    type="url"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    placeholder="https://company.com/job-posting"
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Job Description Text
                  </label>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="Paste the job description text here..."
                    className="w-full border border-gray-300 rounded-md px-3 py-2 h-32"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowImportModal(false)}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting || (!importUrl && !importText)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isImporting ? "Parsing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
