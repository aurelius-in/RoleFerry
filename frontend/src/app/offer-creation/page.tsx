"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface PinpointMatch {
  pinpoint_1: string;
  solution_1: string;
  metric_1: string;
  pinpoint_2: string;
  solution_2: string;
  metric_2: string;
  pinpoint_3: string;
  solution_3: string;
  metric_3: string;
  alignment_score: number;
}

interface Offer {
  id: string;
  title: string;
  content: string;
  tone: 'recruiter' | 'manager' | 'exec';
  format: 'text' | 'link' | 'video';
  url?: string;
  video_url?: string;
  created_at: string;
}

export default function OfferCreationPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'job-seeker' | 'recruiter'>('job-seeker');
  const [pinpointMatches, setPinpointMatches] = useState<PinpointMatch[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedTone, setSelectedTone] = useState<'recruiter' | 'manager' | 'exec'>('manager');
  const [selectedFormat, setSelectedFormat] = useState<'text' | 'link' | 'video'>('text');
  const [offerContent, setOfferContent] = useState("");
  const [offerTitle, setOfferTitle] = useState("");

  useEffect(() => {
    // Load mode from localStorage
    const stored = localStorage.getItem("rf_mode");
    if (stored === 'recruiter') {
      setMode('recruiter');
    }
    
    // Load pinpoint matches from localStorage
    const savedMatches = localStorage.getItem('pinpoint_matches');
    if (savedMatches) {
      setPinpointMatches(JSON.parse(savedMatches));
    }
    
    // Listen for mode changes
    const handleModeChange = (event: CustomEvent) => {
      setMode(event.detail);
    };
    
    window.addEventListener('modeChanged', handleModeChange as EventListener);
    return () => window.removeEventListener('modeChanged', handleModeChange as EventListener);
  }, []);

  const generateOffer = async () => {
    if (pinpointMatches.length === 0) return;
    
    setIsGenerating(true);
    
    // Simulate AI offer generation
    setTimeout(() => {
      const match = pinpointMatches[0];
      let content = "";
      let title = "";
      
      if (mode === 'job-seeker') {
        title = `How I Can Solve ${match.pinpoint_1.split(' ').slice(0, 3).join(' ')}`;
        content = `I understand you're facing ${match.pinpoint_1.toLowerCase()}. In my previous role, I ${match.solution_1.toLowerCase()}, resulting in ${match.metric_1}. I'm confident I can bring similar results to your team.`;
      } else {
        title = `Perfect Candidate for ${match.pinpoint_1.split(' ').slice(0, 3).join(' ')}`;
        content = `I have an exceptional candidate who has successfully ${match.solution_1.toLowerCase()}, achieving ${match.metric_1}. They would be an ideal fit for your ${match.pinpoint_1.toLowerCase()} challenge.`;
      }
      
      // Adjust tone based on audience
      if (selectedTone === 'recruiter') {
        content = `Efficiency-focused: ${content}`;
      } else if (selectedTone === 'manager') {
        content = `Proof of competence: ${content}`;
      } else if (selectedTone === 'exec') {
        content = `ROI/Strategy focused: ${content}`;
      }
      
      const newOffer: Offer = {
        id: Date.now().toString(),
        title,
        content,
        tone: selectedTone,
        format: selectedFormat,
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
        created_at: new Date().toISOString()
      };
      
      setOffers(prev => [...prev, newOffer]);
      setOfferTitle("");
      setOfferContent("");
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
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Offer Creation</h1>
            <p className="text-gray-600">
              {mode === 'job-seeker' 
                ? 'Build a personalized pitch that showcases how you can solve their challenges.'
                : 'Create compelling candidate pitches that highlight their value proposition.'
              }
            </p>
          </div>

          {pinpointMatches.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Pinpoint Matches</h3>
              <p className="text-gray-600 mb-6">
                Please complete the Pinpoint Match step first to create personalized offers.
              </p>
              <button
                onClick={() => router.push('/pinpoint-match')}
                className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                Go to Pinpoint Match
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Pinpoint Matches Summary */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Your Pinpoint Matches</h2>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-blue-900">Alignment Score</span>
                    <span className="text-2xl font-bold text-blue-600">
                      {Math.round(pinpointMatches[0].alignment_score * 100)}%
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-blue-800">
                    <div><strong>Challenge 1:</strong> {pinpointMatches[0].pinpoint_1}</div>
                    <div><strong>Your Solution:</strong> {pinpointMatches[0].solution_1}</div>
                    <div><strong>Impact:</strong> {pinpointMatches[0].metric_1}</div>
                  </div>
                </div>
              </div>

              {/* Offer Configuration */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Configure Your Offer</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Tone Selection */}
                  <div>
                    <h3 className="text-lg font-medium mb-3">Audience Tone</h3>
                    <div className="space-y-3">
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

                  {/* Format Selection */}
                  <div>
                    <h3 className="text-lg font-medium mb-3">Offer Format</h3>
                    <div className="space-y-3">
                      {(['text', 'link', 'video'] as const).map((format) => (
                        <label key={format} className="flex items-center space-x-3 cursor-pointer">
                          <input
                            type="radio"
                            name="format"
                            value={format}
                            checked={selectedFormat === format}
                            onChange={(e) => setSelectedFormat(e.target.value as 'text' | 'link' | 'video')}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <div className="font-medium capitalize">{format}</div>
                            <div className="text-sm text-gray-600">{getFormatDescription(format)}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Generate Offer */}
              <div className="text-center">
                <button
                  onClick={generateOffer}
                  disabled={isGenerating}
                  className="bg-blue-600 text-white px-8 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isGenerating ? "Generating Offer..." : "Generate AI Offer"}
                </button>
              </div>

              {/* Manual Offer Creation */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Create Custom Offer</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Offer Title
                    </label>
                    <input
                      type="text"
                      value={offerTitle}
                      onChange={(e) => setOfferTitle(e.target.value)}
                      placeholder="Enter a compelling title for your offer..."
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Offer Content
                    </label>
                    <textarea
                      value={offerContent}
                      onChange={(e) => setOfferContent(e.target.value)}
                      placeholder="Write your personalized pitch here..."
                      className="w-full border border-gray-300 rounded-md px-3 py-2 h-32"
                    />
                  </div>
                  
                  <div className="flex space-x-4">
                    <button
                      onClick={handleSaveOffer}
                      disabled={!offerTitle || !offerContent}
                      className="bg-green-600 text-white px-6 py-2 rounded-md font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      Save Offer
                    </button>
                  </div>
                </div>
              </div>

              {/* Created Offers */}
              {offers.length > 0 && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">Your Offers</h2>
                  <div className="space-y-4">
                    {offers.map((offer) => (
                      <div key={offer.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-gray-900">{offer.title}</h3>
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <span>Tone: {offer.tone}</span>
                              <span>Format: {offer.format}</span>
                              <span>{new Date(offer.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setOffers(prev => prev.filter(o => o.id !== offer.id));
                            }}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
                          <p className="text-gray-700">{offer.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {offers.length > 0 && (
                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => router.push('/context-research')}
                    className="bg-gray-100 text-gray-700 px-6 py-3 rounded-md font-medium hover:bg-gray-200 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleContinue}
                    className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                  >
                    Continue to Compose ({offers.length} offers)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
