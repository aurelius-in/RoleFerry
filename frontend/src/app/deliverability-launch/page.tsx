"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface PreFlightCheck {
  name: string;
  status: 'pending' | 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

interface LaunchResult {
  success: boolean;
  message: string;
  campaign_id?: string;
  emails_sent?: number;
  scheduled_emails?: number;
  errors?: string[];
}

export default function DeliverabilityLaunchPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'job-seeker' | 'recruiter'>('job-seeker');
  const [campaign, setCampaign] = useState<any>(null);
  const [preFlightChecks, setPreFlightChecks] = useState<PreFlightCheck[]>([]);
  const [isRunningChecks, setIsRunningChecks] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSelectedContacts = (): any[] => {
    try {
      const selected = localStorage.getItem("selected_contacts");
      if (selected) return JSON.parse(selected);
    } catch {}
    try {
      const found = localStorage.getItem("found_contacts");
      const all = found ? JSON.parse(found) : [];
      return Array.isArray(all) ? all.slice(0, 2) : [];
    } catch {}
    return [];
  };

  useEffect(() => {
    // Load mode from localStorage
    const stored = localStorage.getItem("rf_mode");
    if (stored === 'recruiter') {
      setMode('recruiter');
    }
    
    // Load campaign data from previous step
    const campaignData = localStorage.getItem('campaign_data');
    if (campaignData) {
      setCampaign(JSON.parse(campaignData));
    }
    
    // Listen for mode changes
    const handleModeChange = (event: CustomEvent) => {
      setMode(event.detail);
    };
    
    window.addEventListener('modeChanged', handleModeChange as EventListener);
    return () => window.removeEventListener('modeChanged', handleModeChange as EventListener);
  }, []);

  const runPreFlightChecks = async () => {
    setIsRunningChecks(true);
    setError(null);

    try {
      if (!campaign) {
        throw new Error("No campaign data available");
      }

      const payload = {
        campaign_id: campaign.id,
        emails: campaign.emails,
        contacts: loadSelectedContacts(),
      };
      const checks = await api<PreFlightCheck[]>(
        "/deliverability-launch/pre-flight-checks",
        "POST",
        payload
      );
      setPreFlightChecks(checks);
    } catch (err) {
      setError("Failed to run pre-flight checks.");
    } finally {
      setIsRunningChecks(false);
    }
  };

  const launchCampaign = async () => {
    setIsLaunching(true);
    setError(null);

    try {
      if (!campaign) {
        throw new Error("No campaign data available");
      }
      const payload = {
        campaign_id: campaign.id,
        emails: campaign.emails,
        contacts: loadSelectedContacts(),
      };
      const result = await api<LaunchResult>(
        "/deliverability-launch/launch",
        "POST",
        payload
      );
      setLaunchResult(result);
    } catch (err) {
      setError("Failed to launch campaign.");
    } finally {
      setIsLaunching(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <div className="w-4 h-4 bg-gray-300 rounded-full animate-pulse"></div>;
      case 'pass':
        return <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>;
      case 'fail':
        return <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>;
      case 'warning':
        return <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>;
      default:
        return <div className="w-4 h-4 bg-gray-300 rounded-full"></div>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'text-green-600';
      case 'fail': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const allChecksPassed = preFlightChecks.length > 0 && preFlightChecks.every(check => check.status === 'pass' || check.status === 'warning');
  const hasFailures = preFlightChecks.some(check => check.status === 'fail');

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-6xl mx-auto px-4">
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Deliverability / Launch</h1>
            <p className="text-white/70">
              {mode === 'job-seeker' 
                ? 'Final checks before launching your job application campaign.'
                : 'Final checks before launching your candidate pitch campaign.'
              }
            </p>
          </div>

          {!campaign ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No Campaign Data</h3>
              <p className="text-white/70 mb-6">
                Please complete the Campaign step first to launch your sequence.
              </p>
              <button
                onClick={() => router.push('/campaign')}
                className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                Go to Campaign
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Campaign Summary */}
              <div className="bg-blue-50 border border-white/10 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Campaign Summary</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-white/70">Campaign Name</div>
                    <div className="font-semibold text-white">{campaign.name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-white/70">Total Emails</div>
                    <div className="font-semibold text-white">{campaign.emails.length}</div>
                  </div>
                  <div>
                    <div className="text-sm text-white/70">Total Duration</div>
                    <div className="font-semibold text-white">
                      {campaign.emails.reduce((total: number, email: any) => total + email.delay_days, 0)} days
                    </div>
                  </div>
                </div>
              </div>

              {/* Pre-Flight Checks */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">Pre-Flight Checks</h2>
                  <button
                    onClick={runPreFlightChecks}
                    disabled={isRunningChecks}
                    className="bg-orange-600 text-white px-4 py-2 rounded-md font-medium hover:bg-orange-700 transition-colors disabled:opacity-50"
                  >
                    {isRunningChecks ? "Running Checks..." : "Run Pre-Flight Checks"}
                  </button>
                </div>

                {preFlightChecks.length > 0 && (
                  <div className="space-y-4">
                    {preFlightChecks.map((check, index) => (
                      <div
                        key={index}
                        className={`flex items-center space-x-4 p-4 rounded-lg border ${
                          check.name === "GPT Deliverability Helper"
                            ? "border-orange-400/30 bg-orange-500/10"
                            : "border-white/10 bg-black/20"
                        }`}
                      >
                        {getStatusIcon(check.status)}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium text-white">{check.name}</h3>
                            <span className={`text-sm font-medium ${getStatusColor(check.status)}`}>
                              {check.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-white/70 mt-1">{check.message}</p>
                          {check.details && (
                            <p className="text-sm text-white/70 mt-1 whitespace-pre-wrap">{check.details}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Launch Section */}
              {preFlightChecks.length > 0 && (
                <div className="bg-black/20 border border-white/10 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-white mb-4">Launch Campaign</h2>
                  
                  {hasFailures ? (
                    <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="text-red-800 font-medium">Cannot launch - some checks failed</span>
                      </div>
                      <p className="text-red-700 text-sm mt-1">Please fix the failed checks before launching.</p>
                    </div>
                  ) : allChecksPassed ? (
                    <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-green-800 font-medium">All checks passed - ready to launch!</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-yellow-800 font-medium">Run pre-flight checks first</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={launchCampaign}
                    disabled={!allChecksPassed || isLaunching}
                    className="bg-green-600 text-white px-8 py-3 rounded-md font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLaunching ? "Launching Campaign..." : "Launch Campaign"}
                  </button>
                </div>
              )}

              {/* Launch Result */}
              {launchResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <div className="flex items-center mb-4">
                    <svg className="w-6 h-6 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <h2 className="text-xl font-semibold text-green-900">Campaign Launched Successfully!</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-green-700">Campaign ID</div>
                      <div className="font-semibold text-green-900">{launchResult.campaign_id}</div>
                    </div>
                    <div>
                      <div className="text-sm text-green-700">Emails Sent</div>
                      <div className="font-semibold text-green-900">{launchResult.emails_sent}</div>
                    </div>
                    <div>
                      <div className="text-sm text-green-700">Scheduled</div>
                      <div className="font-semibold text-green-900">{launchResult.scheduled_emails}</div>
                    </div>
                  </div>
                  
                  <p className="text-green-800">{launchResult.message}</p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-red-800 font-medium">Error</span>
                  </div>
                  <p className="text-red-700 text-sm mt-1">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => router.push('/campaign')}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-md font-medium hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                {launchResult && (
                  <button
                    onClick={() => router.push('/analytics')}
                    className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                  >
                    View Analytics
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
