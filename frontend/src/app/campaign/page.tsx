"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface EmailStep {
  id: string;
  step_number: number;
  subject: string;
  body: string;
  delay_days: number;
  delay_hours: number;
  stop_on_reply: boolean;
  variables: Record<string, string>;
}

interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  emails: EmailStep[];
  created_at: string;
  updated_at: string;
}

interface DeliverabilityCheck {
  spam_score: number;
  dns_valid: boolean;
  bounce_rate: number;
  health_score: number;
  warnings: string[];
}

export default function CampaignPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'job-seeker' | 'recruiter'>('job-seeker');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deliverabilityCheck, setDeliverabilityCheck] = useState<DeliverabilityCheck | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load mode from localStorage
    const stored = localStorage.getItem("rf_mode");
    if (stored === 'recruiter') {
      setMode('recruiter');
    }
    
    // Load composed email from previous step
    const composedEmail = localStorage.getItem('composed_email');
    if (composedEmail) {
      const emailData = JSON.parse(composedEmail);
      generateCampaign(emailData);
    }
    
    // Listen for mode changes
    const handleModeChange = (event: CustomEvent) => {
      setMode(event.detail);
    };
    
    window.addEventListener('modeChanged', handleModeChange as EventListener);
    return () => window.removeEventListener('modeChanged', handleModeChange as EventListener);
  }, []);

  const generateCampaign = async (composedEmail: any) => {
    setIsGenerating(true);
    setError(null);

    try {
      // Simulate API call to generate 3-email campaign
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Generate 3 emails based on composed email
      const emails: EmailStep[] = [
        {
          id: "email_1",
          step_number: 1,
          subject: composedEmail.subject,
          body: composedEmail.body,
          delay_days: 0,
          delay_hours: 0,
          stop_on_reply: true,
          variables: {}
        },
        {
          id: "email_2",
          step_number: 2,
          subject: `Re: ${composedEmail.subject}`,
          body: `Hi {{first_name}},\n\nJust following up on my previous message about the {{job_title}} role. I wanted to make sure you received it and see if you'd be open to a brief conversation.\n\nI'm confident my experience with {{pinpoint_1}} would be valuable for your team.\n\nBest regards,\n[Your Name]`,
          delay_days: 2,
          delay_hours: 0,
          stop_on_reply: true,
          variables: {}
        },
        {
          id: "email_3",
          step_number: 3,
          subject: `Final follow-up - {{job_title}} at {{company_name}}`,
          body: `Hi {{first_name}},\n\nI know you're busy, so I'll keep this brief. I'm still very interested in the {{job_title}} position and believe I could make an immediate impact.\n\nIf now isn't the right time, I completely understand. I'd appreciate being kept in mind for future opportunities.\n\nThanks for your time,\n[Your Name]`,
          delay_days: 4,
          delay_hours: 0,
          stop_on_reply: true,
          variables: {}
        }
      ];

      const newCampaign: Campaign = {
        id: "campaign_1",
        name: `${mode === 'job-seeker' ? 'Job Application' : 'Candidate Pitch'} Campaign`,
        status: 'draft',
        emails,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      setCampaign(newCampaign);
    } catch (err) {
      setError("Failed to generate campaign. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const runDeliverabilityCheck = async () => {
    try {
      // Simulate deliverability check
      await new Promise(resolve => setTimeout(resolve, 1500));

      const check: DeliverabilityCheck = {
        spam_score: 2.1,
        dns_valid: true,
        bounce_rate: 0.02,
        health_score: 85,
        warnings: [
          "Consider reducing exclamation marks",
          "Add more personalization to subject lines"
        ]
      };

      setDeliverabilityCheck(check);
    } catch (err) {
      setError("Failed to run deliverability check.");
    }
  };

  const updateEmailStep = (stepId: string, updates: Partial<EmailStep>) => {
    if (campaign) {
      const updatedEmails = campaign.emails.map(email => 
        email.id === stepId ? { ...email, ...updates } : email
      );
      setCampaign({ ...campaign, emails: updatedEmails, updated_at: new Date().toISOString() });
    }
  };

  const handleContinue = () => {
    if (campaign) {
      localStorage.setItem('campaign_data', JSON.stringify(campaign));
      router.push('/deliverability-launch');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Campaign</h1>
            <p className="text-gray-600">
              {mode === 'job-seeker' 
                ? 'Your 3-email outreach sequence to land the job.'
                : 'Your 3-email sequence to pitch the candidate.'
              }
            </p>
          </div>

          {isGenerating ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Generating Campaign...</h3>
              <p className="text-gray-600">Creating your 3-email sequence with optimal timing and messaging.</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : campaign ? (
            <div className="space-y-8">
              {/* Campaign Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{campaign.name}</h2>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                      {campaign.status.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-600">
                      {campaign.emails.length} emails • {campaign.emails.reduce((total, email) => total + email.delay_days, 0)} days total
                    </span>
                  </div>
                </div>
                <button
                  onClick={runDeliverabilityCheck}
                  className="bg-orange-600 text-white px-4 py-2 rounded-md font-medium hover:bg-orange-700 transition-colors"
                >
                  Check Deliverability
                </button>
              </div>

              {/* Deliverability Check Results */}
              {deliverabilityCheck && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Deliverability Check</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <div className={`text-2xl font-bold ${getHealthScoreColor(deliverabilityCheck.health_score)}`}>
                        {deliverabilityCheck.health_score}%
                      </div>
                      <div className="text-sm text-gray-600">Health Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{deliverabilityCheck.spam_score}</div>
                      <div className="text-sm text-gray-600">Spam Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{deliverabilityCheck.bounce_rate}%</div>
                      <div className="text-sm text-gray-600">Bounce Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {deliverabilityCheck.dns_valid ? '✓' : '✗'}
                      </div>
                      <div className="text-sm text-gray-600">DNS Valid</div>
                    </div>
                  </div>
                  {deliverabilityCheck.warnings.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Warnings:</h4>
                      <ul className="list-disc list-inside text-sm text-gray-600">
                        {deliverabilityCheck.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Email Steps */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Email Sequence</h3>
                <div className="space-y-6">
                  {campaign.emails.map((email, index) => (
                    <div key={email.id} className="border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                            Step {email.step_number}
                          </div>
                          <div className="text-sm text-gray-600">
                            {email.delay_days > 0 ? `+${email.delay_days} days` : 'Immediate'}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={email.stop_on_reply}
                              onChange={(e) => updateEmailStep(email.id, { stop_on_reply: e.target.checked })}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-600">Stop on reply</span>
                          </label>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Subject Line
                          </label>
                          <input
                            type="text"
                            value={email.subject}
                            onChange={(e) => updateEmailStep(email.id, { subject: e.target.value })}
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email Body
                          </label>
                          <textarea
                            value={email.body}
                            onChange={(e) => updateEmailStep(email.id, { body: e.target.value })}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 h-32"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Delay (Days)
                            </label>
                            <input
                              type="number"
                              value={email.delay_days}
                              onChange={(e) => updateEmailStep(email.id, { delay_days: parseInt(e.target.value) || 0 })}
                              className="w-full border border-gray-300 rounded-md px-3 py-2"
                              min="0"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Delay (Hours)
                            </label>
                            <input
                              type="number"
                              value={email.delay_hours}
                              onChange={(e) => updateEmailStep(email.id, { delay_hours: parseInt(e.target.value) || 0 })}
                              className="w-full border border-gray-300 rounded-md px-3 py-2"
                              min="0"
                              max="23"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => router.push('/compose')}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-md font-medium hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleContinue}
                  className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                >
                  Continue to Launch
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Campaign Data</h3>
              <p className="text-gray-600 mb-6">
                Please complete the Compose step first to generate your campaign.
              </p>
              <button
                onClick={() => router.push('/compose')}
                className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                Go to Compose
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
