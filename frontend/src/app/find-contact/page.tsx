"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatCompanyName } from "@/lib/format";
import { getCurrentDataMode } from "@/lib/dataMode";


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

  // Persisted "saved verified contacts" across multiple company searches.
  const [savedVerified, setSavedVerified] = useState<Contact[]>([]);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [userKey, setUserKey] = useState<string>("anon");
  const [buildStamp, setBuildStamp] = useState<string>("");

  // Outreach drafts (per contact)
  const LINKEDIN_NOTE_LIMIT = 200;
  type OutreachDraft = {
    linkedin_note: string;
    updated_at: string;
  };
  const [outreachDrafts, setOutreachDrafts] = useState<Record<string, OutreachDraft>>({});
  const [activeDraftContactId, setActiveDraftContactId] = useState<string>("");
  const [isImprovingNote, setIsImprovingNote] = useState(false);
  const [improveNoteError, setImproveNoteError] = useState<string | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [researchNotice, setResearchNotice] = useState<string | null>(null);

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

  const getSavedKey = (uid: string) => `rf_saved_verified_contacts:${uid || "anon"}`;
  const getOutreachDraftsKey = (uid: string) => `rf_outreach_drafts:${uid || "anon"}`;

  const persistOutreachDrafts = (next: Record<string, OutreachDraft>) => {
    setOutreachDrafts(next);
    try {
      localStorage.setItem(getOutreachDraftsKey(userKey), JSON.stringify(next || {}));
    } catch {}
  };

  const safeFirstName = (full: string) => {
    const s = String(full || "").trim();
    if (!s) return "there";
    return s.split(/\s+/)[0] || "there";
  };

  const loadSelectedJob = () => {
    try {
      return JSON.parse(localStorage.getItem("selected_job_description") || "null");
    } catch {
      return null;
    }
  };

  const loadPainpointMatch = () => {
    // Prefer per-job matches if available
    try {
      const selectedJobId = String(localStorage.getItem("selected_job_description_id") || "").trim();
      const byJobRaw = localStorage.getItem("painpoint_matches_by_job");
      if (selectedJobId && byJobRaw) {
        const byJob = JSON.parse(byJobRaw) as Record<string, any[]>;
        const matches = byJob?.[selectedJobId] || [];
        if (Array.isArray(matches) && matches.length) return matches[0] || null;
      }
    } catch {}
    try {
      const legacyPainpointKey = ["pin", "point_matches"].join("");
      const matches =
        JSON.parse(localStorage.getItem("painpoint_matches") || "null") ||
        JSON.parse(localStorage.getItem(legacyPainpointKey) || "[]") ||
        JSON.parse(localStorage.getItem("pain_point_matches") || "[]");
      if (Array.isArray(matches) && matches.length) return matches[0] || null;
    } catch {}
    return null;
  };

  const trimToChars = (s: string, limit: number) => {
    const t = String(s || "");
    if (t.length <= limit) return t;
    const ell = "…";
    if (limit <= ell.length) return t.slice(0, limit);
    return t.slice(0, limit - ell.length).trimEnd() + ell;
  };

  const readResearchForContact = (contactId: string) => {
    const cid = String(contactId || "").trim();
    if (!cid) return null;
    try {
      const rawBy = localStorage.getItem("context_research_by_contact");
      const by = rawBy ? JSON.parse(rawBy) : null;
      const hit = by && typeof by === "object" ? (by[cid] || null) : null;
      if (hit) return hit;
    } catch {}
    try {
      const rawHist = localStorage.getItem("context_research_history");
      const hist = rawHist ? JSON.parse(rawHist) : [];
      if (Array.isArray(hist)) {
        const h = hist.find((x: any) => String(x?.contact?.id || "") === cid);
        if (h?.research) return h.research;
      }
    } catch {}
    return null;
  };

  const getInterestingFactsForContact = (contactId: string): string[] => {
    const r = readResearchForContact(contactId) || {};
    const bio = Array.isArray(r?.contact_bios) ? r.contact_bios[0] : null;
    const lists: any[] = [
      bio?.public_profile_highlights,
      bio?.post_topics,
      bio?.publications,
      bio?.opinions,
      bio?.other_interesting_facts,
    ];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const lst of lists) {
      for (const item of (Array.isArray(lst) ? lst : [])) {
        const s = String(item || "").trim();
        if (!s) continue;
        const k = s.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(s);
      }
    }
    return out.slice(0, 6);
  };

  const buildDefaultDraft = (c: Contact): OutreachDraft => {
    const jd = loadSelectedJob();
    const m0 = loadPainpointMatch();
    const first = safeFirstName(c?.name || "");
    // Prefer the CONTACT's company (this screen is about reaching out to them).
    const company = formatCompanyName(String(c?.company || jd?.company || "your team").trim());
    const jobTitle = String(jd?.title || "the role").trim();
    const pain = String(m0?.painpoint_1 || "a key priority").trim();
    const sol = String(m0?.solution_1 || "").trim();
    const metric = String(m0?.metric_1 || "").trim();

    const li = trimToChars(
      `Hi ${first}, I’m exploring ${jobTitle} at ${company}. I noticed ${pain}. I’ve worked on similar problems (${sol || "relevant work"}${metric ? `; ${metric}` : ""}). Open to connect?`,
      LINKEDIN_NOTE_LIMIT
    );

    return {
      linkedin_note: li,
      updated_at: new Date().toISOString(),
    };
  };

  const improveActiveLinkedInNote = async (active: Contact, draft: OutreachDraft) => {
    if (!active?.id) return;
    setImproveNoteError(null);
    setIsImprovingNote(true);
    try {
      const jd = loadSelectedJob();
      const m0 = loadPainpointMatch();
      const payload = {
        note: String(draft?.linkedin_note || ""),
        contact_name: String(active?.name || ""),
        contact_title: String(active?.title || ""),
        contact_company: formatCompanyName(String(active?.company || jd?.company || "")),
        job_title: String(jd?.title || ""),
        painpoint: String(m0?.painpoint_1 || ""),
        solution: String(m0?.solution_1 || ""),
        metric: String(m0?.metric_1 || ""),
        limit: LINKEDIN_NOTE_LIMIT,
      };

      const res = await api<{ note: string; used_ai?: boolean }>("/find-contact/improve-linkedin-note", "POST", payload);
      const improvedRaw = String(res?.note || "").trim();
      const improved = trimToChars(improvedRaw.replaceAll("—", "-").replaceAll("–", "-"), LINKEDIN_NOTE_LIMIT);
      if (!improved) throw new Error("Empty improved note");

      const next = { ...(outreachDrafts || {}) };
      next[active.id] = { ...draft, linkedin_note: improved, updated_at: new Date().toISOString() };
      persistOutreachDrafts(next);
    } catch (e: any) {
      setImproveNoteError(String(e?.message || "Failed to improve note"));
    } finally {
      setIsImprovingNote(false);
    }
  };

  const ensureDraftsForContacts = (list: Contact[]) => {
    const cs = Array.isArray(list) ? list : [];
    if (!cs.length) return;
    const next = { ...(outreachDrafts || {}) };
    let changed = false;
    for (const c of cs) {
      const cid = String(c?.id || "").trim();
      if (!cid) continue;
      if (next[cid]) continue;
      next[cid] = buildDefaultDraft(c);
      changed = true;
    }
    if (changed) persistOutreachDrafts(next);
  };

  const ensureDraftForContact = (c: Contact) => {
    const cid = String(c?.id || "").trim();
    if (!cid) return;
    if (outreachDrafts?.[cid]) return;
    const next = { ...(outreachDrafts || {}) };
    next[cid] = buildDefaultDraft(c);
    persistOutreachDrafts(next);
  };

  const getContactById = (id: string) => {
    const cid = String(id || "").trim();
    if (!cid) return null;
    const c1 = (contacts || []).find((c) => String(c.id) === cid);
    if (c1) return c1;
    const c2 = (savedVerified || []).find((c) => String(c.id) === cid);
    if (c2) return c2;
    const c3 = (suggested || []).find((c) => String(c.id) === cid);
    return c3 || null;
  };

  const contactIdentity = (c: Contact) => {
    const email = String(c.email || "").trim().toLowerCase();
    if (email && isRealEmail(email)) return `email:${email}`;
    const li = String(c.linkedin_url || "").trim().toLowerCase();
    if (li) return `li:${li}`;
    return `name:${String(c.name || "").trim().toLowerCase()}|title:${String(c.title || "").trim().toLowerCase()}|co:${String(c.company || "").trim().toLowerCase()}`;
  };

  const mergeSaved = (incoming: Contact[]) => {
    setSavedVerified((prev) => {
      const next: Contact[] = [...(prev || [])];
      const seen = new Set(next.map(contactIdentity));
      for (const c of incoming || []) {
        const key = contactIdentity(c);
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(c);
      }
      // Stable-ish sorting: group by company then name
      next.sort((a, b) => {
        const ca = String(a.company || "").toLowerCase();
        const cb = String(b.company || "").toLowerCase();
        if (ca !== cb) return ca.localeCompare(cb);
        return String(a.name || "").toLowerCase().localeCompare(String(b.name || "").toLowerCase());
      });
      try {
        localStorage.setItem(getSavedKey(userKey), JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    // Build stamp (debug): helps confirm whether Railway is serving the latest frontend build.
    // If this page doesn't show a build stamp at all, you're on an older deployment.
    try {
      fetch("/__debug", { cache: "no-store" as any })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const sha = String(j?.railwayGitCommitSha || "").trim();
          const short = sha ? sha.slice(0, 7) : "";
          const ts = String(j?.timestamp || "").trim();
          setBuildStamp(short ? `build ${short}${ts ? ` • ${ts}` : ""}` : (ts ? `build • ${ts}` : ""));
        })
        .catch(() => {});
    } catch {}

    // If the user just finished Company Research, prefill the company for a smoother workflow.
    try {
      const co = String(localStorage.getItem("selected_company_name") || "").trim();
      if (co) setSearchQuery((prev) => (String(prev || "").trim() ? prev : co));
    } catch {}

    // Identify user for per-user persistence
    try {
      const u = JSON.parse(localStorage.getItem("rf_user") || "null");
      const uid = String(u?.id || "anon");
      setUserKey(uid);
      const raw = localStorage.getItem(getSavedKey(uid));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSavedVerified(parsed);
      }
    } catch {}

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

      const uniq = Array.from(
        new Set(
          companies
            .map((c) => c.trim())
            .filter(Boolean)
            // Avoid junk placeholder values bubbling into the UI
            .filter((c) => c.toLowerCase() !== "unknown")
        )
      );
      uniq.sort((a, b) => a.localeCompare(b));
      setCompanyOptions(uniq);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // Load outreach drafts (per user)
    try {
      const raw = localStorage.getItem(getOutreachDraftsKey(userKey));
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") {
        // Strip em dashes from saved LinkedIn notes for consistency.
        const next: Record<string, OutreachDraft> = {};
        let changed = false;
        for (const [k, v] of Object.entries(parsed)) {
          const obj = (v as any) || {};
          const noteRaw = String(obj.linkedin_note || "");
          const note = trimToChars(noteRaw.replaceAll("—", "-"), LINKEDIN_NOTE_LIMIT);
          if (note !== noteRaw) changed = true;
          next[k] = {
            linkedin_note: note,
            updated_at: String(obj.updated_at || new Date().toISOString()),
          };
        }
        setOutreachDrafts(next);
        if (changed) {
          try {
            localStorage.setItem(getOutreachDraftsKey(userKey), JSON.stringify(next));
          } catch {}
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey]);

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
      let targetJobTitle = "";
      let candidateTitle = "";
      try {
        const selectedJD = JSON.parse(localStorage.getItem("selected_job_description") || "null");
        targetJobTitle = String(selectedJD?.title || "").trim();
      } catch {}
      try {
        const resume = JSON.parse(localStorage.getItem("resume_extract") || "null");
        const p0 = (resume?.positions && Array.isArray(resume.positions) && resume.positions.length) ? resume.positions[0] : null;
        candidateTitle = String(p0?.title || "").trim();
      } catch {}

      const res = await api<ContactSearchResponse>("/find-contact/search", "POST", {
        query: searchQuery,
        company: searchQuery,
        target_job_title: targetJobTitle || undefined,
        candidate_title: candidateTitle || undefined,
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

        // LinkedIn's internal people search often shows empty results unless you're logged in.
        // For demos, use a Google query that finds LinkedIn profiles reliably.
        const mkPeopleSearch = (title: string) =>
          `https://www.google.com/search?q=${encodeURIComponent(
            `site:linkedin.com/in "${title}" ${company}`
          )}`;

        // Role-aware suggested targets (fallback when we can't find real people).
        let targetJobTitle = "";
        try {
          const selectedJD = JSON.parse(localStorage.getItem("selected_job_description") || "null");
          targetJobTitle = String(selectedJD?.title || "").trim().toLowerCase();
        } catch {}

        const inferFn = () => {
          const t = targetJobTitle;
          if (!t) return "engineering";
          if (t.includes("recruit") || t.includes("talent") || t.includes("sourcer")) return "recruiting";
          if (t.includes("product")) return "product";
          if (t.includes("design") || t.includes("ux") || t.includes("ui")) return "design";
          if (t.includes("marketing") || t.includes("seo") || t.includes("demand gen")) return "marketing";
          if (t.includes("sales") || t.includes("account executive") || t.includes("customer success")) return "sales";
          if (t.includes("engineer") || t.includes("software") || t.includes("developer") || t.includes("data") || t.includes("ml") || t.includes("ai")) return "engineering";
          return "engineering";
        };
        const fn = inferFn();

        const titlesByFn: Record<string, string[]> = {
          engineering: ["Engineering Manager", "Director of Engineering", "VP of Engineering", "CTO", "Head of Talent Acquisition", "Recruiting Manager"],
          product: ["Director of Product", "Head of Product", "VP Product", "CPO", "Head of Talent Acquisition", "Recruiting Manager"],
          design: ["Head of Design", "Design Director", "VP Design", "Chief Design Officer", "Head of Talent Acquisition", "Recruiting Manager"],
          marketing: ["VP of Marketing", "Head of Marketing", "Marketing Director", "CMO", "Head of Talent Acquisition", "Recruiting Manager"],
          sales: ["VP of Sales", "Head of Sales", "Sales Director", "CRO", "Head of Talent Acquisition", "Recruiting Manager"],
          recruiting: ["Head of Talent Acquisition", "Recruiting Manager", "Talent Acquisition Partner", "Lead Recruiter", "VP People", "Chief People Officer"],
        };

        const seedTitles = titlesByFn[fn] || titlesByFn.engineering;

        const fallback: Contact[] = seedTitles.slice(0, 6).map((title, idx) => ({
          id: `suggested_${fn}_${idx}_${Date.now() + idx}`,
          name: `Target: ${title}`,
          title,
          email: "unknown@example.com",
          linkedin_url: mkPeopleSearch(title),
          confidence: 0.45,
          verification_status: "unknown",
          company,
          department: fn === "recruiting" ? "HR" : fn.charAt(0).toUpperCase() + fn.slice(1),
          level:
            title.includes("Chief") || title === "CTO" || title === "CRO" || title === "CMO" || title === "CPO"
              ? "C-Level"
              : title.includes("VP")
                ? "VP"
                : title.includes("Head")
                  ? "Head"
                  : title.includes("Director")
                    ? "Director"
                    : title.includes("Manager")
                      ? "Manager"
                      : "Lead",
        }));
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

      // Auto-save valid verified contacts so they persist across company searches.
      const validVerified: Contact[] = (verified || [])
        .filter((c: any) => {
          const status = String(c?.verification_status || "").toLowerCase();
          const score = Number(c?.verification_score || 0);
          const email = String(c?.email || "");
          return status === "valid" && score >= 80 && isRealEmail(email);
        })
        .map((c: any) => c as Contact);

      if (validVerified.length) {
        mergeSaved(validVerified);
        setSaveNotice(`Saved ${validVerified.length} verified contact${validVerified.length === 1 ? "" : "s"} (Valid).`);
        window.setTimeout(() => setSaveNotice(null), 2500);
      } else {
        setSaveNotice("No new Valid contacts to save from this verification run.");
        window.setTimeout(() => setSaveNotice(null), 2500);
      }
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

  // Keep an "active" contact for drafting when selection changes.
  useEffect(() => {
    // Drafts should follow the current search results first (so notes update when you switch companies).
    const selectedInResults = contacts.filter((c) => selectedContacts.includes(c.id));
    const chosen =
      selectedInResults.length > 0
        ? selectedInResults
        : (contacts && contacts.length > 0)
          ? contacts
          : (savedVerified && savedVerified.length > 0)
            ? savedVerified
            : [];
    const cur = String(activeDraftContactId || "").trim();
    const nextActive =
      cur && chosen.some((c) => c.id === cur)
        ? cur
        : String(chosen?.[0]?.id || "");
    if (nextActive && nextActive !== activeDraftContactId) setActiveDraftContactId(nextActive);
    const active = chosen.find((c) => c.id === nextActive) || chosen?.[0];
    // Ensure drafts exist so the Outreach drafts card is always populated.
    ensureDraftsForContacts(chosen);
    if (active) ensureDraftForContact(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedContacts, contacts, savedVerified]);

  const handleContinue = () => {
    // Only allow continuing with SAVED verified contacts.
    // Selected contacts are for verification workflow only and should not be carried forward.
    const chosen = savedVerified || [];
    if (chosen.length === 0) {
      setError("Verify emails to save Valid contacts before continuing.");
      return;
    }
    localStorage.setItem('selected_contacts', JSON.stringify(chosen));
    router.push('/compose');
  };

  const runContactResearch = async () => {
    const chosen = savedVerified || [];
    if (!chosen.length) {
      setError("Save at least 1 verified contact before running research.");
      return;
    }
    setIsResearching(true);
    setResearchNotice(null);
    setError(null);
    try {
      const selectedJD = loadSelectedJob();
      const selectedJobId = String(localStorage.getItem("selected_job_description_id") || "").trim();
      const resumeExtract = (() => {
        try {
          return JSON.parse(localStorage.getItem("resume_extract") || "null");
        } catch {
          return null;
        }
      })();
      const matchesByJob = (() => {
        try {
          return JSON.parse(localStorage.getItem("painpoint_matches_by_job") || "{}") as Record<string, any[]>;
        } catch {
          return {};
        }
      })();
      const painpointMatches = (selectedJobId && matchesByJob?.[selectedJobId]) ? matchesByJob[selectedJobId] : [];

      const companyName =
        String(localStorage.getItem("selected_company_name") || "").trim() ||
        String((selectedJD as any)?.company || "").trim() ||
        String(chosen?.[0]?.company || "").trim() ||
        "Company";

      const resp = await api<any>("/context-research/research", "POST", {
        contact_ids: chosen.map((c) => c.id),
        company_name: companyName,
        selected_job_description: selectedJD,
        resume_extract: resumeExtract,
        painpoint_matches: painpointMatches,
        contacts: chosen,
        data_mode: getCurrentDataMode(),
      });
      if (!resp?.success) throw new Error(resp?.message || "Research failed");

      const byContact = resp?.research_by_contact || {};
      const helper = resp?.helper || {};

      // Persist in the SAME shape downstream pages already read.
      const now = new Date().toISOString();
      const histRaw = localStorage.getItem("context_research_history");
      const hist = (() => {
        try {
          const parsed = histRaw ? JSON.parse(histRaw) : [];
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      })();

      // Upsert by contact id
      const map = new Map<string, any>();
      for (const it of hist) {
        const cid = String(it?.contact?.id || "").trim();
        if (cid) map.set(cid, it);
      }
      for (const c of chosen) {
        const cid = String(c?.id || "").trim();
        if (!cid) continue;
        const r = byContact?.[cid];
        if (!r) continue;
        map.set(cid, { contact: c, research: r, researched_at: now });
      }
      const nextHist = Array.from(map.values()).sort((a, b) => String(b?.researched_at || "").localeCompare(String(a?.researched_at || "")));

      localStorage.setItem("context_research_history", JSON.stringify(nextHist));
      localStorage.setItem("context_research_by_contact", JSON.stringify(byContact));
      const activeId = String(chosen?.[0]?.id || "").trim();
      if (activeId) localStorage.setItem("context_research_active_contact_id", activeId);
      if (activeId && byContact?.[activeId]) {
        localStorage.setItem("context_research", JSON.stringify(byContact[activeId]));
        localStorage.setItem("research_data", JSON.stringify(byContact[activeId]));
      }
      localStorage.setItem("context_research_helper", JSON.stringify(helper || {}));
      localStorage.setItem(
        "context_research_meta",
        JSON.stringify({
          company_name: companyName,
          jd_title: String((selectedJD as any)?.title || ""),
          data_mode: getCurrentDataMode(),
        })
      );

      setResearchNotice(`Research saved for ${Object.keys(byContact || {}).length} contact${Object.keys(byContact || {}).length === 1 ? "" : "s"}.`);
      window.setTimeout(() => setResearchNotice(null), 2600);
    } catch (e: any) {
      setError(String(e?.message || "Failed to run research."));
    } finally {
      setIsResearching(false);
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
              Select a contact to reach out via LinkedIn. We’ll generate a short LinkedIn request note (≤200 chars). Email drafting happens later.
            </p>
            {buildStamp ? (
              <div className="mt-2 text-[11px] text-white/40 font-mono">{buildStamp}</div>
            ) : null}
          </div>

          {error && (
            <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          )}

          {saveNotice && (
            <div className="mb-6 rounded-md border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {saveNotice}
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left column: saved verified contacts */}
            <div className="lg:w-[360px] shrink-0">
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-white">Saved verified contacts</div>
                    <div className="text-xs text-white/60">
                      Saved when you click Verify (Valid only). These carry across multiple company searches.
                    </div>
                  </div>
                  {savedVerified.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSavedVerified([]);
                        try { localStorage.removeItem(getSavedKey(userKey)); } catch {}
                      }}
                      className="text-xs underline text-white/70 hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {savedVerified.length === 0 ? (
                  <div className="mt-3 text-sm text-white/60">
                    No saved contacts yet. Search a company → select contacts → Verify emails.
                  </div>
                ) : (
                  <div className="mt-3 space-y-2 max-h-[420px] overflow-auto pr-1">
                    {savedVerified.map((c) => {
                      const badge = getVerificationBadge(c.verification_status, c.verification_score);
                      return (
                        <div key={contactIdentity(c)} className="rounded-md border border-white/10 bg-white/5 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-white truncate">{c.name}</div>
                              <div className="text-xs text-white/70 truncate">{formatTitleCase(c.title)}</div>
                              <div className="text-[11px] text-white/50 truncate">{formatCompanyName(c.company)}</div>
                              {isRealEmail(c.email) ? (
                                <div className="mt-1 text-[11px] font-mono text-white/70 break-all">{c.email}</div>
                              ) : null}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {badge.label !== "Unknown" ? (
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBadgeColor(badge.color)}`}>
                                  {badge.icon} {badge.label}
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => {
                                  setSavedVerified((prev) => {
                                    const next = (prev || []).filter((x) => contactIdentity(x) !== contactIdentity(c));
                                    try { localStorage.setItem(getSavedKey(userKey), JSON.stringify(next)); } catch {}
                                    return next;
                                  });
                                }}
                                className="text-[11px] underline text-white/60 hover:text-white"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-4 rounded-md border border-white/10 bg-black/10 p-3">
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                    Contact research (Smart)
                  </div>
                  <div className="mt-1 text-[11px] text-white/60">
                    This runs background research for your saved contacts and stores it for Offer/Compose.
                  </div>
                  {researchNotice ? (
                    <div className="mt-2 rounded-md border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                      {researchNotice}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={runContactResearch}
                    disabled={isResearching || (savedVerified?.length || 0) === 0}
                    className="mt-3 w-full rounded-md bg-white/10 border border-white/15 px-3 py-2 text-sm font-semibold text-white/85 hover:bg-white/15 disabled:opacity-50"
                    title="Run background research for saved contacts"
                  >
                    {isResearching ? "Researching…" : "Run research for saved contacts"}
                  </button>
                </div>

                {/* Continue button lives at the bottom of the right column (single CTA) */}
              </div>
            </div>

            {/* Right column: search + results */}
            <div className="flex-1 min-w-0">
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
                      {formatCompanyName(c)}
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
                    {/* Continue button lives at the bottom of the right column (single CTA) */}
                  </div>
                  );
                })()}
              </div>

              {/* Outreach drafts (auto-generated) */}
              {(() => {
                const selectedInResults = contacts.filter((c) => selectedContacts.includes(c.id));
                const chosen =
                  selectedInResults.length > 0
                    ? selectedInResults
                    : (contacts && contacts.length > 0)
                      ? contacts
                      : (savedVerified && savedVerified.length > 0)
                        ? savedVerified
                        : [];
                const active = getContactById(activeDraftContactId) || chosen?.[0] || null;
                if (!active) return null;
                const draft = outreachDrafts?.[active.id] || null;
                if (!draft) return null;

                return (
                  <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-white">Outreach drafts</div>
                        <div className="text-xs text-white/60">
                          LinkedIn connection request notes are capped at <span className="font-semibold">200 characters</span>.
                        </div>
                      </div>
                      {chosen.length > 1 ? (
                        <div className="max-w-[420px]">
                          <div className="text-[11px] text-white/50 mb-1">Draft for</div>
                          <div className="flex flex-wrap gap-2 justify-end">
                            {chosen.slice(0, 10).map((c) => {
                              const isActive = String(activeDraftContactId || "") === String(c.id || "");
                              return (
                                <button
                                  key={`draft_pill_${c.id}`}
                                  type="button"
                                  onClick={() => {
                                    setActiveDraftContactId(String(c.id || ""));
                                    ensureDraftForContact(c);
                                  }}
                                  title={`${c.name} — ${formatTitleCase(c.title)}`}
                                  className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                                    isActive
                                      ? "brand-gradient text-black border-white/20"
                                      : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
                                  }`}
                                >
                                  {String(c.name || "").split(/\s+/)[0] || c.name}
                                </button>
                              );
                            })}
                            {chosen.length > 10 ? (
                              <div className="px-2 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-white/60">
                                +{chosen.length - 10} more
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4">
                      <div className="rounded-md border border-white/10 bg-white/5 p-3">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                            LinkedIn request note
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={isImprovingNote}
                              onClick={() => improveActiveLinkedInNote(active, draft)}
                              className={`rounded-md border px-2 py-1 text-xs font-semibold transition-colors ${
                                isImprovingNote
                                  ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                                  : "border-white/10 bg-black/20 text-white/80 hover:bg-white/10"
                              }`}
                              title="Rewrite to sound more human (casual, warm, professional)."
                            >
                              {isImprovingNote ? "Improving…" : "Improve with Smart"}
                            </button>
                            <div className={`text-xs ${draft.linkedin_note.length > LINKEDIN_NOTE_LIMIT ? "text-red-300" : "text-white/60"}`}>
                              {draft.linkedin_note.length}/{LINKEDIN_NOTE_LIMIT}
                            </div>
                          </div>
                        </div>
                        {improveNoteError ? (
                          <div className="mb-2 text-xs text-red-200">
                            {improveNoteError}
                          </div>
                        ) : null}
                        {!active.linkedin_url ? (
                          <div className="mb-2 text-xs text-amber-200">
                            Missing LinkedIn URL for this contact - you can still copy the note, but you’ll need to find their profile manually.
                          </div>
                        ) : null}
                        <textarea
                          value={draft.linkedin_note}
                          onChange={(e) => {
                            const nextVal = trimToChars(e.target.value, LINKEDIN_NOTE_LIMIT);
                            const next = { ...(outreachDrafts || {}) };
                            next[active.id] = { ...draft, linkedin_note: nextVal, updated_at: new Date().toISOString() };
                            persistOutreachDrafts(next);
                          }}
                          rows={5}
                          className="w-full bg-black/20 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/40"
                          placeholder="Write a short connection request note…"
                        />

                        {(() => {
                          const facts = getInterestingFactsForContact(active.id);
                          return (
                            <div className="mt-3 rounded-md border border-amber-400/25 bg-amber-500/10 p-3">
                              <div className="text-xs font-semibold text-amber-200 uppercase tracking-wider">
                                Interesting facts found
                              </div>
                              {facts.length ? (
                                <ul className="mt-2 list-disc list-inside space-y-1 text-sm text-white/80">
                                  {facts.map((f, idx) => (
                                    <li key={`fact_${active.id}_${idx}`}>{f}</li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="mt-2 text-xs text-white/65">
                                  No facts yet. Click{" "}
                                  <span className="font-semibold text-white/80">Run research for saved contacts</span>{" "}
                                  on the left to populate this.
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        <div className="mt-2 text-[11px] text-white/50">
                          Tip: This LinkedIn request note is a strong first step to request a connect, introduce yourself, and win the numbers game.
                          <br />
                          Email will be drafted in the next steps as you build more context.
                          <div className="mt-2">
                            How to send:
                            <ol className="mt-1 list-decimal list-inside space-y-0.5">
                              <li>Click the contact’s “View LinkedIn Profile” link below.</li>
                              <li>Click <span className="font-semibold text-white/70">Connect</span>.</li>
                              <li>Click <span className="font-semibold text-white/70">Add a note</span>.</li>
                              <li>Copy/paste this note into LinkedIn, then send.</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
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
                          <p className="text-gray-500 text-xs">{formatCompanyName(contact.company)}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          {badge.label !== "Unknown" ? (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBadgeColor(badge.color)}`}>
                              {badge.icon} {badge.label}
                            </span>
                          ) : null}
                          {isSelected && (
                            <span className="text-blue-600">✓</span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {isRealEmail(contact.email) && (
                          <div className="flex items-start space-x-2">
                            <span className="text-gray-500 text-sm">Email:</span>
                            <span className="text-sm font-mono break-all min-w-0">{contact.email}</span>
                          </div>
                        )}

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

              {/* Action buttons live at the bottom of the right column (single CTA) */}
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

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
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
                          <p className="text-gray-500 text-xs">{formatCompanyName(contact.company)}</p>
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
                          Open profile search
                        </a>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {/* Action buttons live at the bottom of the right column (single CTA) */}
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

          {(() => {
            const canContinue = (savedVerified?.length || 0) > 0;
            const continueLabel = `Continue to Research (${savedVerified.length} saved)`;
            return (
              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/painpoint-match")}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-md font-medium hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={!canContinue}
                  className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {continueLabel}
                </button>
              </div>
            );
          })()}

            </div>
          </div>
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
