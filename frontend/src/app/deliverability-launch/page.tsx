"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatCompanyName } from "@/lib/format";
import InlineSpinner from "@/components/InlineSpinner";

interface PreFlightCheck {
  name: string;
  status: 'pending' | 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
  meta?: any;
}

interface LaunchResult {
  success: boolean;
  message: string;
  campaign_id?: string;
  emails_sent?: number;
  scheduled_emails?: number;
  errors?: string[];
}

interface DeliverabilityCheck {
  overall_health_score: number;
  summary?: string;
  reports: Array<{
    step_number: number;
    health_score: number;
    spam_risk: 'low' | 'medium' | 'high';
    issues: string[];
    warnings: string[];
    subject_variants: string[];
    copy_tweaks: string[];
    improved_subject?: string | null;
    improved_body?: string | null;
  }>;
}

type WarmupProvider =
  | "roleferry"
  | "warmbox"
  | "mailreach"
  | "lemwarm"
  | "warmupinbox"
  | "instantly"
  | "diy"
  | "none";

interface WarmupPlan {
  enabled: boolean;
  provider: WarmupProvider;
  started_at: string; // ISO date
  start_emails_per_day: number;
  target_emails_per_day: number;
  ramp_days: number;
  weekdays_only: boolean;
  reply_rate_pct: number; // simulated replies in warmup network
  rescue_from_spam: boolean;
}

type OutreachChannel = "email" | "linkedin";

