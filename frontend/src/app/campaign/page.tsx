"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import StarRating from "@/components/StarRating";

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
  overall_health_score: number;
  summary?: string;
  reports: Array<{
    step_number: number;
    health_score: number;
    spam_risk: 'low' | 'medium' | 'high';
    issues: string[];
    warnings: string[];
    subject_variants: string[];
    copy_tweaks: string[];
    improved_subject?: string | null;
    improved_body?: string | null;
  }>;
}

export default function CampaignPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'job-seeker' | 'recruiter'>('job-seeker');
  const [contacts, setContacts] = useState<any[]>([]);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [campaignByContact, setCampaignByContact] = useState<Record<string, Campaign>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [deliverabilityCheck, setDeliverabilityCheck] = useState<DeliverabilityCheck | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composeHelper, setComposeHelper] = useState<any>(null);
  const [previewWithValues, setPreviewWithValues] = useState(false);

  const campaign: Campaign | null = activeContactId ? (campaignByContact[activeContactId] || null) : null;

  const applyVariables = (text: string, vars: Record<string, string>) => {
    let out = text;
    for (const [k, v] of Object.entries(vars)) {
      if (!k) continue;
      out = out.split(k).join(v ?? "");
    }
    return out;
  };

  const activeVarMap = useMemo(() => {
    const map: Record<string, string> = {};
    try {
      const composedRaw = localStorage.getItem("composed_email");
      const composed = composedRaw ? JSON.parse(composedRaw) : null;
      const vars = composed?.variables || [];
      for (const v of vars) {
        if (v?.name) map[String(v.name)] = String(v.value ?? "");
      }
    } catch {}

    // Override with active contact info so preview is accurate per person.
    const c = contacts.find((x: any) => String(x?.id || "") === String(activeContactId || ""));
    const first = String(c?.name || "").trim().split(" ")[0] || "there";
    if (first) map["{{first_name}}"] = first;
    if (c?.company) map["{{company_name}}"] = String(c.company);

    return map;
  }, [activeContactId, contacts]);

  useEffect(() => {
    // Load mode from localStorage
    const stored = localStorage.getItem("rf_mode");
    if (stored === 'recruiter') {
      setMode('recruiter');
    }
    
    // Load contacts for per-contact editing
    try {
      const selected = JSON.parse(localStorage.getItem("selected_contacts") || "[]");
      if (Array.isArray(selected)) {
        setContacts(selected);
        if (selected.length) setActiveContactId(String(selected[0]?.id || ""));
      }
    } catch {}

    // Load composed email from previous step
    const composedEmail = localStorage.getItem('composed_email');
    if (composedEmail) {
      const emailData = JSON.parse(composedEmail);
      generateCampaign(emailData);
    }

    // Load helper suggestions from Compose
    const helperRaw = localStorage.getItem("compose_helper");
    if (helperRaw) {
      try { setComposeHelper(JSON.parse(helperRaw)); } catch {}
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

      // Pull variable values from the composed email (if present) so the campaign preview
      // feels realistic instead of showing raw {{placeholders}}.
      const variableMap: Record<string, string> = {};
      try {
        const vars = composedEmail?.variables || [];
        for (const v of vars) {
          if (v?.name) variableMap[String(v.name)] = String(v.value ?? "");
        }
      } catch {}

      // Generate 3 emails based on composed email (keep placeholders; no substitution)
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
          body:
            `Hi {{first_name}},\n\n`
            + `Quick follow-up on my note about the {{job_title}} role at {{company_name}}.\n\n`
            + `If helpful, I can share a 2–3 bullet plan for {{painpoint_1}}.\n\n`
            + `Best,\n[Your Name]`,
          delay_days: 2,
          delay_hours: 0,
          stop_on_reply: true,
          variables: {}
        },
        {
          id: "email_3",
          step_number: 3,
          subject: `Final follow-up — {{job_title}} @ {{company_name}}`,
          body:
            `Hi {{first_name}},\n\n`
            + `Last follow-up — happy to share specifics if it’s useful.\n\n`
            + `Best,\n[Your Name]`,
          delay_days: 4,
          delay_hours: 0,
          stop_on_reply: true,
          variables: {}
        }
      ];

      const selectedContacts = (() => {
        try {
          const sel = JSON.parse(localStorage.getItem("selected_contacts") || "[]");
          return Array.isArray(sel) ? sel : [];
        } catch {
          return [];
        }
      })();
      const now = new Date().toISOString();
      const byContact: Record<string, Campaign> = {};
      for (const c of selectedContacts) {
        const cid = String(c?.id || "");
        if (!cid) continue;
        byContact[cid] = {
          id: `campaign_${cid}`,
          name: `${mode === 'job-seeker' ? 'Job Application' : 'Candidate Pitch'} Campaign`,
          status: 'draft',
          emails: emails.map((e) => ({ ...e })),
          created_at: now,
          updated_at: now,
        };
      }
      setCampaignByContact(byContact);
    } catch (err) {
      setError("Failed to generate campaign. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const runDeliverabilityCheck = async () => {
    try {
      if (!campaign) return;
      setError(null);
      // Use backend GPT deliverability analyzer (with deterministic fallback)
      const contacts = (() => {
        try {
          return JSON.parse(localStorage.getItem("selected_contacts") || "[]");
        } catch {
          return [];
        }
      })();

      const resp = await api<any>("/deliverability-launch/check", "POST", {
        emails: campaign.emails.map((e) => ({
          id: e.id,
          step_number: e.step_number,
          subject: applyVariables(e.subject, activeVarMap),
          body: applyVariables(e.body, activeVarMap),
          delay_days: e.delay_days,
        })),
        contacts,
        user_mode: mode,
      });

      if (!resp?.success) throw new Error(resp?.message || "Deliverability check failed");
      setDeliverabilityCheck({
        overall_health_score: Number(resp.overall_health_score ?? 0) || 0,
        summary: resp.summary || "",
        reports: Array.isArray(resp.reports) ? resp.reports : [],
      });
    } catch (err) {
      setError("Failed to run deliverability check.");
    }
  };

  const updateEmailStep = (stepId: string, updates: Partial<EmailStep>) => {
    if (!activeContactId) return;
    setCampaignByContact((prev) => {
      const cur = prev[activeContactId];
      if (!cur) return prev;
      const updatedEmails = cur.emails.map((email) => (email.id === stepId ? { ...email, ...updates } : email));
      return { ...prev, [activeContactId]: { ...cur, emails: updatedEmails, updated_at: new Date().toISOString() } };
    });
  };

  const handleContinue = () => {
    if (campaign) {
      try {
        localStorage.setItem('campaign_by_contact', JSON.stringify(campaignByContact));
        if (activeContactId) localStorage.setItem('campaign_active_contact_id', String(activeContactId));
      } catch {}
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

  const applyDeliverabilityFix = (stepNumber: number) => {
    if (!campaign || !deliverabilityCheck) return;
    const report = deliverabilityCheck.reports.find((r) => r.step_number === stepNumber);
    if (!report) return;
    const improvedSubject = String(report.improved_subject || "").trim();
    const improvedBody = String(report.improved_body || "").trim();
    if (!improvedSubject && !improvedBody) return;

    const target = campaign.emails.find((e) => e.step_number === stepNumber);
    if (!target) return;
    updateEmailStep(target.id, {
      subject: improvedSubject || target.subject,
      body: improvedBody || target.body,
    });
  };

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-4">
          <a href="/compose" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
            <span className="mr-2">←</span> Back to Compose
          </a>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Campaign</h1>
            <p className="text-white/70">
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
              <h3 className="text-lg font-medium text-white mb-2">Generating Campaign...</h3>
              <p className="text-white/70">Creating your 3-email sequence with optimal timing and messaging.</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Error</h3>
              <p className="text-white/70 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : campaign ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Contacts column (wireframe-style) */}
              <div className="lg:col-span-3">
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="text-sm font-bold text-white mb-3">Contacts</div>
                  {contacts.length === 0 ? (
                    <div className="text-sm text-white/60">No contacts selected.</div>
                  ) : (
                    <div className="space-y-2">
                      {contacts.map((c: any) => {
                        const cid = String(c?.id || "");
                        const active = cid && cid === String(activeContactId || "");
                        const title = String(c?.title || "").trim();
                        const company = String(c?.company || "").trim();
                        return (
                          <button
                            key={cid || String(c?.email || Math.random())}
                            type="button"
                            onClick={() => {
                              if (!cid) return;
                              setActiveContactId(cid);
                              setDeliverabilityCheck(null);
                            }}
                            className={`w-full text-left rounded-lg border p-3 transition-colors ${
                              active
                                ? "border-blue-400/60 bg-blue-500/10"
                                : "border-white/10 bg-white/5 hover:bg-white/10"
                            }`}
                          >
                            <div className="text-sm font-semibold text-white">{String(c?.name || "Contact")}</div>
                            <div className="text-xs text-white/60">
                              {(title ? title : "Decision maker") + (company ? ` • ${company}` : "")}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Main editor */}
              <div className="lg:col-span-9 space-y-8">
              {composeHelper?.variants?.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="text-sm font-bold text-white">GPT Helper: variants (full)</div>
                    {composeHelper?.rationale && (
                      <div className="text-xs text-white/60">{composeHelper.rationale}</div>
                    )}
                  </div>
                  <div className="space-y-3 text-sm">
                    {composeHelper.variants.map((v: any, idx: number) => (
                      <div key={`${v.label || "variant"}_${idx}`} className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-white/90 font-semibold">
                              {v.label || `variant_${idx + 1}`}
                              {v.audience_tone ? (
                                <span className="ml-2 text-xs text-white/60">({v.audience_tone})</span>
                              ) : null}
                            </div>
                            {v.intended_for ? (
                              <div className="mt-1 text-xs text-white/60">{v.intended_for}</div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!campaign) return;
                              const first = campaign.emails.find((e) => e.step_number === 1);
                              if (!first) return;
                              updateEmailStep(first.id, {
                                subject: String(v.subject || first.subject),
                                body: String(v.body || first.body),
                              });
                            }}
                            className="shrink-0 px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                            disabled={!campaign}
                          >
                            Use as Email 1
                          </button>
                        </div>
                        <div className="mt-2 text-white/80">Subject: {v.subject}</div>
                        <pre className="mt-2 whitespace-pre-wrap text-white/70">{String(v.body || "")}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Campaign Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">{campaign.name}</h2>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                      {campaign.status.toUpperCase()}
                    </span>
                    <span className="text-sm text-white/70">
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

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-white/60">
                  Select a contact on the left to edit their outreach (coming next in this rollout).
                </div>
                <label className="flex items-center gap-2 text-xs text-white/70">
                  <input
                    type="checkbox"
                    checked={previewWithValues}
                    onChange={(e) => setPreviewWithValues(e.target.checked)}
                  />
                  Preview with values
                </label>
              </div>

              {/* Deliverability Check Results */}
              {deliverabilityCheck && (
                <div className="bg-black/20 border border-white/10 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Deliverability Check</h3>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                      <div className={`text-2xl font-bold ${getHealthScoreColor(deliverabilityCheck.overall_health_score)}`}>
                        {deliverabilityCheck.overall_health_score}%
                      </div>
                      <div className="text-sm text-white/70">Overall health score</div>
                      <div className="mt-1">
                        <StarRating value={deliverabilityCheck.overall_health_score} scale="percent" showNumeric />
                      </div>
                    </div>
                    {deliverabilityCheck.summary ? (
                      <div className="text-sm text-white/70 md:max-w-2xl">
                        <span className="font-semibold text-white/80">Summary:</span> {deliverabilityCheck.summary}
                      </div>
                    ) : null}
                  </div>

                  {deliverabilityCheck.reports?.length ? (
                    <div className="space-y-4">
                      {deliverabilityCheck.reports.map((r) => (
                        <div key={`rep_${r.step_number}`} className="rounded-lg border border-white/10 bg-black/20 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-white">
                                Step {r.step_number} •{" "}
                                <span className={getHealthScoreColor(r.health_score)}>{r.health_score}%</span>{" "}
                                <span className="text-white/60">({r.spam_risk} risk)</span>
                              </div>
                              {(r.issues?.length || r.warnings?.length) ? (
                                <ul className="mt-2 text-sm text-white/70 list-disc list-inside space-y-1">
                                  {(r.issues || []).slice(0, 4).map((x, i) => (
                                    <li key={`i_${r.step_number}_${i}`} className="text-red-200">{x}</li>
                                  ))}
                                  {(r.warnings || []).slice(0, 4).map((x, i) => (
                                    <li key={`w_${r.step_number}_${i}`}>{x}</li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="mt-2 text-sm text-white/70">No major issues detected.</div>
                              )}

                              {r.subject_variants?.length ? (
                                <div className="mt-3 text-sm text-white/70">
                                  <div className="font-semibold text-white/80 mb-1">Safer subject variants</div>
                                  <ul className="list-disc list-inside space-y-1">
                                    {r.subject_variants.slice(0, 3).map((s, i) => (
                                      <li key={`sv_${r.step_number}_${i}`}>{s}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}

                              {r.copy_tweaks?.length ? (
                                <div className="mt-3 text-sm text-white/70">
                                  <div className="font-semibold text-white/80 mb-1">Copy tweaks</div>
                                  <ul className="list-disc list-inside space-y-1">
                                    {r.copy_tweaks.slice(0, 5).map((t, i) => (
                                      <li key={`ct_${r.step_number}_${i}`}>{t}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </div>

                            {(r.improved_subject || r.improved_body) ? (
                              <button
                                type="button"
                                onClick={() => applyDeliverabilityFix(r.step_number)}
                                className="shrink-0 px-3 py-2 rounded-md bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
                              >
                                Apply fixes
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
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

                        {previewWithValues ? (
                          <div className="rounded-md border border-white/10 bg-white/5 p-3">
                            <div className="text-xs font-semibold text-white/80 mb-2">Preview (with values)</div>
                            <div className="text-xs text-white/70 mb-2">
                              Subject: {applyVariables(email.subject, activeVarMap)}
                            </div>
                            <pre className="whitespace-pre-wrap text-sm text-white/70">
                              {applyVariables(email.body, activeVarMap)}
                            </pre>
                          </div>
                        ) : null}

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
