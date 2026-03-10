"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { persistCampaignContextV1 } from "@/lib/campaignContext";
import { formatCompanyName } from "@/lib/format";
import InlineSpinner from "@/components/InlineSpinner";

type Mode = "job-seeker" | "recruiter";

type BaseTone =
  | "recruiter"
  | "manager"
  | "exec"
  | "developer"
  | "sales"
  | "startup"
  | "enterprise"
  | "custom";

type HailMaryTone =
  | "hilarious"
  | "silly"
  | "wacky"
  | "alarmist"
  | "flirty"
  | "sad"
  | "ridiculous";

type Tone = BaseTone | HailMaryTone;

type ContextLayerId =
  | "job_prefs"
  | "resume"
  | "personality"
  | "offer"
  | "job"
  | "gaps"
  | "painpoint_match"
  | "company_research"
  | "contact_research";

type ContextLayers = Record<ContextLayerId, boolean>;

type SenderProfile = {
  full_name?: string;
  phone?: string;
  linkedin_url?: string;
  email?: string;
};

type SignaturePrefs = {
  include_phone: boolean;
  include_email: boolean;
  include_linkedin: boolean;
  include_bio_link: boolean;
  include_other_link: boolean;
  other_link_url: string;
};

type EmailStepV2 = {
  id: string;
  step_number: 1 | 2 | 3 | 4;
  subject: string;
  body: string;
  delay_days: number;
  stop_on_reply: boolean;

  tone: Tone;
  custom_tone?: string;
  context_layers: ContextLayers;
  special_instructions: string;
  signature_prefs?: SignaturePrefs;

  last_generated_at?: string;
};

type CampaignV2 = {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  emails: EmailStepV2[];
  created_at: string;
  updated_at: string;
};

const STORAGE_V2 = "rf_campaign_by_contact_v2";
const STORAGE_ACTIVE = "rf_campaign_active_contact_id";
const STORAGE_PERSISTED = "rf_persisted_campaign_meta_v1"; // { id, name }

const BASE_TONES: Tone[] = ["recruiter", "manager", "exec", "developer", "sales", "startup", "enterprise", "custom"];
const EMAIL4_EXTRA_TONES: Tone[] = ["hilarious", "silly", "wacky", "alarmist", "flirty", "sad", "ridiculous"];

function nowIso() {
  return new Date().toISOString();
}

