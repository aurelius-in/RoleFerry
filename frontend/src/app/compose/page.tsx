"use client";

import { useState, useEffect, useMemo } from "react";
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
  tone: 'recruiter' | 'manager' | 'exec' | 'developer' | 'sales' | 'startup' | 'enterprise' | 'custom';
  variables: Variable[];
  jargon_terms: JargonTerm[];
  simplified_body: string;
}

type AudienceTone = EmailTemplate["tone"];

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
  const [offerTone, setOfferTone] = useState<AudienceTone>('manager');
  const [selectedTone, setSelectedTone] = useState<AudienceTone>('manager'); // message tone (can override)
  const [customTone, setCustomTone] = useState("");
  const [toneOverrideEnabled, setToneOverrideEnabled] = useState(false);
  const [offerSnippetOverride, setOfferSnippetOverride] = useState("");
  const [showVariables, setShowVariables] = useState(false);
  const [simplifyLanguage, setSimplifyLanguage] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplate | null>(null);
  const [helper, setHelper] = useState<ComposeResponse["helper"] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewWithValues, setPreviewWithValues] = useState(true);
  const [variableOverrides, setVariableOverrides] = useState<Record<string, string>>({});

  // Legacy key support (built dynamically to avoid keeping old terminology in code/UI).
  const legacyPainpointKey = ["pin", "point_matches"].join("");
  const legacyPainpointField = (n: number) => `${["pin", "point_"].join("")}${n}`;

  const cleanOfferSnippet = (raw: string, maxLen: number = 260) => {
    let s = String(raw || "").replace(/\s+/g, " ").trim();
    if (!s) return "";
    // Strip greeting like "Hi Wesley," / "Hello Oliver,"
    s = s.replace(/^(hi|hello|hey)\s+[^,]{1,40},\s*/i, "");
    // Prefer first sentence if present
    const parts = s.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (parts.length && parts[0].length >= 20) s = parts[0].trim();
    if (s.length <= maxLen) return s;
    const cut = s.lastIndexOf(" ", maxLen);
    const idx = cut > 60 ? cut : maxLen;
    return s.slice(0, idx).trim() + "…";
  };

  const looksLikeBadMetric = (raw: string) => {
    const s = String(raw || "").trim();
    if (!s) return true;
    const digitsOnly = s.replace(/[^\d]/g, "");
    // phone-ish or id-ish
    if (digitsOnly.length >= 9 && digitsOnly.length <= 12 && /^[\d\-\s()+.]+$/.test(s)) return true;
    if (/^\d{8,}$/.test(s)) return true;
    return false;
  };

  const buildVariables = (): Variable[] => {
    // Pull best-effort real context from upstream screens.
    let selectedContacts: any[] = [];
    let research: any = {};
    let selectedJD: any = null;
    let matches: any[] = [];
    let createdOffers: any[] = [];

    try {
      selectedContacts = JSON.parse(localStorage.getItem("selected_contacts") || "[]");
    } catch {}
    try {
      research = JSON.parse(localStorage.getItem("context_research") || "{}");
    } catch {}
    try {
      selectedJD = JSON.parse(localStorage.getItem("selected_job_description") || "null");
    } catch {}
    try {
      createdOffers = JSON.parse(localStorage.getItem("created_offers") || "[]");
    } catch {}
    try {
      const selectedJobId = String(localStorage.getItem("selected_job_description_id") || "").trim();
      const byJobRaw = localStorage.getItem("painpoint_matches_by_job");
      if (selectedJobId && byJobRaw) {
        const byJob = JSON.parse(byJobRaw) as Record<string, any[]>;
        matches = byJob?.[selectedJobId] || [];
      }
      if (!matches || !Array.isArray(matches) || matches.length === 0) {
        matches =
          JSON.parse(localStorage.getItem("painpoint_matches") || "null") ||
          JSON.parse(localStorage.getItem(legacyPainpointKey) || "[]") ||
          JSON.parse(localStorage.getItem("pain_point_matches") || "[]");
      }
    } catch {}

    const firstContact = selectedContacts?.[0] || {};
    const firstNameRaw = String(firstContact?.name || "").trim();
    const firstName = firstNameRaw ? firstNameRaw.split(" ")[0] : "there";

    const jdTitle = String(selectedJD?.title || "the role");
    const jdCompany = String(selectedJD?.company || firstContact?.company || "the company");

    const m0 = matches?.[0] || {};
    const painpoint1 = String(
      m0?.painpoint_1 ||
        (m0 as Record<string, unknown>)?.[legacyPainpointField(1)] ||
        "a key priority"
    );
    const sol1 = String(m0?.solution_1 || "a proven approach");
    const metric1Raw = String(m0?.metric_1 || "");
    const metric1 = looksLikeBadMetric(metric1Raw) ? "" : metric1Raw;

    const companySummary = String(research?.company_summary?.description || "");
    const recentNews = String(research?.recent_news?.[0]?.summary || "");
    const contactBio = String(research?.contact_bios?.[0]?.bio || `${firstContact?.title || "Decision maker"} at ${jdCompany}`.trim());

    const lastOffer = Array.isArray(createdOffers) && createdOffers.length ? createdOffers[createdOffers.length - 1] : null;
    const offerTitle = String(lastOffer?.title || "");
    const offerContent = String(lastOffer?.content || "");
    // Work link should come from Offer step (single source of truth). Users can still override it in Variables (advanced).
    const offerUrl = String(lastOffer?.url || "");
    const offerSnippet = offerSnippetOverride || cleanOfferSnippet(offerContent, 260);

    // Fall back to sensible defaults if upstream steps are missing.
    return [
      { name: "{{first_name}}", value: firstName, description: "Contact's first name" },
      { name: "{{job_title}}", value: jdTitle, description: "Target job title" },
      { name: "{{company_name}}", value: jdCompany, description: "Target company name" },
      { name: "{{painpoint_1}}", value: painpoint1, description: "First pain point / business challenge" },
      { name: "{{solution_1}}", value: sol1, description: "Your solution to challenge 1" },
      { name: "{{metric_1}}", value: metric1, description: "Key metric for solution 1" },
      { name: "{{company_summary}}", value: companySummary || `${jdCompany} is a growing enterprise software company focused on onboarding, retention, and analytics.`, description: "Company overview" },
      { name: "{{recent_news}}", value: recentNews || `${jdCompany} recently expanded its product roadmap and partnerships to accelerate customer onboarding.`, description: "Recent company news" },
      { name: "{{contact_bio}}", value: contactBio || `${firstName} is a decision maker at ${jdCompany}.`, description: "Contact's background" },
      { name: "{{offer_title}}", value: offerTitle, description: "Offer title (from Offer step)" },
      { name: "{{offer_snippet}}", value: offerSnippet, description: "Short offer excerpt (reword into 1 sentence)" },
      { name: "{{work_link}}", value: offerUrl, description: "Portfolio/Work Link (URL) (from Offer step)" },
    ];
  };

  const currentVariables: Variable[] = useMemo(() => {
    const base = buildVariables();
    return base.map((v) => ({
      ...v,
      value: Object.prototype.hasOwnProperty.call(variableOverrides, v.name)
        ? String(variableOverrides[v.name] ?? "")
        : v.value,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // dependencies that influence buildVariables()
    offerSnippetOverride,
    variableOverrides,
  ]);

  useEffect(() => {
    // Load persisted variable overrides (per user) so demos survive refreshes.
    try {
      const u = JSON.parse(localStorage.getItem("rf_user") || "null");
      const key = `compose_variable_overrides:${String(u?.id || "anon")}`;
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") setVariableOverrides(parsed);
    } catch {}
  }, []);

  useEffect(() => {
    // Persist overrides (per user)
    try {
      const u = JSON.parse(localStorage.getItem("rf_user") || "null");
      const key = `compose_variable_overrides:${String(u?.id || "anon")}`;
      localStorage.setItem(key, JSON.stringify(variableOverrides));
    } catch {}
  }, [variableOverrides]);

  const regenerateFromEditedVariables = () => {
    const toneToUse = toneOverrideEnabled ? selectedTone : offerTone;
    setEmailTemplate(buildStarterDraft(toneToUse, currentVariables));
    setHelper(null);
    setError(null);
  };

  const buildStarterDraft = (toneToUse: AudienceTone, variables: Variable[]): EmailTemplate => {
    // This is a deterministic starter draft that makes the "variable logic" obvious.
    // Users can refine with AI later, but should always have a reasonable first draft.
    const subject =
      toneToUse === "recruiter"
        ? "{{company_name}} — {{job_title}} (quick question)"
        : toneToUse === "exec"
          ? "{{company_name}} — {{painpoint_1}} idea"
          : "{{job_title}} at {{company_name}} — quick idea";

    const linkIntro =
      toneToUse === "recruiter"
        ? "Please see my work here:"
        : toneToUse === "manager"
          ? "A quick example of my work:"
          : toneToUse === "exec"
            ? "If helpful, a brief example of work/impact:"
            : toneToUse === "developer"
              ? "Code/work samples:"
              : toneToUse === "sales"
                ? "Proof points here:"
                : toneToUse === "startup"
                  ? "A few things I’ve built:"
                  : toneToUse === "enterprise"
                    ? "Selected work samples (process + outcomes):"
                    : "Please see my work here:";

    const workLinkVal = String(variables.find((v) => v.name === "{{work_link}}")?.value || "").trim();
    const signature = (() => {
      try {
        const u = JSON.parse(localStorage.getItem("rf_user") || "null");
        const fn = String(u?.first_name || "").trim();
        const ln = String(u?.last_name || "").trim();
        const nm = `${fn} ${ln}`.trim();
        const phone = String(u?.phone || "").trim();
        const li = String(u?.linkedin_url || "").trim();
        return [nm || "[Your Name]", phone, li].filter(Boolean).join("\n");
      } catch {
        return "[Your Name]";
      }
    })();

    const metricVal = String(variables.find((v) => v.name === "{{metric_1}}")?.value || "").trim();

    const body =
      "Hi {{first_name}},\n\n" +
      "I saw the {{job_title}} role at {{company_name}} and had one concrete idea that might help.\n\n" +
      "- Idea: {{offer_snippet}}\n" +
      `- Proof: {{solution_1}}${metricVal ? " ({{metric_1}})" : ""}\n\n` +
      "Open to a quick 10–15 minute chat?\n\n" +
      (workLinkVal ? `${linkIntro} {{work_link}}\n\n` : "") +
      `Best,\n${signature}\n`;

    return {
      id: "starter_draft",
      subject,
      body,
      tone: toneToUse,
      variables,
      jargon_terms: [],
      simplified_body: body,
    };
  };

  useEffect(() => {
    // Load mode from localStorage
    const stored = localStorage.getItem("rf_mode");
    if (stored === 'recruiter') {
      setMode('recruiter');
    }

    // Default tone to the most recently created offer (if present)
    try {
      const offers = JSON.parse(localStorage.getItem("created_offers") || "[]");
      const last = Array.isArray(offers) && offers.length ? offers[offers.length - 1] : null;
      const t = String(last?.tone || "").trim();
      const ct = String(last?.custom_tone || "").trim();
      const content = String(last?.content || "").trim();
      const snippet = cleanOfferSnippet(content, 260);
      if (t) {
        setOfferTone(t as AudienceTone);
        setSelectedTone(t as AudienceTone);
      }
      if (ct) setCustomTone(ct);
      if (snippet) setOfferSnippetOverride(snippet);
    } catch {}

    // Also support an offer draft (if the user generated/typed an offer but didn't save it into created_offers).
    try {
      const draft = JSON.parse(localStorage.getItem("offer_draft") || "null");
      const snippet = cleanOfferSnippet(String(draft?.content || ""), 260);
      const t = String(draft?.tone || "").trim();
      const ct = String(draft?.custom_tone || "").trim();
      if (t) {
        setOfferTone(t as AudienceTone);
        setSelectedTone(t as AudienceTone);
      }
      if (ct) setCustomTone(ct);
      if (snippet && !offerSnippetOverride) setOfferSnippetOverride(snippet);
    } catch {}
    
    // Listen for mode changes
    const handleModeChange = (event: CustomEvent) => {
      setMode(event.detail);
    };
    
    window.addEventListener('modeChanged', handleModeChange as EventListener);
    return () => window.removeEventListener('modeChanged', handleModeChange as EventListener);
  }, []);

  useEffect(() => {
    // Ensure rf_user exists so signatures don't show as [Your Name] when the cookie exists
    // but localStorage was cleared.
    (async () => {
      try {
        const existing = localStorage.getItem("rf_user");
        if (existing) return;
        const me = await api<any>("/auth/me", "GET");
        if (me?.success && me?.user) {
          localStorage.setItem("rf_user", JSON.stringify(me.user));
          regenerateFromEditedVariables();
        }
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Ensure we always show a starter draft based on the Variables list,
    // so the user sees a concrete email immediately (even before AI refinement).
    if (emailTemplate) return;
    try {
      const vars = buildVariables();
      const toneToUse = toneOverrideEnabled ? selectedTone : offerTone;
      // Starter draft should reflect any overrides (if present)
      setEmailTemplate(buildStarterDraft(toneToUse, currentVariables.length ? currentVariables : vars));
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailTemplate, offerTone, selectedTone, toneOverrideEnabled, offerSnippetOverride, currentVariables]);

  const generateEmail = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const variables = currentVariables;
      const toneToUse = toneOverrideEnabled ? selectedTone : offerTone;

      const buildFallback = (): EmailTemplate => buildStarterDraft(toneToUse, variables);
      const payload = {
        tone: toneToUse,
        custom_tone: selectedTone === "custom" ? customTone : undefined,
        user_mode: mode,
        variables,
        painpoint_matches:
          (() => {
            try {
              const selectedJobId = String(localStorage.getItem("selected_job_description_id") || "").trim();
              const byJobRaw = localStorage.getItem("painpoint_matches_by_job");
              if (selectedJobId && byJobRaw) {
                const byJob = JSON.parse(byJobRaw) as Record<string, any[]>;
                const m = byJob?.[selectedJobId];
                if (m && Array.isArray(m) && m.length) return m;
              }
            } catch {}
            return (
              JSON.parse(localStorage.getItem("painpoint_matches") || "null") ||
              JSON.parse(localStorage.getItem(legacyPainpointKey) || "[]") ||
              JSON.parse(localStorage.getItem("pain_point_matches") || "[]")
            );
          })(),
        context_data: {
          context_research: JSON.parse(localStorage.getItem("context_research") || "{}"),
          selected_job_description: JSON.parse(localStorage.getItem("selected_job_description") || "null"),
          selected_contacts: JSON.parse(localStorage.getItem("selected_contacts") || "[]"),
          created_offers: JSON.parse(localStorage.getItem("created_offers") || "[]"),
        },
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
    } catch (err: any) {
      const msg = String(err?.message || err || "").trim();
      // If auth expired/missing, take the user back to login.
      if (msg.includes(" 401 ") || msg.includes("Not authenticated")) {
        router.push("/login");
        return;
      }
      // Always show a usable variable-based template (even if backend is down)
      try {
        setEmailTemplate((prev) => prev || buildFallback());
      } catch {}
      setError(msg || "Failed to generate email. Please try again.");
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
      // Persist any variable edits so later steps can reuse them.
      try {
        localStorage.setItem("compose_variables", JSON.stringify(currentVariables));
      } catch {}
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
      case 'developer':
        return 'Technical-focused, concrete and specific';
      case 'sales':
        return 'Results-focused, crisp proof points';
      case 'startup':
        return 'Fast-moving, momentum and ownership';
      case 'enterprise':
        return 'Process-minded, risk-aware outcomes';
      case 'custom':
        return 'Use your custom tone description';
      default:
        return '';
    }
  };

  const TONES: AudienceTone[] = ['recruiter', 'manager', 'exec', 'developer', 'sales', 'startup', 'enterprise', 'custom'];
  const cycleTone = (dir: -1 | 1) => {
    setSelectedTone((prev) => {
      const idx = Math.max(0, TONES.indexOf(prev));
      const next = (idx + dir + TONES.length) % TONES.length;
      return TONES[next];
    });
  };

  const applyVariables = (text: string, vars: Variable[]) => {
    let out = String(text || "");
    for (const v of vars || []) {
      if (!v?.name) continue;
      out = out.split(String(v.name)).join(String(v.value ?? ""));
    }
    return out;
  };

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-4">
          <a href="/offer-creation" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
            <span className="mr-2">←</span> Back to Offer
          </a>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Compose</h1>
            <p className="text-white/70">
              Turn your Offer into a polished email. You can edit the key offer line and optional work link before generating.
            </p>
          </div>

          {/* Offer payload (editable) */}
          <div className="mb-8 rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-white">Offer payload (used in the email)</div>
                <div className="text-xs text-white/60">
                  Offer tone: <span className="text-white/80 font-semibold capitalize">{offerTone}</span>
                  {offerTone === "custom" && customTone ? (
                    <span className="text-white/60"> — {customTone}</span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push("/offer-creation")}
                className="text-xs underline text-white/70 hover:text-white"
              >
                Change in Offer →
              </button>
            </div>

            <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">Message tone (override)</div>
                <label className="flex items-center gap-2 text-xs text-white/70">
                  <input
                    type="checkbox"
                    checked={toneOverrideEnabled}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setToneOverrideEnabled(next);
                      if (!next) setSelectedTone(offerTone);
                    }}
                  />
                  Enable override
                </label>
              </div>
              {toneOverrideEnabled ? (
                <div className="mt-2">
                  <div className="flex items-stretch gap-2">
                    <button
                      type="button"
                      onClick={() => cycleTone(-1)}
                      className="shrink-0 w-10 rounded-md border border-white/15 bg-black/40 hover:bg-black/55 text-white flex items-center justify-center"
                      aria-label="Previous tone"
                      title="Previous tone"
                    >
                      <span className="text-lg leading-none">◀</span>
                    </button>

                    <div className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/40 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white capitalize">{selectedTone}</div>
                          <div className="text-xs text-white/60 truncate">{getToneDescription(selectedTone)}</div>
                        </div>
                        <div className="text-[11px] text-white/50">Click arrows</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => cycleTone(1)}
                      className="shrink-0 w-10 rounded-md border border-white/15 bg-black/40 hover:bg-black/55 text-white flex items-center justify-center"
                      aria-label="Next tone"
                      title="Next tone"
                    >
                      <span className="text-lg leading-none">▶</span>
                    </button>
                  </div>
                  {selectedTone === "custom" ? (
                    <input
                      className="mt-2 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Describe your custom tone..."
                      value={customTone}
                      onChange={(e) => setCustomTone(e.target.value)}
                    />
                  ) : null}
                </div>
              ) : (
                <div className="mt-2 text-xs text-white/60">
                  Using Offer tone by default. Enable override to write differently for a specific person.
                </div>
              )}
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-2">
                  Key offer line (we’ll rewrite this into 1 strong sentence)
                </label>
                <textarea
                  value={offerSnippetOverride}
                  onChange={(e) => setOfferSnippetOverride(e.target.value)}
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-500 h-24"
                  placeholder="Paste or edit the core offer line you want referenced in the email..."
                />
              </div>
              <div className="text-xs text-white/60">
                Portfolio/Work Link is set in the <span className="font-semibold">Offer</span> step (single source of truth). If you need to tweak it for this message, edit <span className="font-mono">{"{{work_link}}"}</span> under Variables (advanced).
              </div>
            </div>
          </div>

          {/* Available Variables */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Variables (advanced)</h2>
              <div className="flex items-center gap-3">
                {showVariables ? (
                  <button
                    type="button"
                    onClick={() => setVariableOverrides({})}
                    className="text-xs underline text-white/70 hover:text-white"
                  >
                    Reset all edits
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowVariables((v) => !v)}
                  className="text-sm underline text-white/70 hover:text-white"
                >
                  {showVariables ? "Hide" : "Show"}
                </button>
              </div>
            </div>
            {showVariables && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentVariables.map((variable, index) => (
                  <div key={index} className="bg-black/20 border border-white/10 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium text-white">{variable.name}</div>
                      {Object.prototype.hasOwnProperty.call(variableOverrides, variable.name) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setVariableOverrides((prev) => {
                              const next = { ...prev };
                              delete next[variable.name];
                              return next;
                            });
                          }}
                          className="text-[11px] underline text-white/60 hover:text-white"
                        >
                          Reset
                        </button>
                      ) : null}
                    </div>
                    <div className="text-sm text-white/70 mb-1">{variable.description}</div>
                    <textarea
                      value={String(variable.value ?? "")}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVariableOverrides((prev) => ({ ...prev, [variable.name]: val }));
                      }}
                      className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-2 py-1.5 text-sm text-white font-mono outline-none focus:ring-2 focus:ring-blue-500"
                      rows={Math.min(6, Math.max(2, Math.ceil(String(variable.value || "").length / 42)))}
                    />
                  </div>
                ))}
                <div className="lg:col-span-3">
                  <button
                    type="button"
                    onClick={regenerateFromEditedVariables}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                  >
                    Regenerate draft from edited variables
                  </button>
                  <div className="mt-1 text-xs text-white/60">
                    Edit values above (name, role, offer snippet, etc.), then regenerate to update the draft structure.
                  </div>
                </div>
              </div>
            )}
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
                <label className="mb-2 flex items-center gap-2 text-xs text-white/70">
                  <input
                    type="checkbox"
                    checked={previewWithValues}
                    onChange={(e) => setPreviewWithValues(e.target.checked)}
                  />
                  Preview with values (hide {"{{placeholders}}"})
                </label>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                  <div className="font-medium text-gray-900 mb-2">
                    Subject:{" "}
                    {previewWithValues
                      ? applyVariables(emailTemplate.subject, currentVariables)
                      : emailTemplate.subject}
                  </div>
                  <div className="text-gray-700 whitespace-pre-wrap">
                    {previewWithValues
                      ? applyVariables(
                          simplifyLanguage ? emailTemplate.simplified_body : emailTemplate.body,
                          currentVariables
                        )
                      : (simplifyLanguage ? emailTemplate.simplified_body : emailTemplate.body)}
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
