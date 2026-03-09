"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatCompanyName } from "@/lib/format";
import { getCurrentDataMode } from "@/lib/dataMode";
import InlineSpinner from "@/components/InlineSpinner";


interface ContactSignal {
  label: string;
  value: string;
  category: string;
}

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
  person_signals?: ContactSignal[];
  company_signals?: ContactSignal[];
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
  // Company-first: make the company explicit, and keep an optional secondary query.
  const [companyQuery, setCompanyQuery] = useState("");
  const [otherQuery, setOtherQuery] = useState("");
  const [titleFilters, setTitleFilters] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState<string | null>(null);
  const [seniorityFilter, setSeniorityFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
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
  const [isResearching, setIsResearching] = useState(false);
  const [researchNotice, setResearchNotice] = useState<string | null>(null);
  const [researchByContact, setResearchByContact] = useState<Record<string, any>>({});
  const [selectedContactSignalIds, setSelectedContactSignalIds] = useState<Set<string>>(new Set());

  type RoleDomain =
    | "engineering"
    | "data"
    | "product"
    | "design"
    | "marketing"
    | "sales"
    | "finance"
    | "supply_chain"
    | "writing_comms"
    | "construction"
    | "operations"
    | "recruiting"
    | "other";

  const inferRoleDomainFromSelectedJob = (jd: any): RoleDomain => {
    try {
      const title = String(jd?.title || "").toLowerCase();
      const companyIndustry = String(jd?.industry || jd?.company_industry || "").toLowerCase();
      const skills = Array.isArray(jd?.required_skills) ? jd.required_skills : [];
      const skillsStr = skills.map((s: any) => String(s || "")).join(" ").toLowerCase();
      const body = String(jd?.raw_text || jd?.text || jd?.description || "").toLowerCase();
      const hay = [title, companyIndustry, skillsStr, body].filter(Boolean).join(" ");

      const has = (re: RegExp) => re.test(hay);

      if (has(/\b(supply\s*chain|logistics|warehouse|procurement|inventory|transport|freight|shipping|distribution)\b/)) return "supply_chain";
      if (has(/\b(finance|financial|accounting|controller|cpa|audit|tax|fp&a|treasury|bookkeep|accounts payable|accounts receivable)\b/)) return "finance";
      if (has(/\b(construction|superintendent|foreman|general contractor|civil|mep|site manager|jobsite|project executive)\b/)) return "construction";
      if (has(/\b(communications|comms|public relations|pr\b|content strategist|copywriter|writer|editor|journalist|technical writer)\b/)) return "writing_comms";
      if (has(/\b(sales|account executive|ae\b|bdr\b|sdr\b|business development|revenue|quota|pipeline|customer success)\b/)) return "sales";
      if (has(/\b(marketing|demand gen|growth marketing|seo\b|paid search|paid social|brand|content marketing|lifecycle)\b/)) return "marketing";
      if (has(/\b(product manager|product\b|growth\b|monetization|pricing|product ops)\b/)) return "product";
      if (has(/\b(design|ux\b|ui\b|product designer|visual designer|researcher)\b/)) return "design";
      if (has(/\b(data scientist|data engineer|analytics|bi\b|machine learning|ml\b|ai\b|model|statistic)\b/)) return "data";
      if (has(/\b(recruit|recruiting|talent acquisition|sourcer|hr\b|people ops)\b/)) return "recruiting";
      if (has(/\b(engineer|engineering|software|developer|sre\b|devops|platform|infrastructure|cloud|security)\b/)) return "engineering";
      if (has(/\b(operations|ops\b|program manager|project manager|pm\b|implementation|support|customer support|delivery|supply)\b/)) return "operations";

      return title ? "other" : "engineering";
    } catch {
      return "engineering";
    }
  };

  const roleLeadershipGroupForDomain = (domain: RoleDomain): { group: string; options: string[] } => {
    const groups: Record<RoleDomain, { group: string; options: string[] }> = {
      engineering: {
        group: "Engineering leadership",
        options: [
          "VP of Engineering",
          "SVP Engineering",
          "Head of Engineering",
          "Director of Engineering",
          "Engineering Manager",
          "Head of Platform",
          "Director of Platform",
          "Head of Infrastructure",
          "SRE Manager",
          "Security Director",
          "CISO",
        ],
      },
      data: {
        group: "Data & Analytics leadership",
        options: ["Chief Data Officer", "VP Data", "Head of Data", "Director of Data", "Head of Analytics", "Director of Analytics", "Data Engineering Manager"],
      },
      product: {
        group: "Product leadership",
        options: ["CPO", "VP Product", "Head of Product", "Director of Product", "Group Product Manager", "Product Lead", "Head of Product Operations"],
      },
      design: {
        group: "Design leadership",
        options: ["Chief Design Officer", "VP Design", "Head of Design", "Design Director", "UX Director", "Head of Research"],
      },
      marketing: {
        group: "Marketing leadership",
        options: ["CMO", "VP of Marketing", "Head of Marketing", "Marketing Director", "Head of Growth", "VP Growth", "Demand Gen Director", "Brand Director"],
      },
      sales: {
        group: "Sales leadership",
        options: ["CRO", "VP of Sales", "Head of Sales", "Sales Director", "VP Revenue", "Head of Revenue Operations", "Customer Success Director"],
      },
      finance: {
        group: "Finance & Accounting leadership",
        options: ["CFO", "VP Finance", "Head of Finance", "Finance Director", "Controller", "Director of Accounting", "Head of Accounting", "FP&A Director"],
      },
      supply_chain: {
        group: "Supply chain & Logistics leadership",
        options: ["VP Supply Chain", "Head of Supply Chain", "Director of Supply Chain", "Logistics Director", "Head of Logistics", "Procurement Director", "Head of Procurement", "VP Operations"],
      },
      writing_comms: {
        group: "Communications & Content leadership",
        options: [
          "Chief Communications Officer",
          "VP Communications",
          "Head of Communications",
          "Director of Communications",
          "PR Director",
          "Content Director",
          "Editorial Director",
          "Head of Content",
        ],
      },
      construction: {
        group: "Construction leadership",
        options: ["VP Construction", "Head of Construction", "Director of Construction", "Construction Manager", "Project Executive", "General Superintendent", "Director of Operations"],
      },
      operations: {
        group: "Operations leadership",
        options: ["COO", "VP Operations", "Head of Operations", "Director of Operations", "Business Operations Director", "Program Director", "PMO Director"],
      },
      recruiting: {
        group: "People / Talent leadership",
        options: ["Chief People Officer", "VP People", "Head of People", "Head of Talent Acquisition", "Director of Talent Acquisition", "Recruiting Manager", "HR Business Partner"],
      },
      other: {
        group: "Role-area leadership",
        options: ["VP", "Head of Department", "Director", "Senior Manager", "Hiring Manager", "Functional Lead"],
      },
    };
    return groups[domain] || groups.engineering;
  };

  const [roleDomain, setRoleDomain] = useState<RoleDomain>("engineering");

  useEffect(() => {
    // Drive the 2nd title tier from the *selected role*.
    try {
      const raw = localStorage.getItem("selected_job_description");
      const jd = raw ? JSON.parse(raw) : null;
      setRoleDomain(inferRoleDomainFromSelectedJob(jd));
    } catch {
      setRoleDomain("engineering");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const TITLE_FILTER_OPTIONS: Array<{ group: string; options: string[] }> = useMemo(() => {
    const base: Array<{ group: string; options: string[] }> = [
      {
        group: "Executive",
        options: ["CEO", "COO", "CTO", "CPO", "CFO", "Founder", "President", "General Manager"],
      },
      roleLeadershipGroupForDomain(roleDomain),
      {
        group: "People / Recruiting (hiring owners)",
        options: [
          "Chief People Officer",
          "VP People",
          "Head of People",
          "HR Business Partner",
          "Head of Talent Acquisition",
          "Director of Talent Acquisition",
          "Recruiting Manager",
          "Technical Recruiter",
          "Senior Recruiter",
          "Talent Acquisition Partner",
          "Recruiting Sourcer",
        ],
      },
    ];

    // Only show cross-functional "Product & Growth" when it’s plausibly relevant.
    // (For finance/supply-chain/construction/comms/ops roles this tends to add noise.)
    const showProductGrowth = ["engineering", "data", "product", "design", "marketing", "sales", "recruiting", "other"].includes(roleDomain);
    if (showProductGrowth) {
      base.splice(2, 0, {
        group: "Product & Growth",
        options: [
          "VP Product",
          "Head of Product",
          "Director of Product",
          "Group Product Manager",
          "Product Lead",
          "VP Growth",
          "Head of Growth",
          "Growth Director",
        ],
      });
    }

    return base;
  }, [roleDomain]);

  const TITLE_FILTER_STORAGE_KEY = "rf_decision_maker_title_filters";

  useEffect(() => {
    // Prevent "hidden" titles from previous roles from affecting search.
    const allowed = new Set(TITLE_FILTER_OPTIONS.flatMap((g) => g.options));
    setTitleFilters((prev) => {
      const next = (prev || []).filter((t) => allowed.has(t));
      if (next.length === (prev || []).length) return prev;
      try {
        localStorage.setItem(TITLE_FILTER_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [TITLE_FILTER_OPTIONS]);

  useEffect(() => {
    // Restore title filters (nice UX: people often reuse these).
    try {
      const raw = localStorage.getItem(TITLE_FILTER_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed)) {
        setTitleFilters(parsed.map((x) => String(x)).filter(Boolean));
      }
    } catch {}
  }, []);

  useEffect(() => {
    // Restore research results for UI visibility (Campaign also reads this key).
    try {
      const rawBy = localStorage.getItem("context_research_by_contact");
      const by = rawBy ? JSON.parse(rawBy) : null;
      if (by && typeof by === "object") setResearchByContact(by);
    } catch {}
  }, []);

  const toggleTitleFilter = (t: string) => {
    const title = String(t || "").trim();
    if (!title) return;
    setTitleFilters((prev) => {
      const has = prev.includes(title);
      const next = has ? prev.filter((x) => x !== title) : [...prev, title];
      try {
        localStorage.setItem(TITLE_FILTER_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const clearTitleFilters = () => {
    setTitleFilters([]);
    try {
      localStorage.removeItem(TITLE_FILTER_STORAGE_KEY);
    } catch {}
  };

  const selectAllTitleFilters = () => {
    const all = TITLE_FILTER_OPTIONS.flatMap((g) => g.options);
    const uniq = Array.from(new Set(all));
    setTitleFilters(uniq);
    try {
      localStorage.setItem(TITLE_FILTER_STORAGE_KEY, JSON.stringify(uniq));
    } catch {}
  };

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

  const getInterestingFactsForContact = (
    contactId: string
  ): Array<{ text: string; url?: string; source_title?: string; signal_type?: string }> => {
    const r = readResearchForContact(contactId) || {};
    const bio = Array.isArray(r?.contact_bios) ? r.contact_bios[0] : null;
    const out: Array<{ text: string; url?: string; source_title?: string; signal_type?: string }> = [];
    const seen = new Set<string>();

    const structured = Array.isArray((bio as any)?.interesting_facts) ? (bio as any).interesting_facts : [];
    for (const it of structured) {
      const text = String(it?.fact || it?.text || "").trim();
      const url = String(it?.source_url || it?.url || "").trim();
      const sourceTitle = String(it?.source_title || it?.title || "").trim();
      const signalType = String(it?.signal_type || "").trim();
      if (!text) continue;
      const k = text.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ text, url: url || undefined, source_title: sourceTitle || undefined, signal_type: signalType || undefined });
    }

    const lists: any[] = [
      (bio as any)?.public_profile_highlights,
      (bio as any)?.post_topics,
      (bio as any)?.publications,
      (bio as any)?.opinions,
      (bio as any)?.other_interesting_facts,
    ];
    for (const lst of lists) {
      for (const item of (Array.isArray(lst) ? lst : [])) {
        const text = String(item || "").trim();
        if (!text) continue;
        const k = text.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ text });
      }
    }
    return out.slice(0, 10);
  };

  const getContactMeta = (contactId: string): { urgency_score: number; urgency_reason: string; outreach_angles: string[] } => {
    const r = readResearchForContact(contactId) || {};
    const bio = Array.isArray(r?.contact_bios) ? r.contact_bios[0] : null;
    return {
      urgency_score: Number((bio as any)?.urgency_score) || 0,
      urgency_reason: String((bio as any)?.urgency_reason || "").trim(),
      outreach_angles: Array.isArray((bio as any)?.outreach_angles) ? (bio as any).outreach_angles.map((a: any) => String(a).trim()).filter(Boolean) : [],
    };
  };

  const getIntelligence = (contactId: string): {
    signals: Array<{ signal_type: string; signal_title: string; signal_source: string; signal_content: string; confidence_score: number; signal_date: string }>;
    outreach_summary?: { one_liner_hook: string; strongest_signal: string; recommended_angle: string; conversation_starters: string[] };
    executive_summary: string;
    overall_relevance_score: number;
  } | null => {
    const r = readResearchForContact(contactId) || {};
    const intel = (r as any)?.intelligence;
    if (!intel || !Array.isArray(intel?.signals) || !intel.signals.length) return null;
    return intel;
  };

  const buildDefaultDraft = (c: Contact): OutreachDraft => {
    const first = safeFirstName(c?.name || "");
    const company = formatCompanyName(String(c?.company || "your team").trim());
    const title = formatTitleCase(String(c?.title || "").trim());
    const m0 = loadPainpointMatch();
    const sol = String(m0?.solution_1 || "").trim();
    const metric = String(m0?.metric_1 || "").trim();
    const facts = getInterestingFactsForContact(String(c?.id || ""));

    const cleanPhrase = (s: string) => {
      let t = String(s || "").replace(/\s+/g, " ").trim();
      t = t.replace(/^[\-\*\u2022\d\.\)\s]+/, "").trim();
      t = t.replace(/\s*\.+\s*$/g, "").trim();
      t = t.replace(/\s*,+\s*$/g, "").trim();
      t = t.replace(/\s*;+\s*$/g, "").trim();
      t = t.replace(/\s*:\s*$/g, "").trim();
      return t;
    };

    const solPhrase = cleanPhrase(sol);
    const metricPhrase = cleanPhrase(metric);
    const factPhrase = cleanPhrase(String(facts?.[0]?.text || ""));

    const parts: string[] = [];
    parts.push(`Hi ${first}, I reviewed your profile and wanted to connect.`);
    if (title && company) parts.push(`Your work as ${title} at ${company} stood out.`);
    else if (company) parts.push(`Your work at ${company} stood out.`);
    if (factPhrase) parts.push(`I liked your perspective on ${trimToChars(factPhrase, 56)}.`);
    if (solPhrase && metricPhrase) parts.push(`About me: ${trimToChars(solPhrase, 48)}, ${trimToChars(metricPhrase, 32)}.`);
    else if (solPhrase) parts.push(`About me: ${trimToChars(solPhrase, 68)}.`);
    else if (metricPhrase) parts.push(`About me: ${trimToChars(metricPhrase, 68)}.`);
    else parts.push("About me: I enjoy building practical, measurable solutions.");

    parts.push("Open to connect?");

    const li = trimToChars(
      parts.join(" "),
      LINKEDIN_NOTE_LIMIT
    );

    return {
      linkedin_note: li,
      updated_at: new Date().toISOString(),
    };
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
      if (co) setCompanyQuery((prev: string) => (String(prev || "").trim() ? prev : co));
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

    // Carry over company names from previous steps (Role Descriptions + selected JD + selected contacts).
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
      // Prefer the selected job's company if present; else default to the first known company.
      if (!String(companyQuery || "").trim() && uniq.length) {
        try {
          const selectedJdRaw = localStorage.getItem("selected_job_description");
          const jd = selectedJdRaw ? JSON.parse(selectedJdRaw) : null;
          const c = String(jd?.company || "").trim();
          setCompanyQuery(c || uniq[0] || "");
        } catch {
          setCompanyQuery(uniq[0] || "");
        }
      }
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
    if (!companyQuery.trim()) return;
    
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
        query: companyQuery,
        company: companyQuery,
        role: (otherQuery || "").trim() || undefined,
        title_filters: titleFilters.length ? titleFilters : undefined,
        target_job_title: targetJobTitle || undefined,
        candidate_title: candidateTitle || undefined,
        seniority: seniorityFilter || undefined,
        location: locationFilter.trim() || undefined,
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
        const company = companyQuery.trim();

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
          if (t.includes("finance") || t.includes("accounting") || t.includes("controller") || t.includes("fp&a")) return "finance";
          if (t.includes("supply chain") || t.includes("logistics") || t.includes("procurement")) return "supply_chain";
          if (t.includes("construction") || t.includes("superintendent") || t.includes("foreman")) return "construction";
          if (t.includes("communications") || t.includes("writer") || t.includes("copywriter") || t.includes("editor")) return "writing_comms";
          if (t.includes("operations") || t.includes("program manager") || t.includes("project manager")) return "operations";
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
          finance: ["Controller", "Finance Director", "VP Finance", "CFO", "Head of Talent Acquisition", "Recruiting Manager"],
          supply_chain: ["Director of Supply Chain", "Head of Supply Chain", "Logistics Director", "VP Operations", "Head of Talent Acquisition", "Recruiting Manager"],
          construction: ["VP Construction", "Director of Construction", "Construction Manager", "Project Executive", "Head of Talent Acquisition", "Recruiting Manager"],
          writing_comms: ["Head of Communications", "Director of Communications", "Content Director", "VP Communications", "Head of Talent Acquisition", "Recruiting Manager"],
          operations: ["VP Operations", "Director of Operations", "COO", "Business Operations Director", "Head of Talent Acquisition", "Recruiting Manager"],
        };

        const seedTitlesRaw = titlesByFn[fn] || titlesByFn.engineering;
        const seedTitles = titleFilters.length ? seedTitlesRaw.filter((t) => titleFilters.includes(t)) : seedTitlesRaw;

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
    // Always allow a verification attempt. Some contacts won't have an email yet,
    // but the backend can still do best-effort guessing/enrichment.
    const emailsToVerify = selected.map(c => c.email).filter((e) => isRealEmail(e));

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

    const selectedSignals: Record<string, ContactSignal[]> = {};
    for (const c of chosen) {
      const sigs = (c.person_signals || []).filter((_: any, idx: number) =>
        selectedContactSignalIds.has(`${c.id}_psig_${idx}`)
      );
      if (sigs.length) selectedSignals[c.id] = sigs;
    }
    localStorage.setItem('selected_person_signals', JSON.stringify(selectedSignals));

    router.push('/bio-page');
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
      setResearchByContact(byContact);
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
          <a href="/company-research" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
            <span className="mr-2">←</span> Back to Company Research
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
                    This runs background research for your saved contacts and stores it for Campaign personalization.
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
                    className="mt-3 w-full rounded-md bg-white/10 border border-white/15 px-3 py-2 text-sm font-semibold text-white/85 hover:bg-white/15 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    title="Run background research for saved contacts"
                  >
                    {isResearching ? (
                      <>
                        <InlineSpinner className="h-3.5 w-3.5" />
                        <span>Researching</span>
                      </>
                    ) : (
                      "Run research for saved contacts"
                    )}
                  </button>

                  {(savedVerified?.length || 0) > 0 ? (
                    <div className="mt-3">
                      <div className="text-[11px] text-white/60">
                        Researched:{" "}
                        <span className="text-white/80 font-semibold">
                          {(savedVerified || []).filter((c) => Boolean(researchByContact?.[String(c?.id || "")])).length}/{savedVerified.length}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1">
                        {(savedVerified || []).slice(0, 6).map((c) => {
                          const cid = String(c?.id || "").trim();
                          const has = Boolean(researchByContact?.[cid]);
                          return (
                            <div key={`r_${cid}`} className="flex items-center justify-between gap-2 text-[11px]">
                              <div className="min-w-0 truncate text-white/75">
                                {String(c?.name || "Contact")}
                              </div>
                              <div className={`shrink-0 ${has ? "text-emerald-200" : "text-white/35"}`}>
                                {has ? "✓ ready" : "—"}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {activeDraftContactId ? (
                        <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-2.5 space-y-2">
                          {(() => {
                            const meta = getContactMeta(activeDraftContactId);
                            if (meta.urgency_score > 0) {
                              const color = meta.urgency_score >= 70 ? "text-emerald-300" : meta.urgency_score >= 40 ? "text-amber-300" : "text-white/50";
                              return (
                                <div className="flex items-center gap-2">
                                  <div className={`text-[11px] font-bold ${color}`}>{meta.urgency_score}/100</div>
                                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                    <div className={`h-full rounded-full ${meta.urgency_score >= 70 ? "bg-emerald-400" : meta.urgency_score >= 40 ? "bg-amber-400" : "bg-white/30"}`} style={{ width: `${meta.urgency_score}%` }} />
                                  </div>
                                  {meta.urgency_reason && <div className="text-[9px] text-white/40 max-w-[120px] truncate" title={meta.urgency_reason}>{meta.urgency_reason}</div>}
                                </div>
                              );
                            }
                            return null;
                          })()}

                          <div className="text-[11px] font-semibold text-white/80">Signals</div>
                          <div className="text-[11px] text-white/60 space-y-1">
                            {(() => {
                              const facts = getInterestingFactsForContact(activeDraftContactId);
                              if (!facts.length) return <div className="text-white/40">No signals found yet. Run research to populate.</div>;
                              return facts.slice(0, 5).map((f, idx) => {
                                const sigId = `${activeDraftContactId}_fact_${idx}`;
                                const on = selectedContactSignalIds.has(sigId);
                                const typeIcon = f.signal_type === "career_move" ? "↗" : f.signal_type === "company_news" ? "★" : f.signal_type === "hiring_signal" ? "⚡" : "●";
                                return (
                                  <div key={`f_${idx}`} className={`flex items-start gap-1.5 ${on ? "text-emerald-200" : ""}`}>
                                    <span className="shrink-0 text-[9px] mt-0.5 opacity-60">{on ? "✓" : typeIcon}</span>
                                    <span className="min-w-0">
                                      {f.url ? (
                                        <a href={f.url} target="_blank" rel="noopener noreferrer" className="hover:underline" title={f.source_title || f.url}>{trimToChars(f.text, 100)}</a>
                                      ) : trimToChars(f.text, 100)}
                                    </span>
                                  </div>
                                );
                              });
                            })()}
                          </div>

                          {(() => {
                            const meta = getContactMeta(activeDraftContactId);
                            if (!meta.outreach_angles.length) return null;
                            return (
                              <div className="mt-1.5 pt-1.5 border-t border-white/5">
                                <div className="text-[10px] font-semibold text-white/60 mb-1">Outreach angles</div>
                                {meta.outreach_angles.slice(0, 3).map((a, i) => (
                                  <div key={`oa_${i}`} className="text-[10px] text-blue-200/70 mt-0.5">→ {a}</div>
                                ))}
                              </div>
                            );
                          })()}

                          {/* Intelligence panel */}
                          {(() => {
                            const intel = getIntelligence(activeDraftContactId);
                            if (!intel) return null;
                            return (
                              <div className="mt-2 pt-2 border-t border-white/5">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="text-[10px] font-semibold text-white/60">Intelligence</div>
                                  {intel.overall_relevance_score > 0 && (
                                    <span className={`text-[9px] font-bold ${intel.overall_relevance_score >= 0.7 ? "text-emerald-300" : "text-amber-300"}`}>
                                      {(intel.overall_relevance_score * 100).toFixed(0)}%
                                    </span>
                                  )}
                                </div>
                                {intel.outreach_summary?.one_liner_hook && (
                                  <div className="text-[10px] text-blue-200/80 mb-1">{intel.outreach_summary.one_liner_hook}</div>
                                )}
                                {intel.signals.slice(0, 3).map((s, i) => (
                                  <div key={`is_${i}`} className="text-[10px] text-white/50 mt-0.5 flex gap-1">
                                    <span className="shrink-0 text-[8px] mt-0.5 opacity-50">●</span>
                                    <span className="truncate">{s.signal_title}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {/* Continue button lives at the bottom of the right column (single CTA) */}
              </div>
            </div>

            {/* Right column: search + results */}
            <div className="flex-1 min-w-0">
          {/* Filters — Sendr-inspired collapsible rows */}
          <div className="mb-6 rounded-lg border border-white/10 bg-black/20">
            <div className="px-4 py-3 border-b border-white/5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Filters</h3>
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !companyQuery.trim()}
                  className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isSearching ? (<><InlineSpinner /><span>Searching</span></>) : "Search"}
                </button>
              </div>
            </div>

            {/* Company */}
            <button type="button" onClick={() => setFilterOpen((p) => p === "company" ? null : "company")} className="flex w-full items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/[0.03] transition-colors">
              <svg className="w-4 h-4 text-white/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>
              <span className="text-sm text-white/70 flex-1 text-left">{companyQuery ? companyQuery : "Company name"}</span>
              {companyQuery && <span className="text-[10px] text-emerald-300 font-medium shrink-0">{companyQuery}</span>}
              <svg className={`w-3 h-3 text-white/30 shrink-0 transition-transform ${filterOpen === "company" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </button>
            {filterOpen === "company" && (
              <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <input
                  type="text"
                  value={companyQuery}
                  onChange={(e) => setCompanyQuery(e.target.value)}
                  placeholder="Enter company name…"
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-500/50"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  autoFocus
                />
                {companyOptions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {companyOptions.map((c) => (
                      <button key={c} type="button" onClick={() => setCompanyQuery(c)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${companyQuery === c ? "border-blue-400/50 bg-blue-500/20 text-blue-100" : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"}`}>
                        {formatCompanyName(c)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Person name */}
            <button type="button" onClick={() => setFilterOpen((p) => p === "person" ? null : "person")} className="flex w-full items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/[0.03] transition-colors">
              <svg className="w-4 h-4 text-white/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
              <span className="text-sm text-white/70 flex-1 text-left">{otherQuery ? otherQuery : "Person name or keywords"}</span>
              {otherQuery && <span className="text-[10px] text-emerald-300 font-medium shrink-0 max-w-[140px] truncate">{otherQuery}</span>}
              <svg className={`w-3 h-3 text-white/30 shrink-0 transition-transform ${filterOpen === "person" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </button>
            {filterOpen === "person" && (
              <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <input
                  type="text"
                  value={otherQuery}
                  onChange={(e) => setOtherQuery(e.target.value)}
                  placeholder="Name, keywords, or LinkedIn URL…"
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-500/50"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  autoFocus
                />
              </div>
            )}

            {/* Job title / Decision Makers */}
            <button type="button" onClick={() => setFilterOpen((p) => p === "title" ? null : "title")} className="flex w-full items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/[0.03] transition-colors">
              <svg className="w-4 h-4 text-white/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
              <span className="text-sm text-white/70 flex-1 text-left">Job title</span>
              {titleFilters.length > 0 && <span className="text-[10px] text-emerald-300 font-medium shrink-0">{titleFilters.length} selected</span>}
              <svg className={`w-3 h-3 text-white/30 shrink-0 transition-transform ${filterOpen === "title" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </button>
            {filterOpen === "title" && (
              <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-3">
                  <button type="button" onClick={selectAllTitleFilters} className="text-[11px] font-semibold rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-white/80 hover:bg-white/10">Select all</button>
                  <button type="button" onClick={clearTitleFilters} className="text-[11px] font-semibold rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-white/80 hover:bg-white/10">Clear</button>
                </div>
                <div className="space-y-3">
                  {TITLE_FILTER_OPTIONS.map((g) => (
                    <div key={g.group}>
                      <div className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-1.5">{g.group}</div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                        {g.options.map((t) => {
                          const checked = titleFilters.includes(t);
                          return (
                            <button key={`${g.group}_${t}`} type="button" aria-pressed={checked} onClick={() => toggleTitleFilter(t)} className={`w-full text-left rounded-md border px-2 py-1.5 text-[11px] leading-tight font-medium transition-colors ${checked ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100" : "border-white/5 bg-white/[0.02] text-white/45 hover:bg-white/[0.05] hover:text-white/70"}`} title={t}>
                              <span className="block min-w-0 truncate">{t}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Seniority */}
            <button type="button" onClick={() => setFilterOpen((p) => p === "seniority" ? null : "seniority")} className="flex w-full items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/[0.03] transition-colors">
              <svg className="w-4 h-4 text-white/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" /></svg>
              <span className="text-sm text-white/70 flex-1 text-left">Seniority</span>
              {seniorityFilter && <span className="text-[10px] text-emerald-300 font-medium shrink-0">{seniorityFilter}</span>}
              <svg className={`w-3 h-3 text-white/30 shrink-0 transition-transform ${filterOpen === "seniority" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </button>
            {filterOpen === "seniority" && (
              <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                  {["C-Suite", "VP", "Director", "Manager", "Senior", "Entry"].map((lvl) => {
                    const on = seniorityFilter === lvl;
                    return (
                      <button key={lvl} type="button" onClick={() => setSeniorityFilter(on ? "" : lvl)} className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${on ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-100" : "border-white/5 bg-white/[0.02] text-white/45 hover:bg-white/[0.05]"}`}>{lvl}</button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Location */}
            <button type="button" onClick={() => setFilterOpen((p) => p === "location" ? null : "location")} className="flex w-full items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors">
              <svg className="w-4 h-4 text-white/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
              <span className="text-sm text-white/70 flex-1 text-left">{locationFilter ? locationFilter : "Location"}</span>
              {locationFilter && <span className="text-[10px] text-emerald-300 font-medium shrink-0 max-w-[140px] truncate">{locationFilter}</span>}
              <svg className={`w-3 h-3 text-white/30 shrink-0 transition-transform ${filterOpen === "location" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </button>
            {filterOpen === "location" && (
              <div className="px-4 py-3 border-t border-white/5 bg-white/[0.02]">
                <input
                  type="text"
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  placeholder="City, state, or country…"
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-500/50"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Contacts List */}
          {contacts.length > 0 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Found Contacts</h2>
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
                            <div className={`text-xs ${draft.linkedin_note.length > LINKEDIN_NOTE_LIMIT ? "text-red-300" : "text-white/60"}`}>
                              {draft.linkedin_note.length}/{LINKEDIN_NOTE_LIMIT}
                            </div>
                          </div>
                        </div>
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
                          const topFacts = facts.slice(0, 6);
                          const meta = getContactMeta(active.id);
                          const signalLabel: Record<string, string> = {
                            web_activity: "Activity",
                            career_move: "Career",
                            company_news: "News",
                            hiring_signal: "Hiring",
                            role_insight: "Role",
                          };
                          const signalColor: Record<string, string> = {
                            web_activity: "bg-blue-500/20 text-blue-300",
                            career_move: "bg-purple-500/20 text-purple-300",
                            company_news: "bg-amber-500/20 text-amber-300",
                            hiring_signal: "bg-emerald-500/20 text-emerald-300",
                            role_insight: "bg-white/10 text-white/60",
                          };
                          return (
                            <div className="mt-3 rounded-md border border-amber-400/25 bg-amber-500/10 p-3">
                              <div className="flex items-center justify-between mb-1">
                                <div className="text-xs font-semibold text-amber-200 uppercase tracking-wider">
                                  Signals for outreach
                                </div>
                                {meta.urgency_score > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <div className={`text-[10px] font-bold ${meta.urgency_score >= 70 ? "text-emerald-300" : meta.urgency_score >= 40 ? "text-amber-300" : "text-white/50"}`}>
                                      {meta.urgency_score >= 70 ? "Hot" : meta.urgency_score >= 40 ? "Warm" : "Low"} ({meta.urgency_score})
                                    </div>
                                  </div>
                                )}
                              </div>
                              {meta.urgency_reason && (
                                <div className="text-[10px] text-white/45 mb-2">{meta.urgency_reason}</div>
                              )}
                              <div className="text-[11px] text-white/55 mb-2">
                                Select signals about {safeFirstName(active.name)} to weave into your message.
                              </div>
                              {topFacts.length ? (
                                <div className="space-y-1.5">
                                  {topFacts.map((f, idx) => {
                                    const sigId = `${active.id}_fact_${idx}`;
                                    const on = selectedContactSignalIds.has(sigId);
                                    return (
                                      <button
                                        key={sigId}
                                        type="button"
                                        onClick={() => {
                                          setSelectedContactSignalIds((prev) => {
                                            const next = new Set(prev);
                                            if (next.has(sigId)) next.delete(sigId); else next.add(sigId);
                                            try {
                                              const selected = topFacts.filter((_, fi) => next.has(`${active.id}_fact_${fi}`));
                                              localStorage.setItem(
                                                "rf_selected_contact_signals",
                                                JSON.stringify(selected.map((s) => ({ text: s.text, url: s.url }))),
                                              );
                                            } catch {}
                                            return next;
                                          });
                                        }}
                                        className={`w-full text-left rounded-md border p-2 transition-colors ${
                                          on
                                            ? "border-emerald-400/50 bg-emerald-500/15"
                                            : "border-white/10 bg-white/5 hover:bg-white/10"
                                        }`}
                                      >
                                        <div className="flex items-start gap-2">
                                          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                                            on ? "border-emerald-400 bg-emerald-500 text-black" : "border-white/30 text-white/40"
                                          }`}>
                                            {on ? "✓" : ""}
                                          </span>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                              {f.signal_type && signalLabel[f.signal_type] && (
                                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${signalColor[f.signal_type] || "bg-white/10 text-white/60"}`}>
                                                  {signalLabel[f.signal_type]}
                                                </span>
                                              )}
                                              {f.source_title && (
                                                <span className="text-[9px] text-white/35 truncate max-w-[150px]">{f.source_title}</span>
                                              )}
                                            </div>
                                            <span className="text-[13px] text-white/80 leading-tight">{f.text}</span>
                                          </div>
                                          {f.url ? (
                                            <a
                                              href={f.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="shrink-0 text-[10px] underline text-white/50 hover:text-white"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              source
                                            </a>
                                          ) : null}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="mt-2 text-xs text-white/65">
                                  No signals found. Click{" "}
                                  <span className="font-semibold text-white/80">Run research for saved contacts</span>{" "}
                                  on the left to populate.
                                </div>
                              )}
                              {meta.outreach_angles.length > 0 && (
                                <div className="mt-2.5 pt-2 border-t border-amber-400/15">
                                  <div className="text-[10px] font-semibold text-amber-200/70 mb-1">Suggested angles</div>
                                  {meta.outreach_angles.slice(0, 3).map((a, i) => (
                                    <div key={`angle_${i}`} className="text-[11px] text-white/60 mt-0.5">→ {a}</div>
                                  ))}
                                </div>
                              )}
                              {(() => {
                                const intel = getIntelligence(active.id);
                                if (!intel?.outreach_summary?.conversation_starters?.length) return null;
                                return (
                                  <div className="mt-2.5 pt-2 border-t border-amber-400/15">
                                    <div className="text-[10px] font-semibold text-amber-200/70 mb-1">Conversation starters</div>
                                    {intel.outreach_summary!.conversation_starters.slice(0, 3).map((s, i) => (
                                      <div key={`conv_${i}`} className="text-[11px] text-white/55 mt-1 leading-snug pl-3 border-l-2 border-amber-400/20">{s}</div>
                                    ))}
                                  </div>
                                );
                              })()}
                              {facts.length > 6 ? (
                                <div className="mt-2 text-[10px] text-white/45">
                                  +{facts.length - 6} more signal{facts.length - 6 === 1 ? "" : "s"} available.
                                </div>
                              ) : null}
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

              {selectedContacts.length > 0 && (() => {
                const verifiableCount = contacts.filter((c) => selectedContacts.includes(c.id) && isRealEmail(c.email)).length;
                const verifyLabel = `Verify emails (${verifiableCount}/${selectedContacts.length})`;
                const hint =
                  verifiableCount === 0
                    ? "No emails detected yet — we’ll still try a best-effort verification/guess when you click."
                    : "Verify the selected contacts’ emails (Valid contacts get saved on the left).";
                return (
                  <div className="flex justify-end">
                    <button
                      onClick={handleVerifyEmails}
                      className="px-4 py-2 rounded-md font-medium transition-colors bg-green-600 text-white hover:bg-green-700"
                      title={hint}
                    >
                      {verifyLabel}
                    </button>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                {contacts.map((contact) => {
                  const badge = getVerificationBadge(contact.verification_status, contact.verification_score);
                  const isSelected = selectedContacts.includes(contact.id);
                  const hooks = getInterestingFactsForContact(contact.id);
                  const research = readResearchForContact(contact.id) || {};
                  const bio = Array.isArray(research?.contact_bios) ? research.contact_bios[0] : null;
                  const topics = Array.isArray((bio as any)?.post_topics) ? ((bio as any).post_topics as any[]) : [];
                  const pubs = Array.isArray((bio as any)?.publications) ? ((bio as any).publications as any[]) : [];
                  
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
                          {hooks.length ? (
                            <div className="mt-2 text-[11px] text-white/70">
                              <span className="font-semibold text-white/80">Personalization:</span>{" "}
                              <span className="text-white/70">{trimToChars(hooks[0].text, 140)}</span>
                            </div>
                          ) : (
                            <div className="mt-2 text-[11px] text-white/50">
                              No online info found for {contact.name?.split(" ")[0] || "this contact"}. Run research to discover more.
                            </div>
                          )}
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

                        {topics.length ? (
                          <div className="pt-1">
                            <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Recent topics</div>
                            <div className="mt-1 text-[11px] text-white/70">
                              {topics.slice(0, 3).map((t: any, idx: number) => (
                                <div key={`topic_${contact.id}_${idx}`} className="truncate">
                                  - {String(t || "").trim()}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {pubs.length ? (
                          <div className="pt-1">
                            <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wider">Publications</div>
                            <div className="mt-1 text-[11px] text-white/70">
                              {pubs.slice(0, 2).map((p: any, idx: number) => (
                                <div key={`pub_${contact.id}_${idx}`} className="truncate">
                                  - {String(p || "").trim()}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {/* Person signals from PDL */}
                        {(contact.person_signals?.length ?? 0) > 0 && (
                          <div className="pt-2">
                            <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1.5">About {contact.name?.split(" ")[0]}</div>
                            <div className="flex flex-wrap gap-1.5">
                              {contact.person_signals!.slice(0, 9).map((sig, idx) => {
                                const sigId = `${contact.id}_psig_${idx}`;
                                const on = selectedContactSignalIds.has(sigId);
                                const count = [...selectedContactSignalIds].filter(k => k.startsWith(`${contact.id}_`)).length;
                                return (
                                  <button
                                    key={sigId}
                                    type="button"
                                    title={`${sig.label}: ${sig.value}`}
                                    disabled={!on && count >= 3}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedContactSignalIds(prev => {
                                        const next = new Set(prev);
                                        if (next.has(sigId)) { next.delete(sigId); } else if (count < 3) { next.add(sigId); }
                                        return next;
                                      });
                                    }}
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] leading-tight border transition-all ${
                                      on
                                        ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-200"
                                        : count >= 3
                                          ? "border-white/5 bg-white/3 text-white/30 cursor-not-allowed"
                                          : "border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:bg-white/10"
                                    }`}
                                  >
                                    {on && <span className="text-emerald-300">✓</span>}
                                    <span className="font-medium">{sig.label}:</span>
                                    <span className="truncate max-w-[140px]">{sig.value}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-[9px] text-white/40 mt-1">Select up to 3 to include in your message</p>
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
            return (
              <div className="mt-8 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/painpoint-match")}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-md font-medium hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <div className="flex items-center gap-2">
                  {!canContinue ? (
                    <div className="text-[11px] text-white/60">
                      Verify emails to continue
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleContinue}
                    disabled={!canContinue}
                    className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    Save &amp; Continue
                  </button>
                </div>
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
                  const company = companyQuery.trim() || "Company";
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
