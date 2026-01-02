"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getCurrentDataMode } from "@/lib/dataMode";

interface Contact {
  id: string;
  name: string;
  title: string;
  email: string;
  company: string;
  department: string;
  level: string;
  linkedin_url?: string;
  email_source?: string;
  location_name?: string;
  location_country?: string;
  job_company_website?: string;
  job_company_linkedin_url?: string;
  job_company_industry?: string;
  job_company_size?: string;
}

interface CompanySummary {
  name: string;
  description: string;
  industry: string;
  size: string;
  founded: string;
  headquarters: string;
  website: string;
  linkedin_url?: string;
}

interface ContactBio {
  name: string;
  title: string;
  company: string;
  bio: string;
  experience: string;
  education: string;
  skills: string[];
  linkedin_url?: string;
  public_profile_highlights?: string[];
  publications?: string[];
  post_topics?: string[];
  opinions?: string[];
  other_interesting_facts?: string[];
}

interface RecentNews {
  title: string;
  summary: string;
  date: string;
  source: string;
  url: string;
}

interface ResearchData {
  company_summary: CompanySummary;
  contact_bios: ContactBio[];
  recent_news: RecentNews[];
  shared_connections: string[];
  background_report_title?: string | null;
  background_report_sections?: Array<{
    heading: string;
    body: string;
    sources?: Array<{ title: string; url: string }>;
  }> | null;
}

