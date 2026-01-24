"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

// Must match the backend `PainPointMatch` shape from /painpoint-match/generate
interface PainPointMatch {
  painpoint_1: string;
  solution_1: string;
  metric_1: string;
  painpoint_2: string;
  solution_2: string;
  metric_2: string;
  painpoint_3: string;
  solution_3: string;
  metric_3: string;
  alignment_score: number;
}

interface Offer {
  id: string;
  title: string;
  content: string;
  tone: 'recruiter' | 'manager' | 'exec' | 'developer' | 'sales' | 'startup' | 'enterprise' | 'custom';
  format: 'text' | 'link' | 'video';
  url?: string;
  video_url?: string;
  custom_tone?: string;
  created_at: string;
}

interface BackendOffer {
  id: string;
  title: string;
  content: string;
  tone: string;
  format: string;
  url?: string | null;
  video_url?: string | null;
  custom_tone?: string | null;
  created_at: string;
  user_mode: string;
}

interface OfferCreationResponse {
  success: boolean;
  message: string;
  offer?: BackendOffer;
}

interface Contact {
  id: string;
  name: string;
  title?: string;
  company?: string;
  department?: string;
  level?: string;
  email?: string;
  linkedin_url?: string;
}

export default function OfferCreationPage() {
  const router = useRouter();
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'job-seeker' | 'recruiter'>('job-seeker');
  const [painPointMatches, setPainPointMatches] = useState<PainPointMatch[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTone, setSelectedTone] = useState<Offer['tone']>('manager');
  const [selectedFormat, setSelectedFormat] = useState<'text' | 'link' | 'video'>('text');
  const [offerContent, setOfferContent] = useState("");
  const [offerTitle, setOfferTitle] = useState("");
  const [customTone, setCustomTone] = useState("");
  const [optionalLink, setOptionalLink] = useState("");
  const [videoFileName, setVideoFileName] = useState<string>("");
  const [videoObjectUrl, setVideoObjectUrl] = useState<string>("");
  const [isVideoDragOver, setIsVideoDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [researchHistory, setResearchHistory] = useState<Array<{ contact: Contact; research: any; researched_at: string }>>([]);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [isEditingOffer, setIsEditingOffer] = useState(false);
  const [draftVersion, setDraftVersion] = useState(0);
  const [draftSavedNotice, setDraftSavedNotice] = useState<string | null>(null);

  const readActiveResearch = () => {
    try {
      const activeId = String(localStorage.getItem("context_research_active_contact_id") || "").trim();
      if (activeId) {
        try {
          const rawBy = localStorage.getItem("context_research_by_contact");
          const by = rawBy ? JSON.parse(rawBy) : null;
          const hit = by && typeof by === "object" ? (by[activeId] || null) : null;
          if (hit) return hit;
        } catch {}
        try {
          const rawHist = localStorage.getItem("context_research_history");
          const hist = rawHist ? JSON.parse(rawHist) : [];
          if (Array.isArray(hist)) {
            const h = hist.find((x: any) => String(x?.contact?.id || "") === activeId);
            if (h?.research) return h.research;
          }
        } catch {}
      }
    } catch {}
    try {
      return JSON.parse(localStorage.getItem("context_research") || "{}");
    } catch {
      return {};
    }
  };

  const readResearchHistory = () => {
    try {
      const raw = localStorage.getItem("context_research_history");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const setActiveContact = (contactId: string) => {
    const cid = String(contactId || "").trim();
    if (!cid) return;
    setActiveContactId(cid);
    try {
      localStorage.setItem("context_research_active_contact_id", cid);
    } catch {}

    // Ensure `context_research` reflects the selected contact (downstream screens read this too).
    try {
      const rawBy = localStorage.getItem("context_research_by_contact");
      const by = rawBy ? JSON.parse(rawBy) : null;
      const hit = by && typeof by === "object" ? (by[cid] || null) : null;
      if (hit) {
        localStorage.setItem("context_research", JSON.stringify(hit));
        localStorage.setItem("research_data", JSON.stringify(hit));
      } else {
        const hist = readResearchHistory();
        const h = Array.isArray(hist) ? hist.find((x: any) => String(x?.contact?.id || "") === cid) : null;
        if (h?.research) {
          localStorage.setItem("context_research", JSON.stringify(h.research));
          localStorage.setItem("research_data", JSON.stringify(h.research));
        }
      }
    } catch {}

    // Keep selected_contacts aligned so downstream variable builders that use selected_contacts[0]
    // stay consistent with the chosen contact.
    try {
      const raw = localStorage.getItem("selected_contacts");
      const list = raw ? JSON.parse(raw) : [];
      if (Array.isArray(list) && list.length) {
        const idx = list.findIndex((c: any) => String(c?.id || "") === cid);
        if (idx >= 0) {
          const chosen = list[idx];
          const rest = list.filter((_: any, i: number) => i !== idx);
          localStorage.setItem("selected_contacts", JSON.stringify([chosen, ...rest]));
          setSelectedContacts([chosen, ...rest]);
        }
      }
    } catch {}
  };

  const displayMetric = (raw: string) => {
    const s = String(raw || "").trim();
    if (!s) return null;
    // Hide obviously-wrong "metrics" like phone numbers / random ids.
    const digitsOnly = s.replace(/[^\d]/g, "");
    if (digitsOnly.length >= 9 && digitsOnly.length <= 12 && /^[\d\-\s()+.]+$/.test(s)) {
      return null;
    }
    // Hide tokens that look like unhelpful ids
    if (/^\d{8,}$/.test(s)) return null;
    return s;
  };

  const persistOffer = async (o: Offer) => {
    const resp = await api<OfferCreationResponse>("/offer-creation/save", "POST", {
      ...o,
      user_mode: mode,
      video_url: o.video_url || undefined,
    });
    return resp?.offer || o;
  };

  const readSelectedJob = () => {
    try {
      return JSON.parse(localStorage.getItem("selected_job_description") || "null");
    } catch {
      return null;
    }
  };

  const seedDraftFromContext = () => {
    // Deterministic baseline so the box is never empty (AI can overwrite on first click).
    const m0 = painPointMatches?.[0];
    const research = readActiveResearch();
    const jd = readSelectedJob();
    const company = String(jd?.company || (selectedContacts?.[0]?.company || "") || "the company").trim();
    const jobTitle = String(jd?.title || "this role").trim();
    const contactName =
      String(
        selectedContacts.find((c) => String(c?.id || "") === String(activeContactId || ""))?.name ||
          researchHistory.find((h) => String(h?.contact?.id || "") === String(activeContactId || ""))?.contact?.name ||
          selectedContacts?.[0]?.name ||
          "the team"
      ).trim();

    const pain = String(m0?.painpoint_1 || "a key priority").trim();
    const sol = String(m0?.solution_1 || "").trim();
    const metric = displayMetric(String(m0?.metric_1 || "")) || "";
    const hooks = (research && Array.isArray((research as any)?.hooks)) ? (research as any).hooks : [];
    const hook = String(hooks?.[0] || "").trim();

    const title = `Offer: ${pain} @ ${company}`;
    const lines = [
      `Hi ${contactName},`,
      ``,
      `I’m exploring ${jobTitle} at ${company}. Here’s a quick, concrete offer tied to the role’s priorities:`,
      ``,
      `- Focus: ${pain}`,
      sol ? `- Proof point: ${sol}${metric ? ` (${metric})` : ""}` : `- Proof point: [Add 1 proof point from your background]`,
      hook ? `- First-week plan: ${hook}` : `- First-week plan: Identify the top bottleneck + ship a low-risk improvement with a measurable KPI`,
      ``,
      `If you’d like, I can share a 2–3 bullet plan tailored to your team’s current constraints.`,
    ];

    setOfferTitle((prev) => prev || title);
    setOfferContent((prev) => prev || lines.join("\n"));
  };

  useEffect(() => {
    // Load mode from localStorage
    const stored = localStorage.getItem("rf_mode");
    if (stored === 'recruiter') {
      setMode('recruiter');
    }
    
    // Load pain point matches from localStorage (prefer matches for selected job id)
    const legacyPainpointKey = ["pin", "point_matches"].join("");
    try {
      const selectedJobId = localStorage.getItem("selected_job_description_id") || "";
      const byJobRaw = localStorage.getItem("painpoint_matches_by_job");
      if (selectedJobId && byJobRaw) {
        const byJob = JSON.parse(byJobRaw) as Record<string, PainPointMatch[]>;
        const m = byJob?.[selectedJobId];
        if (m && Array.isArray(m) && m.length) {
          setPainPointMatches(m);
        } else {
          const savedMatches =
            localStorage.getItem("painpoint_matches") ||
            localStorage.getItem(legacyPainpointKey) ||
            localStorage.getItem("pain_point_matches");
          if (savedMatches) setPainPointMatches(JSON.parse(savedMatches));
        }
      } else {
        const savedMatches =
          localStorage.getItem("painpoint_matches") ||
          localStorage.getItem(legacyPainpointKey) ||
          localStorage.getItem("pain_point_matches");
        if (savedMatches) setPainPointMatches(JSON.parse(savedMatches));
      }
    } catch {
      const savedMatches =
        localStorage.getItem("painpoint_matches") ||
        localStorage.getItem(legacyPainpointKey) ||
        localStorage.getItem("pain_point_matches");
      if (savedMatches) setPainPointMatches(JSON.parse(savedMatches));
    }
    
    // Listen for mode changes
    const handleModeChange = (event: CustomEvent) => {
      setMode(event.detail);
    };
    
    window.addEventListener('modeChanged', handleModeChange as EventListener);
    return () => window.removeEventListener('modeChanged', handleModeChange as EventListener);
  }, []);

  useEffect(() => {
    // Load selected contacts + research history so user can select who this offer is targeting.
    try {
      const scRaw = localStorage.getItem("selected_contacts");
      const sc = scRaw ? JSON.parse(scRaw) : [];
      if (Array.isArray(sc)) setSelectedContacts(sc);
    } catch {}
    try {
      const hist = readResearchHistory();
      setResearchHistory(hist);
    } catch {}
    try {
      const active = String(localStorage.getItem("context_research_active_contact_id") || "").trim();
      if (active) setActiveContactId(active);
    } catch {}
  }, []);

  useEffect(() => {
    // Prefill draft as soon as we have enough upstream context.
    if (!offerContent && painPointMatches.length > 0) {
      seedDraftFromContext();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [painPointMatches, activeContactId, selectedContacts.length, researchHistory.length]);

  useEffect(() => {
    // Load saved offers for this logged-in user (server-backed when available).
    (async () => {
      try {
        const resp = await api<{ success: boolean; offers: Offer[] }>("/offer-creation/me", "GET");
        if (resp?.success && Array.isArray(resp.offers)) {
          setOffers(resp.offers);
        }
      } catch {
        // Non-blocking: keep empty/offline library if backend can't be reached.
      }
    })();
  }, []);

  const handleVideoSelected = (file: File | null) => {
    if (!file) return;
    if (!String(file.type || "").startsWith("video/")) {
      setError("Please select a valid video file.");
      return;
    }
    // Keep demo-friendly: avoid giant uploads / memory pressure.
    const maxMb = 80;
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > maxMb) {
      setError(`That video is ${Math.round(sizeMb)}MB. Please upload a video under ${maxMb}MB for the demo.`);
      return;
    }

    setError(null);
    setVideoFileName(file.name);
    try {
      if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
    } catch {}
    const nextUrl = URL.createObjectURL(file);
    setVideoObjectUrl(nextUrl);
    // If they upload a video, treat the offer as a video format by default.
    setSelectedFormat("video");
  };

  const generateOffer = async () => {
    if (painPointMatches.length === 0) return;
    
    setIsGenerating(true);
    setError(null);

    try {
      const payload = {
        painpoint_matches: [painPointMatches[0]],
        tone: selectedTone,
        custom_tone: selectedTone === "custom" ? customTone : undefined,
        format: selectedFormat,
        user_mode: mode,
        context_research: readActiveResearch(),
      };
      const resp = await api<OfferCreationResponse>("/offer-creation/create", "POST", payload);
      const o = resp.offer;
      if (o) {
        const mapped: Offer = {
          id: o.id,
          title: o.title,
          content: o.content,
          tone: o.tone as Offer["tone"],
          format: o.format as Offer["format"],
          url: o.url || undefined,
          video_url: o.video_url || undefined,
          custom_tone: (o as any)?.custom_tone || undefined,
          created_at: o.created_at,
        };
        setOfferTitle(mapped.title);
        setOfferContent(mapped.content);
        setDraftVersion((v) => v + 1);
      }
    } catch (e: any) {
      setError("Failed to generate offer. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveOffer = async () => {
    if (offerTitle && offerContent) {
      const newOffer: Offer = {
        id: Date.now().toString(),
        title: offerTitle,
        content: offerContent,
        tone: selectedTone,
        format: selectedFormat,
        url: optionalLink,
        video_url: videoObjectUrl || undefined,
        custom_tone: selectedTone === "custom" ? customTone : undefined,
        created_at: new Date().toISOString(),
      };

      try {
        const saved = await persistOffer(newOffer);
        setOffers(prev => [saved as any, ...prev.filter(p => p.id !== (saved as any)?.id)]);
        setDraftSavedNotice("Saved to Offer Library.");
        window.setTimeout(() => setDraftSavedNotice(null), 1800);
      } catch (e: any) {
        setError("Failed to save offer. Please try again.");
      }
    }
  };

  const handleContinue = () => {
    // Continue should use the CURRENT draft (even if not saved to the library).
    if (!offerTitle.trim() || !offerContent.trim()) {
      setError("Generate (or edit) a personalized offer before continuing.");
      return;
    }
    const draft: Offer = {
      id: `draft_${Date.now()}`,
      title: offerTitle,
      content: offerContent,
      tone: selectedTone,
      format: selectedFormat,
      url: optionalLink || undefined,
      video_url: videoObjectUrl || undefined,
      custom_tone: selectedTone === "custom" ? customTone : undefined,
      created_at: new Date().toISOString(),
    };
    // Do NOT add to Offer Library unless they hit Save.
    localStorage.setItem('created_offers', JSON.stringify([draft]));
    router.push('/bio-page');
  };

  const getToneDescription = (tone: string) => {
    switch (tone) {
      case 'recruiter': return 'Efficiency-focused';
      case 'manager': return 'Competence-focused';
      case 'exec': return 'ROI/Strategy-focused';
      case 'developer': return 'Technical-focused';
      case 'sales': return 'Results-focused';
      case 'startup': return 'Innovation-focused';
      case 'enterprise': return 'Process-focused';
      case 'custom': return 'Your custom tone';
      default: return '';
    }
  };

  const getFormatDescription = (format: string) => {
    switch (format) {
      case 'text':
        return 'Text-based pitch for email or message';
      case 'link':
        return 'Link to detailed pitch page or portfolio';
      case 'video':
        return 'Video pitch for personal touch';
      default:
        return '';
    }
  };

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 mb-4">
        <div className="flex justify-between items-center">
          <a href="/context-research" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
            <span className="mr-2">←</span> Back to Research
          </a>
          <div className="bg-gray-900/70 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-lg border border-white/10">
            Step 9 of 12
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar: Offer Library */}
          <div className="lg:col-span-3">
            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-6 sticky top-8 shadow-2xl shadow-black/20">
              <h2 className="text-xl font-bold text-white mb-4">Offer Library</h2>
              
              {offers.length === 0 ? (
                <p className="text-sm text-white/60 italic">No offers created yet.</p>
              ) : (
                <div className="space-y-3">
                  {offers.map((offer) => (
                    <div key={offer.id} className="p-3 border border-white/10 rounded-lg bg-black/20 hover:bg-white/5 transition-colors cursor-pointer group">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-sm text-white mb-1 line-clamp-1">{offer.title}</h3>
                          <div className="flex flex-wrap gap-1">
                            <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-200 border border-white/10 rounded-full capitalize">{offer.tone}</span>
                            <span className="text-xs px-2 py-0.5 bg-white/10 text-white/80 border border-white/10 rounded-full capitalize">{offer.format}</span>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setOffers(prev => prev.filter(o => o.id !== offer.id)); }}
                          className="text-white/40 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Continue button lives under the Personalized Offer (single CTA for this step). */}
            </div>
          </div>

          {/* Main Content: Offer Creation */}
          <div className="lg:col-span-9">
            <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
              <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-white mb-2">Offer Creation</h1>
                <p className="text-white/70">
                  {mode === 'job-seeker' 
                    ? 'Build a personalized pitch that showcases how you can solve their challenges.'
                    : 'Create compelling candidate pitches that highlight their value proposition.'
                  }
                </p>
              </div>

              {error && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {painPointMatches.length === 0 ? (
                <div className="text-center py-12 bg-black/20 rounded-lg border border-dashed border-white/20">
                  <div className="mb-4 text-4xl">🎯</div>
                  <h3 className="text-lg font-medium text-white mb-2">No Pain Point Matches</h3>
                  <p className="text-white/70 mb-6">
                    Please complete the Pain Point Match step first.
                  </p>
                  <button
                    onClick={() => router.push('/painpoint-match')}
                    className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                  >
                    Go to Pain Point Match
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Target contact selector (uses persisted research history) */}
                  <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-white/90">Target contact</div>
                        <div className="text-xs text-white/60">
                          Select who this offer is written for. We’ll use their saved research for personalization.
                        </div>
                      </div>
                      <a
                        href="/context-research"
                        className="text-xs font-semibold text-blue-200/90 hover:text-blue-100 underline underline-offset-2"
                        title="Go back to research more contacts"
                      >
                        Research more →
                      </a>
                    </div>

                    <div className="mt-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-white/70 mb-1">Researched contacts</label>
                        <select
                          value={activeContactId || ""}
                          onChange={(e) => setActiveContact(e.target.value)}
                          className="w-full rounded-md border border-white/10 bg-black/30 text-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="" disabled>
                            {researchHistory.length ? "Select a researched contact…" : "No researched contacts yet"}
                          </option>
                          {researchHistory.map((h) => (
                            <option key={`opt_${h?.contact?.id}`} value={String(h?.contact?.id || "")}>
                              {String(h?.contact?.name || "Contact")}
                              {h?.contact?.title ? ` — ${String(h.contact.title)}` : ""}
                              {h?.contact?.company ? ` @ ${String(h.contact.company)}` : ""}
                            </option>
                          ))}
                        </select>
                        {!researchHistory.length ? (
                          <div className="mt-2 text-xs text-white/60">
                            Run research on the Research step to build your list, then come back here to choose who you’re targeting.
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-3">
                        <label className="block text-[11px] font-semibold text-white/70 mb-1">Quick pick</label>
                        <div className="flex flex-wrap gap-2">
                          {researchHistory.slice(0, 6).map((h) => {
                            const id = String(h?.contact?.id || "");
                            const active = String(activeContactId || "") === id;
                            return (
                              <button
                                type="button"
                                key={`pill_${id}`}
                                onClick={() => setActiveContact(id)}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                                  active
                                    ? "brand-gradient text-black border-white/10"
                                    : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
                                }`}
                                title="Set this contact as the target"
                              >
                                {String(h?.contact?.name || "Contact")}
                              </button>
                            );
                          })}
                          {researchHistory.length === 0 && selectedContacts.length > 0 ? (
                            <div className="text-xs text-white/60">
                              Tip: research at least one contact first, then you can select them here.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {activeContactId ? (
                      <div className="mt-3 text-xs text-white/70">
                        <span className="font-semibold text-white/80">Active:</span>{" "}
                        {selectedContacts.find((c) => String(c?.id) === String(activeContactId))?.name ||
                          researchHistory.find((h) => String(h?.contact?.id) === String(activeContactId))?.contact?.name ||
                          "Selected contact"}
                      </div>
                    ) : null}
                  </div>

                  {/* Tone Selection */}
                  <div>
                    <h2 className="text-xl font-semibold mb-4">Select Tone & Audience</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {(['recruiter', 'manager', 'exec', 'developer', 'sales', 'startup', 'enterprise', 'custom'] as const).map((tone) => (
                        <label 
                          key={tone} 
                          className={`
                            relative flex flex-col items-center justify-center p-3 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-all
                            ${selectedTone === tone ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200'}
                          `}
                        >
                          <input
                            type="radio"
                            name="tone"
                            value={tone}
                            checked={selectedTone === tone}
                            onChange={(e) => setSelectedTone(e.target.value as any)}
                            className="sr-only"
                          />
                          <span className="font-semibold capitalize text-gray-900">{tone}</span>
                          <span className="text-xs text-center text-gray-500 mt-1 leading-tight">
                            {getToneDescription(tone).split(' ')[0]}
                          </span>
                        </label>
                      ))}
                    </div>
                    {selectedTone === 'custom' && (
                      <div className="mt-3">
                        <input 
                          type="text" 
                          value={customTone}
                          onChange={(e) => setCustomTone(e.target.value)}
                          placeholder="Describe your desired tone (e.g., Professional but friendly)"
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                        />
                      </div>
                    )}
                  </div>

                  {/* Editor Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <h2 className="text-xl font-semibold">Personalized Offer</h2>

                      <div className="text-sm text-white/70">
                        Click the offer box to rotate through new AI-generated versions. When you see one you like, you can edit it and/or hit Save.
                      </div>

                      {draftSavedNotice ? (
                        <div className="rounded-md border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
                          {draftSavedNotice}
                        </div>
                      ) : null}

                      <div className="space-y-3">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (!isGenerating) generateOffer();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              if (!isGenerating) generateOffer();
                            }
                          }}
                          className={`w-full rounded-lg border p-4 transition-colors ${
                            isGenerating
                              ? "border-blue-400/40 bg-blue-500/10 cursor-wait"
                              : "border-white/10 bg-black/20 hover:bg-black/30 cursor-pointer"
                          }`}
                          title="Click to generate a new version"
                        >
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                              Offer draft {draftVersion ? `(v${draftVersion})` : ""}
                            </div>
                            <div className="text-xs text-white/60">
                              {isGenerating ? "Generating…" : "Click to generate a new version"}
                            </div>
                          </div>
                          <div className="text-sm text-white whitespace-pre-wrap">
                            {offerContent || "Click to generate your first offer…"}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => setIsEditingOffer((v) => !v)}
                            className="text-sm px-3 py-2 rounded-md bg-white/10 border border-white/10 text-white hover:bg-white/15 transition-colors"
                          >
                            {isEditingOffer ? "Hide editor" : "Edit"}
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveOffer}
                            disabled={!offerTitle.trim() || !offerContent.trim()}
                            className="text-sm px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                          >
                            Save to library
                          </button>
                        </div>

                        {isEditingOffer ? (
                          <textarea
                            value={offerContent}
                            onChange={(e) => setOfferContent(e.target.value)}
                            className="w-full h-64 border border-white/10 bg-black/30 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm text-white"
                          />
                        ) : null}

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleContinue}
                            disabled={!offerTitle.trim() || !offerContent.trim()}
                            className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                          >
                            Continue to Bio Page →
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <h3 className="font-medium text-gray-900 mb-2">Portfolio/Work Link (URL)</h3>
                        <input
                          type="url"
                          value={optionalLink}
                          onChange={(e) => setOptionalLink(e.target.value)}
                          placeholder="http://My_Portfolio_or_Examples_of_My_Work.com"
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                        <div className="mt-1 text-xs text-gray-500">
                          Optional. Add your portfolio, LinkedIn, GitHub, or a case study page.
                        </div>
                      </div>

                      <div>
                        <h3 className="font-medium text-white mb-2">Upload Video (Optional)</h3>
                        <input
                          ref={videoInputRef}
                          type="file"
                          accept="video/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            handleVideoSelected(f);
                          }}
                        />
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => videoInputRef.current?.click()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              videoInputRef.current?.click();
                            }
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsVideoDragOver(true);
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsVideoDragOver(false);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsVideoDragOver(false);
                            const f = e.dataTransfer.files?.[0] || null;
                            handleVideoSelected(f);
                          }}
                          className={
                            "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer outline-none " +
                            (isVideoDragOver
                              ? "border-blue-400 bg-blue-500/10"
                              : "border-white/20 bg-black/20 hover:bg-white/5")
                          }
                        >
                          <span className="text-2xl block mb-2">📹</span>
                          <p className="text-sm text-white/70">
                            Click or drag to upload a short intro video
                          </p>
                          {videoFileName ? (
                            <div className="mt-3 text-xs text-white/80">
                              Selected: <span className="font-semibold">{videoFileName}</span>
                            </div>
                          ) : null}
                        </div>
                        {videoObjectUrl ? (
                          <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <div className="text-xs font-semibold text-white/80">Preview</div>
                              <button
                                type="button"
                                onClick={() => {
                                  try {
                                    if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
                                  } catch {}
                                  setVideoObjectUrl("");
                                  setVideoFileName("");
                                  // revert format if they remove video
                                  if (selectedFormat === "video") setSelectedFormat("text");
                                }}
                                className="text-xs text-white/70 hover:text-white"
                              >
                                Remove
                              </button>
                            </div>
                            <video
                              src={videoObjectUrl}
                              controls
                              className="w-full rounded-md bg-black"
                            />
                            <div className="mt-2 text-[11px] text-white/50">
                              Demo note: this video is stored locally in your browser session (not uploaded to the server).
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {/* Offer generation is driven by clicking the offer box (left). */}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
