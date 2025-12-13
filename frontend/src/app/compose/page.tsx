"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface Variable {
  name: string;
  value: string;
  description: string;
}

interface JargonTerm {
  term: string;
  definition: string;
  category: string;
  position: [number, number];
}

interface EmailTemplate {
  id: string;
  subject: string;
  body: string;
  tone: 'recruiter' | 'manager' | 'exec';
  variables: Variable[];
  jargon_terms: JargonTerm[];
  simplified_body: string;
}

interface ComposeResponse {
  success: boolean;
  message: string;
  email_template?: EmailTemplate;
  helper?: {
    rationale?: string;
    variants?: { label: string; subject: string; body: string }[];
  };
}

export default function ComposePage() {
  const router = useRouter();
  const [mode, setMode] = useState<'job-seeker' | 'recruiter'>('job-seeker');
  const [selectedTone, setSelectedTone] = useState<'recruiter' | 'manager' | 'exec'>('manager');
  const [simplifyLanguage, setSimplifyLanguage] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplate | null>(null);
  const [helper, setHelper] = useState<ComposeResponse["helper"] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock variables that would come from previous steps
  const mockVariables: Variable[] = [
    { name: "{{first_name}}", value: "Jane", description: "Contact's first name" },
    { name: "{{job_title}}", value: "Senior Software Engineer", description: "Target job title" },
    { name: "{{company_name}}", value: "TechCorp", description: "Target company name" },
    { name: "{{pinpoint_1}}", value: "Scaling our backend infrastructure to handle 10x traffic", description: "First business challenge" },
    { name: "{{solution_1}}", value: "My experience scaling microservices on AWS, handling peak loads with auto-scaling groups and load balancers", description: "Your solution to challenge 1" },
    { name: "{{metric_1}}", value: "Achieved 99.9% uptime and 20% cost reduction", description: "Key metric for solution 1" },
    { name: "{{company_summary}}", value: "TechCorp is a leading technology company specializing in AI-driven solutions for enterprise clients", description: "Company overview" },
    { name: "{{recent_news}}", value: "TechCorp recently announced a strategic partnership with GlobalData Inc. to expand their market reach in Asia", description: "Recent company news" },
    { name: "{{contact_bio}}", value: "Jane Doe is the Hiring Manager for the AI Solutions division at TechCorp", description: "Contact's background" }
  ];

  useEffect(() => {
    // Load mode from localStorage
    const stored = localStorage.getItem("rf_mode");
    if (stored === 'recruiter') {
      setMode('recruiter');
    }
    
    // Listen for mode changes
    const handleModeChange = (event: CustomEvent) => {
      setMode(event.detail);
    };
    
    window.addEventListener('modeChanged', handleModeChange as EventListener);
    return () => window.removeEventListener('modeChanged', handleModeChange as EventListener);
  }, []);

  const generateEmail = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const payload = {
        tone: selectedTone,
        user_mode: mode,
        variables: mockVariables,
        pinpoint_matches: JSON.parse(localStorage.getItem("pinpoint_matches") || "[]"),
        context_data: JSON.parse(localStorage.getItem("context_research") || "{}"),
      };

      const res = await api<ComposeResponse>("/compose/generate", "POST", payload);
      if (!res.success || !res.email_template) {
        throw new Error(res.message || "Failed to generate email.");
      }

      // If the user wants simplified copy, use the server-provided simplified_body.
      const tpl = simplifyLanguage
        ? { ...res.email_template, body: res.email_template.simplified_body }
        : res.email_template;

      setEmailTemplate(tpl);
      setHelper(res.helper || null);
      if (res.helper) {
        localStorage.setItem("compose_helper", JSON.stringify(res.helper));
      }
    } catch (err) {
      setError("Failed to generate email. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubjectChange = (newSubject: string) => {
    if (emailTemplate) {
      setEmailTemplate({ ...emailTemplate, subject: newSubject });
    }
  };

  const handleBodyChange = (newBody: string) => {
    if (emailTemplate) {
      setEmailTemplate({ ...emailTemplate, body: newBody });
    }
  };

  const handleContinue = () => {
    if (emailTemplate) {
      localStorage.setItem('composed_email', JSON.stringify(emailTemplate));
      router.push('/campaign');
    }
  };

  const getToneDescription = (tone: string) => {
    switch (tone) {
      case 'recruiter':
        return 'Efficiency-focused, quick decision making';
      case 'manager':
        return 'Proof of competence, team impact';
      case 'exec':
        return 'ROI/Strategy focused, business outcomes';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-6xl mx-auto px-4">
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Compose</h1>
            <p className="text-white/70">
              Generate your first email using all the data from previous steps.
            </p>
          </div>

          {/* Tone Selection */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Audience Tone</h2>
            <div className="flex space-x-4">
              {(['recruiter', 'manager', 'exec'] as const).map((tone) => (
                <label key={tone} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="tone"
                    value={tone}
                    checked={selectedTone === tone}
                    onChange={(e) => setSelectedTone(e.target.value as 'recruiter' | 'manager' | 'exec')}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium capitalize">{tone}</div>
                    <div className="text-sm text-gray-600">{getToneDescription(tone)}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Available Variables */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Available Variables</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mockVariables.map((variable, index) => (
                <div key={index} className="bg-black/20 border border-white/10 rounded-lg p-3">
                  <div className="font-medium text-white">{variable.name}</div>
                  <div className="text-sm text-white/70 mb-1">{variable.description}</div>
                  <div className="text-sm text-blue-600 font-mono">{variable.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Generate Email Button */}
          <div className="text-center mb-8">
            <button
              onClick={generateEmail}
              disabled={isGenerating}
              className="bg-blue-600 text-white px-8 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isGenerating ? "Generating Email..." : "Generate Email"}
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-white/10 rounded-md">
              <p className="text-red-200">{error}</p>
            </div>
          )}

          {/* Email Template */}
          {emailTemplate && (
            <div className="space-y-6">
              {/* Jargon Clarity Toggle */}
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simplifyLanguage}
                    onChange={(e) => setSimplifyLanguage(e.target.checked)}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium">Simplify Language (detect jargon & acronyms)</span>
                </label>
              </div>

              {/* Subject Line */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={emailTemplate.subject}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>

              {/* Email Body */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Body
                </label>
                <textarea
                  value={simplifyLanguage ? emailTemplate.simplified_body : emailTemplate.body}
                  onChange={(e) => handleBodyChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 h-64"
                />
              </div>

              {/* Jargon Terms Detected */}
              {emailTemplate.jargon_terms.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Detected Jargon & Acronyms</h3>
                  <div className="space-y-2">
                    {emailTemplate.jargon_terms.map((term, index) => (
                      <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-yellow-800">{term.term}</span>
                            <span className="text-sm text-yellow-600 ml-2">({term.category})</span>
                          </div>
                          <div className="text-sm text-yellow-700">{term.definition}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Preview</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <div className="font-medium text-gray-900 mb-2">Subject: {emailTemplate.subject}</div>
                  <div className="text-gray-700 whitespace-pre-wrap">
                    {simplifyLanguage ? emailTemplate.simplified_body : emailTemplate.body}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => router.push('/offer-creation')}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-md font-medium hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleContinue}
                  className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                >
                  Continue to Campaign
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
