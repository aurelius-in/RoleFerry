"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { getCurrentDataMode } from "@/lib/dataMode";
import { formatCompanyName } from "@/lib/format";

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
  const [userKey, setUserKey] = useState<string>("anon");
  const [researchData, setResearchData] = useState<ResearchData | null>(null);
  const [researchByContact, setResearchByContact] = useState<Record<string, ResearchData>>({});
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [researchHistory, setResearchHistory] = useState<
    Array<{ contact: Contact; research: ResearchData; researched_at: string }>
  >([]);
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

  const RESEARCH_HISTORY_KEY = "context_research_history";
  const getSavedVerifiedKey = (uid: string) => `rf_saved_verified_contacts:${uid || "anon"}`;

  const loadResearchHistory = () => {
    try {
      const raw = localStorage.getItem(RESEARCH_HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const persistResearchHistory = (items: Array<{ contact: Contact; research: ResearchData; researched_at: string }>) => {
    try {
      localStorage.setItem(RESEARCH_HISTORY_KEY, JSON.stringify(items || []));
    } catch {}
  };

  const upsertResearchHistory = (byContact: Record<string, ResearchData>, contacts: Contact[]) => {
    const now = new Date().toISOString();
    setResearchHistory((prev) => {
      const map = new Map<string, { contact: Contact; research: ResearchData; researched_at: string }>();
      for (const it of Array.isArray(prev) ? prev : []) {
        if (it?.contact?.id) map.set(String(it.contact.id), it);
      }
      for (const c of contacts || []) {
        const id = String(c?.id || "").trim();
        if (!id) continue;
        const r = byContact?.[id];
        if (!r) continue;
        map.set(id, {
          contact: c,
          research: r,
          researched_at: now,
        });
      }
      const next = Array.from(map.values()).sort((a, b) => String(b.researched_at).localeCompare(String(a.researched_at)));
      persistResearchHistory(next);
      return next;
    });
  };

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
    setResearchHistory(loadResearchHistory());
    // Load contacts from the previous step:
    // - Prefer the full saved verified contacts set (persisted across searches)
    // - Fall back to 'selected_contacts' (legacy)
    try {
      const u = JSON.parse(localStorage.getItem("rf_user") || "null");
      const uid = String(u?.id || "anon");
      setUserKey(uid);

      let fromSaved: any[] = [];
      try {
        const rawSaved = localStorage.getItem(getSavedVerifiedKey(uid));
        const parsedSaved = rawSaved ? JSON.parse(rawSaved) : [];
        if (Array.isArray(parsedSaved)) fromSaved = parsedSaved;
      } catch {}

      let fromSelected: any[] = [];
      try {
        const rawSelected = localStorage.getItem("selected_contacts");
        const parsedSelected = rawSelected ? JSON.parse(rawSelected) : [];
        if (Array.isArray(parsedSelected)) fromSelected = parsedSelected;
      } catch {}

      const chosen = (fromSaved && fromSaved.length > 0) ? fromSaved : fromSelected;
      if (Array.isArray(chosen) && chosen.length > 0) {
        setSelectedContacts(chosen as any);
        setActiveContactId(String((chosen as any)[0]?.id || "") || null);
      }
    } catch {
      // Legacy fallback
      try {
        const raw = localStorage.getItem("selected_contacts");
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
          setSelectedContacts(parsed as any);
          if (parsed.length > 0) setActiveContactId(parsed[0]?.id || null);
        }
      } catch {}
    }
  }, []);

  const handleResearch = async () => {
    if (selectedContacts.length === 0) return;
    
    setIsResearching(true);

    setError(null);
    try {
      // Fast path: if we already have research cached locally for these exact contacts + same job/company context, reuse it.
      try {
        const cachedByContactRaw = localStorage.getItem("context_research_by_contact");
        const cachedActiveId = localStorage.getItem("context_research_active_contact_id");
        const cachedMetaRaw = localStorage.getItem("context_research_meta");
        const cachedMeta = cachedMetaRaw ? JSON.parse(cachedMetaRaw) : null;
        const cachedByContact = cachedByContactRaw ? JSON.parse(cachedByContactRaw) : null;
        const cachedKeys = cachedByContact ? Object.keys(cachedByContact) : [];
        const selectedIds = selectedContacts.map((c) => c.id).filter(Boolean);
        const sameSet =
          cachedKeys.length === selectedIds.length &&
          selectedIds.every((id) => cachedKeys.includes(id));

        let selectedJD: any = null;
        try {
          selectedJD = JSON.parse(localStorage.getItem("selected_job_description") || "null");
        } catch {}
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
        const wantMode = getCurrentDataMode();
        const metaOk =
          cachedMeta &&
          String(cachedMeta?.company_name || "") === String(companyName || "") &&
          String(cachedMeta?.jd_title || "") === String(selectedJD?.title || "") &&
          String(cachedMeta?.data_mode || "") === String(wantMode || "");

        if (cachedByContact && sameSet && metaOk) {
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

      // Optional grounding context for smarter background reports
      let resumeExtract: any = null;
      let painpointMatches: any[] = [];
      try {
        resumeExtract = JSON.parse(localStorage.getItem("resume_extract") || "null");
      } catch {}
      try {
        painpointMatches = JSON.parse(localStorage.getItem("painpoint_matches") || "[]") || [];
      } catch {}

      const resp = await api<any>("/context-research/research", "POST", {
        contact_ids: selectedContacts.map((c) => c.id),
        contacts: selectedContacts,
        company_name: companyName,
        selected_job_description: selectedJD,
        resume_extract: resumeExtract,
        painpoint_matches: painpointMatches,
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
      localStorage.setItem(
        "context_research_meta",
        JSON.stringify({
          company_name: companyName,
          jd_title: String(selectedJD?.title || ""),
          data_mode: getCurrentDataMode(),
        })
      );
      if (nextActiveId) localStorage.setItem("context_research_active_contact_id", String(nextActiveId));
      localStorage.setItem("context_research_helper", JSON.stringify(resp.helper || {}));
      // Backwards compatibility for older screen key.
      localStorage.setItem("research_data", JSON.stringify(nextResearch));

      // Persist a growing list of researched contacts (across runs), so research isn’t overwritten
      // when users come back and research a different person.
      upsertResearchHistory(byContact, selectedContacts);
    } catch (e: any) {
      // Deterministic-ish fallback if backend is unavailable.
      const companyName = selectedContacts[0]?.company || "TechCorp Inc.";
      const slug = companyName.toLowerCase().replace(/\s+/g, "");
      const fallback: ResearchData = {
        company_summary: {
          name: companyName,
          description:
            `High-level overview for ${formatCompanyName(companyName)}.`,
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
          bio: `${contact.name} is a ${contact.title} at ${formatCompanyName(contact.company)}.`,
          experience: "Unknown",
          education: "Unknown",
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

      upsertResearchHistory(byId, selectedContacts);
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
    const cid = String(contactId || "").trim();
    if (!cid) return;
    setActiveContactId(cid);

    // 1) Immediate hit: in-memory or saved history.
    const next = researchByContact?.[cid];
    const fromHistory = researchHistory.find((h) => String(h?.contact?.id) === cid);
    const chosen = next || fromHistory?.research || null;
    if (chosen) {
      setResearchData(chosen);
      try {
        localStorage.setItem("context_research", JSON.stringify(chosen));
        localStorage.setItem("research_data", JSON.stringify(chosen));
        localStorage.setItem("context_research_active_contact_id", cid);
      } catch {}
      return;
    }

    // 2) If we have cached per-contact research from a prior run, reuse it.
    try {
      const cachedByContactRaw = localStorage.getItem("context_research_by_contact");
      const cachedByContact = cachedByContactRaw ? JSON.parse(cachedByContactRaw) : null;
      if (cachedByContact && typeof cachedByContact === "object" && cachedByContact[cid]) {
        const cached = cachedByContact[cid];
        setResearchByContact((prev) => ({ ...(prev || {}), [cid]: cached }));
        setResearchData(cached);
        try {
          localStorage.setItem("context_research", JSON.stringify(cached));
          localStorage.setItem("research_data", JSON.stringify(cached));
          localStorage.setItem("context_research_active_contact_id", cid);
        } catch {}
        return;
      }
    } catch {}

    // 3) No cached research — run research for this single contact on click.
    const contact = selectedContacts.find((c) => String(c?.id || "") === cid);
    if (!contact) return;

    (async () => {
      setIsResearching(true);
      setError(null);
      try {
        const companyName =
          contact?.company ||
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

        // Optional grounding context for smarter background reports
        let resumeExtract: any = null;
        let painpointMatches: any[] = [];
        try {
          resumeExtract = JSON.parse(localStorage.getItem("resume_extract") || "null");
        } catch {}
        try {
          painpointMatches = JSON.parse(localStorage.getItem("painpoint_matches") || "[]") || [];
        } catch {}

        const resp = await api<any>("/context-research/research", "POST", {
          contact_ids: [cid],
          contacts: [contact],
          company_name: companyName,
          selected_job_description: selectedJD,
          resume_extract: resumeExtract,
          painpoint_matches: painpointMatches,
          data_mode: getCurrentDataMode(),
        });

        if (!resp?.success || !resp?.research_data) {
          throw new Error(resp?.message || "Research failed");
        }

        const byContact: Record<string, ResearchData> = resp?.research_by_contact || {};
        const nextResearch =
          (byContact?.[cid] as any) || (resp.research_data as any);

        setResearchByContact((prev) => ({ ...(prev || {}), ...(byContact || {}), [cid]: nextResearch }));
        setResearchData(nextResearch);
        setHelper(resp.helper || null);

        // Persist for downstream screens (Offer Creation expects `context_research`).
        try {
          localStorage.setItem("context_research", JSON.stringify(nextResearch));
          localStorage.setItem("context_research_by_contact", JSON.stringify({ ...(byContact || {}), [cid]: nextResearch }));
          localStorage.setItem(
            "context_research_meta",
            JSON.stringify({
              company_name: companyName,
              jd_title: String(selectedJD?.title || ""),
              data_mode: getCurrentDataMode(),
            })
          );
          localStorage.setItem("context_research_active_contact_id", cid);
          localStorage.setItem("context_research_helper", JSON.stringify(resp.helper || {}));
          localStorage.setItem("research_data", JSON.stringify(nextResearch));
        } catch {}

        upsertResearchHistory({ ...(byContact || {}), [cid]: nextResearch } as any, [contact]);
      } catch (e: any) {
        setError(String(e?.message || "Research failed"));
      } finally {
        setIsResearching(false);
      }
    })();
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
              <div className="text-sm font-bold text-white mb-2">Smart Helper: outreach hooks</div>
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
              {/* Contacts + Start Research (cleaner workflow) */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Contacts to research</h2>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Left: contacts list (primary) */}
                  <div className="lg:col-span-5">
                    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-white/90">Saved contacts</div>
                          <div className="mt-1 text-[11px] text-white/55">
                            These come from the previous step. Click a contact to view their research.
                          </div>
                        </div>
                        <div className="text-[10px] text-white/50">{selectedContacts.length}</div>
                      </div>

                      <div className="mt-3 space-y-2 max-h-[520px] overflow-auto pr-1">
                        {selectedContacts.map((contact) => {
                          const active = activeContactId === contact.id;
                          return (
                            <div
                              key={contact.id}
                              className={`rounded-lg border p-3 transition-colors ${
                                active ? "border-blue-400/60 bg-blue-500/10" : "border-white/10 bg-black/10 hover:bg-black/20"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => handleSelectContact(contact.id)}
                                className="w-full text-left"
                                title="Set as active contact"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-white truncate">{contact.name}</div>
                                    <div className="text-xs text-white/70 truncate">{formatTitleCase(contact.title)}</div>
                                    <div className="text-[11px] text-white/50 truncate">{formatCompanyName(contact.company)}</div>
                                  </div>
                                  {active ? (
                                    <span className="shrink-0 rounded-full border border-blue-300/40 bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-100">
                                      Active
                                    </span>
                                  ) : null}
                                </div>
                              </button>

                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  value={String(contact.linkedin_url || "")}
                                  onChange={(e) => {
                                    const nextVal = e.target.value;
                                    setSelectedContacts((prev) => {
                                      const next = (prev || []).map((c) => (c.id === contact.id ? { ...c, linkedin_url: nextVal } : c));
                                      try {
                                        localStorage.setItem("selected_contacts", JSON.stringify(next));
                                        // Keep the canonical saved-verified store in sync so this sticks across runs.
                                        localStorage.setItem(getSavedVerifiedKey(userKey), JSON.stringify(next));
                                      } catch {}
                                      return next;
                                    });
                                  }}
                                  placeholder="Paste LinkedIn URL (optional, helps research)"
                                  className="flex-1 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {contact.linkedin_url ? (
                                  <a
                                    href={String(contact.linkedin_url)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 text-xs font-semibold text-blue-200/90 hover:text-blue-100"
                                  >
                                    Open
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Right: actions + saved research shortcuts (small, non-redundant) */}
                  <div className="lg:col-span-7">
                    <div className="rounded-lg border border-white/10 bg-black/10 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-bold text-white/90">Research workflow</div>
                          <div className="mt-1 text-[11px] text-white/55">
                            Click a contact on the left to load their research. If we don’t have it yet, we’ll research that contact automatically.
                          </div>
                        </div>
                      </div>

                      {isResearching ? (
                        <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                            <div className="text-sm text-white/70">Researching…</div>
                          </div>
                        </div>
                      ) : dataMode === "demo" ? (
                        <div className="mt-4 text-xs text-yellow-200/90">
                          Demo mode: web lookups are limited. Switch to <span className="font-semibold">Live</span> for richer results.
                        </div>
                      ) : null}

                      {researchHistory.length > 0 ? (
                        <div className="mt-5">
                          <div className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                            Recently researched
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {researchHistory.slice(0, 10).map((h) => {
                              const id = String(h?.contact?.id || "");
                              const active = activeContactId === id;
                              return (
                                <button
                                  key={`histpill_${id}`}
                                  type="button"
                                  onClick={() => handleSelectContact(id)}
                                  className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                                    active
                                      ? "brand-gradient text-black border-white/20"
                                      : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
                                  }`}
                                  title="Load saved research"
                                >
                                  {String(h?.contact?.name || "Contact").split(/\s+/)[0] || "Contact"}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-5 text-xs text-white/55">
                          No saved research yet. After you run research once, quick-switch pills will appear here.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Research Results */}
              {researchData && (
                <div className="space-y-8">
                  {activeContactId ? (
                    <div className="text-sm text-white/70">
                      <span className="font-semibold text-white/80">Viewing research for:</span>{" "}
                      {selectedContacts.find((c) => c.id === activeContactId)?.name ||
                        researchHistory.find((h) => String(h?.contact?.id) === String(activeContactId))?.contact?.name ||
                        "Selected contact"}
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
                            <div key={`sec_${idx}`} className="rounded-lg border border-white/10 bg-black/20 p-4">
                              <div className="text-sm font-semibold text-white/90">{s.heading}</div>
                              <div className="mt-2 text-sm text-white/70 whitespace-pre-wrap">{s.body}</div>
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
                          className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 h-32 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
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
                            className="bg-white/10 border border-white/20 text-white px-4 py-2 rounded-md text-sm hover:bg-white/15"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                        <p className="text-white/70">{researchData.company_summary.description}</p>
                        <div className="mt-3 grid grid-cols-2 gap-4 text-sm text-white/70">
                          <div>
                            <span className="font-medium text-white/80">Industry:</span> {researchData.company_summary.industry}
                          </div>
                          <div>
                            <span className="font-medium text-white/80">Size:</span> {researchData.company_summary.size}
                          </div>
                          <div>
                            <span className="font-medium text-white/80">Founded:</span> {researchData.company_summary.founded}
                          </div>
                          <div>
                            <span className="font-medium text-white/80">Headquarters:</span> {researchData.company_summary.headquarters}
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
                        <div key={index} className="rounded-lg border border-white/10 bg-black/20 p-4">
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="font-semibold text-white/90">{bio.name}</h3>
                            <button
                              onClick={() => handleEdit(`contact_${index}`, bio.bio)}
                              className="text-blue-200/90 hover:text-blue-100 text-sm font-semibold"
                            >
                              Edit
                            </button>
                          </div>
                          
                          {editingField === `contact_${index}` ? (
                            <div className="space-y-3">
                              <textarea
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 h-24 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
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
                                  className="bg-white/10 border border-white/20 text-white px-4 py-2 rounded-md text-sm hover:bg-white/15"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="mb-1 text-xs text-white/60">
                                {formatTitleCase(bio.title)}{bio.company ? ` • ${formatCompanyName(bio.company)}` : ""}
                              </div>
                              <p className="text-white/70 mb-3">{bio.bio}</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/70">
                                <div>
                                  <span className="font-medium text-white/80">Experience:</span> {bio.experience}
                                </div>
                                <div>
                                  <span className="font-medium text-white/80">Education:</span> {bio.education}
                                </div>
                                <div className="md:col-span-2">
                                  <span className="font-medium text-white/80">Skills:</span> {bio.skills.join(", ")}
                                </div>
                                {(bio.public_profile_highlights?.length ||
                                  bio.publications?.length ||
                                  bio.post_topics?.length ||
                                  bio.opinions?.length ||
                                  bio.other_interesting_facts?.length) ? (
                                  <div className="md:col-span-2">
                                    <div className="mt-2 rounded-lg border border-white/10 bg-black/10 p-3">
                                      <div className="text-xs font-semibold text-white/80 mb-2">Public profile insights (best effort)</div>
                                      {bio.public_profile_highlights?.length ? (
                                        <div className="mb-2">
                                          <div className="text-xs font-medium text-white/60">Highlights</div>
                                          <ul className="mt-1 list-disc pl-5 text-white/70">
                                            {bio.public_profile_highlights.slice(0, 6).map((x, idx) => (
                                              <li key={idx}>{x}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      ) : null}
                                      {bio.post_topics?.length ? (
                                        <div className="mb-2">
                                          <div className="text-xs font-medium text-white/60">Post topics</div>
                                          <div className="mt-1 flex flex-wrap gap-1">
                                            {bio.post_topics.slice(0, 10).map((t, idx) => (
                                              <span key={idx} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/70">
                                                {t}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      ) : null}
                                      {bio.publications?.length ? (
                                        <div className="mb-2">
                                          <div className="text-xs font-medium text-white/60">Publications / writing</div>
                                          <ul className="mt-1 list-disc pl-5 text-white/70">
                                            {bio.publications.slice(0, 5).map((x, idx) => (
                                              <li key={idx}>{x}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      ) : null}
                                      {bio.opinions?.length ? (
                                        <div className="mb-2">
                                          <div className="text-xs font-medium text-white/60">Opinions / takes</div>
                                          <ul className="mt-1 list-disc pl-5 text-white/70">
                                            {bio.opinions.slice(0, 5).map((x, idx) => (
                                              <li key={idx}>{x}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      ) : null}
                                      {bio.other_interesting_facts?.length ? (
                                        <div>
                                          <div className="text-xs font-medium text-white/60">Other interesting facts</div>
                                          <ul className="mt-1 list-disc pl-5 text-white/70">
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
                                    <div className="mt-2 rounded-lg border border-white/10 bg-black/10 p-3 text-xs text-white/60">
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
                      <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                        No sourced news available right now.
                        <div className="mt-1 text-xs text-white/50">
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
                            <div key={index} className="rounded-lg border border-white/10 bg-black/20 p-4">
                              <div className="flex items-start justify-between gap-3">
                                <h3 className="font-semibold text-white/90 mb-2">{news.title}</h3>
                                {isUnsourced ? (
                                  <span className="shrink-0 rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[11px] font-semibold text-yellow-800">
                                    Unsourced theme
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-white/70 mb-2">{news.summary}</p>
                              <div className="flex justify-between items-center text-sm text-white/50">
                                <span>
                                  {(news.source || "General").trim()}
                                  {news.date ? ` • ${news.date}` : ""}
                                </span>
                                {hasUrl ? (
                                  <a
                                    href={news.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-200/90 hover:text-blue-100 font-semibold"
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
                      <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                        <ul className="space-y-2">
                          {researchData.shared_connections.map((connection, index) => (
                            <li key={index} className="flex items-center space-x-2">
                              <span className="text-green-500">•</span>
                              <span className="text-white/70">{connection}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}

                  {/* Variables Preview */}
                  <div>
                    <h2 className="text-xl font-semibold mb-4">Available Variables</h2>
                    <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                      <p className="text-sm text-white/70 mb-3">
                        These variables can be used in your email templates:
                      </p>
                      <div className="space-y-2 text-sm">
                        <div>
                          <code className="bg-white/10 border border-white/10 px-2 py-1 rounded text-emerald-200">{"{{company_summary}}"}</code>
                          <span className="ml-2 text-white/60">
                            {getVariableText('company_summary').substring(0, 100)}...
                          </span>
                        </div>
                        <div>
                          <code className="bg-white/10 border border-white/10 px-2 py-1 rounded text-emerald-200">{"{{contact_bio}}"}</code>
                          <span className="ml-2 text-white/60">
                            {getVariableText('contact_bio').substring(0, 100)}...
                          </span>
                        </div>
                        <div>
                          <code className="bg-white/10 border border-white/10 px-2 py-1 rounded text-emerald-200">{"{{recent_news}}"}</code>
                          <span className="ml-2 text-white/60">
                            {getVariableText('recent_news').substring(0, 100)}...
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4">
                    <button
                      onClick={() => router.push('/find-contact')}
                      className="bg-white/10 border border-white/20 text-white px-6 py-3 rounded-md font-medium hover:bg-white/15 transition-colors"
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
