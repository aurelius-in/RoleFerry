"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";


interface ResumeExtract {
  positions: Array<{
    company: string;
    title: string;
    startDate: string;
    endDate: string;
    current: boolean;
    description: string;
  }>;
  keyMetrics: Array<{
    metric: string;
    value: string;
    context: string;
  }>;
  skills: string[];
  businessChallenges: string[];
  accomplishments: string[];
  tenure: Array<{
    company: string;
    duration: string;
    role: string;
  }>;
}

export default function ResumePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [extract, setExtract] = useState<ResumeExtract | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cachedFilename, setCachedFilename] = useState<string | null>(null);

  const totalYearsExperience = (() => {
    if (!extract?.positions?.length) return null;

    const parseDate = (s: string): Date | null => {
      const t = String(s || "").trim();
      if (!t) return null;
      // Common formats: YYYY-MM, YYYY/MM, YYYY
      const m = t.match(/^(\d{4})(?:[-/](\d{1,2}))?/);
      if (!m) return null;
      const year = Number(m[1]);
      const month = m[2] ? Math.max(1, Math.min(12, Number(m[2]))) : 1;
      if (!year || year < 1950 || year > 2100) return null;
      return new Date(Date.UTC(year, month - 1, 1));
    };

    let minStart: number | null = null;
    let maxEnd: number | null = null;

    for (const p of extract.positions) {
      const start = parseDate(p.startDate);
      const end = p.current ? new Date() : parseDate(p.endDate);
      if (!start || !end) continue;
      const s = start.getTime();
      const e = end.getTime();
      if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) continue;
      if (minStart === null || s < minStart) minStart = s;
      if (maxEnd === null || e > maxEnd) maxEnd = e;
    }

    if (minStart === null || maxEnd === null) return null;
    const years = (maxEnd - minStart) / (1000 * 60 * 60 * 24 * 365.25);
    if (!Number.isFinite(years) || years <= 0) return null;
    return Math.round(years * 10) / 10;
  })();

  const clearResumeCache = () => {
    // Resume + anything derived from resume (so you don't see stale matches)
    localStorage.removeItem("resume_extract");
    localStorage.removeItem("resume_extract_meta");
    localStorage.removeItem("painpoint_matches");
    localStorage.removeItem("painpoint_matches_by_job");
    // Keep user-entered prefs/jobs unless explicitly resetting the whole demo.

    setExtract(null);
    setIsEditing(false);
    setUploadError(null);
    setCachedFilename(null);
    // Allow re-uploading the same file immediately.
    try {
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {}
  };

  useEffect(() => {
    // Load cached resume extract (if any) so the UI reflects what's powering downstream steps.
    try {
      const raw = localStorage.getItem("resume_extract");
      if (raw) setExtract(JSON.parse(raw));
      const metaRaw = localStorage.getItem("resume_extract_meta");
      if (metaRaw) {
        const meta = JSON.parse(metaRaw);
        if (meta?.filename) setCachedFilename(String(meta.filename));
      }
    } catch {
      // If cache is corrupt, clear it silently.
      try {
        localStorage.removeItem("resume_extract");
        localStorage.removeItem("resume_extract_meta");
      } catch {}
    }
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Prevent stale resume data from persisting after a new upload.
    clearResumeCache();

    setIsUploading(true);
    setUploadError(null);

    try {
      // Call the real backend upload endpoint via the Next.js /api rewrite.
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/resume/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const backendExtract = data?.extract;
        if (!backendExtract) {
          setUploadError("Upload succeeded but the backend did not return an extract. Please try again.");
          setExtract(null);
          return;
        }

        const backendBusinessChallenges = backendExtract.business_challenges;
        const mappedBusinessChallenges =
          Array.isArray(backendBusinessChallenges) && backendBusinessChallenges.length
            ? backendBusinessChallenges
            : [];

        const mapped: ResumeExtract = {
          positions: (backendExtract.positions || []).map((p: any) => ({
            company: p.company,
            title: p.title,
            startDate: p.start_date,
            endDate: p.end_date,
            current: p.current,
            description: p.description,
          })),
          keyMetrics: (backendExtract.key_metrics || []).map((m: any) => ({
            metric: m.metric,
            value: m.value,
            context: m.context,
          })),
          skills: backendExtract.skills || [],
          businessChallenges: mappedBusinessChallenges,
          accomplishments: backendExtract.accomplishments || [],
          tenure: (backendExtract.tenure || []).map((t: any) => ({
            company: t.company,
            duration: t.duration,
            role: t.role,
          })),
        };

        // Persist immediately so downstream steps (Gap Analysis / Match) use the new resume right away.
        localStorage.setItem("resume_extract", JSON.stringify(mapped));
        localStorage.setItem(
          "resume_extract_meta",
          JSON.stringify({ filename: file.name, updated_at: new Date().toISOString() })
        );
        setCachedFilename(file.name);
        setExtract(mapped);
      } else {
        // Show helpful server error text when available.
        try {
          const err = await res.json();
          const detail = String(err?.detail || err?.message || "");
          setUploadError(detail || `Upload failed (HTTP ${res.status}).`);
        } catch {
          setUploadError(`Upload failed (HTTP ${res.status}).`);
        }
        setExtract(null);
      }
    } catch (e: any) {
      const msg = String(e?.message || "");
      setUploadError(msg || "Upload failed. Is the backend running?");
      setExtract(null);
    } finally {
      setIsUploading(false);
      // Allow selecting the same file again to retry (onChange won't fire otherwise).
      try {
        event.target.value = "";
      } catch {}
    }
  };

  const handleSave = () => {
    if (extract) {
      localStorage.setItem('resume_extract', JSON.stringify(extract));
      router.push('/job-descriptions');
    }
  };

  const handleEdit = (field: keyof ResumeExtract, index: number, value: any) => {
    if (!extract) return;
    
    const newExtract = { ...extract };
    if (Array.isArray(newExtract[field])) {
      (newExtract[field] as any[])[index] = value;
    }
    setExtract(newExtract);
  };

  const handleAddItem = (field: keyof ResumeExtract, newItem: any) => {
    if (!extract) return;
    
    const newExtract = { ...extract };
    if (Array.isArray(newExtract[field])) {
      (newExtract[field] as any[]).push(newItem);
    }
    setExtract(newExtract);
  };

  const handleRemoveItem = (field: keyof ResumeExtract, index: number) => {
    if (!extract) return;
    
    const newExtract = { ...extract };
    if (Array.isArray(newExtract[field])) {
      (newExtract[field] as any[]).splice(index, 1);
    }
    setExtract(newExtract);
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 mb-4">
        <a href="/job-preferences" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
          <span className="mr-2">←</span> Back to Job Prefs
        </a>
      </div>
      <div className="max-w-4xl mx-auto px-4">
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">Resume / Candidate Profile</h1>
                  <p className="text-white/70">
                    Upload your resume or candidate profile to extract key information for personalized outreach.
                  </p>
                  {cachedFilename ? (
                    <div className="mt-2 text-xs text-white/50">
                      Cached resume: <span className="text-white/70 font-semibold">{cachedFilename}</span>
                    </div>
                  ) : null}
                </div>
                <div className="bg-gray-900/70 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-lg border border-white/10">
                  Step 3 of 12
                </div>
              </div>

          {!extract ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Upload Resume</h3>
              <p className="text-white/70 mb-6">
                Upload a PDF or DOCX file to extract your experience, skills, and accomplishments.
              </p>
              {uploadError && (
                <div className="mx-auto mb-4 max-w-xl rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100 text-left">
                  {uploadError}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.html,.htm"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isUploading ? "Processing..." : "Choose File"}
              </button>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={clearResumeCache}
                  className="text-xs text-white/60 hover:text-white underline underline-offset-4"
                >
                  Clear cached resume
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">Resume Extract</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={clearResumeCache}
                    className="bg-white/5 text-white/80 px-3 py-2 rounded-md hover:bg-white/10 transition-colors border border-white/10 text-sm"
                  >
                    Clear cached resume
                  </button>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="bg-white/10 text-white px-4 py-2 rounded-md hover:bg-white/15 transition-colors border border-white/10"
                  >
                    {isEditing ? "Done Editing" : "Edit"}
                  </button>
                </div>
              </div>

              {/* Positions */}
              <div>
                <h3 className="text-xl font-semibold mb-4">Work Experience</h3>
                <div className="space-y-4">
                  {extract.positions.map((position, index) => (
                    <div key={index} className="border border-white/10 bg-black/20 rounded-lg p-4">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="text"
                              value={position.company}
                              onChange={(e) => handleEdit('positions', index, { ...position, company: e.target.value })}
                              className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Company"
                            />
                            <input
                              type="text"
                              value={position.title}
                              onChange={(e) => handleEdit('positions', index, { ...position, title: e.target.value })}
                              className="border border-gray-300 rounded-md px-3 py-2"
                              placeholder="Title"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="text"
                              value={position.startDate}
                              onChange={(e) => handleEdit('positions', index, { ...position, startDate: e.target.value })}
                              className="border border-gray-300 rounded-md px-3 py-2"
                              placeholder="Start Date"
                            />
                            <input
                              type="text"
                              value={position.endDate}
                              onChange={(e) => handleEdit('positions', index, { ...position, endDate: e.target.value })}
                              className="border border-gray-300 rounded-md px-3 py-2"
                              placeholder="End Date"
                            />
                          </div>
                          <textarea
                            value={position.description}
                            onChange={(e) => handleEdit('positions', index, { ...position, description: e.target.value })}
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                            placeholder="Description"
                            rows={3}
                          />
                          <button
                            onClick={() => handleRemoveItem('positions', index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove Position
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-semibold text-lg">{position.title}</h4>
                              <p className="text-gray-600">{position.company}</p>
                            </div>
                            <span className="text-sm text-gray-500">
                              {position.startDate} - {position.current ? "Present" : position.endDate}
                            </span>
                          </div>
                          <p className="text-gray-700">{position.description}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Metrics */}
              <div>
                <h3 className="text-xl font-semibold mb-4">Key Metrics</h3>
                {extract.keyMetrics.length === 0 ? (
                  <div className="text-sm text-red-300 font-semibold">Missing details</div>
                ) : null}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {extract.keyMetrics.map((metric, index) => (
                    <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={metric.metric}
                            onChange={(e) => handleEdit('keyMetrics', index, { ...metric, metric: e.target.value })}
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                            placeholder="Metric"
                          />
                          <input
                            type="text"
                            value={metric.value}
                            onChange={(e) => handleEdit('keyMetrics', index, { ...metric, value: e.target.value })}
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                            placeholder="Value"
                          />
                          <input
                            type="text"
                            value={metric.context}
                            onChange={(e) => handleEdit('keyMetrics', index, { ...metric, context: e.target.value })}
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                            placeholder="Context"
                          />
                          <button
                            onClick={() => handleRemoveItem('keyMetrics', index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div>
                          <h4 className="font-semibold text-blue-900">{metric.metric}</h4>
                          <p className="text-2xl font-bold text-blue-600">{metric.value}</p>
                          <p className="text-sm text-blue-700">{metric.context}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Business Challenges */}
              <div>
                <h3 className="text-xl font-semibold mb-4">Business Challenges Solved</h3>
                {extract.businessChallenges.length === 0 ? (
                  <div className="text-sm text-red-300 font-semibold">Missing details</div>
                ) : null}
                <ul className="space-y-2">
                  {extract.businessChallenges.map((challenge, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="text-orange-500 mt-1">•</span>
                      {isEditing ? (
                         <div className="flex-1 flex space-x-2">
                           <input
                             type="text"
                             value={challenge}
                             onChange={(e) => handleEdit('businessChallenges', index, e.target.value)}
                             className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                           />
                           <button
                             onClick={() => handleRemoveItem('businessChallenges', index)}
                             className="text-red-600 hover:text-red-800 text-sm"
                           >
                             Remove
                           </button>
                         </div>
                      ) : (
                        <span>{challenge}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Skills */}
              <div>
                <h3 className="text-xl font-semibold mb-4">Skills</h3>
                {extract.skills.length === 0 ? (
                  <div className="text-sm text-red-300 font-semibold">Missing details</div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {extract.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Accomplishments */}
              <div>
                <h3 className="text-xl font-semibold mb-4">Notable Accomplishments</h3>
                {extract.accomplishments.length === 0 ? (
                  <div className="text-sm text-red-300 font-semibold">Missing details</div>
                ) : null}
                <ul className="space-y-2">
                  {extract.accomplishments.map((accomplishment, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="text-green-500 mt-1">•</span>
                      <span>{accomplishment}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tenure */}
              <div>
                <h3 className="text-xl font-semibold mb-4">Tenure Summary</h3>
                {extract.tenure.length === 0 ? (
                  <div className="text-sm text-red-300 font-semibold">Missing details</div>
                ) : null}
                <div className="space-y-2">
                  {extract.tenure.map((tenure, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <div>
                        <span className="font-medium">{tenure.role}</span> at <span className="font-medium">{tenure.company}</span>
                      </div>
                      <span className="text-gray-600">{tenure.duration}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-bold text-white mb-2">Available Variables from this Step</div>
                <div className="text-xs text-white/60 mb-3">
                  These variables are now available for downstream steps (Compose/Campaign):
                </div>
                <div className="flex flex-wrap gap-2">
                  <code className="px-2 py-1 rounded-md border border-white/10 bg-black/30 text-[11px] text-green-200">
                    resume.key_metrics[]
                  </code>
                  <code className="px-2 py-1 rounded-md border border-white/10 bg-black/30 text-[11px] text-green-200">
                    resume.business_challenges[]
                  </code>
                  <code className="px-2 py-1 rounded-md border border-white/10 bg-black/30 text-[11px] text-green-200">
                    resume.accomplishments[]
                  </code>
                  <code className="px-2 py-1 rounded-md border border-white/10 bg-black/30 text-[11px] text-green-200">
                    resume.total_years_experience{totalYearsExperience !== null ? `=${totalYearsExperience}` : ""}
                  </code>
                  <code className="px-2 py-1 rounded-md border border-white/10 bg-black/30 text-[11px] text-green-200">
                    resume.positions[]
                  </code>
                </div>
                {totalYearsExperience === null ? (
                  <div className="mt-2 text-[11px] text-white/50">
                    Note: total years is best-effort (derived from position dates). If your resume dates are missing/irregular, it may show as unavailable.
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => router.push('/job-preferences')}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-md font-medium hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSave}
                  className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                >
                  Save & Continue
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
