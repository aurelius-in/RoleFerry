"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const JARGON_PHRASES = [
  "fast-paced environment",
  "rockstar",
  "wear multiple hats",
  "self-starter",
  "move fast",
  "high ownership",
  "results-driven",
  "detail-oriented",
  "world-class",
  "best-in-class",
  "passion for excellence",
];

function extractJargon(text: string): string[] {
  const hay = (text || "").toLowerCase();
  const found: string[] = [];
  for (const p of JARGON_PHRASES) {
    if (hay.includes(p)) found.push(p);
  }
  // Prettify for display
  return found.map((p) => p.replace(/^\w/, (c) => c.toUpperCase()));
}

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
  job_descriptions?: BackendJobDescription[];
}

type JobRecommendation = {
  id: string;
  label: string;
  company: string;
  source: string;
  url: string;
  rationale: string;
  score?: number;
  created_at?: string;
};

export default function JobDescriptionsPage() {
  const router = useRouter();
  // Important: avoid reading localStorage during the initial render to prevent
  // React hydration mismatches (which can break click interactions).
  const [hasMounted, setHasMounted] = useState(false);
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [recommendations, setRecommendations] = useState<JobRecommendation[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [importText, setImportText] = useState("");
  const [importType, setImportType] = useState<'url' | 'text'>('url');
  const [sortBy, setSortBy] = useState<'date' | 'grade'>('date');
  const suggestedUrl =
    "https://www.google.com/about/careers/applications/jobs/results/?employment_type=FULL_TIME&degree=MASTERS&skills=software%2C%20architecture%2C%20ai";

  useEffect(() => {
    setHasMounted(true);
    try {
      const cached = localStorage.getItem("job_descriptions");
      if (cached) {
        const parsed = JSON.parse(cached) as JobDescription[];
        // Drop old demo placeholder JDs so they don't keep showing up as "mock output".
        const cleaned = (parsed || []).filter((jd) => {
          const isOldDemoId = (jd.id || "").startsWith("jd_demo_");
          const isOldDemoContent =
            (jd.company || "") === "TechCorp Inc." &&
            (jd.content || "").startsWith("Job description content from URL");
          return !isOldDemoId && !isOldDemoContent;
        });
        setJobDescriptions(cleaned);
        localStorage.setItem("job_descriptions", JSON.stringify(cleaned));
      }
    } catch {
      // ignore malformed cache
    }

    try {
      const recs = localStorage.getItem("job_recommendations");
      if (recs) setRecommendations(JSON.parse(recs));
    } catch {
      // ignore malformed recs cache
    }
  }, []);

  const handleImport = async () => {
    const hasUrl = importType === "url" && Boolean(importUrl.trim());
    const hasText = importType === "text" && Boolean(importText.trim());
    if (!hasUrl && !hasText) return;

    setImportError(null);
    setIsImporting(true);

    try {
      const payload = {
        url: hasUrl ? importUrl.trim() : null,
        text: hasText ? importText.trim() : null,
      };
      const resp = await api<JobDescriptionResponse>("/job-descriptions/import", "POST", payload);
      const jds = (resp.job_descriptions && resp.job_descriptions.length)
        ? resp.job_descriptions
        : (resp.job_description ? [resp.job_description] : []);

      if (jds.length) {
        const mappedAll: JobDescription[] = jds.map((jd) => ({
          id: jd.id,
          title: jd.title,
          company: jd.company,
          url: jd.url || undefined,
          content: jd.content || "",
          painPoints: jd.pain_points || [],
          requiredSkills: jd.required_skills || [],
          successMetrics: jd.success_metrics || [],
          jdJargon: extractJargon(jd.content || ""),
          grade: undefined,
          parsedAt: jd.parsed_at || new Date().toISOString(),
        }));

        setJobDescriptions((prev) => {
          // Merge by id: replace existing items (so re-importing the same URL updates the card),
          // and append truly new ones.
          const next = [...prev];
          for (const m of mappedAll) {
            const idx = next.findIndex((p) => p.id === m.id);
            if (idx >= 0) next[idx] = { ...next[idx], ...m };
            else next.push(m);
          }
          if (typeof window !== "undefined") {
            localStorage.setItem("job_descriptions", JSON.stringify(next));
          }
          return next;
        });
      }
      // Only clear inputs on success
      setImportUrl("");
      setImportText("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setImportError(msg);
    } finally {
      setIsImporting(false);
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
      router.push('/painpoint-match');
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

          {recommendations.length > 0 && (
            <div className="mb-6 rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-white">Recommended job pages</div>
                  <div className="text-xs text-white/60">
                    From your Job Preferences — click one to populate the URL field.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("job_recommendations");
                    setRecommendations([]);
                  }}
                  className="text-xs underline text-white/70 hover:text-white"
                >
                  Clear
                </button>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {recommendations.slice(0, 8).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setImportType("url");
                      setImportUrl(r.url);
                    }}
                    className="text-left rounded-md border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{r.label}</div>
                        <div className="text-xs text-white/60">{r.company}</div>
                      </div>
                      {typeof r.score === "number" && (
                        <div className="text-xs font-semibold text-white/70">{r.score}/100</div>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-white/70">{r.rationale}</div>
                    <div className="mt-2 text-xs text-blue-300 underline">Use this URL</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6 flex justify-between items-center">
            <div className="flex-1">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="inline-flex rounded-full border border-white/10 bg-black/25 p-1">
                      <button
                        type="button"
                        onClick={() => setImportType("url")}
                        aria-pressed={importType === "url"}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          importType === "url"
                            ? "brand-gradient text-black"
                            : "text-white/80 hover:bg-white/10"
                        }`}
                      >
                        Import URL
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportType("text")}
                        aria-pressed={importType === "text"}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          importType === "text"
                            ? "brand-gradient text-black"
                            : "text-white/80 hover:bg-white/10"
                        }`}
                      >
                        Paste text
                      </button>
                    </div>
                  </div>

                  {importType === "url" ? (
                    <>
                      <div className="text-xs text-white/70 mb-1">Paste a job URL</div>
                      <input
                        type="url"
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        placeholder="Paste a job URL (or a listing URL) and import"
                        className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="mt-1 text-xs text-white/60">
                        Suggested:{" "}
                        <button
                          type="button"
                          className="underline hover:text-white"
                          onClick={() => {
                            // Always switch to URL mode so the user immediately sees the populated field.
                            setImportType("url");
                            setImportUrl(suggestedUrl);
                          }}
                        >
                          Google Careers results page
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs text-white/70 mb-1">Paste Job description</div>
                      <textarea
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder="Paste Job description"
                        className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 min-h-[280px] resize-y"
                      />
                    </>
                  )}

                  {importError && (
                    <div className="mt-2 text-xs text-red-300">
                      Import failed: {importError}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleImport}
                    disabled={
                      isImporting ||
                      (importType === "url" ? !importUrl.trim() : !importText.trim())
                    }
                    className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {isImporting ? "Parsing..." : "Import"}
                  </button>
                </div>
              </div>
            </div>
            
            {hasMounted && jobDescriptions.length > 0 && (
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

          {!hasMounted || jobDescriptions.length === 0 ? (
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
                    {jd.jdJargon.length > 0 && (
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
                    )}
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
    </div>
  );
}
