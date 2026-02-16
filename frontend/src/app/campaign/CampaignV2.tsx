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
    .replace(/[ \t]+\n/g, "\n")
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
    "Final follow-up: get their attention with something unexpected/off-the-wall.",
    "Do NOT rehash the whole story. Keep it very short (2-5 sentences).",
    "Be very provocative in a very playful way.",
    "End with an easy yes/no question.",
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
  // Keep links in context by default; signature lines are controlled separately by signature_prefs.
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
    const next = { ...(campaignByContact || {}) };
    const camp = next[cid];
    if (!camp) return;
    next[cid] = {
      ...camp,
      updated_at: nowIso(),
      emails: (camp.emails || []).map((e) => (e.id === stepId ? ({ ...e, ...patch } as any) : e)),
    };
    persist(next);
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

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-4">
          <a href="/bio-page" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
            <span className="mr-2">←</span> Back to Bio Page
          </a>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Email Campaign</h1>
            <p className="text-white/70">
              Generate a 4-email sequence per decision maker. Each email can include different context layers, tone, and instructions.
            </p>
          </div>

            <div className="mb-6 rounded-lg border border-white/10 bg-black/20 p-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                <div className="lg:col-span-6">
                  <div className="text-xs font-semibold text-white/60 uppercase tracking-wider">Campaign name</div>
                  <input
                    value={persistedCampaignName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setPersistedCampaignName(v);
                      // Best-effort persist for reloads even before saving to DB.
                      try {
                        localStorage.setItem(STORAGE_PERSISTED, JSON.stringify({ id: String(persistedCampaignId || "").trim(), name: v }));
                      } catch {}
                    }}
                    placeholder="e.g., 26-02-15-analytics-size-51-200-remote_123"
                    className="mt-1 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="mt-1 text-[11px] text-white/50">
                    Stored in Postgres when you click Save. (Optional, but recommended so Launch can retrieve it later.)
                  </div>
                </div>
                <div className="lg:col-span-3">
                  <div className="text-xs font-semibold text-white/60 uppercase tracking-wider">Campaign ID</div>
                  <div className="mt-1 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/80 font-mono">
                    {persistedCampaignId || "Not saved yet"}
                  </div>
                </div>
                <div className="lg:col-span-3 flex gap-2">
                  <button
                    type="button"
                    onClick={savePersistedCampaign}
                    disabled={isSaving || isLoading || (contacts?.length || 0) === 0}
                    className="flex-1 px-3 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    title="Create (if needed) and persist this campaign + rows to Postgres."
                  >
                    {isSaving ? (
                      <>
                        <InlineSpinner className="h-4 w-4" />
                        <span>Saving</span>
                      </>
                    ) : (
                      "Save campaign"
                    )}
                  </button>
                </div>
                <div className="lg:col-span-9">
                  <div className="text-xs font-semibold text-white/60 uppercase tracking-wider">Load campaign by ID</div>
                  <div className="mt-1 flex gap-2">
                    <input
                      value={loadCampaignId}
                      onChange={(e) => setLoadCampaignId(e.target.value)}
                      placeholder="Paste a campaign ID…"
                      className="flex-1 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={loadPersistedCampaign}
                      disabled={isSaving || isLoading}
                      className="px-3 py-2 rounded-md bg-white/10 text-white text-sm font-semibold hover:bg-white/15 disabled:opacity-50 inline-flex items-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <InlineSpinner className="h-4 w-4" />
                          <span>Loading</span>
                        </>
                      ) : (
                        "Load"
                      )}
                    </button>
                  </div>
                  <div className="mt-1 text-[11px] text-white/50">
                    Loading replaces your selected contacts and restores saved email drafts for each recipient.
                  </div>
                </div>
                <div className="lg:col-span-3 flex items-center justify-end">
                  {notice ? <div className="text-xs font-semibold text-emerald-200">{notice}</div> : null}
                </div>
              </div>
            </div>

          {error ? (
            <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: contacts */}
            <div className="lg:col-span-3">
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-bold text-white">Contacts</div>
                <div className="mt-1 text-xs text-white/60">Pick a person to edit their sequence.</div>

                {(contacts?.length || 0) ? (
                  <div className="mt-3 space-y-2 max-h-[520px] overflow-auto pr-1">
                    {contacts.slice(0, 40).map((c) => {
                      const cid = String(c?.id || "").trim();
                      const active = cid && cid === String(activeContactId || "");
                      return (
                        <button
                          key={`c_${cid}`}
                          type="button"
                          onClick={() => setActive(cid)}
                          className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                            active ? "border-blue-400/60 bg-blue-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                          }`}
                        >
                          <div className="text-sm font-semibold text-white/85 truncate">{String(c?.name || "Contact")}</div>
                          <div className="mt-1 text-[11px] text-white/55 truncate">
                            {String(c?.title || "Decision maker")}
                            {c?.company ? ` • ${formatCompanyName(String(c.company))}` : ""}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-white/60">No contacts selected yet. Go back and save verified contacts.</div>
                )}
              </div>

              <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-bold text-white">Bio URL</div>
                <div className="mt-1 text-xs text-white/60">
                  {bioUrl ? (
                    <span className="break-all text-emerald-200">{bioUrl}</span>
                  ) : (
                    <span className="text-amber-200">Publish your Bio Page first (Campaign uses it when Bio is selected).</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: editor */}
            <div className="lg:col-span-9">
              {!activeCampaign || !activeContact ? (
                <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-sm text-white/70">
                  <div className="text-white/80 font-semibold">Select a contact to start campaign.</div>
                  <div className="mt-2">
                    After you select someone, click <span className="font-semibold text-white/85">Generate all 4</span> to draft their sequence.
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xl font-bold text-white">{String(activeContact?.name || "Contact")}</div>
                      <div className="text-sm text-white/70">
                        {String(activeContact?.title || "Decision maker")}
                        {activeContact?.company ? ` • ${formatCompanyName(String(activeContact.company))}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => generateAllForContact(String(activeContactId || ""))}
                        disabled={Boolean(busyKey)}
                        className="px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
                        title="Generate (or regenerate) all 4 emails for this contact."
                      >
                        {busyKey ? (
                          <>
                            <InlineSpinner className="h-3.5 w-3.5" />
                            <span>Generating</span>
                          </>
                        ) : (
                          "Generate all 4"
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {activeCampaign.emails.map((step) => {
                      const isBusy = busyKey === `${String(activeContactId)}_${step.step_number}`;
                      const open = openAccordions?.[step.id] || { layers: false, instructions: false };
                      const toneOptions = toneOptionsForStep(step.step_number);
                      const toneIdx = Math.max(0, toneOptions.indexOf(step.tone));
                      const toneDisplay = toneOptions[toneIdx] || toneOptions[0];
                      const emailLabel = emailLabelForNumber(Number(step.step_number || 0));
                      return (
                        <div key={step.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-bold text-white">
                                Email {step.step_number} ({emailLabel})
                              </div>
                              <div className="mt-1 text-xs text-white/60">
                                {step.last_generated_at ? `Updated ${new Date(step.last_generated_at).toLocaleString()}` : "Not generated yet"}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => generateStep(String(activeContactId || ""), step)}
                              disabled={isBusy}
                              className="px-3 py-2 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-2"
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

                          {/* Tone selector */}
                          <div className="mt-3">
                            <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Tone</div>
                            <div className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/30 px-1 py-1">
                              <button
                                type="button"
                                onClick={() => cycleTone(String(activeContactId || ""), step, -1)}
                                className="h-8 w-9 rounded-md border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                                aria-label="Previous tone"
                              >
                                ◀
                              </button>
                              <button
                                type="button"
                                onClick={() => cycleTone(String(activeContactId || ""), step, 1)}
                                className="h-8 min-w-[220px] px-3 rounded-md border border-white/10 bg-white/5 text-white/85 hover:bg-white/10 text-sm font-semibold text-left"
                                title="Click to cycle tones"
                              >
                                {toneLabel(toneDisplay)}
                              </button>
                              <button
                                type="button"
                                onClick={() => cycleTone(String(activeContactId || ""), step, 1)}
                                className="h-8 w-9 rounded-md border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
                                aria-label="Next tone"
                              >
                                ▶
                              </button>
                            </div>
                            {step.tone === "custom" ? (
                              <input
                                value={String(step.custom_tone || "")}
                                onChange={(e) => updateStep(String(activeContactId || ""), step.id, { custom_tone: e.target.value })}
                                placeholder="Describe your custom tone…"
                                className="mt-2 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            ) : null}
                          </div>

                          {/* Accordions */}
                          <div className="mt-4 space-y-2">
                            <button
                              type="button"
                              onClick={() => toggleAccordion(step.id, "layers")}
                              className="w-full flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
                            >
                              <span>Context Layers</span>
                              <span className="text-white/60">{open.layers ? "▾" : "▸"}</span>
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
                                          onChange={() => toggleLayer(String(activeContactId || ""), step, k)}
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
                                    updateStep(String(activeContactId || ""), step.id, {
                                      signature_prefs: { ...sig, ...patch },
                                    });
                                  const otherUrl = String(sig.other_link_url || "").trim();
                                  const otherUrlOk = !otherUrl || otherUrl.startsWith("http://") || otherUrl.startsWith("https://");

                                  return (
                                    <div>
                                      <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-2">
                                        Signature lines (shown under your name)
                                      </div>
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        <label className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white/80 hover:bg-white/10 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(sig.include_phone)}
                                            onChange={() => setSig({ include_phone: !sig.include_phone })}
                                            className="rounded border-white/20 bg-black/30 text-blue-500 focus:ring-blue-500"
                                          />
                                          <span className="min-w-0 truncate">Phone</span>
                                        </label>
                                        <label className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white/80 hover:bg-white/10 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(sig.include_email)}
                                            onChange={() => setSig({ include_email: !sig.include_email })}
                                            className="rounded border-white/20 bg-black/30 text-blue-500 focus:ring-blue-500"
                                          />
                                          <span className="min-w-0 truncate">Email</span>
                                        </label>
                                        <label className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white/80 hover:bg-white/10 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(sig.include_linkedin)}
                                            onChange={() => setSig({ include_linkedin: !sig.include_linkedin })}
                                            className="rounded border-white/20 bg-black/30 text-blue-500 focus:ring-blue-500"
                                          />
                                          <span className="min-w-0 truncate">LinkedIn</span>
                                        </label>
                                        <label className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white/80 hover:bg-white/10 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(sig.include_bio_link)}
                                            onChange={() => setSig({ include_bio_link: !sig.include_bio_link })}
                                            className="rounded border-white/20 bg-black/30 text-blue-500 focus:ring-blue-500"
                                          />
                                          <span className="min-w-0 truncate">Bio link</span>
                                        </label>
                                        <label className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white/80 hover:bg-white/10 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(sig.include_other_link)}
                                            onChange={() => setSig({ include_other_link: !sig.include_other_link })}
                                            className="rounded border-white/20 bg-black/30 text-blue-500 focus:ring-blue-500"
                                          />
                                          <span className="min-w-0 truncate">Other link</span>
                                        </label>
                                      </div>

                                      {sig.include_other_link ? (
                                        <div className="mt-2">
                                          <input
                                            value={String(sig.other_link_url || "")}
                                            onChange={(e) => setSig({ other_link_url: e.target.value })}
                                            placeholder="https://…"
                                            className={`w-full rounded-md border bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500 ${
                                              otherUrlOk ? "border-white/15" : "border-rose-400/60"
                                            }`}
                                          />
                                          {!otherUrlOk ? (
                                            <div className="mt-1 text-[11px] text-rose-200">Please start with http:// or https://</div>
                                          ) : null}
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
                              <span className="text-white/60">{open.instructions ? "▾" : "▸"}</span>
                            </button>
                            {open.instructions ? (
                              <div className="rounded-md border border-white/10 bg-black/20 p-3">
                                <textarea
                                  value={String(step.special_instructions || "")}
                                  onChange={(e) => updateStep(String(activeContactId || ""), step.id, { special_instructions: e.target.value })}
                                  rows={6}
                                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            ) : null}
                          </div>

                          {/* Subject/body */}
                          <div className="mt-4 grid grid-cols-1 gap-3">
                            <div>
                              <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Subject</div>
                              <input
                                value={String(step.subject || "")}
                                onChange={(e) => updateStep(String(activeContactId || ""), step.id, { subject: e.target.value })}
                                className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Generate to fill…"
                              />
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Body</div>
                              <textarea
                                value={String(step.body || "")}
                                onChange={(e) => updateStep(String(activeContactId || ""), step.id, { body: e.target.value })}
                                rows={8}
                                className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500 whitespace-pre-wrap"
                                placeholder="Generate to fill…"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-8 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => router.push("/bio-page")}
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

