"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import StarRating from "@/components/StarRating";

interface Contact {
  id: string;
  name: string;
  title: string;
  email: string;
  linkedin_url?: string;
  confidence: number;
  verification_status: 'valid' | 'risky' | 'invalid' | 'unknown';
  verification_score?: number;
  company: string;
  department: string;
  level: string;
  email_source?: string;
  location_name?: string;
  location_country?: string;
  job_company_website?: string;
  job_company_linkedin_url?: string;
  job_company_industry?: string;
  job_company_size?: string;
}

interface VerificationBadge {
  label: string;
  color: string;
  icon: string;
}

interface ContactSearchResponse {
  success: boolean;
  message: string;
  contacts: Contact[];
  helper?: {
    opener_suggestions?: string[];
    questions_to_ask?: string[];
    talking_points_by_contact?: Record<string, string[]>;
  };
}

export default function FindContactPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [companyOptions, setCompanyOptions] = useState<string[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verifyingEmails, setVerifyingEmails] = useState<string[]>([]);
  const [helper, setHelper] = useState<ContactSearchResponse["helper"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<Contact[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualLinkedIn, setManualLinkedIn] = useState("");
  const [manualEmail, setManualEmail] = useState("");

  const formatTitleCase = (input?: string) => {
    const s = String(input || "").trim();
    if (!s) return "";
    const lowerWords = new Set(["of", "and"]);
    const words = s.split(/\s+/).filter(Boolean);
    const out = words.map((w, idx) => {
      if (w.length <= 6 && w === w.toUpperCase()) return w;
      const parts = w.split(/([\/\-.])/g);
      const rebuilt = parts
        .map((p) => {
          if (p === "/" || p === "-" || p === ".") return p;
          const raw = p.trim();
          if (!raw) return raw;
          const low = raw.toLowerCase();
          if (idx > 0 && lowerWords.has(low)) return low;
          return low.charAt(0).toUpperCase() + low.slice(1);
        })
        .join("");
      return rebuilt;
    });
    return out.join(" ");
  };

  const isRealEmail = (email?: string) => {
    const e = String(email || "").trim().toLowerCase();
    if (!e) return false;
    if (e === "unknown@example.com") return false;
    if (e.endsWith("@example.com")) return false;
    return true;
  };

  useEffect(() => {
    // Load any existing contacts from localStorage
    const savedContacts = localStorage.getItem('found_contacts');
    if (savedContacts) {
      try {
        const parsed: Contact[] = JSON.parse(savedContacts);
        const looksLikeOldMock = Array.isArray(parsed) && parsed.some((c) => {
          const company = String((c as any)?.company || "");
          const email = String((c as any)?.email || "");
          const id = String((c as any)?.id || "");
          return (
            company.toLowerCase().includes("techcorp") ||
            email.toLowerCase().endsWith("@techcorp.com") ||
            ["contact_1", "contact_2", "contact_3"].includes(id)
          );
        });

        if (looksLikeOldMock) {
          localStorage.removeItem("found_contacts");
        } else {
          setContacts(parsed);
        }
      } catch {
        localStorage.removeItem("found_contacts");
      }
    }

    // Carry over company names from previous steps (Job Descriptions + selected JD + selected contacts).
    try {
      const companies: string[] = [];
      const jdsRaw = localStorage.getItem("job_descriptions");
      if (jdsRaw) {
        const jds = JSON.parse(jdsRaw);
        if (Array.isArray(jds)) {
          for (const jd of jds) {
            const c = String(jd?.company || "").trim();
            if (c) companies.push(c);
          }
        }
      }
      const selectedJdRaw = localStorage.getItem("selected_job_description");
      if (selectedJdRaw) {
        const jd = JSON.parse(selectedJdRaw);
        const c = String(jd?.company || "").trim();
        if (c) companies.push(c);
      }
      const selContactsRaw = localStorage.getItem("selected_contacts");
      if (selContactsRaw) {
        const sel = JSON.parse(selContactsRaw);
        if (Array.isArray(sel)) {
          for (const sc of sel) {
            const c = String(sc?.company || "").trim();
            if (c) companies.push(c);
          }
        }
      }

      const uniq = Array.from(new Set(companies.map((c) => c.trim()).filter(Boolean)));
      uniq.sort((a, b) => a.localeCompare(b));
      setCompanyOptions(uniq);
    } catch {
      // ignore
    }
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setError(null);
    // Clear any previously cached results so we don't show stale demo contacts on failure.
    setContacts([]);
    setSelectedContacts([]);
    setSuggested([]);
    setHelper(null);

    try {
      const res = await api<ContactSearchResponse>("/find-contact/search", "POST", {
        query: searchQuery,
      });
      if (!res.success) throw new Error(res.message || "Search failed");
      setContacts(res.contacts || []);
      setHelper(res.helper || null);
      localStorage.setItem("found_contacts", JSON.stringify(res.contacts || []));
    } catch (e: any) {
      const msg = String(e?.message || "");
      // Surface the backend error so users know they need to configure PDL or refine the query.
      const isNotFound = msg.includes("404") || msg.toLowerCase().includes("no decision makers");
      setError(isNotFound ? "No decision makers found for that company. Try a more specific company name, or use the suggested targets below." : msg || "Search failed.");

      if (isNotFound) {
        const company = searchQuery.trim();
        const mkLinkedIn = (title: string) =>
          `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${title} ${company}`)}`;

        const fallback: Contact[] = [
          {
            id: `suggested_vp_eng_${Date.now()}`,
            name: "Target: VP of Engineering",
            title: "VP of Engineering",
            email: "unknown@example.com",
            linkedin_url: mkLinkedIn("VP of Engineering"),
            confidence: 0.45,
            verification_status: "unknown",
            company,
            department: "Engineering",
            level: "VP",
          },
          {
            id: `suggested_dir_eng_${Date.now() + 1}`,
            name: "Target: Director of Engineering",
            title: "Director of Engineering",
            email: "unknown@example.com",
            linkedin_url: mkLinkedIn("Director of Engineering"),
            confidence: 0.45,
            verification_status: "unknown",
            company,
            department: "Engineering",
            level: "Director",
          },
          {
            id: `suggested_head_ta_${Date.now() + 2}`,
            name: "Target: Head of Talent Acquisition",
            title: "Head of Talent Acquisition",
            email: "unknown@example.com",
            linkedin_url: mkLinkedIn("Head of Talent Acquisition"),
            confidence: 0.45,
            verification_status: "unknown",
            company,
            department: "HR",
            level: "Head",
          },
          {
            id: `suggested_talent_mgr_${Date.now() + 3}`,
            name: "Target: Recruiting Manager",
            title: "Recruiting Manager",
            email: "unknown@example.com",
            linkedin_url: mkLinkedIn("Recruiting Manager"),
            confidence: 0.4,
            verification_status: "unknown",
            company,
            department: "HR",
            level: "Manager",
          },
          {
            id: `suggested_cto_${Date.now() + 4}`,
            name: "Target: CTO / Technical Founder",
            title: "CTO",
            email: "unknown@example.com",
            linkedin_url: mkLinkedIn("CTO"),
            confidence: 0.4,
            verification_status: "unknown",
            company,
            department: "Engineering",
            level: "C-Level",
          },
        ];
        setSuggested(fallback);
      }
      try {
        localStorage.removeItem("found_contacts");
      } catch {}
    } finally {
      setIsSearching(false);
    }
  };

  const handleVerifyEmails = async () => {
    const selected = contacts.filter(c => selectedContacts.includes(c.id));
    const emailsToVerify = selected.map(c => c.email).filter((e) => isRealEmail(e));
    
    if (emailsToVerify.length === 0) return;
    
    setVerifyingEmails(emailsToVerify);
    setShowVerificationModal(true);

    try {
      const resp = await api<any>("/find-contact/verify", "POST", {
        contact_ids: selectedContacts,
        contacts: selected,
      });

      const verified = resp?.verified_contacts || [];
      const byId: Record<string, any> = {};
      for (const c of verified) byId[c.id] = c;

      setContacts(prev => {
        const next = prev.map(c => (byId[c.id] ? { ...c, ...byId[c.id] } : c));
        localStorage.setItem("found_contacts", JSON.stringify(next));
        return next;
      });
    } catch {
      // keep UX usable even if verify fails
    } finally {
      setVerifyingEmails([]);
      setShowVerificationModal(false);
    }
  };

  const handleContactSelect = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleContinue = () => {
    if (selectedContacts.length > 0) {
      const selectedContactData = contacts.filter(c => selectedContacts.includes(c.id));
      localStorage.setItem('selected_contacts', JSON.stringify(selectedContactData));
      router.push('/context-research');
    }
  };

  const getVerificationBadge = (status: string, score?: number): VerificationBadge => {
    if (status === 'valid' && (score || 0) >= 80) {
      return { label: 'Valid', color: 'green', icon: '✓' };
    } else if (status === 'risky' || (status === 'valid' && (score || 0) < 80)) {
      return { label: 'Risky', color: 'yellow', icon: '⚠' };
    } else if (status === 'invalid') {
      return { label: 'Invalid', color: 'red', icon: '✗' };
    } else {
      return { label: 'Unknown', color: 'gray', icon: '?' };
    }
  };

  const getBadgeColor = (color: string) => {
    switch (color) {
      case 'green': return 'bg-green-100 text-green-800';
      case 'yellow': return 'bg-yellow-100 text-yellow-800';
      case 'red': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-4">
          <a href="/painpoint-match" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
            <span className="mr-2">←</span> Back to Match
          </a>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Decision Makers</h1>
            <p className="text-white/70">
              Select a contact and reach out via email (if available) or LinkedIn.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          {/* Search Section */}
          <div className="mb-8">
            {companyOptions.length > 0 && (
              <div className="mb-6">
                <div className="text-xs font-semibold text-white/70 mb-3 uppercase tracking-wider">Quick Search: Companies from previous steps</div>
                <div className="flex flex-wrap gap-2">
                  {companyOptions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setSearchQuery(c);
                        // Trigger search automatically when clicking a quick-option? 
                        // Let's keep it manual for consistency unless asked.
                      }}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                        searchQuery === c
                          ? "brand-gradient text-black border-white/20 shadow-lg shadow-blue-500/20"
                          : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex space-x-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by company name, role, or LinkedIn URL..."
                className="flex-1 rounded-md border border-white/15 bg-black/30 px-4 py-2 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSearching ? "Searching..." : "Search"}
              </button>
            </div>
          </div>

          {/* Contacts List */}
          {contacts.length > 0 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Found Contacts</h2>
                {selectedContacts.length > 0 && (() => {
                  const verifiableCount = contacts.filter(
                    (c) => selectedContacts.includes(c.id) && isRealEmail(c.email)
                  ).length;
                  const canVerify = verifiableCount > 0;
                  const verifyLabel = `Verify emails (${verifiableCount}/${selectedContacts.length})`;

                  return (
                  <div className="flex items-center gap-2">
                    {canVerify && (
                      <button
                        onClick={handleVerifyEmails}
                        className="px-4 py-2 rounded-md font-medium transition-colors bg-green-600 text-white hover:bg-green-700"
                      >
                        {verifyLabel}
                      </button>
                    )}
                    <button
                      onClick={handleContinue}
                      className="px-4 py-2 rounded-md font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Continue (Email or LinkedIn outreach)
                    </button>
                  </div>
                  );
                })()}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contacts.map((contact) => {
                  const badge = getVerificationBadge(contact.verification_status, contact.verification_score);
                  const isSelected = selectedContacts.includes(contact.id);
                  
                  return (
                    <div
                      key={contact.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-white/10 hover:border-white/20 bg-black/20'
                      }`}
                      onClick={() => handleContactSelect(contact.id)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">{contact.name}</h3>
                          <p className="text-gray-600 text-sm">{formatTitleCase(contact.title)}</p>
                          <p className="text-gray-500 text-xs">{contact.company}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBadgeColor(badge.color)}`}>
                            {badge.icon} {badge.label}
                          </span>
                          {isSelected && (
                            <span className="text-blue-600">✓</span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {isRealEmail(contact.email) && (
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-500 text-sm">Email:</span>
                            <span className="text-sm font-mono">{contact.email}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-500 text-sm">Confidence:</span>
                          <div className="flex items-center space-x-1">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${contact.confidence * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-sm text-gray-600">
                              {Math.round(contact.confidence * 100)}%
                            </span>
                            <StarRating value={contact.confidence} scale="fraction" showNumeric={false} className="ml-1 text-[10px]" />
                          </div>
                        </div>

                        {contact.verification_score && (
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-500 text-sm">Verification:</span>
                            <span className="text-sm text-gray-600">
                              {contact.verification_score}%
                            </span>
                          </div>
                        )}

                        {contact.linkedin_url && (
                          <div>
                            <a
                              href={
                                contact.linkedin_url.startsWith("http://") || contact.linkedin_url.startsWith("https://")
                                  ? contact.linkedin_url
                                  : `https://${contact.linkedin_url.replace(/^\/+/, "")}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View LinkedIn Profile
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedContacts.length > 0 && (
                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => router.push('/painpoint-match')}
                    className="bg-gray-100 text-gray-700 px-6 py-3 rounded-md font-medium hover:bg-gray-200 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleContinue}
                    className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                  >
                    Continue to Research ({selectedContacts.length} selected)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Suggested targets (fallback when no contacts are found) */}
          {contacts.length === 0 && suggested.length > 0 && !isSearching && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Suggested targets</h2>
                  <p className="text-white/70 text-sm">
                    These are role targets with LinkedIn search links. Add a real person manually if you have one.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setManualOpen(true)}
                  className="px-4 py-2 rounded-md font-medium transition-colors bg-white/10 border border-white/20 text-white hover:bg-white/15"
                >
                  Add manually
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {suggested.map((contact) => {
                  const isSelected = selectedContacts.includes(contact.id);
                  return (
                    <div
                      key={contact.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        isSelected ? "border-blue-500 bg-blue-50" : "border-white/10 hover:border-white/20 bg-black/20"
                      }`}
                      onClick={() => handleContactSelect(contact.id)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">{contact.name}</h3>
                          <p className="text-gray-600 text-sm">{formatTitleCase(contact.title)}</p>
                          <p className="text-gray-500 text-xs">{contact.company}</p>
                        </div>
                        {isSelected && <span className="text-blue-600">✓</span>}
                      </div>
                      {contact.linkedin_url ? (
                        <a
                          href={contact.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open LinkedIn search
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleContinue}
                  disabled={selectedContacts.length === 0}
                  className="px-4 py-2 rounded-md font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Continue (Email or LinkedIn outreach)
                </button>
              </div>
            </div>
          )}

          {contacts.length === 0 && !isSearching && (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Contacts Found</h3>
              <p className="text-gray-600 mb-6">
                Search for contacts by company name, role, or LinkedIn URL to get started.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Manual add modal */}
      {manualOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="rounded-lg border border-white/10 bg-slate-950/90 backdrop-blur max-w-lg w-full p-6 text-slate-100 shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold">Add a decision maker manually</h2>
              <button className="text-white/70 hover:text-white" onClick={() => setManualOpen(false)}>
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/70 mb-1" htmlFor="manualName">Name</label>
                <input
                  id="manualName"
                  name="manualName"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-white/70 mb-1" htmlFor="manualTitle">Title</label>
                <input
                  id="manualTitle"
                  name="manualTitle"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="Director of Engineering"
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-white/70 mb-1" htmlFor="manualLinkedIn">LinkedIn URL (optional)</label>
                <input
                  id="manualLinkedIn"
                  name="manualLinkedIn"
                  value={manualLinkedIn}
                  onChange={(e) => setManualLinkedIn(e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-white/70 mb-1" htmlFor="manualEmail">Email (optional)</label>
                <input
                  id="manualEmail"
                  name="manualEmail"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 rounded-md bg-white/10 border border-white/20 text-white hover:bg-white/15"
                onClick={() => setManualOpen(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => {
                  const company = searchQuery.trim() || "Company";
                  const id = `manual_${Date.now()}`;
                  const c: Contact = {
                    id,
                    name: manualName.trim() || "Decision maker",
                    title: manualTitle.trim() || "Decision Maker",
                    email: (manualEmail.trim() || "unknown@example.com"),
                    linkedin_url: manualLinkedIn.trim() || undefined,
                    confidence: 0.7,
                    verification_status: "unknown",
                    verification_score: undefined,
                    company,
                    department: "General",
                    level: "Director",
                  };
                  setContacts([c]);
                  setSelectedContacts([id]);
                  setSuggested([]);
                  setManualOpen(false);
                  setManualName("");
                  setManualTitle("");
                  setManualLinkedIn("");
                  setManualEmail("");
                  localStorage.setItem("found_contacts", JSON.stringify([c]));
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="rounded-lg border border-white/10 bg-slate-950/90 backdrop-blur max-w-md w-full p-6 text-slate-100 shadow-2xl shadow-black/30">
            <h2 className="text-xl font-semibold mb-4">Verifying Emails</h2>
            <p className="text-gray-600 mb-4">
              Verifying {verifyingEmails.length} email addresses...
            </p>
            <div className="space-y-2">
              {verifyingEmails.map((email, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-gray-600">{email}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
