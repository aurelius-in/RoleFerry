"use client";

import { useState, useRef } from "react";
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    // Simulate AI parsing
    setTimeout(() => {
      const mockExtract: ResumeExtract = {
        positions: [
          {
            company: "TechCorp Inc.",
            title: "Senior Software Engineer",
            startDate: "2022-01",
            endDate: "2024-12",
            current: true,
            description: "Led development of microservices architecture, reducing system latency by 40%"
          },
          {
            company: "StartupXYZ",
            title: "Full Stack Developer",
            startDate: "2020-06",
            endDate: "2021-12",
            current: false,
            description: "Built customer-facing web application serving 10K+ users"
          }
        ],
        keyMetrics: [
          {
            metric: "System Performance",
            value: "40% reduction",
            context: "in latency through microservices optimization"
          },
          {
            metric: "User Growth",
            value: "10K+ users",
            context: "served through customer-facing application"
          },
          {
            metric: "Team Leadership",
            value: "5 engineers",
            context: "managed in cross-functional team"
          }
        ],
        skills: ["Python", "JavaScript", "React", "Node.js", "AWS", "Docker", "PostgreSQL"],
        businessChallenges: [
          "Scaling customer-centric strategy across onboarding, expansion, and value realization efforts",
          "Integrating two legacy CS orgs into a unified global operating model",
          "Improving customer satisfaction for a $40M consulting firm",
          "Driving adoption and ROI for a $250M+ SaaS provider"
        ],
        accomplishments: [
          "Reduced system latency by 40% through microservices architecture",
          "Led team of 5 engineers in cross-functional projects",
          "Built scalable web application serving 10K+ users",
          "Implemented CI/CD pipeline reducing deployment time by 60%"
        ],
        tenure: [
          { company: "TechCorp Inc.", duration: "2 years", role: "Senior Software Engineer" },
          { company: "StartupXYZ", duration: "1.5 years", role: "Full Stack Developer" }
        ]
      };
      
      setExtract(mockExtract);
      setIsUploading(false);
    }, 2000);
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 mb-4">
        <a href="/foundry" className="inline-flex items-center text-gray-600 hover:text-gray-900 font-medium transition-colors">
          <span className="mr-2">←</span> Back to Path
        </a>
      </div>
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm border p-8">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">Resume / Candidate Profile</h1>
                  <p className="text-gray-600">
                    Upload your resume or candidate profile to extract key information for personalized outreach.
                  </p>
                </div>
                <div className="bg-gray-900 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-lg border border-gray-700">
                  Step 3 of 12
                </div>
              </div>

          {!extract ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Resume</h3>
              <p className="text-gray-600 mb-6">
                Upload a PDF or DOCX file to extract your experience, skills, and accomplishments.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
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
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">Resume Extract</h2>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors"
                >
                  {isEditing ? "Done Editing" : "Edit"}
                </button>
              </div>

              {/* Positions */}
              <div>
                <h3 className="text-xl font-semibold mb-4">Work Experience</h3>
                <div className="space-y-4">
                  {extract.positions.map((position, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      {isEditing ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <input
                              type="text"
                              value={position.company}
                              onChange={(e) => handleEdit('positions', index, { ...position, company: e.target.value })}
                              className="border border-gray-300 rounded-md px-3 py-2"
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