function safeJson<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function cleanMessageText(v: any): string {
  return String(v ?? "")
    .replace(/&nbsp;?/gi, " ")
    .replace(/&#160;?/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/^\s{0,3}#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/gs, "$1")
    .replace(/__(.*?)__/gs, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[*+-]\s+/gm, "")
    .replace(/(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)/gs, "$1")
    .replace(/(?<!_)_(?!_)([^_\n]+?)(?<!_)_(?!_)/gs, "$1")
    .replace(/\*/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function firstName(full: string) {
  const s = String(full || "").trim();
  if (!s) return "there";
  return s.split(/\s+/)[0] || "there";
}

function defaultLayers(): ContextLayers {
  return {
    job_prefs: true,
    resume: true,
    personality: true,
    offer: true,
    job: true,
    gaps: true,
    painpoint_match: true,
    company_research: true,
    contact_research: true,
  };
}

function defaultSignaturePrefs(): SignaturePrefs {
  return {
    include_phone: true,
    include_email: true,
    include_linkedin: true,
    include_bio_link: true,
    include_other_link: false,
    other_link_url: "",
  };
}

function defaultToneForStep(step: 1 | 2 | 3 | 4): Tone {
  if (step === 4) return "hilarious";
  return "manager";
}

function defaultInstructions(step: 1 | 2 | 3 | 4) {
  if (step === 1) {
    return [
      "Write a concise, human first email that feels personally written to this person.",
      "No fluff openers. Lead with a concrete value/idea and one credibility proof.",
      "Use specifics from the selected context layers, but do not overstuff.",
      "End with a simple CTA (10–15 min chat).",
    ].join("\n");
  }
  if (step === 2) {
    return [
      "Follow up briefly. Assume they are busy, not ignoring you.",
      "Add one additional helpful detail or angle (not a repeat).",
      "Keep it short and easy to respond to.",
    ].join("\n");
  }
  if (step === 3) {
    return [
      "Follow up again with a different angle: alternative proof, different benefit, or a short 2–3 bullet plan.",
      "Warm and respectful. No guilt. No pressure.",
    ].join("\n");
  }
  return [
    "Final follow-up. This is a respectful 'breakup' message.",
    "If tone is playful/wacky.",
    "Give them an easy out (reply 'no') and an easy yes (quick chat).",
    "This is a first-person job seeker contacting a hiring decision maker.  It should should sound person, relatable, human, friendly, and not corporate, salesy or too canned.",
  ].join("\n");
}

function buildEmptyCampaign(contact: any): CampaignV2 {
  const cid = String(contact?.id || "").trim() || `c_${Date.now()}`;
  const nm = String(contact?.name || "Contact").trim();
  const company = String(contact?.company || "").trim();
  const nameForTitle = nm ? nm.split(/\s+/)[0] : "Contact";

  const mk = (step: 1 | 2 | 3 | 4, delayDays: number): EmailStepV2 => ({
    id: `${cid}_e${step}`,
    step_number: step,
    subject: "",
    body: "",
    delay_days: delayDays,
    stop_on_reply: true,
    tone: defaultToneForStep(step),
    context_layers: defaultLayers(),
    special_instructions: defaultInstructions(step),
    signature_prefs: defaultSignaturePrefs(),
  });

  return {
    id: `camp_${cid}`,
    name: `Sequence for ${nameForTitle}${company ? ` @ ${formatCompanyName(company)}` : ""}`,
    status: "draft",
    emails: [mk(1, 0), mk(2, 3), mk(3, 7), mk(4, 14)],
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

function toneLabel(t: Tone) {
  if (t === "exec") return "Exec (ROI)";
  if (t === "recruiter") return "Recruiter (short)";
  if (t === "manager") return "Manager (collab)";
  if (t === "developer") return "Developer (technical)";
  if (t === "enterprise") return "Enterprise";
  if (t === "startup") return "Startup";
  if (t === "ridiculous") return "Ridiculous";
  return String(t).replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function layerLabel(id: ContextLayerId) {
  switch (id) {
    case "job_prefs":
      return "Role Prefs";
    case "resume":
      return "Resume";
    case "personality":
      return "Personality";
    case "offer":
      return "Offer (Value Prop)";
    case "job":
      return "Role";
    case "gaps":
      return "Gaps";
    case "painpoint_match":
      return "Pain Point Match";
    case "company_research":
      return "Company Research";
    case "contact_research":
      return "Contact Research";
  }
}

function emailLabelForNumber(n: number) {
  if (n === 1) return "Initial";
  if (n === 4) return "Final check-in";
  return "Follow-up";
}

function recommendedCtaType(stepNumber: number): "Soft CTA" | "Hard CTA" {
  return stepNumber <= 2 ? "Soft CTA" : "Hard CTA";
}

function filterContextByLayers(ctx: any, layers: ContextLayers) {
  const out: any = {
    sender_profile: ctx?.sender_profile,
    contact: ctx?.contact,
    company_name: ctx?.company_name,
    links: ctx?.links,
  };
  if (layers.job_prefs) out.job_preferences = ctx.job_preferences;
  if (layers.resume) out.resume_extract = ctx.resume_extract;
  if (layers.personality) {
    out.personality_profile = ctx.personality_profile;
    out.temperament_profile = ctx.temperament_profile;
  }
  if (layers.offer) out.offer = ctx.offer;
  if (layers.job) out.selected_job_description = ctx.selected_job_description;
  if (layers.gaps) out.gap_analysis = ctx.gap_analysis;
  if (layers.painpoint_match) out.painpoint_matches = ctx.painpoint_matches;
  if (layers.company_research) out.company_research = ctx.company_research;
  if (layers.contact_research) out.contact_research = ctx.contact_research;
  if (ctx.selected_contact_signals?.length) out.selected_contact_signals = ctx.selected_contact_signals;
  if (ctx.selected_company_signals?.length) out.selected_company_signals = ctx.selected_company_signals;
  return out;
}

export default function CampaignV2() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("job-seeker");
  const [contacts, setContacts] = useState<any[]>([]);
  const [activeContactId, setActiveContactId] = useState<string>("");
  const [campaignByContact, setCampaignByContact] = useState<Record<string, CampaignV2>>({});
  const [busyKey, setBusyKey] = useState<string>(""); // `${contactId}_${step}`
  const [error, setError] = useState<string | null>(null);
  const [bioUrl, setBioUrl] = useState<string>("");

  const [openAccordions, setOpenAccordions] = useState<Record<string, { layers: boolean; instructions: boolean }>>({});

  // Persisted campaign (DB) metadata
  const [persistedCampaignId, setPersistedCampaignId] = useState<string>("");
  const [persistedCampaignName, setPersistedCampaignName] = useState<string>("");
  const [loadCampaignId, setLoadCampaignId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const activeCampaign = activeContactId ? campaignByContact[activeContactId] || null : null;
  const activeContact = useMemo(() => contacts.find((c) => String(c?.id || "") === String(activeContactId || "")) || null, [contacts, activeContactId]);

  useEffect(() => {
    // Client-only: hydrate from localStorage.
    const storedMode = String(localStorage.getItem("rf_mode") || "").trim();
    if (storedMode === "recruiter") setMode("recruiter");

    const selectedContacts = safeJson<any[]>(localStorage.getItem("selected_contacts"), []);
    setContacts(Array.isArray(selectedContacts) ? selectedContacts : []);

    const by = safeJson<Record<string, CampaignV2>>(localStorage.getItem(STORAGE_V2), {});
    setCampaignByContact(by || {});

    const savedActive = String(localStorage.getItem(STORAGE_ACTIVE) || "").trim();
    const fallback = selectedContacts?.[0]?.id ? String(selectedContacts[0].id) : "";
    setActiveContactId(savedActive || fallback);

    setBioUrl(String(localStorage.getItem("bio_page_url") || "").trim());

    const persisted = safeJson<any>(localStorage.getItem(STORAGE_PERSISTED), null);
    const pid = String(persisted?.id || "").trim();
    const pname = String(persisted?.name || "").trim();
    setPersistedCampaignId(pid);
    setPersistedCampaignName(pname);
    setLoadCampaignId(pid);
  }, []);

  const persistPersistedMeta = (next: { id: string; name: string }) => {
    setPersistedCampaignId(String(next?.id || "").trim());
    setPersistedCampaignName(String(next?.name || "").trim());
    try {
      localStorage.setItem(STORAGE_PERSISTED, JSON.stringify({ id: String(next?.id || "").trim(), name: String(next?.name || "").trim() }));
    } catch {}
  };

  const persist = (next: Record<string, CampaignV2>) => {
    setCampaignByContact(next);
    try {
      localStorage.setItem(STORAGE_V2, JSON.stringify(next || {}));
    } catch {}
  };

  const ensureCampaignForContact = (contact: any) => {
    const cid = String(contact?.id || "").trim();
    if (!cid) return;
    // IMPORTANT: use a functional update so we don't overwrite when looping contacts.
    setCampaignByContact((prev) => {
      const cur = prev || {};
      if (cur?.[cid]) return cur;
      const next = { ...cur };
      next[cid] = buildEmptyCampaign(contact);
      try {
        localStorage.setItem(STORAGE_V2, JSON.stringify(next || {}));
      } catch {}
      return next;
    });
    // Also snapshot structured context so generation has a single canonical blob.
    try {
      persistCampaignContextV1(cid);
    } catch {}
  };

  useEffect(() => {
    for (const c of contacts || []) ensureCampaignForContact(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts]);

  const setActive = (cid: string) => {
    const id = String(cid || "").trim();
    if (!id) return;
    setActiveContactId(id);
    try {
      localStorage.setItem(STORAGE_ACTIVE, id);
    } catch {}
  };

  const updateStep = (contactId: string, stepId: string, patch: Partial<EmailStepV2>) => {
    const cid = String(contactId || "").trim();
    if (!cid) return;
    // Use functional update to avoid stale-closure overwrites during sequential async generation.
    setCampaignByContact((prev) => {
      const cur = prev || {};
      const camp = cur[cid];
      if (!camp) return cur;
      const next = { ...cur };
      next[cid] = {
        ...camp,
        updated_at: nowIso(),
        emails: (camp.emails || []).map((e) => (e.id === stepId ? ({ ...e, ...patch } as any) : e)),
      };
      try {
        localStorage.setItem(STORAGE_V2, JSON.stringify(next || {}));
      } catch {}
      return next;
    });
  };

  const toneOptionsForStep = (step: 1 | 2 | 3 | 4): Tone[] => {
    // Make the "attention-grabbing" tones available for all steps (not just email 4).
    // Keep base tones first so the cycle starts in sane territory.
    return [...BASE_TONES, ...EMAIL4_EXTRA_TONES];
  };

  const cycleTone = (contactId: string, step: EmailStepV2, dir: -1 | 1) => {
    const options = toneOptionsForStep(step.step_number);
    const idx = Math.max(0, options.indexOf(step.tone));
    const next = options[(idx + dir + options.length) % options.length] || options[0];
    updateStep(contactId, step.id, { tone: next });
  };

  const toggleLayer = (contactId: string, step: EmailStepV2, layer: ContextLayerId) => {
    const cur = step.context_layers || defaultLayers();
    updateStep(contactId, step.id, { context_layers: { ...cur, [layer]: !cur[layer] } });
  };

  const toggleAccordion = (stepId: string, key: "layers" | "instructions") => {
    setOpenAccordions((prev) => {
      const cur = prev?.[stepId] || { layers: false, instructions: false };
      return { ...(prev || {}), [stepId]: { ...cur, [key]: !cur[key] } };
    });
  };

  const generateStep = async (contactId: string, step: EmailStepV2) => {
    const cid = String(contactId || "").trim();
    if (!cid) return;
    setError(null);
    setBusyKey(`${cid}_${step.step_number}`);
    try {
      const ctx = persistCampaignContextV1(cid);
      const filtered = filterContextByLayers(ctx, step.context_layers || defaultLayers());

      const sig = step.signature_prefs || defaultSignaturePrefs();
      const bioUrl = String(ctx?.links?.bio_page_url || "").trim();
      // Only pass bio URL if the signature prefs allow it (prevents the model from referencing it).
      if (!sig.include_bio_link && filtered?.links) {
        filtered.links = { ...(filtered.links || {}) };
        delete filtered.links.bio_page_url;
      }

      const payload = {
        step_number: step.step_number,
        tone: step.tone,
        custom_tone: step.tone === "custom" ? String(step.custom_tone || "").trim() : undefined,
        special_instructions: step.special_instructions,
        enabled_context_layers: step.context_layers,
        context: filtered,
        signature_prefs: {
          include_phone: Boolean(sig.include_phone),
          include_email: Boolean(sig.include_email),
          include_linkedin: Boolean(sig.include_linkedin),
          include_bio_link: Boolean(sig.include_bio_link && bioUrl),
          include_other_link: Boolean(sig.include_other_link && String(sig.other_link_url || "").trim()),
          other_link_url: String(sig.other_link_url || "").trim(),
        },
        sender_profile: ctx.sender_profile as SenderProfile,
      };

      const res = await api<{ success: boolean; subject: string; body: string; message?: string }>(
        "/campaign/generate-step",
        "POST",
        payload
      );

      if (!res?.success) throw new Error(res?.message || "Failed to generate email");
      updateStep(cid, step.id, {
        subject: cleanMessageText(res.subject || ""),
        body: cleanMessageText(res.body || ""),
        last_generated_at: nowIso(),
      });
    } catch (e: any) {
      setError(String(e?.message || "Failed to generate."));
    } finally {
      setBusyKey("");
    }
  };

  const generateAllForContact = async (contactId: string) => {
    const camp = campaignByContact?.[contactId];
    if (!camp) return;
    for (const step of camp.emails) {
      // eslint-disable-next-line no-await-in-loop
      await generateStep(contactId, step);
    }
  };

  const buildRowsForSave = () => {
    const out: any[] = [];
    for (const c of contacts || []) {
      const cid = String(c?.id || "").trim();
      if (!cid) continue;
      const ctx = persistCampaignContextV1(cid);
      const camp = campaignByContact?.[cid];

      const full = String(c?.name || "").trim();
      const parts = full.split(/\s+/).filter(Boolean);
      const first = String(c?.first_name || c?.firstName || parts?.[0] || "").trim();
      const last = String(c?.last_name || c?.lastName || (parts.length > 1 ? parts.slice(1).join(" ") : "") || "").trim();

      const email = String(c?.email || cid).trim();
      const appliedLink = String(ctx?.selected_job_description?.url || ctx?.selected_job_description?.link || "").trim();
      const appliedTitle = String(ctx?.selected_job_description?.title || "").trim();
      const personalized = String(ctx?.links?.bio_page_url || bioUrl || "").trim();

      const emailsObj: any = { emails: {} };
      if (camp?.emails?.length) {
        for (const e of camp.emails) {
          const n = Number(e?.step_number || 0) || 0;
          if (n < 1 || n > 4) continue;
          emailsObj.emails[`email_${n}`] = {
            email_number: n,
            subject: cleanMessageText(e?.subject || ""),
            body: cleanMessageText(e?.body || ""),
            tone: String(e?.tone || "").trim(),
            custom_tone: String(e?.custom_tone || "").trim(),
            special_instructions: String(e?.special_instructions || "").trim(),
            last_generated_at: String(e?.last_generated_at || "").trim(),
            delay_days: Number(e?.delay_days || 0) || 0,
            stop_on_reply: Boolean(e?.stop_on_reply),
            signature_prefs: e?.signature_prefs || {},
          };
        }
      }

      out.push({
        email,
        email_provider: String(c?.email_provider || c?.emailProvider || "").trim(),
        lead_status: String(c?.lead_status || c?.leadStatus || "").trim(),
        first_name: first,
        last_name: last,
        verification_status: String(c?.verification_status || c?.verificationStatus || "").trim(),
        interest_status: String(c?.interest_status || c?.interestStatus || "").trim(),
        website: String(c?.website || "").trim(),
        job_title: String(c?.title || c?.jobTitle || "").trim(),
        linkedin: String(c?.linkedin_url || c?.linkedin || c?.linkedIn || "").trim(),
        employees: c?.employees ?? c?.Employees ?? null,
        company_name: String(c?.company || ctx?.company_name || "").trim(),
        applied_job_link: appliedLink,
        applied_job_title: appliedTitle,
        personalized_page: personalized,
        context: ctx || {},
        emails: emailsObj,
        state: { contact_id: cid },
      });
    }
    return out;
  };

  const savePersistedCampaign = async () => {
    setError(null);
    setNotice(null);
    setIsSaving(true);
    try {
      const nm = String(persistedCampaignName || "").trim();
      let id = String(persistedCampaignId || "").trim();
      if (!id) {
        const created = await api<{ campaign: any }>("/campaign/campaigns", "POST", { name: nm, status: "draft", meta: {} });
        id = String(created?.campaign?.id || "").trim();
        if (!id) throw new Error("Failed to create campaign");
      } else {
        // Keep persisted name in sync when saving again.
        try {
          await api<{ campaign: any }>(`/campaign/campaigns/${encodeURIComponent(id)}`, "PATCH", { name: nm });
        } catch {
          // Ignore name update failures; rows upsert can still succeed.
        }
      }

      const rows = buildRowsForSave();
      await api<{ row_ids: string[] }>(`/campaign/campaigns/${encodeURIComponent(id)}/rows:upsert`, "POST", { rows });

      persistPersistedMeta({ id, name: nm });
      setLoadCampaignId(id);
      setNotice(`Saved campaign (${rows.length} row${rows.length === 1 ? "" : "s"}).`);
      window.setTimeout(() => setNotice(null), 2200);
    } catch (e: any) {
      setError(String(e?.message || "Failed to save campaign."));
    } finally {
      setIsSaving(false);
    }
  };

  const loadPersistedCampaign = async () => {
    setError(null);
    setNotice(null);
    setIsLoading(true);
    try {
      const id = String(loadCampaignId || "").trim();
      if (!id) throw new Error("Enter a campaign ID to load.");
      const res = await api<{ campaign: any; rows: any[] }>(`/campaign/campaigns/${encodeURIComponent(id)}`, "GET");
      const camp = res?.campaign || null;
      const rows = Array.isArray(res?.rows) ? res.rows : [];
      if (!camp) throw new Error("Campaign not found.");

      const nextContacts = rows.map((r: any) => {
        const state = r?.state && typeof r.state === "object" ? r.state : {};
        const cid = String(state?.contact_id || r?.email || r?.id || "").trim() || `c_${Date.now()}`;
        const name = `${String(r?.first_name || "").trim()} ${String(r?.last_name || "").trim()}`.trim() || "Contact";
        return {
          id: cid,
          email: String(r?.email || "").trim(),
          name,
          company: String(r?.company_name || "").trim(),
          title: String(r?.job_title || "").trim(),
          linkedin_url: String(r?.linkedin || "").trim(),
          website: String(r?.website || "").trim(),
          employees: r?.employees ?? null,
          verification_status: String(r?.verification_status || "").trim(),
        };
      });

      // Seed selected_contacts so other pages continue to work.
      try {
        localStorage.setItem("selected_contacts", JSON.stringify(nextContacts));
      } catch {}
      setContacts(nextContacts);

      // Rebuild per-contact editable sequences from persisted row.emails.
      const nextBy: Record<string, CampaignV2> = {};
      for (const c of nextContacts) {
        const cid = String(c?.id || "").trim();
        if (!cid) continue;
        const base = buildEmptyCampaign(c);
        const row = rows.find((x: any) => {
          const st = x?.state && typeof x.state === "object" ? x.state : {};
          const rid = String(st?.contact_id || x?.email || "").trim();
          return rid === cid;
        });
        const storedEmails = row?.emails && typeof row.emails === "object" ? row.emails : {};
        const blob = storedEmails?.emails && typeof storedEmails.emails === "object" ? storedEmails.emails : {};
        const patched = {
          ...base,
          emails: (base.emails || []).map((e) => {
            const n = Number(e.step_number || 0);
            const hit = blob?.[`email_${n}`] || null;
            if (!hit) return e;
            return {
              ...e,
              subject: cleanMessageText(hit?.subject || e.subject || ""),
              body: cleanMessageText(hit?.body || e.body || ""),
              tone: (String(hit?.tone || e.tone || "manager").trim() as any) || e.tone,
              custom_tone: String(hit?.custom_tone || "").trim() || e.custom_tone,
              special_instructions: String(hit?.special_instructions || "").trim() || e.special_instructions,
              last_generated_at: String(hit?.last_generated_at || "").trim() || e.last_generated_at,
              signature_prefs: hit?.signature_prefs || e.signature_prefs,
            };
          }),
        } as CampaignV2;
        nextBy[cid] = patched;
      }
      persist(nextBy);

      const first = nextContacts?.[0]?.id ? String(nextContacts[0].id) : "";
      setActiveContactId(first);
      try {
        localStorage.setItem(STORAGE_ACTIVE, first);
      } catch {}

      persistPersistedMeta({ id: String(camp?.id || id).trim(), name: String(camp?.name || "").trim() });
      setNotice("Loaded campaign.");
      window.setTimeout(() => setNotice(null), 2200);
    } catch (e: any) {
      setError(String(e?.message || "Failed to load campaign."));
    } finally {
      setIsLoading(false);
    }
  };

  const canContinueToLaunch = Boolean(bioUrl) && (contacts?.length || 0) > 0;

  const [expandedContacts, setExpandedContacts] = useState<Set<string>>(new Set());
  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());

  const toggleContact = (cid: string) => {
    setExpandedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid); else next.add(cid);
      return next;
    });
    if (!expandedContacts.has(cid)) setActive(cid);
  };

  const toggleEmail = (key: string) => {
    setExpandedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const renderEmailStep = (cid: string, step: EmailStepV2) => {
    const isBusy = busyKey === `${cid}_${step.step_number}`;
    const open = openAccordions?.[step.id] || { layers: false, instructions: false };
    const toneOptions = toneOptionsForStep(step.step_number);
    const toneIdx = Math.max(0, toneOptions.indexOf(step.tone));
    const toneDisplay = toneOptions[toneIdx] || toneOptions[0];
    const emailLabel = emailLabelForNumber(Number(step.step_number || 0));
    const emailKey = `${cid}_e${step.step_number}`;
    const isEmailOpen = expandedEmails.has(emailKey);
    const hasContent = Boolean(step.subject || step.body);

    return (
      <div key={step.id} className="rounded-lg border border-white/10 bg-black/20 overflow-hidden" style={{ marginLeft: 14 }}>
        <button
          type="button"
          onClick={() => toggleEmail(emailKey)}
          className="w-full flex items-center gap-2 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
        >
          <svg
            className={`w-2.5 h-2.5 text-white/50 shrink-0 transition-transform ${isEmailOpen ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
          <span className="text-sm font-bold text-white">
            Email {step.step_number} ({emailLabel})
          </span>
          <span
            className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              recommendedCtaType(Number(step.step_number || 0)) === "Soft CTA"
                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                : "border-amber-400/40 bg-amber-500/15 text-amber-200"
            }`}
          >
            {recommendedCtaType(Number(step.step_number || 0))}
          </span>
          {hasContent && <span className="ml-auto text-[10px] text-emerald-300/70">drafted</span>}
        </button>

        {isEmailOpen && (
          <div className="border-t border-white/5 px-4 pb-4">
            <div className="mt-3 text-xs text-white/60">
              {step.last_generated_at ? `Updated ${new Date(step.last_generated_at).toLocaleString()}` : "Not generated yet"}
            </div>

            <div className="mt-3">
              <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Tone</div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/30 px-1 py-1">
                  <button
                    type="button"
                    onClick={() => cycleTone(cid, step, -1)}
                    className="h-8 w-9 rounded-md border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                    aria-label="Previous tone"
                  >
                    &#9664;
                  </button>
                  <button
                    type="button"
                    onClick={() => cycleTone(cid, step, 1)}
                    className="h-8 min-w-[180px] px-3 rounded-md border border-white/10 bg-white/5 text-white/85 hover:bg-white/10 text-sm font-semibold text-left"
                    title="Click to cycle tones"
                  >
                    {toneLabel(toneDisplay)}
                  </button>
                  <button
                    type="button"
                    onClick={() => cycleTone(cid, step, 1)}
                    className="h-8 w-9 rounded-md border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                    aria-label="Next tone"
                  >
                    &#9654;
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => generateStep(cid, step)}
                  disabled={isBusy}
                  className="h-10 px-3 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isBusy ? (
                    <>
                      <InlineSpinner className="h-3.5 w-3.5" />
                      <span>Generating</span>
                    </>
                  ) : (
                    "Generate"
                  )}
                </button>
              </div>
              {step.tone === "custom" ? (
                <input
                  value={String(step.custom_tone || "")}
                  onChange={(e) => updateStep(cid, step.id, { custom_tone: e.target.value })}
                  placeholder="Describe your custom tone..."
                  className="mt-2 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : null}
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => toggleAccordion(step.id, "layers")}
                className="w-full flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
              >
                <span>Context Layers</span>
                <span className="text-white/60">{open.layers ? "\u25BE" : "\u25B8"}</span>
              </button>
              {open.layers ? (
                <div className="rounded-md border border-white/10 bg-black/20 p-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {(Object.keys(step.context_layers || defaultLayers()) as ContextLayerId[]).map((k) => {
                      const checked = Boolean(step.context_layers?.[k]);
                      return (
                        <label
                          key={`${step.id}_${k}`}
                          className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white/80 hover:bg-white/10 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleLayer(cid, step, k)}
                            className="rounded border-white/20 bg-black/30 text-blue-500 focus:ring-blue-500"
                          />
                          <span className="min-w-0 truncate">{layerLabel(k)}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="my-3 border-t border-white/10" />

                  {(() => {
                    const sig = step.signature_prefs || defaultSignaturePrefs();
                    const setSig = (patch: Partial<SignaturePrefs>) =>
                      updateStep(cid, step.id, { signature_prefs: { ...sig, ...patch } });
                    const otherUrl = String(sig.other_link_url || "").trim();
                    const otherUrlOk = !otherUrl || otherUrl.startsWith("http://") || otherUrl.startsWith("https://");

                    return (
                      <div>
                        <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-2">
                          Signature lines
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {(["include_phone", "include_email", "include_linkedin", "include_bio_link", "include_other_link"] as const).map((field) => (
                            <label key={field} className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white/80 hover:bg-white/10 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(sig[field])}
                                onChange={() => setSig({ [field]: !sig[field] })}
                                className="rounded border-white/20 bg-black/30 text-blue-500 focus:ring-blue-500"
                              />
                              <span className="min-w-0 truncate">{field.replace("include_", "").replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())}</span>
                            </label>
                          ))}
                        </div>
                        {sig.include_other_link ? (
                          <div className="mt-2">
                            <input
                              value={String(sig.other_link_url || "")}
                              onChange={(e) => setSig({ other_link_url: e.target.value })}
                              placeholder="https://..."
                              className={`w-full rounded-md border bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500 ${otherUrlOk ? "border-white/15" : "border-rose-400/60"}`}
                            />
                            {!otherUrlOk ? <div className="mt-1 text-[11px] text-rose-200">Please start with http:// or https://</div> : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => toggleAccordion(step.id, "instructions")}
                className="w-full flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
              >
                <span>Special Instructions</span>
                <span className="text-white/60">{open.instructions ? "\u25BE" : "\u25B8"}</span>
              </button>
              {open.instructions ? (
                <div className="rounded-md border border-white/10 bg-black/20 p-3">
                  <textarea
                    value={String(step.special_instructions || "")}
                    onChange={(e) => updateStep(cid, step.id, { special_instructions: e.target.value })}
                    rows={5}
                    className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Subject</div>
                <input
                  value={String(step.subject || "")}
                  onChange={(e) => updateStep(cid, step.id, { subject: e.target.value })}
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Generate to fill..."
                />
              </div>
              <div>
                <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Body</div>
                <textarea
                  value={String(step.body || "")}
                  onChange={(e) => updateStep(cid, step.id, { body: e.target.value })}
                  rows={8}
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500 whitespace-pre-wrap"
                  placeholder="Generate to fill..."
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-4">
          <a href="/apply" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
            <span className="mr-2">&larr;</span> Back
          </a>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-1">Email Campaign</h1>
            <p className="text-white/70 text-sm">
              Expand a contact to generate their 4-email outreach sequence. Each email draws from your resume, offer, company research, pain points, and contact signals.
            </p>
          </div>

          {/* Bio page link */}
          <div className="mb-5 rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-xs font-semibold text-white/60 uppercase tracking-wider shrink-0">Bio Page Link</div>
              {bioUrl ? (
                <a href={bioUrl} target="_blank" rel="noreferrer" className="text-sm text-emerald-200 underline break-all hover:text-emerald-100">{bioUrl}</a>
              ) : (
                <span className="text-sm text-amber-200">Not published yet &mdash; go to Bio Page to publish first.</span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-white/50">
              Your bio page link is included in emails when the Bio Link signature option is enabled. Saves decision makers time by letting them see your full profile.
            </div>
          </div>

          {/* Campaign persistence */}
          <div className="mb-5 rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-5">
                <div className="text-xs font-semibold text-white/60 uppercase tracking-wider">Campaign name</div>
                <input
                  value={persistedCampaignName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPersistedCampaignName(v);
                    try { localStorage.setItem(STORAGE_PERSISTED, JSON.stringify({ id: String(persistedCampaignId || "").trim(), name: v })); } catch {}
                  }}
                  placeholder="e.g., 26-02-15-analytics-remote_123"
                  className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-3">
                <div className="text-xs font-semibold text-white/60 uppercase tracking-wider">Campaign ID</div>
                <div className="mt-1 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/80 font-mono truncate">
                  {persistedCampaignId || "Not saved yet"}
                </div>
              </div>
              <div className="md:col-span-4 flex gap-2">
                <button
                  type="button"
                  onClick={savePersistedCampaign}
                  disabled={isSaving || isLoading || (contacts?.length || 0) === 0}
                  className="flex-1 px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {isSaving ? (<><InlineSpinner className="h-4 w-4" /><span>Saving</span></>) : "Save"}
                </button>
                <button
                  type="button"
                  onClick={loadPersistedCampaign}
                  disabled={isSaving || isLoading}
                  className="px-3 py-2 rounded-md bg-white/10 text-white text-sm font-semibold hover:bg-white/15 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isLoading ? (<><InlineSpinner className="h-4 w-4" /><span>Loading</span></>) : "Load"}
                </button>
              </div>
              {notice ? <div className="md:col-span-12 text-xs font-semibold text-emerald-200">{notice}</div> : null}
            </div>
          </div>

          {error ? (
            <div className="mb-5 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>
          ) : null}

          {/* Contacts */}
          {(contacts?.length || 0) === 0 ? (
            <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-sm text-white/60">
              No contacts selected yet. Go back and save verified contacts from the Find Contact step.
            </div>
          ) : (
            <div className="space-y-2">
              {contacts.slice(0, 40).map((c) => {
                const cid = String(c?.id || "").trim();
                const isOpen = expandedContacts.has(cid);
                const camp = campaignByContact[cid] || null;
                const emailCount = camp?.emails?.filter((e) => Boolean(e.subject || e.body)).length || 0;

                return (
                  <div key={`cc_${cid}`} className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleContact(cid)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
                    >
                      <svg
                        className={`w-3 h-3 text-white/40 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white truncate">{String(c?.name || "Contact")}</span>
                          <span className="text-xs text-white/50 truncate">
                            {String(c?.title || "Decision maker")}
                            {c?.company ? ` \u00B7 ${formatCompanyName(String(c.company))}` : ""}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {emailCount > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 text-[10px] text-emerald-200">
                            {emailCount}/4 drafted
                          </span>
                        )}
                      </div>
                    </button>

                    {isOpen && camp && (
                      <div className="border-t border-white/5 px-4 pb-4">
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="text-xs text-white/60">
                            {c?.email ? <span className="text-white/70">{String(c.email)}</span> : null}
                            {c?.linkedin_url ? (
                              <a href={String(c.linkedin_url)} target="_blank" rel="noreferrer" className="ml-3 text-sky-300 hover:text-sky-200 underline">LinkedIn</a>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => generateAllForContact(cid)}
                            disabled={Boolean(busyKey)}
                            className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
                          >
                            {busyKey && busyKey.startsWith(cid) ? (
                              <><InlineSpinner className="h-3.5 w-3.5" /><span>Generating...</span></>
                            ) : (
                              "Generate All 4 Emails"
                            )}
                          </button>
                        </div>

                        <div className="mt-3 space-y-2">
                          {camp.emails.map((step) => renderEmailStep(cid, step))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push("/apply")}
              className="rounded-md border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!canContinueToLaunch}
              onClick={() => router.push("/deliverability-launch")}
              className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              title={!bioUrl ? "Publish your Bio Page first." : "Save & Continue"}
            >
              Save &amp; Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