export default function DeliverabilityLaunchPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'job-seeker' | 'recruiter'>('job-seeker');
  const [campaign, setCampaign] = useState<any>(null);
  const [campaignByContactV2, setCampaignByContactV2] = useState<Record<string, any>>({});
  const [deliverabilityCheck, setDeliverabilityCheck] = useState<DeliverabilityCheck | null>(null);
  const [isCheckingDeliverability, setIsCheckingDeliverability] = useState(false);
  const [activeDeliverabilityStep, setActiveDeliverabilityStep] = useState<number | null>(null);
  const [preFlightChecks, setPreFlightChecks] = useState<PreFlightCheck[]>([]);
  const [isRunningChecks, setIsRunningChecks] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendingDomain, setSendingDomain] = useState("");
  const [dkimSelector, setDkimSelector] = useState("");
  const [launchVerifiedOnly, setLaunchVerifiedOnly] = useState(false);
  const [channel, setChannel] = useState<OutreachChannel>("email");
  const [linkedinNotesByContact, setLinkedinNotesByContact] = useState<Record<string, string>>({});
  const [linkedinNotice, setLinkedinNotice] = useState<string | null>(null);

  const [warmupUserKey, setWarmupUserKey] = useState<string>("anon");
  const [warmupPlan, setWarmupPlan] = useState<WarmupPlan>({
    enabled: false,
    provider: "none",
    started_at: new Date().toISOString(),
    start_emails_per_day: 8,
    target_emails_per_day: 35,
    ramp_days: 14,
    weekdays_only: true,
    reply_rate_pct: 35,
    rescue_from_spam: true,
  });
  const [warmupNotice, setWarmupNotice] = useState<string | null>(null);
  const [roleferryWarmupAvailable, setRoleferryWarmupAvailable] = useState(false);
  const [roleferryWarmupMessage, setRoleferryWarmupMessage] = useState<string>("");
  const [rfAccounts, setRfAccounts] = useState<any[]>([]);
  const [rfSelected, setRfSelected] = useState<Record<string, boolean>>({});
  const [rfLoading, setRfLoading] = useState(false);
  const [rfNotice, setRfNotice] = useState<string | null>(null);

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const applyDeliverabilityFix = (stepNumber: number) => {
    if (!campaign || !deliverabilityCheck) return;
    const report = deliverabilityCheck.reports.find((r) => r.step_number === stepNumber);
    if (!report) return;
    const improvedSubject = String(report.improved_subject || "").trim();
    const improvedBody = String(report.improved_body || "").trim();
    if (!improvedSubject && !improvedBody) return;

    const emails = Array.isArray(campaign?.emails) ? campaign.emails : [];
    const nextEmails = emails.map((e: any) => {
      if (Number(e?.step_number) !== Number(stepNumber)) return e;
      return { ...e, subject: improvedSubject || e.subject, body: improvedBody || e.body };
    });
    const nextCampaign = { ...(campaign || {}), emails: nextEmails, updated_at: new Date().toISOString() };
    setCampaign(nextCampaign);
    try {
      localStorage.setItem("campaign_data", JSON.stringify(nextCampaign));
    } catch {}
  };

  const runDeliverabilityCheck = async () => {
    if (!campaign) return;
    setError(null);
    setIsCheckingDeliverability(true);
    try {
      const contacts = (() => {
        try {
          return JSON.parse(localStorage.getItem("selected_contacts") || "[]");
        } catch {
          return [];
        }
      })();

      const emails = Array.isArray(campaign?.emails) ? campaign.emails : [];
      const resp = await api<any>("/deliverability-launch/check", "POST", {
        emails: emails.map((e: any) => ({
          id: e.id,
          step_number: e.step_number,
          subject: String(e.subject || ""),
          body: String(e.body || ""),
          delay_days: Number(e.delay_days || 0) || 0,
        })),
        contacts,
        user_mode: mode,
      });

      if (!resp?.success) throw new Error(resp?.message || "Deliverability check failed");
      const nextCheck = {
        overall_health_score: Number(resp.overall_health_score ?? 0) || 0,
        summary: resp.summary || "",
        reports: Array.isArray(resp.reports) ? resp.reports : [],
      };
      setDeliverabilityCheck(nextCheck);
      if (Array.isArray(nextCheck.reports) && nextCheck.reports.length) {
        setActiveDeliverabilityStep(Number(nextCheck.reports[0]?.step_number || 1) || 1);
      }
    } catch (e: any) {
      setError(String(e?.message || "Failed to run deliverability check."));
      setDeliverabilityCheck(null);
      setActiveDeliverabilityStep(null);
    } finally {
      setIsCheckingDeliverability(false);
    }
  };

  const persistChannel = (next: OutreachChannel) => {
    setChannel(next);
    try {
      localStorage.setItem("launch_channel", next);
    } catch {}
  };

  const readLinkedinNotes = () => {
    try {
      const raw = localStorage.getItem("linkedin_notes_by_contact");
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const persistLinkedinNotes = (by: Record<string, string>) => {
    try {
      localStorage.setItem("linkedin_notes_by_contact", JSON.stringify(by || {}));
    } catch {}
  };

  const readResearchForContact = (cid: string) => {
    const id = String(cid || "").trim();
    if (!id) return null;
    try {
      const rawBy = localStorage.getItem("context_research_by_contact");
      const by = rawBy ? JSON.parse(rawBy) : null;
      const hit = by && typeof by === "object" ? (by[id] || null) : null;
      if (hit) return hit;
    } catch {}
    try {
      const rawHist = localStorage.getItem("context_research_history");
      const hist = rawHist ? JSON.parse(rawHist) : [];
      if (Array.isArray(hist)) {
        const h = hist.find((x: any) => String(x?.contact?.id || "") === id);
        if (h?.research) return h.research;
      }
    } catch {}
    return null;
  };

  const readPainpoint = () => {
    // Best-effort pull (matches by selected job id first, else fallback).
    try {
      const selectedJobId = String(localStorage.getItem("selected_job_description_id") || "").trim();
      const byJobRaw = localStorage.getItem("painpoint_matches_by_job");
      if (selectedJobId && byJobRaw) {
        const byJob = JSON.parse(byJobRaw) as Record<string, any[]>;
        const m = byJob?.[selectedJobId]?.[0];
        if (m?.painpoint_1) return String(m.painpoint_1);
      }
    } catch {}
    try {
      const m0 = (JSON.parse(localStorage.getItem("painpoint_matches") || "[]") || [])[0];
      if (m0?.painpoint_1) return String(m0.painpoint_1);
    } catch {}
    return "";
  };

  const readOfferSnippet = () => {
    // Prefer compose variables (edited), else fall back to last created offer.
    try {
      const vars = JSON.parse(localStorage.getItem("compose_variables") || "[]");
      if (Array.isArray(vars)) {
        const v = vars.find((x: any) => String(x?.name || "") === "{{offer_snippet}}");
        const val = String(v?.value || "").trim();
        if (val) return val;
      }
    } catch {}
    try {
      const composed = JSON.parse(localStorage.getItem("composed_email") || "null");
      const vars = composed?.variables || [];
      if (Array.isArray(vars)) {
        const v = vars.find((x: any) => String(x?.name || "") === "{{offer_snippet}}");
        const val = String(v?.value || "").trim();
        if (val) return val;
      }
    } catch {}
    try {
      const offers = JSON.parse(localStorage.getItem("created_offers") || "[]");
      const last = Array.isArray(offers) && offers.length ? offers[offers.length - 1] : null;
      const raw = String(last?.content || "").replace(/\s+/g, " ").trim();
      if (!raw) return "";
      return raw.length > 180 ? raw.slice(0, 180).trim() + "…" : raw;
    } catch {}
    return "";
  };

  const buildLinkedinNote = (c: any) => {
    // LinkedIn connection request notes have a tight limit (commonly ~300 chars). Keep it crisp.
    const name = String(c?.name || "").trim();
    const first = name ? name.split(" ")[0] : "there";
    const company = formatCompanyName(String(c?.company || "").trim());
    const jd = (() => {
      try { return JSON.parse(localStorage.getItem("selected_job_description") || "null"); } catch { return null; }
    })();
    const jobTitle = String(jd?.title || "a role").trim();
    const pain = readPainpoint();
    const offer = readOfferSnippet();
    const r = readResearchForContact(String(c?.id || "")) || {};
    const hook = String(r?.recent_news?.[0]?.summary || "").replace(/\s+/g, " ").trim();

    // Prefer: personal + 1 line value + tiny CTA
    const pieces: string[] = [];
    // Avoid em-dashes; they can read as "AI-written" in LinkedIn notes.
    pieces.push(`Hi ${first},`);
    if (company) pieces.push(`I’m exploring ${jobTitle} at ${company}.`);
    else pieces.push(`I’m exploring ${jobTitle}.`);

    const valueLine =
      offer
        ? `I have a quick idea: ${offer}`
        : pain
          ? `Quick thought on ${pain}.`
          : "";
    if (valueLine) pieces.push(valueLine);
    if (hook && hook.length >= 40) {
      // Only include if it’s short enough to be meaningful in a note.
      const shortHook = hook.length > 90 ? hook.slice(0, 90).trim() + "…" : hook;
      pieces.push(`Also saw: ${shortHook}`);
    }
    pieces.push("Open to connect?");

    let note = pieces.join(" ").replace(/\s+/g, " ").trim();
    // Hard cap to keep under LinkedIn note limits.
    const max = 280;
    if (note.length > max) note = note.slice(0, max - 1).trimEnd() + "…";
    return note;
  };

  const generateLinkedinNotes = () => {
    (async () => {
      const contacts = loadSelectedContacts();
      const draftsById: Record<string, string> = {};
      for (const c of contacts) {
        const cid = String(c?.id || "").trim();
        if (!cid) continue;
        draftsById[cid] = buildLinkedinNote(c);
      }

      // Always attempt an LLM polish pass (with deterministic fallback on failure).
      const polishedById: Record<string, string> = { ...draftsById };
      try {
        const jd = (() => {
          try { return JSON.parse(localStorage.getItem("selected_job_description") || "null"); } catch { return null; }
        })();
        const jobTitle = String(jd?.title || "").trim();
        const painpoint = readPainpoint();
        const solution = readOfferSnippet();

        await Promise.all(
          contacts.map(async (c: any) => {
            const cid = String(c?.id || "").trim();
            if (!cid) return;
            const draft = draftsById[cid] || "";
            if (!draft) return;
            const res = await api<{ note: string; used_ai?: boolean }>("/find-contact/improve-linkedin-note", "POST", {
              note: draft,
              contact_name: String(c?.name || "").trim() || undefined,
              contact_title: String(c?.title || "").trim() || undefined,
              contact_company: String(c?.company || "").trim() || undefined,
              job_title: jobTitle || undefined,
              painpoint: painpoint || undefined,
              solution: solution || undefined,
              limit: 280,
            });
            const improved = String(res?.note || "").replaceAll("—", "-").replaceAll("–", "-").replace(/\s+/g, " ").trim();
            if (improved) polishedById[cid] = improved;
          })
        );
      } catch {
        // Keep deterministic drafts if the polish step fails.
      }

      setLinkedinNotesByContact(polishedById);
      persistLinkedinNotes(polishedById);
      setLinkedinNotice(`Generated ${Object.keys(polishedById).length} LinkedIn note(s).`);
      window.setTimeout(() => setLinkedinNotice(null), 2200);
    })();
  };

  const computeCampaignSummary = () => {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    // Short year; avoid "20xx-" prefix in the UI.
    const datePrefix = `${yy}-${mm}-${dd}`;

    const kebab = (raw: any) => {
      const s = String(raw ?? "").trim().toLowerCase();
      if (!s) return "";
      // Replace common symbols and collapse whitespace.
      let t = s.replace(/&/g, " and ").replace(/\s+/g, " ").trim();
      // Keep only alnum and spaces/hyphens, then kebab-case.
      t = t.replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
      return t;
    };

    const shortIndustry = (raw: any) => {
      const s = String(raw ?? "").trim();
      if (!s) return "";
      // Tighten common long labels (demo-friendly).
      let t = s;
      t = t.replace(/&/g, "and");
      t = t.replace(/\bmachine learning\b/gi, "ML");
      t = t.replace(/\bartificial intelligence\b/gi, "AI");
      t = t.replace(/\bai\b/gi, "AI");
      // "AI and ML" → "AI ML"
      t = t.replace(/\band\b/gi, " ");
      t = t.replace(/\s+/g, " ").trim();
      // Hard cap to avoid huge tokens.
      if (t.length > 28) t = t.slice(0, 28).trim();
      return kebab(t);
    };

    const shortSize = (raw: any) => {
      const s = String(raw ?? "").trim();
      if (!s) return "";
      // Prefer numeric range like "51-200" and label it so it's self-explanatory.
      const m = s.match(/(\d[\d,]*)\s*[-–—]\s*(\d[\d,]*)/);
      if (!m) return "";
      const a = String(m[1] || "").replace(/,/g, "");
      const b = String(m[2] || "").replace(/,/g, "");
      if (!a || !b) return "";
      return kebab(`size-${a}-${b}`);
    };

    // Pull top filters from Job Prefs (best-effort)
    let prefs: any = null;
    try {
      prefs = JSON.parse(localStorage.getItem("job_preferences") || "null");
    } catch {}
    const industries = prefs?.industries || [];
    const sizes = prefs?.companySize || prefs?.company_size || [];
    const work = prefs?.workType || prefs?.work_type || [];

    const nameParts = [
      datePrefix,
      shortIndustry(industries?.[0]),
      shortSize(sizes?.[0]),
      kebab(work?.[0]),
    ].filter(Boolean);

    const selectedContacts = loadSelectedContacts();
    const recipients = selectedContacts.length;

    const companyNorm = (c: any) => String(c || "").replace(/\s+/g, " ").trim();

    const recipientCompanies = new Set(
      selectedContacts.map((c: any) => companyNorm(c?.company)).filter(Boolean)
    ).size;

    const byCompany: Array<{ company: string; contacts: number; planned_sends: number }> = (() => {
      const steps = Array.isArray(campaign?.emails) ? campaign.emails.length : 0;
      const m = new Map<string, number>();
      for (const c of selectedContacts) {
        const key = companyNorm(c?.company) || "Unknown";
        m.set(key, (m.get(key) || 0) + 1);
      }
      const out: Array<{ company: string; contacts: number; planned_sends: number }> = [];
      for (const [company, contacts] of m.entries()) {
        out.push({ company, contacts, planned_sends: contacts * steps });
      }
      out.sort((a, b) => b.planned_sends - a.planned_sends || b.contacts - a.contacts || a.company.localeCompare(b.company));
      return out;
    })();

    // Jobs step context (NOT the same thing as emails sent/applied)
    let jobDescs: any[] = [];
    try {
      jobDescs = JSON.parse(localStorage.getItem("job_descriptions") || "[]");
    } catch {}
    const targetJobsCount = Array.isArray(jobDescs) ? jobDescs.length : 0;
    const targetJobTitles = Array.isArray(jobDescs)
      ? new Set(jobDescs.map((j) => String(j?.title || "").trim()).filter(Boolean)).size
      : 0;
    const targetCompanies = Array.isArray(jobDescs)
      ? new Set(jobDescs.map((j) => String(j?.company || "").trim()).filter(Boolean)).size
      : 0;

    const sequenceSteps = Array.isArray(campaign?.emails) ? campaign.emails.length : 0;
    const plannedSends = recipients * sequenceSteps;
    const firstStepSends = recipients;

    return {
      // Slug-style name: no spaces, no ampersands, no extra filler.
      campaignName: nameParts.join("-"),
      recipients,
      sequenceSteps,
      plannedSends,
      firstStepSends,
      recipientCompanies,
      byCompany,
      targetJobsCount,
      targetJobTitles,
      targetCompanies,
    };
  };

  const loadSelectedContacts = (): any[] => {
    try {
      const selected = localStorage.getItem("selected_contacts");
      if (selected) return JSON.parse(selected);
    } catch {}
    try {
      const found = localStorage.getItem("found_contacts");
      const all = found ? JSON.parse(found) : [];
      return Array.isArray(all) ? all.slice(0, 2) : [];
    } catch {}
    return [];
  };

  useEffect(() => {
    // Load mode from localStorage
    const stored = localStorage.getItem("rf_mode");
    if (stored === 'recruiter') {
      setMode('recruiter');
    }
    
    // Load per-contact sequences generated in Campaign
    try {
      const raw = localStorage.getItem("rf_campaign_by_contact_v2");
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") setCampaignByContactV2(parsed);
    } catch {}

    // Pick a canonical campaign (for checks/UI preview) from the first selected contact.
    try {
      const contacts = loadSelectedContacts();
      const firstId = String((Array.isArray(contacts) ? contacts[0]?.id : "") || "").trim();
      const camp = firstId ? (parsed: any) => (parsed && typeof parsed === "object" ? parsed[firstId] : null) : () => null;
      const raw = localStorage.getItem("rf_campaign_by_contact_v2");
      const by = raw ? JSON.parse(raw) : null;
      const c0 = camp(by);
      if (c0?.emails?.length) {
        setCampaign(c0);
      } else {
        // Legacy fallback: older builds stored a single campaign template.
        const campaignData = localStorage.getItem("campaign_data");
        if (campaignData) setCampaign(JSON.parse(campaignData));
      }
    } catch {
      // Legacy fallback
      try {
        const campaignData = localStorage.getItem("campaign_data");
        if (campaignData) setCampaign(JSON.parse(campaignData));
      } catch {}
    }

    // Load channel + previously generated LinkedIn notes
    try {
      const ch = String(localStorage.getItem("launch_channel") || "").trim();
      if (ch === "linkedin" || ch === "email") setChannel(ch as OutreachChannel);
    } catch {}
    try {
      const notes = readLinkedinNotes();
      setLinkedinNotesByContact(notes);
    } catch {}

    // Load warmup plan (per user)
    try {
      const u = JSON.parse(localStorage.getItem("rf_user") || "null");
      const uid = String(u?.id || "anon");
      setWarmupUserKey(uid);
      const key = `warmup_plan:${uid}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setWarmupPlan((prev) => ({ ...prev, ...(parsed as any) }));
        }
      }
    } catch {}

    // Check whether RoleFerry warm-up (Instantly API) is available
    (async () => {
      try {
        const res = await api<{ available: boolean; provider?: string; message?: string }>(
          "/deliverability-launch/roleferry-warmup/status",
          "GET"
        );
        setRoleferryWarmupAvailable(Boolean(res?.available));
        setRoleferryWarmupMessage(String(res?.message || ""));
      } catch {
        setRoleferryWarmupAvailable(false);
        setRoleferryWarmupMessage("");
      }
    })();
    
    // Listen for mode changes
    const handleModeChange = (event: CustomEvent) => {
      setMode(event.detail);
    };
    
    window.addEventListener('modeChanged', handleModeChange as EventListener);
    return () => window.removeEventListener('modeChanged', handleModeChange as EventListener);
  }, []);

  const loadRoleferryAccounts = async () => {
    setRfLoading(true);
    setRfNotice(null);
    try {
      const res = await api<{ accounts: any[] }>("/deliverability-launch/roleferry-warmup/accounts", "GET");
      const accounts = Array.isArray(res?.accounts) ? res.accounts : [];
      setRfAccounts(accounts);
      // default-select none; keep prior selections if possible
      setRfSelected((prev) => {
        const next: Record<string, boolean> = { ...(prev || {}) };
        for (const a of accounts) {
          const email = String(a?.email || "").trim();
          if (!email) continue;
          if (next[email] === undefined) next[email] = false;
        }
        return next;
      });
    } catch (e: any) {
      setRfNotice(String(e?.message || "Failed to load warm-up accounts"));
    } finally {
      setRfLoading(false);
    }
  };

  const enableRoleferryWarmup = async (opts: { includeAll?: boolean }) => {
    setRfLoading(true);
    setRfNotice(null);
    try {
      const includeAll = Boolean(opts?.includeAll);
      const emails = includeAll
        ? []
        : Object.entries(rfSelected || {})
            .filter(([, v]) => Boolean(v))
            .map(([k]) => k);

      if (!includeAll && emails.length === 0) {
        setRfNotice("Select at least one sender account to enable warm-up.");
        return;
      }

      await api("/deliverability-launch/roleferry-warmup/enable", "POST", {
        include_all_emails: includeAll,
        emails,
      });
      setRfNotice(includeAll ? "Enabled warm-up for all accounts in Instantly." : `Enabled warm-up for ${emails.length} account(s).`);
      window.setTimeout(() => setRfNotice(null), 2400);
      // refresh list to reflect statuses
      try { await loadRoleferryAccounts(); } catch {}
    } catch (e: any) {
      setRfNotice(String(e?.message || "Failed to enable warm-up"));
    } finally {
      setRfLoading(false);
    }
  };

  useEffect(() => {
    // Persist warmup plan (per user)
    try {
      const key = `warmup_plan:${warmupUserKey || "anon"}`;
      localStorage.setItem(key, JSON.stringify(warmupPlan));
    } catch {}
  }, [warmupPlan, warmupUserKey]);

  const warmupSchedule = useMemo(() => {
    // Basic linear ramp schedule (like most warmup tools show), for demo UX.
    const start = Math.max(1, Number(warmupPlan.start_emails_per_day || 1));
    const target = Math.max(start, Number(warmupPlan.target_emails_per_day || start));
    const days = Math.max(7, Math.min(30, Number(warmupPlan.ramp_days || 14)));
    const out: Array<{ day: number; date: string; emails: number }> = [];
    const d0 = new Date(warmupPlan.started_at || new Date().toISOString());

    const step = (target - start) / Math.max(days - 1, 1);
    let cur = start;
    let i = 0;
    while (out.length < days && i < 80) {
      const dt = new Date(d0);
      dt.setDate(d0.getDate() + i);
      const dow = dt.getDay(); // 0 Sun .. 6 Sat
      const isWeekend = dow === 0 || dow === 6;
      const include = warmupPlan.weekdays_only ? !isWeekend : true;
      if (include) {
        out.push({
          day: out.length + 1,
          date: dt.toISOString().slice(0, 10),
          emails: Math.round(cur),
        });
        cur += step;
      }
      i += 1;
    }
    return out;
  }, [warmupPlan]);

  const runPreFlightChecks = async () => {
    if (channel === "linkedin") {
      // For LinkedIn outreach we don't run email deliverability checks.
      setPreFlightChecks([]);
      setError(null);
      generateLinkedinNotes();
      return;
    }
    setIsRunningChecks(true);
    setError(null);

    try {
      if (!campaign) {
        throw new Error("No campaign data available");
      }

      const campaignToUse = campaign;

      const payload = {
        campaign_id: campaignToUse.id || "manual_launch",
        emails: campaignToUse.emails || [],
        contacts: loadSelectedContacts(),
        sending_domain: sendingDomain || undefined,
        dkim_selector: dkimSelector || undefined,
        warmup_plan: warmupPlan,
      };
      const checks = await api<PreFlightCheck[]>(
        "/deliverability-launch/pre-flight-checks",
        "POST",
        payload
      );
      setPreFlightChecks(checks);
    } catch (err) {
      setError("Failed to run pre-flight checks.");
    } finally {
      setIsRunningChecks(false);
    }
  };

  const launchCampaign = async () => {
    if (channel === "linkedin") {
      // No automated sending. This page provides copy-ready notes; user sends on LinkedIn.
      setLaunchResult({
        success: true,
        message: "LinkedIn mode: copy your notes and send them as connection request notes in LinkedIn.",
        campaign_id: "linkedin_manual",
        emails_sent: 0,
        scheduled_emails: 0,
      });
      return;
    }
    setIsLaunching(true);
    setError(null);

    try {
      if (!campaign) {
        throw new Error("No campaign data available");
      }

      const selectedContacts = loadSelectedContacts();
      const emailCheck = preFlightChecks.find((c) => c.name === "Email Verification");
      const verifiedContacts = (emailCheck?.meta?.verified_contacts as any[]) || [];
      const contactsForLaunch =
        launchVerifiedOnly && Array.isArray(verifiedContacts) && verifiedContacts.length
          ? verifiedContacts
          : selectedContacts;

      // Provide per-contact primary email (step 1) if available (Campaign generates unique copy per person).
      const primaryByContactId: Record<string, { subject: string; body: string }> = {};
      try {
        for (const c of Array.isArray(contactsForLaunch) ? contactsForLaunch : []) {
          const cid = String(c?.id || "").trim();
          if (!cid) continue;
          const seq = campaignByContactV2?.[cid];
          const e1 = Array.isArray(seq?.emails) ? seq.emails.find((e: any) => Number(e?.step_number) === 1) : null;
          const subject = String(e1?.subject || "").trim();
          const body = String(e1?.body || "").trim();
          if (subject || body) primaryByContactId[cid] = { subject, body };
        }
      } catch {}

      const payload = {
        campaign_id: campaign.id,
        emails: campaign.emails,
        contacts: contactsForLaunch,
        primary_by_contact_id: Object.keys(primaryByContactId).length ? primaryByContactId : undefined,
        warmup_plan: warmupPlan,
      };
      const result = await api<LaunchResult>(
        "/deliverability-launch/launch",
        "POST",
        payload
      );
      setLaunchResult(result);

      // Add to Job Tracker automatically on successful launch
      if (result.success) {
        try {
          const trackerKey = "tracker_applications";
          const existingRaw = localStorage.getItem(trackerKey);
          const existing = existingRaw ? JSON.parse(existingRaw) : [];
          const list = Array.isArray(existing) ? existing : [];

          const newEntries = (payload.contacts || []).map((c: any) => ({
            id: `trk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            company: { 
              name: c.company || "Unknown",
              logo: c.company ? `https://logo.clearbit.com/${String(c.company).toLowerCase().replace(/\s+/g, "")}.com` : undefined
            },
            role: campaign?.name || "Applied Role",
            status: mode === "job-seeker" ? "applied" : "applied", // In recruiter mode it maps to 'Contacted' via statusMap
            appliedDate: new Date().toISOString().slice(0, 10),
            lastContact: new Date().toISOString().slice(0, 10),
            replyStatus: null,
            source: "campaign_launch",
            contacts: [c.name].filter(Boolean),
          }));

          localStorage.setItem(trackerKey, JSON.stringify([...newEntries, ...list]));
        } catch (e) {
          console.error("Failed to auto-update tracker", e);
        }
      }
    } catch (err) {
      setError("Failed to launch campaign.");
    } finally {
      setIsLaunching(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <div className="w-4 h-4 bg-gray-300 rounded-full animate-pulse"></div>;
      case 'pass':
        return <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>;
      case 'fail':
        return <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>;
      case 'warning':
        return <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
          <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>;
      default:
        return <div className="w-4 h-4 bg-gray-300 rounded-full"></div>;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass': return 'text-green-600';
      case 'fail': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const allChecksPassed = preFlightChecks.length > 0 && preFlightChecks.every(check => check.status === 'pass' || check.status === 'warning');
  const emailCheck = preFlightChecks.find((c) => c.name === "Email Verification");
  const emailFail = emailCheck?.status === "fail";
  const parsedCounts = (() => {
    const msg = String(emailCheck?.message || "");
    const m = msg.match(/Verified\s+(\d+)\s*\/\s*(\d+)/i);
    if (!m) return null;
    return { verified: Number(m[1] || 0) || 0, total: Number(m[2] || 0) || 0 };
  })();
  const verifiedCount = Number(emailCheck?.meta?.verified_count ?? parsedCounts?.verified ?? 0) || 0;
  const totalWithEmail = Number(emailCheck?.meta?.total_with_email ?? parsedCounts?.total ?? 0) || 0;
  const failedCount = Number(emailCheck?.meta?.failed_count ?? 0) || Math.max(totalWithEmail - verifiedCount, 0);

  // Treat some failures as "action-required but bypassable" for demo/testing.
  // - Email Verification can be bypassed by launching only to verified emails.
  // - Domain Warmup is not verifiable in local demo; show red but don't block launch.
  const bypassableFails = new Set(["Email Verification", "Domain Warmup"]);
  const blockingFailures = preFlightChecks.some((c) => c.status === "fail" && !bypassableFails.has(c.name));
  const canLaunch =
    preFlightChecks.length > 0 &&
    !blockingFailures &&
    (!emailFail || (launchVerifiedOnly && verifiedCount > 0) || verifiedCount > 0);
  const hasFailures = preFlightChecks.some(check => check.status === 'fail');

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-4">
        <a href="/campaign" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
          <span className="mr-2">←</span> Back to Campaign
          </a>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Deliverability / Launch</h1>
            <p className="text-white/70">
              {mode === 'job-seeker' 
                ? 'Final checks before launching your role application campaign.'
                : 'Final checks before launching your candidate pitch campaign.'
              }
            </p>
          </div>

          {!campaign ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No Campaign Data</h3>
              <p className="text-white/70 mb-6">
                Please complete the Campaign step first to launch your sequence.
              </p>
              <button
                onClick={() => router.push('/campaign')}
                className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                Go to Campaign
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Campaign Summary */}
              <div className="bg-blue-50 border border-white/10 rounded-lg p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Campaign Summary</h2>
                {(() => {
                  const {
                    campaignName,
                    recipients,
                    sequenceSteps,
                    plannedSends,
                    firstStepSends,
                    recipientCompanies,
                    byCompany,
                    targetJobsCount,
                    targetJobTitles,
                    targetCompanies,
                  } = computeCampaignSummary();
                  return (
                    <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-white/70">Campaign Name</div>
                    <div className="font-semibold text-white">{campaignName || campaign.name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-white/70">Sequence steps</div>
                    <div className="font-semibold text-white">{sequenceSteps}</div>
                  </div>
                  <div>
                    <div className="text-sm text-white/70">Total Duration</div>
                    <div className="font-semibold text-white">
                      {campaign.emails.reduce((total: number, email: any) => total + email.delay_days, 0)} days
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-white/70">Recipients</div>
                    <div className="font-semibold text-white">{recipients} contact{recipients === 1 ? "" : "s"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-white/70">Recipient companies</div>
                    <div className="font-semibold text-white">{recipientCompanies} compan{recipientCompanies === 1 ? "y" : "ies"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-white/70">Planned sends (all steps)</div>
                    <div className="font-semibold text-white">{plannedSends} email{plannedSends === 1 ? "" : "s"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-white/70">Step 1 sends</div>
                    <div className="font-semibold text-white">{firstStepSends} email{firstStepSends === 1 ? "" : "s"}</div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                    <div className="text-sm font-semibold text-white">Send volume by company</div>
                    <div className="mt-1 text-xs text-white/60">
                      This is based on your selected contacts (where emails actually go).
                    </div>
                    <div className="mt-3 space-y-2">
                      {(byCompany || []).slice(0, 6).map((row) => (
                        <div key={`co_${row.company}`} className="flex items-center justify-between gap-3 text-sm">
                          <div className="min-w-0 truncate text-white/80">{formatCompanyName(row.company)}</div>
                          <div className="shrink-0 text-white/70">
                            {row.contacts} × {sequenceSteps} = <span className="font-semibold text-white">{row.planned_sends}</span>
                          </div>
                        </div>
                      ))}
                      {Array.isArray(byCompany) && byCompany.length > 6 ? (
                        <div className="text-xs text-white/50">
                          +{byCompany.length - 6} more
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="md:col-span-2 rounded-lg border border-white/10 bg-black/20 p-4">
                    <div className="text-sm font-semibold text-white">Roles step context (not sends)</div>
                    <div className="mt-1 text-xs text-white/60">
                      These come from your imported role descriptions and are used for targeting, not for counting sent emails.
                    </div>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div className="rounded-md border border-white/10 bg-white/5 p-3">
                        <div className="text-xs text-white/60">Role descriptions imported</div>
                        <div className="text-white font-semibold">{targetJobsCount}</div>
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/5 p-3">
                        <div className="text-xs text-white/60">Unique target titles</div>
                        <div className="text-white font-semibold">{targetJobTitles}</div>
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/5 p-3">
                        <div className="text-xs text-white/60">Unique target companies</div>
                        <div className="text-white font-semibold">{targetCompanies}</div>
                      </div>
                    </div>
                  </div>
                </div>
                    </>
                  );
                })()}
              </div>

              {/* Email deliverability (moved from Campaign) */}
              {channel === "email" ? (
                <div className="bg-black/20 border border-white/10 rounded-lg p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-white">Email deliverability check</h2>
                      <p className="mt-1 text-sm text-white/70">
                        Check each email step for spam risk and get suggested fixes. Results show on the left by step.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={runDeliverabilityCheck}
                      disabled={!campaign || isCheckingDeliverability}
                      className="px-4 py-2 rounded-md bg-orange-600 text-white font-semibold hover:bg-orange-700 disabled:opacity-50 inline-flex items-center gap-2"
                    >
                      {isCheckingDeliverability ? (
                        <>
                          <InlineSpinner />
                          <span>Checking</span>
                        </>
                      ) : (
                        "Check deliverability"
                      )}
                    </button>
                  </div>

                  {deliverabilityCheck ? (
                    <div className="mt-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                        <div>
                          <div className={`text-2xl font-bold ${getHealthScoreColor(deliverabilityCheck.overall_health_score)}`}>
                            {deliverabilityCheck.overall_health_score}%
                          </div>
                          <div className="text-sm text-white/70">Overall health score</div>
                        </div>
                        {deliverabilityCheck.summary ? (
                          <div className="text-sm text-white/70 md:max-w-2xl">
                            <span className="font-semibold text-white/80">Summary:</span> {deliverabilityCheck.summary}
                          </div>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        {/* Left: steps checked */}
                        <div className="lg:col-span-4">
                          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                            <div className="text-sm font-semibold text-white/85">Emails checked</div>
                            <div className="mt-2 space-y-2">
                              {(deliverabilityCheck.reports || []).map((r) => {
                                const isActive = Number(activeDeliverabilityStep || 0) === Number(r.step_number);
                                return (
                                  <button
                                    key={`dl_${r.step_number}`}
                                    type="button"
                                    onClick={() => setActiveDeliverabilityStep(Number(r.step_number))}
                                    className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                                      isActive ? "border-orange-400/50 bg-orange-500/10" : "border-white/10 bg-black/20 hover:bg-white/10"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="text-sm font-semibold text-white/85">Step {r.step_number}</div>
                                      <div className="text-xs text-white/70">
                                        <span className={getHealthScoreColor(Number(r.health_score || 0) || 0)}>
                                          {Number(r.health_score || 0) || 0}%
                                        </span>{" "}
                                        <span className="text-white/50">({r.spam_risk})</span>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Right: details */}
                        <div className="lg:col-span-8">
                          {(() => {
                            const step = Number(activeDeliverabilityStep || 0) || Number(deliverabilityCheck.reports?.[0]?.step_number || 1) || 1;
                            const r = (deliverabilityCheck.reports || []).find((x) => Number(x.step_number) === step) || null;
                            if (!r) return <div className="text-sm text-white/70">No details available.</div>;
                            return (
                              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-semibold text-white">
                                      Step {r.step_number} •{" "}
                                      <span className={getHealthScoreColor(Number(r.health_score || 0) || 0)}>{Number(r.health_score || 0) || 0}%</span>{" "}
                                      <span className="text-white/60">({r.spam_risk} risk)</span>
                                    </div>
                                    {(r.issues?.length || r.warnings?.length) ? (
                                      <ul className="mt-2 text-sm text-white/70 list-disc list-inside space-y-1">
                                        {(r.issues || []).slice(0, 6).map((x, i) => (
                                          <li key={`i_${r.step_number}_${i}`} className="text-red-200">{x}</li>
                                        ))}
                                        {(r.warnings || []).slice(0, 6).map((x, i) => (
                                          <li key={`w_${r.step_number}_${i}`}>{x}</li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <div className="mt-2 text-sm text-white/70">No major issues detected.</div>
                                    )}

                                    {r.subject_variants?.length ? (
                                      <div className="mt-3 text-sm text-white/70">
                                        <div className="font-semibold text-white/80 mb-1">Safer subject variants</div>
                                        <ul className="list-disc list-inside space-y-1">
                                          {r.subject_variants.slice(0, 4).map((s, i) => (
                                            <li key={`sv_${r.step_number}_${i}`}>{s}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    ) : null}

                                    {r.copy_tweaks?.length ? (
                                      <div className="mt-3 text-sm text-white/70">
                                        <div className="font-semibold text-white/80 mb-1">Copy tweaks</div>
                                        <ul className="list-disc list-inside space-y-1">
                                          {r.copy_tweaks.slice(0, 6).map((t, i) => (
                                            <li key={`ct_${r.step_number}_${i}`}>{t}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    ) : null}
                                  </div>

                                  {(r.improved_subject || r.improved_body) ? (
                                    <button
                                      type="button"
                                      onClick={() => applyDeliverabilityFix(r.step_number)}
                                      className="shrink-0 px-3 py-2 rounded-md bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
                                    >
                                      Apply fixes
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 text-sm text-white/70">
                      Click <span className="font-semibold text-white/80">Check deliverability</span> to analyze your sequence.
                    </div>
                  )}
                </div>
              ) : null}

              {/* Outreach Channel */}
              <div className="bg-black/20 border border-white/10 rounded-lg p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Channel</h2>
                    <p className="mt-1 text-sm text-white/70">
                      Choose how you’ll reach out. Email uses pre-flight checks; LinkedIn generates short connection request notes (no warm-up needed).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => persistChannel("email")}
                      className={`px-3 py-2 rounded-md text-sm font-semibold border transition-colors ${
                        channel === "email"
                          ? "brand-gradient text-black border-white/10"
                          : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      Email
                    </button>
                    <button
                      type="button"
                      onClick={() => persistChannel("linkedin")}
                      className={`px-3 py-2 rounded-md text-sm font-semibold border transition-colors ${
                        channel === "linkedin"
                          ? "brand-gradient text-black border-white/10"
                          : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      LinkedIn “Add a note”
                    </button>
                  </div>
                </div>
              </div>

              {/* LinkedIn notes (manual send) */}
              {channel === "linkedin" ? (
                <div className="bg-black/20 border border-white/10 rounded-lg p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-white">LinkedIn connection request notes</h2>
                      <p className="mt-1 text-sm text-white/70">
                        These are short, copy-ready notes for connection requests. They use your existing role context, offer, and saved research (when available).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={generateLinkedinNotes}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors"
                    >
                      Generate notes
                    </button>
                  </div>

                  {linkedinNotice ? (
                    <div className="mt-3 rounded-md border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                      {linkedinNotice}
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-3">
                    {loadSelectedContacts().map((c: any) => {
                      const cid = String(c?.id || "").trim();
                      const note = cid ? String(linkedinNotesByContact?.[cid] || "") : "";
                      const len = note.length;
                      const hasLinkedin = Boolean(String(c?.linkedin_url || "").trim());
                      return (
                        <div key={`li_${cid}`} className="rounded-lg border border-white/10 bg-white/5 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-white">{String(c?.name || "Contact")}</div>
                              <div className="text-xs text-white/60">
                                {String(c?.title || "Decision maker")}
                                {c?.company ? ` • ${formatCompanyName(String(c.company))}` : ""}
                              </div>
                              {hasLinkedin ? (
                                <a
                                  href={String(c.linkedin_url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-block mt-1 text-xs text-blue-300 underline hover:text-blue-200"
                                >
                                  Open LinkedIn profile
                                </a>
                              ) : (
                                <div className="mt-1 text-xs text-yellow-200/80">
                                  Missing LinkedIn URL — run Find Contact again or add `linkedin_url` to this contact.
                                </div>
                              )}
                            </div>
                            <div className="shrink-0 text-[11px] text-white/60">
                              {len}/280
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                            <div className="md:col-span-10">
                              <textarea
                                value={note}
                                onChange={(e) => {
                                  const v = e.target.value.slice(0, 280);
                                  const next = { ...(linkedinNotesByContact || {}) };
                                  if (cid) next[cid] = v;
                                  setLinkedinNotesByContact(next);
                                  persistLinkedinNotes(next);
                                }}
                                placeholder="Click “Generate notes” to fill this."
                                className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-500 h-24"
                              />
                            </div>
                            <div className="md:col-span-2 flex md:flex-col gap-2">
                              <button
                                type="button"
                                disabled={!note}
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(note);
                                    setLinkedinNotice("Copied note to clipboard.");
                                    window.setTimeout(() => setLinkedinNotice(null), 1600);
                                  } catch {}
                                }}
                                className="w-full bg-white text-black px-3 py-2 rounded-md text-xs font-bold hover:bg-white/90 disabled:opacity-50"
                              >
                                Copy
                              </button>
                              <button
                                type="button"
                                disabled={!cid}
                                onClick={() => {
                                  if (!cid) return;
                                  const next = { ...(linkedinNotesByContact || {}) };
                                  next[cid] = buildLinkedinNote(c);
                                  setLinkedinNotesByContact(next);
                                  persistLinkedinNotes(next);
                                }}
                                className="w-full bg-white/5 text-white px-3 py-2 rounded-md text-xs font-bold border border-white/10 hover:bg-white/10 disabled:opacity-50"
                              >
                                Refresh
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-md border border-white/10 bg-black/30 p-3 text-xs text-white/70">
                    Tip: keep notes short and specific. If LinkedIn rejects a note, trim it (280 chars max here).
                  </div>
                </div>
              ) : null}

              {/* Email warm-up (what most outreach tools include) */}
              {channel === "email" ? (
              <div className="bg-black/20 border border-white/10 rounded-lg p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Email Warm-up</h2>
                    <p className="mt-1 text-sm text-white/70">
                      Warm-up gradually builds sender reputation by sending low-volume emails that get opens/replies (usually via a warm-up network).
                      Most teams run this for <span className="font-semibold text-white/80">10–21 days</span> before launching to real contacts.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-white/70">
                    <input
                      type="checkbox"
                      checked={warmupPlan.enabled}
                      onChange={(e) => {
                        const next = e.target.checked;
                        setWarmupPlan((p) => ({ ...p, enabled: next, started_at: next ? new Date().toISOString() : p.started_at }));
                        setWarmupNotice(next ? "Warm-up enabled (plan saved)." : "Warm-up disabled (plan saved).");
                        window.setTimeout(() => setWarmupNotice(null), 2200);
                      }}
                    />
                    Enable warm-up
                  </label>
                </div>

                {warmupNotice ? (
                  <div className="mt-3 rounded-md border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    {warmupNotice}
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-semibold text-white mb-2">Choose a warm-up method</div>
                    <div className="text-xs text-white/60 mb-3">
                      Pick a provider. If RoleFerry warm-up is available, you can enable it directly here.
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        ...(roleferryWarmupAvailable
                          ? [
                              {
                                id: "roleferry",
                                label: "Use RoleFerry’s Warm-up",
                                hint: "Enable warm-up via RoleFerry (powered by Instantly’s warm-up API)",
                                url: "https://instantly.ai/",
                              },
                            ]
                          : []),
                        { id: "warmbox", label: "Warmbox", hint: "AI warm-up, opens/replies, spam rescue", url: "https://www.warmbox.ai/" },
                        { id: "mailreach", label: "Mailreach", hint: "Warm-up + deliverability monitoring", url: "https://mailreach.co/" },
                        { id: "lemwarm", label: "Lemwarm (Lemlist)", hint: "Warm-up network (Lemlist ecosystem)", url: "https://www.lemlist.com/lemwarm" },
                        { id: "warmupinbox", label: "Warmup Inbox", hint: "Large warm-up inbox network", url: "https://www.warmupinbox.com/" },
                        { id: "instantly", label: "Instantly Warmup", hint: "Warm-up inside Instantly", url: "https://instantly.ai/" },
                        { id: "diy", label: "DIY", hint: "Manual warm-up (harder; slower)", url: "https://support.google.com/a/answer/174124?hl=en" },
                      ].map((p) => {
                        const active = warmupPlan.provider === (p.id as WarmupProvider);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setWarmupPlan((prev) => ({ ...prev, provider: p.id as WarmupProvider }))}
                            className={`text-left rounded-md border p-3 transition-colors ${
                              active ? "border-blue-400/60 bg-blue-500/10" : "border-white/10 bg-black/20 hover:bg-black/30"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-white">{p.label}</div>
                              {active ? <div className="text-xs text-blue-200/80">Selected</div> : null}
                            </div>
                            <div className="mt-1 text-xs text-white/60">{p.hint}</div>
                            <div className="mt-2 text-xs">
                              <a
                                href={p.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-blue-300 underline hover:text-blue-200"
                              >
                                Open setup (new tab)
                              </a>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {roleferryWarmupAvailable && warmupPlan.provider === "roleferry" ? (
                      <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">RoleFerry’s Warm-up</div>
                            <div className="mt-1 text-xs text-white/60">
                              {roleferryWarmupMessage || "Enable warm-up for your sender account(s) inside Instantly via RoleFerry."}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={loadRoleferryAccounts}
                            disabled={rfLoading}
                            className="px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 disabled:opacity-50 inline-flex items-center gap-2"
                          >
                            {rfLoading ? (
                              <>
                                <InlineSpinner className="h-3.5 w-3.5" />
                                <span>Loading</span>
                              </>
                            ) : (
                              "Load accounts"
                            )}
                          </button>
                        </div>

                        {rfNotice ? (
                          <div className="mt-3 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
                            {rfNotice}
                          </div>
                        ) : null}

                        {Array.isArray(rfAccounts) && rfAccounts.length ? (
                          <div className="mt-3 space-y-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => enableRoleferryWarmup({ includeAll: true })}
                                disabled={rfLoading}
                                className="px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
                              >
                                Enable for all accounts
                              </button>
                              <button
                                type="button"
                                onClick={() => enableRoleferryWarmup({ includeAll: false })}
                                disabled={rfLoading}
                                className="px-3 py-2 rounded-md bg-white text-black text-xs font-bold hover:bg-white/90 disabled:opacity-50"
                              >
                                Enable for selected
                              </button>
                            </div>

                            <div className="rounded-md border border-white/10 divide-y divide-white/10">
                              {rfAccounts.slice(0, 12).map((a: any) => {
                                const email = String(a?.email || "").trim();
                                const score = a?.stat_warmup_score;
                                const warm = a?.warmup_status;
                                const selected = Boolean(rfSelected?.[email]);
                                return (
                                  <label key={`rfw_${email}`} className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-white/80">
                                    <div className="min-w-0 flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={(e) => setRfSelected((prev) => ({ ...(prev || {}), [email]: e.target.checked }))}
                                      />
                                      <span className="truncate">{email}</span>
                                    </div>
                                    <div className="shrink-0 text-white/60">
                                      {score !== undefined && score !== null ? `score ${score}` : null}
                                      {warm !== undefined && warm !== null ? ` • warmup ${warm}` : null}
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                            {rfAccounts.length > 12 ? (
                              <div className="text-[11px] text-white/50">
                                Showing 12 of {rfAccounts.length}. (We can expand this list later.)
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="mt-3 text-xs text-white/60">
                            No accounts loaded yet.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-semibold text-white mb-2">Ramp settings</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-white/60 mb-1">Start/day</div>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={warmupPlan.start_emails_per_day}
                          onChange={(e) => setWarmupPlan((p) => ({ ...p, start_emails_per_day: Math.max(1, parseInt(e.target.value) || 1) }))}
                          className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
                        />
                      </div>
                      <div>
                        <div className="text-xs text-white/60 mb-1">Target/day</div>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={warmupPlan.target_emails_per_day}
                          onChange={(e) => setWarmupPlan((p) => ({ ...p, target_emails_per_day: Math.max(1, parseInt(e.target.value) || 1) }))}
                          className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
                        />
                      </div>
                      <div>
                        <div className="text-xs text-white/60 mb-1">Ramp days</div>
                        <input
                          type="number"
                          min={7}
                          max={30}
                          value={warmupPlan.ramp_days}
                          onChange={(e) => setWarmupPlan((p) => ({ ...p, ramp_days: Math.max(7, Math.min(30, parseInt(e.target.value) || 14)) }))}
                          className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
                        />
                      </div>
                      <div>
                        <div className="text-xs text-white/60 mb-1">Reply rate %</div>
                        <input
                          type="number"
                          min={0}
                          max={80}
                          value={warmupPlan.reply_rate_pct}
                          onChange={(e) => setWarmupPlan((p) => ({ ...p, reply_rate_pct: Math.max(0, Math.min(80, parseInt(e.target.value) || 0)) }))}
                          className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none"
                        />
                      </div>
                    </div>

                    <div className="mt-3 space-y-2 text-xs text-white/70">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={warmupPlan.weekdays_only}
                          onChange={(e) => setWarmupPlan((p) => ({ ...p, weekdays_only: e.target.checked }))}
                        />
                        Weekdays only
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={warmupPlan.rescue_from_spam}
                          onChange={(e) => setWarmupPlan((p) => ({ ...p, rescue_from_spam: e.target.checked }))}
                        />
                        Enable “rescue from spam” behavior (if provider supports it)
                      </label>
                    </div>

                    <div className="mt-3 rounded-md border border-white/10 bg-black/20 p-3 text-xs text-white/70">
                      <div className="font-semibold text-white/80 mb-1">Best practice</div>
                      Keep real sending separate while warming up (or send very low volume), avoid heavy links, and increase slowly.
                    </div>
                  </div>
                </div>

                {warmupPlan.enabled ? (
                  <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">Warm-up schedule preview</div>
                        <div className="text-xs text-white/60">
                          This is the ramp RoleFerry will assume you’re following when deciding if Launch is “too early”.
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                      {warmupSchedule.slice(0, 12).map((d) => (
                        <div key={`wu_${d.day}`} className="rounded-md border border-white/10 bg-white/5 p-2">
                          <div className="text-white/80 font-semibold">Day {d.day}</div>
                          <div className="text-white/60">{d.date}</div>
                          <div className="mt-1 text-white">{d.emails} emails/day</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              ) : null}

              {/* Pre-Flight Checks */}
              {channel === "email" ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">Pre-Flight Checks</h2>
                  <button
                    onClick={runPreFlightChecks}
                    disabled={isRunningChecks}
                    className="bg-orange-600 text-white px-4 py-2 rounded-md font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {isRunningChecks ? (
                      <>
                        <InlineSpinner />
                        <span>Running checks</span>
                      </>
                    ) : (
                      "Run Pre-Flight Checks"
                    )}
                  </button>
                </div>

                <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-black/20 border border-white/10 rounded-lg p-4">
                    <div className="text-sm font-semibold text-white mb-2">Sender domain (optional, enables real DNS checks)</div>
                    <input
                      value={sendingDomain}
                      onChange={(e) => setSendingDomain(e.target.value)}
                      placeholder="e.g., yourdomain.com"
                      className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="mt-1 text-xs text-white/60">
                      Used to check SPF + DMARC via DNS. DKIM requires a selector.
                    </div>
                  </div>
                  <div className="bg-black/20 border border-white/10 rounded-lg p-4">
                    <div className="text-sm font-semibold text-white mb-2">DKIM selector (optional)</div>
                    <input
                      value={dkimSelector}
                      onChange={(e) => setDkimSelector(e.target.value)}
                      placeholder="e.g., google, default, selector1"
                      className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="mt-1 text-xs text-white/60">
                      Checks TXT at <span className="font-mono">{`<selector>._domainkey.<domain>`}</span>
                    </div>
                  </div>
                </div>

                {/* Recipients (per-contact email verification status) */}
                <div className="mb-4 bg-black/20 border border-white/10 rounded-lg p-4">
                  {(() => {
                    const contacts = loadSelectedContacts();
                    const emailCheck = preFlightChecks.find((c) => c.name === "Email Verification");
                    const verifiedContacts = (emailCheck?.meta?.verified_contacts as any[]) || [];
                    const verifiedEmailSet = new Set(
                      (Array.isArray(verifiedContacts) ? verifiedContacts : [])
                        .map((c: any) => String(c?.email || "").trim().toLowerCase())
                        .filter(Boolean)
                    );
                    const verifiedIdSet = new Set(
                      (Array.isArray(verifiedContacts) ? verifiedContacts : [])
                        .map((c: any) => String(c?.id || "").trim())
                        .filter(Boolean)
                    );

                    const total = Array.isArray(contacts) ? contacts.length : 0;
                    const withEmail = (Array.isArray(contacts) ? contacts : []).filter((c: any) => String(c?.email || "").trim()).length;
                    const verified = (Array.isArray(contacts) ? contacts : []).filter((c: any) => {
                      const id = String(c?.id || "").trim();
                      const em = String(c?.email || "").trim().toLowerCase();
                      if (!id && !em) return false;
                      return (id && verifiedIdSet.has(id)) || (em && verifiedEmailSet.has(em));
                    }).length;

                    return (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-white">Recipients</div>
                            <div className="mt-1 text-xs text-white/60">
                              Deliverability (spam risk) is checked per <span className="font-semibold text-white/80">email step</span>.{" "}
                              This table shows per-contact <span className="font-semibold text-white/80">email verification</span>.
                            </div>
                          </div>
                          <div className="text-xs text-white/60">
                            {emailCheck ? (
                              <>
                                Verified: <span className="text-emerald-200 font-semibold">{verified}</span> / {withEmail} with email
                              </>
                            ) : (
                              <>Run pre-flight checks to verify emails</>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 rounded-md border border-white/10 overflow-hidden">
                          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[11px] text-white/60 bg-white/5">
                            <div className="col-span-4">Contact</div>
                            <div className="col-span-5">Email</div>
                            <div className="col-span-3 text-right">Status</div>
                          </div>
                          <div className="divide-y divide-white/10">
                            {(Array.isArray(contacts) ? contacts : []).slice(0, 50).map((c: any) => {
                              const name = String(c?.name || "Contact").trim();
                              const company = String(c?.company || "").trim();
                              const email = String(c?.email || "").trim();
                              const id = String(c?.id || "").trim();
                              const isVerified =
                                Boolean((id && verifiedIdSet.has(id)) || (email && verifiedEmailSet.has(email.toLowerCase())));
                              const status =
                                !email
                                  ? { label: "No email", cls: "text-white/60" }
                                  : !emailCheck
                                    ? { label: "Not checked", cls: "text-yellow-200" }
                                    : isVerified
                                      ? { label: "Verified", cls: "text-emerald-200" }
                                      : { label: "Unverified", cls: "text-red-200" };
                              return (
                                <div key={`rcpt_${id || email || name}`} className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-white/80">
                                  <div className="col-span-4 min-w-0">
                                    <div className="truncate font-semibold text-white/85">{name}</div>
                                    <div className="truncate text-[11px] text-white/50">{company || "—"}</div>
                                  </div>
                                  <div className="col-span-5 min-w-0 truncate font-mono text-[11px] text-white/70">
                                    {email || "—"}
                                  </div>
                                  <div className={`col-span-3 text-right font-semibold ${status.cls}`}>{status.label}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        {total > 50 ? (
                          <div className="mt-2 text-[11px] text-white/50">Showing 50 of {total} recipients.</div>
                        ) : null}
                      </>
                    );
                  })()}
                </div>

                {preFlightChecks.length > 0 && (
                  <div className="space-y-4">
                    {preFlightChecks.map((check, index) => (
                      <div
                        key={index}
                        className={`flex items-center space-x-4 p-4 rounded-lg border ${
                          check.name === "AI Deliverability Helper"
                            ? "border-orange-400/30 bg-orange-500/10"
                            : "border-white/10 bg-black/20"
                        }`}
                      >
                        {getStatusIcon(check.status)}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-medium text-white">{check.name}</h3>
                            <span className={`text-sm font-medium ${getStatusColor(check.status)}`}>
                              {check.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-white/70 mt-1">{check.message}</p>
                          {check.details && (
                            <p className="text-sm text-white/70 mt-1 whitespace-pre-wrap">{check.details}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              ) : null}

              {/* Launch Section */}
              {channel === "email" ? (
              preFlightChecks.length > 0 && (
                <div className="bg-black/20 border border-white/10 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-white mb-4">Launch Campaign</h2>
                  
                  {blockingFailures ? (
                    <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="text-red-800 font-medium">Cannot launch - some checks failed</span>
                      </div>
                      <p className="text-red-700 text-sm mt-1">Please fix the failed checks before launching.</p>
                    </div>
                  ) : (failedCount > 0 && verifiedCount > 0 && !(launchVerifiedOnly && verifiedCount > 0)) ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-yellow-800 font-medium">Some contacts failed verification</span>
                      </div>
                      <p className="text-yellow-700 text-sm mt-1">
                        You can launch to verified emails only ({verifiedCount}/{totalWithEmail || verifiedCount}).
                      </p>
                      <label className="mt-3 flex items-start gap-3 text-sm text-yellow-900">
                        <input
                          type="checkbox"
                          checked={launchVerifiedOnly}
                          onChange={(e) => setLaunchVerifiedOnly(e.target.checked)}
                          className="mt-1"
                        />
                        <span>
                          Launch with only <span className="font-semibold">{verifiedCount}</span> verified emails (skip{" "}
                          <span className="font-semibold">{failedCount}</span> unverified)
                        </span>
                      </label>
                    </div>
                  ) : allChecksPassed || hasFailures ? (
                    <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-green-800 font-medium">Ready to launch</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span className="text-yellow-800 font-medium">Run pre-flight checks first</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={launchCampaign}
                    disabled={!canLaunch || isLaunching}
                    className="bg-green-600 text-white px-8 py-3 rounded-md font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    {isLaunching ? (
                      <>
                        <InlineSpinner />
                        <span>Launching</span>
                      </>
                    ) : (
                      "Launch Campaign"
                    )}
                  </button>
                </div>
              )
              ) : (
                <div className="bg-black/20 border border-white/10 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-white mb-2">Send on LinkedIn</h2>
                  <p className="text-sm text-white/70 mb-4">
                    LinkedIn mode is manual send. Generate/copy your notes above and send them as connection request notes.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={generateLinkedinNotes}
                      className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                    >
                      Regenerate notes
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/tracker")}
                      className="bg-white text-black px-6 py-3 rounded-md font-medium hover:bg-white/90 transition-colors"
                    >
                      Go to Tracker →
                    </button>
                  </div>
                </div>
              )}

              {/* Launch Result */}
              {launchResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                  <div className="flex items-center mb-4">
                    <svg className="w-6 h-6 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <h2 className="text-xl font-semibold text-green-900">Campaign Launched Successfully!</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-green-700">Campaign ID</div>
                      <div className="font-semibold text-green-900">{launchResult.campaign_id}</div>
                    </div>
                    <div>
                      <div className="text-sm text-green-700">Emails Sent</div>
                      <div className="font-semibold text-green-900">{launchResult.emails_sent}</div>
                    </div>
                    <div>
                      <div className="text-sm text-green-700">Scheduled</div>
                      <div className="font-semibold text-green-900">{launchResult.scheduled_emails}</div>
                    </div>
                  </div>
                  
                  <p className="text-green-800">{launchResult.message}</p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-red-800 font-medium">Error</span>
                  </div>
                  <p className="text-red-700 text-sm mt-1">{error}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => router.push('/campaign')}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-md font-medium hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                {launchResult && (
                  <button
                    onClick={() => router.push('/analytics')}
                    className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                  >
                    View Analytics
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
