"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface PainPointMatch {
  painPoint_1: string;
  solution_1: string;
  metric_1: string;
  painPoint_2: string;
  solution_2: string;
  metric_2: string;
  painPoint_3: string;
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
  created_at: string;
}

export default function OfferCreationPage() {
  const router = useRouter();
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

  useEffect(() => {
    // Load mode from localStorage
    const stored = localStorage.getItem("rf_mode");
    if (stored === 'recruiter') {
      setMode('recruiter');
    }
    
    // Load pain point matches from localStorage
    const savedMatches = localStorage.getItem('pain_point_matches');
    if (savedMatches) {
      setPainPointMatches(JSON.parse(savedMatches));
    }
    
    // Listen for mode changes
    const handleModeChange = (event: CustomEvent) => {
      setMode(event.detail);
    };
    
    window.addEventListener('modeChanged', handleModeChange as EventListener);
    return () => window.removeEventListener('modeChanged', handleModeChange as EventListener);
  }, []);

  const generateOffer = async () => {
    if (painPointMatches.length === 0) return;
    
    setIsGenerating(true);
    
    // Simulate AI offer generation
    setTimeout(() => {
      const match = painPointMatches[0];
      let content = "";
      let title = "";
      
      if (mode === 'job-seeker') {
        title = `How I Can Solve ${match.painPoint_1.split(' ').slice(0, 3).join(' ')}`;
        content = `I understand you're facing ${match.painPoint_1.toLowerCase()}. In my previous role, I ${match.solution_1.toLowerCase()}, resulting in ${match.metric_1}. I'm confident I can bring similar results to your team.`;
      } else {
        title = `Perfect Candidate for ${match.painPoint_1.split(' ').slice(0, 3).join(' ')}`;
        content = `I have an exceptional candidate who has successfully ${match.solution_1.toLowerCase()}, achieving ${match.metric_1}. They would be an ideal fit for your ${match.painPoint_1.toLowerCase()} challenge.`;
      }
      
      // Adjust tone based on audience
      if (selectedTone === 'recruiter') {
        content = `Efficiency-focused: ${content}`;
      } else if (selectedTone === 'manager') {
        content = `Proof of competence: ${content}`;
      } else if (selectedTone === 'exec') {
        content = `ROI/Strategy focused: ${content}`;
      } else if (selectedTone === 'developer') {
        content = `Technical Detail: ${content}`;
      } else if (selectedTone === 'sales') {
        content = `Results-Oriented: ${content}`;
      } else if (selectedTone === 'startup') {
        content = `Innovation-Driven: ${content}`;
      } else if (selectedTone === 'enterprise') {
        content = `Process-Aligned: ${content}`;
      } else if (selectedTone === 'custom') {
        content = `Custom Tone (${customTone}): ${content}`;
      }
      
      const newOffer: Offer = {
        id: Date.now().toString(),
        title,
        content,
        tone: selectedTone,
        format: selectedFormat,
        url: optionalLink,
        created_at: new Date().toISOString()
      };
      
      setOffers(prev => [...prev, newOffer]);
      setOfferTitle(title);
      setOfferContent(content);
      setIsGenerating(false);
    }, 2000);
  };

  const handleSaveOffer = () => {
    if (offerTitle && offerContent) {
      const newOffer: Offer = {
        id: Date.now().toString(),
        title: offerTitle,
        content: offerContent,
        tone: selectedTone,
        format: selectedFormat,
        url: optionalLink,
        created_at: new Date().toISOString()
      };
      
      setOffers(prev => [...prev, newOffer]);
      setOfferTitle("");
      setOfferContent("");
      setOptionalLink("");
    }
  };

  const handleContinue = () => {
    if (offers.length > 0) {
      localStorage.setItem('created_offers', JSON.stringify(offers));
      router.push('/context-research');
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 mb-4">
        <div className="flex justify-between items-center">
          <a href="/foundry" className="inline-flex items-center text-gray-600 hover:text-gray-900 font-medium transition-colors">
            <span className="mr-2">←</span> Back to Path
          </a>
          <div className="bg-gray-900 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-lg border border-gray-700">
            Step 9 of 12
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Sidebar: Offer Library */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Offer Library</h2>
              
              {offers.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No offers created yet.</p>
              ) : (
                <div className="space-y-3">
                  {offers.map((offer) => (
                    <div key={offer.id} className="p-3 border rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors cursor-pointer group">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-sm text-gray-900 mb-1 line-clamp-1">{offer.title}</h3>
                          <div className="flex flex-wrap gap-1">
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full capitalize">{offer.tone}</span>
                            <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full capitalize">{offer.format}</span>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setOffers(prev => prev.filter(o => o.id !== offer.id)); }}
                          className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {offers.length > 0 && (
                <div className="mt-6 pt-4 border-t">
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
            <div className="bg-white rounded-lg shadow-sm border p-8">
              <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Offer Creation</h1>
                <p className="text-gray-600">
                  {mode === 'job-seeker' 
                    ? 'Build a personalized pitch that showcases how you can solve their challenges.'
                    : 'Create compelling candidate pitches that highlight their value proposition.'
                  }
                </p>
              </div>

              {painPointMatches.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <div className="mb-4 text-4xl">🎯</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Pain Point Matches</h3>
                  <p className="text-gray-600 mb-6">
                    Please complete the Pain Point Match step first.
                  </p>
                  <button
                    onClick={() => router.push('/pain-point-match')}
                    className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                  >
                    Go to Pain Point Match
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Pain Point Match Summary Card */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                     <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wide mb-2">Target Opportunity</h3>
                     <p className="text-blue-800 font-medium mb-1">Challenge: {painPointMatches[0].painPoint_1}</p>
                     <p className="text-blue-700 text-sm">Proposed Solution: {painPointMatches[0].solution_1} ({painPointMatches[0].metric_1})</p>
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
                        <h3 className="font-medium text-gray-900 mb-2">Optional Link</h3>
                        <input
                          type="url"
                          value={optionalLink}
                          onChange={(e) => setOptionalLink(e.target.value)}
                          placeholder="https://your-portfolio.com/project-x"
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                      </div>

                      <div>
                        <h3 className="font-medium text-gray-900 mb-2">Upload Video (Optional)</h3>
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer">
                          <span className="text-2xl block mb-2">📹</span>
                          <p className="text-sm text-gray-600">Click or drag to upload a short intro video</p>
                        </div>
                      </div>

                      <div className="pt-4 border-t">
                        <div className="flex flex-col gap-3">
                          <button
                            onClick={generateOffer}
                            disabled={isGenerating}
                            className="w-full bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm"
                          >
                            {isGenerating ? "✨ Generating with AI..." : "✨ Generate AI Offer"}
                          </button>
                          <button
                            onClick={handleSaveOffer}
                            disabled={!offerContent}
                            className="w-full bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-md font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                          >
                            Save to Library
                          </button>
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
