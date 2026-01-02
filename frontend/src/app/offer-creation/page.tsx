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
        // Auto-save to the user's library so demos don't need a separate "Save" action.
        try {
          const saved = await persistOffer(mapped);
          setOffers(prev => [saved as any, ...prev.filter(p => p.id !== (saved as any)?.id)]);
        } catch {
          // If save fails, still show it locally so the workflow can continue.
          setOffers(prev => [mapped, ...prev.filter(p => p.id !== mapped.id)]);
        }
        setOfferTitle(mapped.title);
        setOfferContent(mapped.content);
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
        setOfferTitle("");
        setOfferContent("");
        setOptionalLink("");
        setVideoFileName("");
        try {
          if (videoObjectUrl) URL.revokeObjectURL(videoObjectUrl);
        } catch {}
        setVideoObjectUrl("");
      } catch (e: any) {
        setError("Failed to save offer. Please try again.");
      }
    }
  };

  const handleContinue = () => {
    if (offers.length > 0) {
      localStorage.setItem('created_offers', JSON.stringify(offers));
      router.push('/compose');
    }
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

              {offers.length > 0 && (
                <div className="mt-6 pt-4 border-t border-white/10">
                  <button
                    onClick={handleContinue}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-md font-medium hover:bg-green-700 transition-colors text-sm"
                  >
                    Continue ({offers.length}) →
                  </button>
                </div>
              )}
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
                  {/* Pain Point Match Summary Card */}
                  <div className="bg-blue-50 border border-white/10 rounded-lg p-4">
                     <h3 className="text-sm font-semibold text-white uppercase tracking-wide mb-2">Target Opportunity</h3>
                     <p className="text-white/90 font-medium mb-1">Challenge: {painPointMatches[0].painpoint_1}</p>
                     <p className="text-white/70 text-sm">
                       Proposed solution: {painPointMatches[0].solution_1}
                       {displayMetric(painPointMatches[0].metric_1) ? (
                         <span className="text-white/60">{" "}— {displayMetric(painPointMatches[0].metric_1)}</span>
                       ) : null}
                     </p>
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
                      
                      <div className="space-y-3">
                        <button 
                          onClick={() => setOfferContent(prev => prev + "\n[Insert Snippet: Case Study X]")}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded text-sm font-medium transition-colors"
                        >
                          + Insert Snippet
                        </button>

                        <textarea
                          value={offerContent}
                          onChange={(e) => setOfferContent(e.target.value)}
                          placeholder="Draft your offer here..."
                          className="w-full h-64 border border-gray-300 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                        />
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

                      <div className="pt-4 border-t border-white/10">
                        <div className="flex flex-col gap-3">
                          <button
                            onClick={generateOffer}
                            disabled={isGenerating}
                            className="w-full bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
                          >
                            {isGenerating ? "✨ Generating with AI..." : "✨ Generate AI Offer"}
                          </button>
                          <div className="text-xs text-white/60 text-center">
                            Offers are auto-saved to your library when generated.
                          </div>
                        </div>
                      </div>
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
