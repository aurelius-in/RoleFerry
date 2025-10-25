"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface JobDescription {
  id: string;
  title: string;
  company: string;
  url?: string;
  content: string;
  painPoints: string[];
  requiredSkills: string[];
  successMetrics: string[];
  parsedAt: string;
}

export default function JobDescriptionsPage() {
  const router = useRouter();
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importText, setImportText] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importType, setImportType] = useState<'url' | 'text'>('url');

  const handleImport = async () => {
    if (!importUrl && !importText) return;
    
    setIsImporting(true);
    
    // Simulate AI parsing
    setTimeout(() => {
      const newJD: JobDescription = {
        id: Date.now().toString(),
        title: "Senior Software Engineer",
        company: "TechCorp Inc.",
        url: importType === 'url' ? importUrl : undefined,
        content: importType === 'url' ? "Job description content from URL..." : importText,
        painPoints: [
          "Need to reduce time-to-fill for engineering roles",
          "Struggling with candidate quality and cultural fit",
          "High turnover in engineering team affecting project delivery"
        ],
        requiredSkills: [
          "Python", "JavaScript", "React", "Node.js", "AWS", "Docker", "PostgreSQL"
        ],
        successMetrics: [
          "Reduce time-to-hire by 30%",
          "Improve candidate quality scores",
          "Increase team retention by 25%"
        ],
        parsedAt: new Date().toISOString()
      };
      
      setJobDescriptions(prev => [...prev, newJD]);
      setIsImporting(false);
      setShowImportModal(false);
      setImportUrl("");
      setImportText("");
    }, 2000);
  };

  const handleDelete = (id: string) => {
    setJobDescriptions(prev => prev.filter(jd => jd.id !== id));
  };

  const handleContinue = () => {
    if (jobDescriptions.length > 0) {
      localStorage.setItem('job_descriptions', JSON.stringify(jobDescriptions));
      router.push('/pinpoint-match');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Job Descriptions</h1>
            <p className="text-gray-600">
              Import job descriptions to extract business challenges, required skills, and success metrics.
            </p>
          </div>

          <div className="mb-6">
            <button
              onClick={() => setShowImportModal(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
            >
              Import Job Description
            </button>
          </div>

          {jobDescriptions.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Job Descriptions</h3>
              <p className="text-gray-600 mb-6">
                Import job descriptions from URLs or paste text to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {jobDescriptions.map((jd) => (
                <div key={jd.id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{jd.title}</h3>
                      <p className="text-gray-600">{jd.company}</p>
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
                    <button
                      onClick={() => handleDelete(jd.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Pain Points */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Business Challenges</h4>
                      <ul className="space-y-2">
                        {jd.painPoints.map((point, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="text-red-500 mt-1">•</span>
                            <span className="text-sm text-gray-700">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Required Skills */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Required Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {jd.requiredSkills.map((skill, index) => (
                          <span
                            key={index}
                            className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Success Metrics */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Success Metrics</h4>
                      <ul className="space-y-2">
                        {jd.successMetrics.map((metric, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="text-green-500 mt-1">•</span>
                            <span className="text-sm text-gray-700">{metric}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-xs text-gray-500">
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
                className="bg-gray-100 text-gray-700 px-6 py-3 rounded-md font-medium hover:bg-gray-200 transition-colors"
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
          <div className="bg-white rounded-lg max-w-2xl w-full p-6">
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