export default function ContextResearchPage() {
  const router = useRouter();
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [researchData, setResearchData] = useState<ResearchData | null>(null);
  const [researchByContact, setResearchByContact] = useState<Record<string, ResearchData>>({});
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [dataMode, setDataMode] = useState<"demo" | "live">("live");
  const [helper, setHelper] = useState<{
    hooks?: string[];
    corpus_preview?: any;
    research_scope?: "company" | "division";
    scope_target?: string;
  } | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const formatTitleCase = (input?: string) => {
    const s = String(input || "").trim();
    if (!s) return "";
    const lowerWords = new Set(["of", "and"]);

    const words = s.split(/\s+/).filter(Boolean);
    const out = words.map((w, idx) => {
      // Preserve acronyms / all-caps tokens (VP, CEO, AI/ML, etc)
      if (w.length <= 6 && w === w.toUpperCase()) return w;
      // Preserve tokens with slashes/dots (AI/ML, SRE/DevOps, etc) but title-case parts
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

  useEffect(() => {
    setDataMode(getCurrentDataMode());
    // Load selected contacts from localStorage
    const savedContacts = localStorage.getItem('selected_contacts');
    if (savedContacts) {
      const parsed = JSON.parse(savedContacts);
      setSelectedContacts(parsed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setActiveContactId(parsed[0]?.id || null);
      }
    }
  }, []);

  const handleResearch = async () => {
    if (selectedContacts.length === 0) return;
    
    setIsResearching(true);

    setError(null);
    try {
      // Fast path: if we already have research cached locally for these exact contacts, reuse it.
      try {
        const cachedByContactRaw = localStorage.getItem("context_research_by_contact");
        const cachedActiveId = localStorage.getItem("context_research_active_contact_id");
        const cachedByContact = cachedByContactRaw ? JSON.parse(cachedByContactRaw) : null;
        const cachedKeys = cachedByContact ? Object.keys(cachedByContact) : [];
        const selectedIds = selectedContacts.map((c) => c.id).filter(Boolean);
        const sameSet =
          cachedKeys.length === selectedIds.length &&
          selectedIds.every((id) => cachedKeys.includes(id));

        if (cachedByContact && sameSet) {
          setResearchByContact(cachedByContact);
          const nextId = cachedActiveId && cachedByContact[cachedActiveId] ? cachedActiveId : selectedIds[0] || null;
          if (nextId) setActiveContactId(nextId);
          setResearchData(nextId ? cachedByContact[nextId] : null);
          setIsResearching(false);
          return;
        }
      } catch {
        // Ignore cache parse errors and fall through to backend call.
      }

      const companyName =
        selectedContacts[0]?.company ||
        (() => {
          try {
            const jdsRaw = localStorage.getItem("job_descriptions");
            const jds = jdsRaw ? JSON.parse(jdsRaw) : [];
            return jds?.[0]?.company || "TechCorp Inc.";
          } catch {
            return "TechCorp Inc.";
          }
        })();

      let selectedJD: any = null;
      try {
        selectedJD = JSON.parse(localStorage.getItem("selected_job_description") || "null");
      } catch {}

      const resp = await api<any>("/context-research/research", "POST", {
        contact_ids: selectedContacts.map((c) => c.id),
        contacts: selectedContacts,
        company_name: companyName,
        selected_job_description: selectedJD,
        data_mode: getCurrentDataMode(),
      });

      if (!resp?.success || !resp?.research_data) {
        throw new Error(resp?.message || "Research failed");
      }

      const byContact: Record<string, ResearchData> = resp?.research_by_contact || {};
      const nextActiveId =
        activeContactId ||
        selectedContacts[0]?.id ||
        Object.keys(byContact)[0] ||
        null;

      setResearchByContact(byContact);
      if (nextActiveId) setActiveContactId(nextActiveId);

      const nextResearch =
        (nextActiveId && byContact?.[nextActiveId]) ? byContact[nextActiveId] : resp.research_data;
      setResearchData(nextResearch);
      setHelper(resp.helper || null);

      // Persist for downstream screens (Compose expects `context_research`).
      localStorage.setItem("context_research", JSON.stringify(nextResearch));
      localStorage.setItem("context_research_by_contact", JSON.stringify(byContact));
      if (nextActiveId) localStorage.setItem("context_research_active_contact_id", String(nextActiveId));
      localStorage.setItem("context_research_helper", JSON.stringify(resp.helper || {}));
      // Backwards compatibility for older screen key.
      localStorage.setItem("research_data", JSON.stringify(nextResearch));
    } catch (e: any) {
      // Deterministic-ish fallback if backend is unavailable.
      const companyName = selectedContacts[0]?.company || "TechCorp Inc.";
      const slug = companyName.toLowerCase().replace(/\s+/g, "");
      const fallback: ResearchData = {
        company_summary: {
          name: companyName,
          description:
            `Research for ${companyName}. ` +
            `Couldn’t reach the backend right now. If you’re trying to run real research, make sure Data Mode is set to Live and the backend is running.`,
          industry: "Unknown",
          size: "Unknown",
          founded: "Unknown",
          headquarters: "Unknown",
          website: `https://${slug}.com`,
          linkedin_url: `https://linkedin.com/company/${slug}`,
        },
        contact_bios: selectedContacts.map((contact) => ({
          name: contact.name,
          title: contact.title,
          company: contact.company,
          bio: `${contact.name} is a ${contact.title} at ${contact.company}. Bio details are limited in demo mode.`,
          experience: "Experience details limited in demo mode.",
          education: "Education details limited in demo mode.",
          skills: [],
          linkedin_url: `https://linkedin.com/in/${contact.name.toLowerCase().replace(/\s+/g, "")}`,
        })),
        // No fake/placeholder news. If backend is down, we simply have no sources.
        recent_news: [],
        shared_connections: [],
      };

      setResearchData(fallback);
      const byId: Record<string, ResearchData> = {};
      // Make the fallback selectable per contact (same company info, contact-specific bio).
      selectedContacts.forEach((c, idx) => {
        byId[c.id] = {
          ...fallback,
          contact_bios: [fallback.contact_bios[idx] || fallback.contact_bios[0]].filter(Boolean) as any,
        };
      });
      setResearchByContact(byId);
      if (!activeContactId && selectedContacts[0]?.id) setActiveContactId(selectedContacts[0].id);
      const fallbackHelper = {
        hooks: [
          "Limited signals — add a specific job/pain point to make outreach hooks sharper",
          "Lead with a concrete outcome you can improve (no fluff)",
        ],
      };
      setHelper(fallbackHelper);
      const activeId = activeContactId || selectedContacts[0]?.id;
      const activeResearch = (activeId && byId[activeId]) ? byId[activeId] : fallback;
      localStorage.setItem("context_research", JSON.stringify(activeResearch));
      localStorage.setItem("context_research_by_contact", JSON.stringify(byId));
      if (activeId) localStorage.setItem("context_research_active_contact_id", String(activeId));
      localStorage.setItem("context_research_helper", JSON.stringify(fallbackHelper));
      localStorage.setItem("research_data", JSON.stringify(fallback));
      // Don't show a scary banner; silently fall back without fabricating details.
    } finally {
      setIsResearching(false);
    }
  };

  const handleEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const handleSaveEdit = () => {
    if (!researchData || !editingField) return;
    
    setResearchData(prev => {
      if (!prev) return prev;
      
      const newData = { ...prev };
      
      if (editingField === 'company_summary') {
        newData.company_summary = { ...newData.company_summary, description: editValue };
      } else if (editingField.startsWith('contact_')) {
        const contactIndex = parseInt(editingField.split('_')[1]);
        if (newData.contact_bios[contactIndex]) {
          newData.contact_bios[contactIndex] = { ...newData.contact_bios[contactIndex], bio: editValue };
        }
      }
      
      return newData;
    });
    
    setEditingField(null);
    setEditValue("");
  };

  const handleContinue = () => {
    if (researchData) {
      localStorage.setItem("context_research", JSON.stringify(researchData));
      localStorage.setItem("research_data", JSON.stringify(researchData));
      if (activeContactId) localStorage.setItem("context_research_active_contact_id", String(activeContactId));
      router.push('/offer-creation');
    }
  };

  const getVariableText = (variable: string) => {
    if (!researchData) return `{{${variable}}}`;
    
    switch (variable) {
      case 'company_summary':
        return researchData.company_summary.description;
      case 'contact_bio':
        return researchData.contact_bios[0]?.bio || 'Contact bio not available';
      case 'recent_news':
        return researchData.recent_news[0]?.summary || 'No recent news available';
      default:
        return `{{${variable}}}`;
    }
  };

  const handleSelectContact = (contactId: string) => {
    setActiveContactId(contactId);
    const next = researchByContact?.[contactId];
    if (next) {
      setResearchData(next);
      try {
        localStorage.setItem("context_research", JSON.stringify(next));
        localStorage.setItem("research_data", JSON.stringify(next));
        localStorage.setItem("context_research_active_contact_id", String(contactId));
      } catch {}
    }
  };

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-4">
          <a href="/find-contact" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
            <span className="mr-2">←</span> Back to Contact
          </a>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Background Research</h1>
            <p className="text-white/70">
              Hiring signals, contact context, and company intelligence to contextualize your outreach.
            </p>
            {dataMode === "demo" ? (
              <div className="mt-2 text-xs text-yellow-200">
                Data Mode is <span className="font-semibold">Demo</span> — web lookups are disabled. Switch to{" "}
                <span className="font-semibold">Live</span> in the navbar to enable real research.
              </div>
            ) : null}
            {helper?.research_scope && (
              <div className="mt-3 text-xs text-white/70">
                <span className="font-semibold text-white/80">Research scope:</span>{" "}
                {helper.research_scope === "division" ? "Division / org-level" : "Company-level"}
                {helper.scope_target ? (
                  <span className="text-white/60"> — {String(helper.scope_target)}</span>
                ) : null}
              </div>
            )}
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-orange-400/30 bg-orange-500/10 p-4 text-sm text-white/80">
              {error}
            </div>
          )}

          {helper?.hooks?.length ? (
            <div className="mb-6 rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-bold text-white mb-2">GPT Helper: outreach hooks</div>
              <ul className="list-disc list-inside text-sm text-white/70 space-y-1">
                {helper.hooks.slice(0, 5).map((h: string, i: number) => (
                  <li key={`hook_${i}`}>{h}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {selectedContacts.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No Contacts Selected</h3>
              <p className="text-white/70 mb-6">
                Please go back and select contacts to research.
              </p>
              <button
                onClick={() => router.push('/find-contact')}
                className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                Go to Find Contact
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Selected Contacts */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Selected Contacts</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedContacts.map((contact) => (
                    <button
                      type="button"
                      key={contact.id}
                      onClick={() => handleSelectContact(contact.id)}
                      className={`text-left border rounded-lg p-4 transition-colors ${
                        activeContactId === contact.id
                          ? "border-blue-400/60 bg-blue-500/10"
                          : "border-white/10 bg-black/20 hover:bg-black/30"
                      }`}
                      title="Click to view research for this contact"
                    >
                      <h3 className="font-semibold text-white">{contact.name}</h3>
                      <p className="text-white/70 text-sm">{formatTitleCase(contact.title)}</p>
                      {contact.department ? (
                        <p className="text-white/60 text-xs">{formatTitleCase(contact.department)}</p>
                      ) : null}
                      <p className="text-white/50 text-xs">{contact.company}</p>
                      {activeContactId === contact.id ? (
                        <p className="mt-2 text-xs text-blue-200/80">Active</p>
                      ) : null}
                    </button>
                  ))}
                </div>
                {selectedContacts.length > 1 ? (
                  <p className="mt-2 text-xs text-white/60">
                    Click a contact to swap the research panels below (Company Summary, Contact Bio, News, Shared Connections).
                  </p>
                ) : null}
              </div>

              {/* Research Button */}
              <div className="text-center">
                <button
                  onClick={handleResearch}
                  disabled={isResearching}
                  className="bg-blue-600 text-white px-8 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isResearching ? "Researching..." : "Start Research"}
                </button>
              </div>

              {/* Research Results */}
              {researchData && (
                <div className="space-y-8">
                  {activeContactId ? (
                    <div className="text-sm text-white/70">
                      <span className="font-semibold text-white/80">Viewing research for:</span>{" "}
                      {selectedContacts.find((c) => c.id === activeContactId)?.name || "Selected contact"}
                    </div>
                  ) : null}
                  {/* Contact Background Report (dynamic sections; omit low-signal) */}
                  {Array.isArray(researchData.background_report_sections) &&
                  researchData.background_report_sections.length > 0 ? (
                    <div>
                      <h2 className="text-xl font-semibold mb-4">
                        {researchData.background_report_title || "Contact Background Report"}
                      </h2>
                      <div className="space-y-4">
                        {researchData.background_report_sections
                          .filter((s) => {
                            const body = String(s?.body || "").trim();
                            // Hide anything shorter than ~2 sentences.
                            const sentenceCount = (body.match(/[.!?](\s|$)/g) || []).length;
                            return body.length >= 120 && sentenceCount >= 2;
                          })
                          .slice(0, 20)
                          .map((s, idx) => (
                            <div key={`sec_${idx}`} className="border border-gray-200 rounded-lg p-4">
                              <div className="text-sm font-semibold text-gray-900">{s.heading}</div>
                              <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{s.body}</div>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Company Summary */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-semibold">Company Summary</h2>
                      <button
                        onClick={() => handleEdit('company_summary', researchData.company_summary.description)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                    </div>
                    
                    {editingField === 'company_summary' ? (
                      <div className="space-y-3">
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 h-32"
                        />
                        <div className="flex space-x-2">
                          <button
                            onClick={handleSaveEdit}
                            className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingField(null)}
                            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-gray-700">{researchData.company_summary.description}</p>
                        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Industry:</span> {researchData.company_summary.industry}
                          </div>
                          <div>
                            <span className="font-medium">Size:</span> {researchData.company_summary.size}
                          </div>
                          <div>
                            <span className="font-medium">Founded:</span> {researchData.company_summary.founded}
                          </div>
                          <div>
                            <span className="font-medium">Headquarters:</span> {researchData.company_summary.headquarters}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Contact Bios */}
                  <div>
                    <h2 className="text-xl font-semibold mb-4">Contact Bios</h2>
                    {selectedContacts.length > 1 ? (
                      <div className="mb-3 text-xs text-white/60">
                        Showing the active contact’s bio. Click a different contact above to switch.
                      </div>
                    ) : null}
                    <div className="space-y-4">
                      {researchData.contact_bios.map((bio, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="font-semibold text-gray-900">{bio.name}</h3>
                            <button
                              onClick={() => handleEdit(`contact_${index}`, bio.bio)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Edit
                            </button>
                          </div>
                          
                          {editingField === `contact_${index}` ? (
                            <div className="space-y-3">
                              <textarea
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 h-24"
                              />
                              <div className="flex space-x-2">
                                <button
                                  onClick={handleSaveEdit}
                                  className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingField(null)}
                                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-200"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="mb-1 text-xs text-gray-600">
                                {formatTitleCase(bio.title)}{bio.company ? ` • ${bio.company}` : ""}
                              </div>
                              <p className="text-gray-700 mb-3">{bio.bio}</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="font-medium">Experience:</span> {bio.experience}
                                </div>
                                <div>
                                  <span className="font-medium">Education:</span> {bio.education}
                                </div>
                                <div className="md:col-span-2">
                                  <span className="font-medium">Skills:</span> {bio.skills.join(", ")}
                                </div>
                                {(bio.public_profile_highlights?.length ||
                                  bio.publications?.length ||
                                  bio.post_topics?.length ||
                                  bio.opinions?.length ||
                                  bio.other_interesting_facts?.length) ? (
                                  <div className="md:col-span-2">
                                    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                                      <div className="text-xs font-semibold text-gray-700 mb-2">Public profile insights (best effort)</div>
                                      {bio.public_profile_highlights?.length ? (
                                        <div className="mb-2">
                                          <div className="text-xs font-medium text-gray-600">Highlights</div>
                                          <ul className="mt-1 list-disc pl-5 text-gray-700">
                                            {bio.public_profile_highlights.slice(0, 6).map((x, idx) => (
                                              <li key={idx}>{x}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      ) : null}
                                      {bio.post_topics?.length ? (
                                        <div className="mb-2">
                                          <div className="text-xs font-medium text-gray-600">Post topics</div>
                                          <div className="mt-1 flex flex-wrap gap-1">
                                            {bio.post_topics.slice(0, 10).map((t, idx) => (
                                              <span key={idx} className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-700">
                                                {t}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      ) : null}
                                      {bio.publications?.length ? (
                                        <div className="mb-2">
                                          <div className="text-xs font-medium text-gray-600">Publications / writing</div>
                                          <ul className="mt-1 list-disc pl-5 text-gray-700">
                                            {bio.publications.slice(0, 5).map((x, idx) => (
                                              <li key={idx}>{x}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      ) : null}
                                      {bio.opinions?.length ? (
                                        <div className="mb-2">
                                          <div className="text-xs font-medium text-gray-600">Opinions / takes</div>
                                          <ul className="mt-1 list-disc pl-5 text-gray-700">
                                            {bio.opinions.slice(0, 5).map((x, idx) => (
                                              <li key={idx}>{x}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      ) : null}
                                      {bio.other_interesting_facts?.length ? (
                                        <div>
                                          <div className="text-xs font-medium text-gray-600">Other interesting facts</div>
                                          <ul className="mt-1 list-disc pl-5 text-gray-700">
                                            {bio.other_interesting_facts.slice(0, 5).map((x, idx) => (
                                              <li key={idx}>{x}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="md:col-span-2">
                                    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                                      Public profile insights will appear here when we have public snippets (e.g., via Serper) or other sources.
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent News */}
                  <div>
                    <h2 className="text-xl font-semibold mb-4">Recent News</h2>
                    {researchData.recent_news.length === 0 ? (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                        No sourced news available right now.
                        <div className="mt-1 text-xs text-gray-500">
                          To fetch real headlines + links, set Data Mode to <span className="font-semibold">Live</span> and configure Serper.
                          Until then, use the <span className="font-semibold">hooks</span> above as “timing” angles.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {researchData.recent_news.map((news, index) => {
                          const hasUrl = Boolean((news.url || "").trim());
                          const isUnsourced = !hasUrl;
                          return (
                            <div key={index} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-start justify-between gap-3">
                                <h3 className="font-semibold text-gray-900 mb-2">{news.title}</h3>
                                {isUnsourced ? (
                                  <span className="shrink-0 rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[11px] font-semibold text-yellow-800">
                                    Unsourced theme
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-gray-700 mb-2">{news.summary}</p>
                              <div className="flex justify-between items-center text-sm text-gray-500">
                                <span>
                                  {(news.source || "General").trim()}
                                  {news.date ? ` • ${news.date}` : ""}
                                </span>
                                {hasUrl ? (
                                  <a
                                    href={news.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800"
                                  >
                                    Read More
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Shared Connections */}
                  {researchData.shared_connections.length > 0 ? (
                    <div>
                      <h2 className="text-xl font-semibold mb-4">Shared Connections</h2>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <ul className="space-y-2">
                          {researchData.shared_connections.map((connection, index) => (
                            <li key={index} className="flex items-center space-x-2">
                              <span className="text-green-500">•</span>
                              <span className="text-gray-700">{connection}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}

                  {/* Variables Preview */}
                  <div>
                    <h2 className="text-xl font-semibold mb-4">Available Variables</h2>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800 mb-3">
                        These variables can be used in your email templates:
                      </p>
                      <div className="space-y-2 text-sm">
                        <div>
                          <code className="bg-blue-100 px-2 py-1 rounded">{"{{company_summary}}"}</code>
                          <span className="ml-2 text-gray-600">
                            {getVariableText('company_summary').substring(0, 100)}...
                          </span>
                        </div>
                        <div>
                          <code className="bg-blue-100 px-2 py-1 rounded">{"{{contact_bio}}"}</code>
                          <span className="ml-2 text-gray-600">
                            {getVariableText('contact_bio').substring(0, 100)}...
                          </span>
                        </div>
                        <div>
                          <code className="bg-blue-100 px-2 py-1 rounded">{"{{recent_news}}"}</code>
                          <span className="ml-2 text-gray-600">
                            {getVariableText('recent_news').substring(0, 100)}...
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4">
                    <button
                      onClick={() => router.push('/find-contact')}
                      className="bg-gray-100 text-gray-700 px-6 py-3 rounded-md font-medium hover:bg-gray-200 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleContinue}
                      className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                    >
                      Continue to Offer Creation
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
