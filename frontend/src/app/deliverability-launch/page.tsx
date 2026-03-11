"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatCompanyName } from "@/lib/format";
import InlineSpinner from "@/components/InlineSpinner";

type OutreachChannel = "email" | "linkedin";

interface InstantlyLaunchResult {
  success: boolean;
  campaign_id?: string;
  campaign_name?: string;
  email_accounts_used?: number;
  leads_added?: number;
  activated?: boolean;
  message?: string;
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

function ToggleSwitch({ enabled, onChange, label, subtitle }: { enabled: boolean; onChange: (v: boolean) => void; label: string; subtitle?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5 border-b border-white/5 last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-medium text-white">{label}</div>
        {subtitle && <div className="text-xs text-white/50 mt-0.5 leading-snug">{subtitle}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${enabled ? "bg-emerald-500" : "bg-white/15"}`}
      >
        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
      </button>
    </div>
  );
}

export default function DeliverabilityLaunchPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"job-seeker" | "recruiter">("job-seeker");
  const [campaign, setCampaign] = useState<any>(null);
  const [campaignByContactV2, setCampaignByContactV2] = useState<Record<string, any>>({});
  const [channel, setChannel] = useState<OutreachChannel>("email");
  const [linkedinNotesByContact, setLinkedinNotesByContact] = useState<Record<string, string>>({});
  const [linkedinNotice, setLinkedinNotice] = useState<string | null>(null);

  // --- Instantly campaign options state ---
  const [usePrewarmed, setUsePrewarmed] = useState(true);
  const [userEmails, setUserEmails] = useState<string[]>([]);
  const [newEmailInput, setNewEmailInput] = useState("");
  const [stopOnReply, setStopOnReply] = useState(true);
  const [linkTracking, setLinkTracking] = useState(false);
  const [openTracking, setOpenTracking] = useState(false);
  const [deliveryOptimization, setDeliveryOptimization] = useState(true);
  const [dailyLimit] = useState(25);
  const [campaignOwner] = useState("David March");
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [emailGap, setEmailGap] = useState(5);
  const [randomWaitMax, setRandomWaitMax] = useState(2);
  const [maxNewLeads, setMaxNewLeads] = useState<number | null>(null);
  const [prioritizeNewLeads, setPrioritizeNewLeads] = useState(true);
  const [abTesting, setAbTesting] = useState(false);
  const [abWinningMetric, setAbWinningMetric] = useState<string>("reply_rate");
  const [providerMatching, setProviderMatching] = useState(true);
  const [stopForCompany, setStopForCompany] = useState(true);
  const [stopOnAutoReply, setStopOnAutoReply] = useState(true);
  const [insertUnsubscribeHeader, setInsertUnsubscribeHeader] = useState(true);
  const [allowRiskyEmails, setAllowRiskyEmails] = useState(false);
  const [ccList, setCcList] = useState<string[]>([]);
  const [bccList, setBccList] = useState<string[]>([]);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");

  // --- Launch state ---
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<InstantlyLaunchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Helpers ---
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

  const readOfferSnippet = () => {
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
      const vars2 = composed?.variables || [];
      if (Array.isArray(vars2)) {
        const v = vars2.find((x: any) => String(x?.name || "") === "{{offer_snippet}}");
        const val = String(v?.value || "").trim();
        if (val) return val;
      }
    } catch {}
    try {
      const offers = JSON.parse(localStorage.getItem("created_offers") || "[]");
      const last = Array.isArray(offers) && offers.length ? offers[offers.length - 1] : null;
      const raw = String(last?.content || "").replace(/\s+/g, " ").trim();
      if (!raw) return "";
      return raw.length > 180 ? raw.slice(0, 180).trim() + "..." : raw;
    } catch {}
    return "";
  };

  const buildLinkedinNote = (c: any) => {
    const name = String(c?.name || "").trim();
    const first = name ? name.split(" ")[0] : "there";
    const company = formatCompanyName(String(c?.company || "").trim());
    const title = String(c?.title || "").trim();
    const offer = readOfferSnippet();
    const r = readResearchForContact(String(c?.id || "")) || {};
    const bio = Array.isArray(r?.contact_bios) ? r.contact_bios[0] : null;
    const fact = String((bio as any)?.interesting_facts?.[0]?.fact || (bio as any)?.post_topics?.[0] || "").replace(/\s+/g, " ").trim();

    const pieces: string[] = [];
    pieces.push(`Hi ${first},`);
    pieces.push("I reviewed your profile and wanted to connect.");
    if (title && company) pieces.push(`Your work as ${title} at ${company} stood out.`);
    else if (company) pieces.push(`Your work at ${company} stood out.`);
    if (fact) pieces.push(`I liked your perspective on ${fact.length > 70 ? fact.slice(0, 70).trim() + "..." : fact}.`);
    if (offer) pieces.push(`About me: ${offer.length > 85 ? offer.slice(0, 85).trim() + "..." : offer}`);
    else pieces.push("About me: I enjoy building practical, measurable solutions.");
    pieces.push("Open to connect?");

    let note = pieces.join(" ").replace(/\s+/g, " ").trim();
    const max = 280;
    if (note.length > max) note = note.slice(0, max - 1).trimEnd() + "...";
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
      const polishedById: Record<string, string> = { ...draftsById };
      try {
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
              solution: solution || undefined,
              limit: 280,
            });
            const improved = String(res?.note || "").replaceAll("\u2014", "-").replaceAll("\u2013", "-").replace(/\s+/g, " ").trim();
            if (improved) polishedById[cid] = improved;
          })
        );
      } catch {}
      setLinkedinNotesByContact(polishedById);
      try { localStorage.setItem("linkedin_notes_by_contact", JSON.stringify(polishedById || {})); } catch {}
      setLinkedinNotice(`Generated ${Object.keys(polishedById).length} LinkedIn note(s).`);
      window.setTimeout(() => setLinkedinNotice(null), 2200);
    })();
  };

  const persistChannel = (next: OutreachChannel) => {
    setChannel(next);
    try { localStorage.setItem("launch_channel", next); } catch {}
  };

  // --- Campaign name computation ---
  const computeCampaignName = () => {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const datePrefix = `${yy}-${mm}-${dd}`;

    const kebab = (raw: any) => {
      const s = String(raw ?? "").trim().toLowerCase();
      if (!s) return "";
      let t = s.replace(/&/g, " and ").replace(/\s+/g, " ").trim();
      t = t.replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
      return t;
    };

    let prefs: any = null;
    try { prefs = JSON.parse(localStorage.getItem("job_preferences") || "null"); } catch {}
    const industries = prefs?.industries || [];
    const work = prefs?.workType || prefs?.work_type || [];

    const shortIndustry = (raw: any) => {
      const s = String(raw ?? "").trim();
      if (!s) return "";
      let t = s.replace(/&/g, "and").replace(/\bartificial intelligence\b/gi, "AI").replace(/\bmachine learning\b/gi, "ML");
      t = t.replace(/\band\b/gi, " ").replace(/\s+/g, " ").trim();
      if (t.length > 28) t = t.slice(0, 28).trim();
      return kebab(t);
    };

    const parts = [datePrefix, shortIndustry(industries?.[0]), kebab(work?.[0])].filter(Boolean);
    const slug = parts.join("-");
    const suffix = String(Math.floor(100 + Math.random() * 900));
    return slug ? `${slug}_${suffix}` : `campaign_${suffix}`;
  };

  // --- Load data on mount ---
  useEffect(() => {
    const stored = localStorage.getItem("rf_mode");
    if (stored === "recruiter") setMode("recruiter");

    try {
      const raw = localStorage.getItem("rf_campaign_by_contact_v2");
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") setCampaignByContactV2(parsed);
    } catch {}

    (async () => {
      const persisted = (() => {
        try { return JSON.parse(localStorage.getItem("rf_persisted_campaign_meta_v1") || "null"); } catch { return null; }
      })();
      const persistedId = String(persisted?.id || "").trim();
      if (persistedId) {
        try {
          const resp = await api<{ campaign: any; rows: any[] }>(`/campaign/campaigns/${encodeURIComponent(persistedId)}`, "GET");
          const camp = resp?.campaign || null;
          const rows = Array.isArray(resp?.rows) ? resp.rows : [];
          if (camp && rows.length) {
            const delaysByN: Record<number, number> = { 1: 0, 2: 3, 3: 7, 4: 14 };
            const contactIdForRow = (r: any) => {
              const st = r?.state && typeof r.state === "object" ? r.state : {};
              return String(st?.contact_id || r?.email || r?.id || "").trim();
            };
            const toContacts = rows.map((r: any) => {
              const cid = contactIdForRow(r) || `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
              const rName = `${String(r?.first_name || "").trim()} ${String(r?.last_name || "").trim()}`.trim() || "Contact";
              return { id: cid, email: String(r?.email || "").trim(), name: rName, company: String(r?.company_name || "").trim(), title: String(r?.job_title || "").trim(), linkedin_url: String(r?.linkedin || "").trim() };
            });
            try { localStorage.setItem("selected_contacts", JSON.stringify(toContacts)); } catch {}

            const extractEmails = (r: any) => {
              const s = r?.emails && typeof r.emails === "object" ? r.emails : {};
              const blob = s?.emails && typeof s.emails === "object" ? s.emails : s;
              const out: any[] = [];
              for (const n of [1, 2, 3, 4]) {
                const hit = (blob as any)?.[`email_${n}`] || null;
                out.push({ id: `${String(r?.id || contactIdForRow(r) || "row")}_e${n}`, step_number: n, subject: cleanMessageText(hit?.subject || ""), body: cleanMessageText(hit?.body || ""), delay_days: delaysByN[n] ?? 0, stop_on_reply: true });
              }
              return out;
            };

            const by: Record<string, any> = {};
            for (const r of rows) {
              const cid = contactIdForRow(r);
              if (!cid) continue;
              by[cid] = { id: `camp_${cid}`, name: String(camp?.name || "").trim() || "Campaign", status: "draft", emails: extractEmails(r) };
            }
            setCampaignByContactV2(by);
            try { localStorage.setItem("rf_campaign_by_contact_v2", JSON.stringify(by || {})); } catch {}

            const c0 = rows[0];
            const canonical = { id: String(camp?.id || persistedId).trim(), name: String(camp?.name || "").trim() || "Campaign", status: "draft", emails: extractEmails(c0) };
            setCampaign(canonical);
            try { localStorage.setItem("campaign_data", JSON.stringify(canonical)); } catch {}
            return;
          }
        } catch {}
      }

      try {
        const contacts = loadSelectedContacts();
        const firstId = String((Array.isArray(contacts) ? contacts[0]?.id : "") || "").trim();
        const raw = localStorage.getItem("rf_campaign_by_contact_v2");
        const by = raw ? JSON.parse(raw) : null;
        const c0 = firstId && by && typeof by === "object" ? by[firstId] : null;
        if (c0?.emails?.length) {
          setCampaign(c0);
        } else {
          const campaignData = localStorage.getItem("campaign_data");
          if (campaignData) setCampaign(JSON.parse(campaignData));
        }
      } catch {
        try {
          const campaignData = localStorage.getItem("campaign_data");
          if (campaignData) setCampaign(JSON.parse(campaignData));
        } catch {}
      }
    })();

    try {
      const ch = String(localStorage.getItem("launch_channel") || "").trim();
      if (ch === "linkedin" || ch === "email") setChannel(ch as OutreachChannel);
    } catch {}
    try {
      const raw = localStorage.getItem("linkedin_notes_by_contact");
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed && typeof parsed === "object") setLinkedinNotesByContact(parsed);
    } catch {}

    // Pre-populate tags from companies
    try {
      const contacts = loadSelectedContacts();
      const companies = [...new Set(contacts.map((c: any) => String(c?.company || "").trim()).filter(Boolean))];
      if (companies.length) setCustomTags(companies);
    } catch {}

    const handleModeChange = (event: CustomEvent) => { setMode(event.detail); };
    window.addEventListener("modeChanged", handleModeChange as EventListener);
    return () => window.removeEventListener("modeChanged", handleModeChange as EventListener);
  }, []);

  // --- Build sequences from campaign data ---
  const buildSequences = () => {
    const steps: any[] = [];
    const emails = Array.isArray(campaign?.emails) ? campaign.emails : [];
    for (const e of emails) {
      const stepN = Number(e?.step_number || steps.length + 1);
      const subject = cleanMessageText(e?.subject || "");
      const body = cleanMessageText(e?.body || "");
      if (!subject && !body) continue;
      steps.push({
        type: "email",
        delay: Number(e?.delay_days || 0),
        delay_unit: "days",
        variants: [{ subject, body }],
      });
    }
    return steps.length ? [{ steps }] : [];
  };

  // --- Launch ---
  const launchInstantly = async () => {
    setIsLaunching(true);
    setError(null);
    setLaunchResult(null);
    try {
      const contacts = loadSelectedContacts();
      if (!contacts.length) throw new Error("No contacts selected.");

      const campaignName = computeCampaignName();
      const sequences = buildSequences();

      const payload = {
        options: {
          campaign_name: campaignName,
          email_accounts: userEmails,
          use_prewarmed: usePrewarmed,
          stop_on_reply: stopOnReply,
          stop_on_auto_reply: stopOnAutoReply,
          stop_for_company: stopForCompany,
          link_tracking: linkTracking,
          open_tracking: openTracking,
          delivery_optimization: deliveryOptimization,
          daily_limit: dailyLimit,
          email_gap: emailGap,
          random_wait_max: randomWaitMax,
          max_new_leads_per_day: maxNewLeads,
          prioritize_new_leads: prioritizeNewLeads,
          ab_testing: abTesting,
          ab_winning_metric: abTesting ? abWinningMetric : null,
          provider_matching: providerMatching,
          insert_unsubscribe_header: insertUnsubscribeHeader,
          allow_risky_emails: allowRiskyEmails,
          cc_list: ccList,
          bcc_list: bccList,
          custom_tags: customTags,
          campaign_owner: campaignOwner,
        },
        contacts,
        sequences,
        campaign_id_local: campaign?.id || null,
      };

      const result = await api<InstantlyLaunchResult>("/deliverability-launch/instantly-launch", "POST", payload);
      setLaunchResult(result);

      if (result.success) {
        try {
          const trackerKey = "tracker_applications";
          const existingRaw = localStorage.getItem(trackerKey);
          const existing = existingRaw ? JSON.parse(existingRaw) : [];
          const list = Array.isArray(existing) ? existing : [];
          const newEntries = contacts.map((c: any) => ({
            id: `trk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            company: { name: c.company || "Unknown" },
            role: campaign?.name || "Applied Role",
            status: "applied",
            appliedDate: new Date().toISOString().slice(0, 10),
            lastContact: new Date().toISOString().slice(0, 10),
            source: "instantly_campaign",
            contacts: [c.name].filter(Boolean),
          }));
          localStorage.setItem(trackerKey, JSON.stringify([...newEntries, ...list]));
        } catch {}
      }
    } catch (e: any) {
      setError(String(e?.message || "Failed to launch campaign."));
    } finally {
      setIsLaunching(false);
    }
  };

  // --- Derived ---
  const selectedContacts = loadSelectedContacts();
  const totalContacts = selectedContacts.length;
  const emailAccountCount = (usePrewarmed ? 1 : 0) + userEmails.length;
  const maxDailyCapacity = emailAccountCount * dailyLimit;

  // --- Render ---
  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-4">
          <a href="/campaign" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
            <span className="mr-2">&larr;</span> Back to Campaign
          </a>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Launch Campaign</h1>
            <p className="text-white/60 text-sm">
              {mode === "job-seeker"
                ? "Configure your outreach settings and launch your email campaign via Instantly."
                : "Configure your candidate pitch settings and launch via Instantly."}
            </p>
          </div>

          {!campaign ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-white/40 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-white mb-2">No Campaign Data</h3>
              <p className="text-white/70 mb-6">Please generate your campaign emails first.</p>
              <button onClick={() => router.push("/campaign")} className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors">
                Go to Campaign
              </button>
            </div>
          ) : (
            <div className="space-y-6">

              {/* Channel Selection */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-5">
                <h2 className="text-base font-semibold text-white mb-3">Channel</h2>
                <p className="text-xs text-white/50 mb-3">Choose how you will reach out.</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => persistChannel("email")}
                    className={`flex-1 py-2.5 rounded-md text-sm font-medium border transition-colors ${
                      channel === "email" ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300" : "bg-white/5 border-white/10 text-white/60 hover:text-white/80"
                    }`}
                  >
                    Email (Instantly)
                  </button>
                  <button
                    type="button"
                    onClick={() => persistChannel("linkedin")}
                    className={`flex-1 py-2.5 rounded-md text-sm font-medium border transition-colors ${
                      channel === "linkedin" ? "bg-blue-500/20 border-blue-400/50 text-blue-300" : "bg-white/5 border-white/10 text-white/60 hover:text-white/80"
                    }`}
                  >
                    LinkedIn
                  </button>
                </div>
              </div>

              {channel === "linkedin" ? (
                <>
                  {/* LinkedIn Notes */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-base font-semibold text-white">LinkedIn Connection Notes</h2>
                      <button type="button" onClick={generateLinkedinNotes} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded font-medium hover:bg-blue-700 transition-colors">
                        Generate Notes
                      </button>
                    </div>
                    <p className="text-xs text-white/50 mb-4">Premium LinkedIn only. Send as connection request notes (&lt;300 chars).</p>
                    {linkedinNotice && <div className="text-xs text-emerald-400 mb-3">{linkedinNotice}</div>}
                    {selectedContacts.map((c: any) => {
                      const cid = String(c?.id || "").trim();
                      const note = linkedinNotesByContact[cid] || "";
                      return (
                        <div key={cid} className="mb-3 last:mb-0">
                          <div className="text-xs text-white/70 font-medium mb-1">{c.name || "Contact"} {c.company ? `- ${c.company}` : ""}</div>
                          <textarea
                            className="w-full bg-black/20 border border-white/10 rounded text-xs text-white/80 p-2 resize-none focus:outline-none focus:border-white/30"
                            rows={3}
                            maxLength={300}
                            value={note}
                            onChange={(e) => {
                              const next = { ...linkedinNotesByContact, [cid]: e.target.value };
                              setLinkedinNotesByContact(next);
                              try { localStorage.setItem("linkedin_notes_by_contact", JSON.stringify(next)); } catch {}
                            }}
                          />
                          <div className="text-right text-[10px] text-white/30">{note.length}/300</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-5">
                    <h2 className="text-base font-semibold text-white mb-2">Send on LinkedIn</h2>
                    <p className="text-xs text-white/50 mb-4">LinkedIn mode is manual. Copy your notes above and send as connection request notes.</p>
                    <div className="flex gap-3">
                      <button type="button" onClick={generateLinkedinNotes} className="bg-blue-600 text-white px-5 py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors">
                        Regenerate Notes
                      </button>
                      <button type="button" onClick={() => router.push("/tracker")} className="bg-white/10 text-white px-5 py-2.5 rounded-md text-sm font-medium hover:bg-white/20 transition-colors">
                        Go to Tracker &rarr;
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* --- Instantly Campaign Options --- */}

                  {/* Accounts to use */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-5">
                    <h2 className="text-base font-semibold text-white mb-1">Accounts to Use</h2>
                    <p className="text-xs text-white/50 mb-4">Select one or more accounts to send emails from.</p>

                    <label className="flex items-center gap-2.5 mb-3 cursor-pointer">
                      <input type="checkbox" checked={usePrewarmed} onChange={(e) => setUsePrewarmed(e.target.checked)}
                        className="w-4 h-4 rounded border-white/30 bg-transparent accent-emerald-500" />
                      <span className="text-sm text-white">Pre-warmed accounts (Instantly)</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full px-2 py-0.5 font-semibold">Recommended</span>
                    </label>

                    <div className="mb-3">
                      <div className="text-xs text-white/50 mb-1.5">Or add your own email account:</div>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          placeholder="you@example.com"
                          value={newEmailInput}
                          onChange={(e) => setNewEmailInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newEmailInput.trim()) {
                              setUserEmails((prev) => [...prev, newEmailInput.trim()]);
                              setNewEmailInput("");
                            }
                          }}
                          className="flex-1 bg-black/20 border border-white/10 rounded px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newEmailInput.trim()) {
                              setUserEmails((prev) => [...prev, newEmailInput.trim()]);
                              setNewEmailInput("");
                            }
                          }}
                          className="bg-white/10 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-white/20 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                      {!usePrewarmed && userEmails.length === 0 && (
                        <p className="text-[10px] text-red-400 mt-1.5 italic">
                          Not recommended for more than 20 applications/day. Your email may be flagged and deliverability cannot be guaranteed.
                        </p>
                      )}
                    </div>

                    {userEmails.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {userEmails.map((email, i) => (
                          <span key={i} className="inline-flex items-center gap-1.5 bg-white/10 text-white/80 text-xs px-2.5 py-1 rounded-full">
                            {email}
                            <button type="button" onClick={() => setUserEmails((prev) => prev.filter((_, j) => j !== i))} className="text-white/40 hover:text-white/80">&times;</button>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-3 text-xs text-white/40">
                      Daily limit: <span className="font-semibold text-white/60">{dailyLimit}</span> emails per account/day
                      &middot; Total capacity: <span className="font-semibold text-white/60">{maxDailyCapacity}</span>/day
                      &middot; {totalContacts} recipient(s) selected
                    </div>
                  </div>

                  {/* Email Behavior */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-5">
                    <h2 className="text-base font-semibold text-white mb-1">Email Behavior</h2>
                    <ToggleSwitch enabled={stopOnReply} onChange={setStopOnReply} label="Stop Sending Emails on Reply" subtitle="Stop sending emails to a lead if a response has been received." />
                    <ToggleSwitch enabled={stopOnAutoReply} onChange={setStopOnAutoReply} label="Stop Sending Emails on Auto-Reply" subtitle="Stop sending to a lead if an automatic response (e.g. out-of-office) has been received." />
                    <ToggleSwitch enabled={stopForCompany} onChange={setStopForCompany} label="Stop Campaign for Company on Reply" subtitle="Stops the campaign for all leads from a company if a reply is received from any of them." />
                  </div>

                  {/* Tracking & Delivery */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-5">
                    <h2 className="text-base font-semibold text-white mb-1">Tracking & Delivery</h2>
                    <ToggleSwitch
                      enabled={linkTracking}
                      onChange={(v) => setLinkTracking(v)}
                      label="Link Tracking"
                      subtitle="Track email link clicks."
                    />
                    <ToggleSwitch
                      enabled={openTracking}
                      onChange={(v) => {
                        setOpenTracking(v);
                        if (v) setDeliveryOptimization(false);
                      }}
                      label="Open Tracking"
                      subtitle="Track email opens."
                    />
                    <ToggleSwitch
                      enabled={deliveryOptimization}
                      onChange={(v) => {
                        setDeliveryOptimization(v);
                        if (v) setOpenTracking(false);
                      }}
                      label="Delivery Optimization"
                      subtitle="Disables open tracking. Sends as text-only for maximum deliverability."
                    />
                  </div>

                  {/* Campaign Owner & Tags */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-5">
                    <h2 className="text-base font-semibold text-white mb-3">Campaign Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs text-white/50 mb-1">Campaign Owner</label>
                        <div className="bg-black/20 border border-white/10 rounded px-3 py-2 text-sm text-white/80">{campaignOwner}</div>
                      </div>
                      <div>
                        <label className="block text-xs text-white/50 mb-1">Daily Limit per Account</label>
                        <div className="bg-black/20 border border-white/10 rounded px-3 py-2 text-sm text-white/80">{dailyLimit} emails/day</div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-white/50 mb-1">Custom Tags</label>
                      <p className="text-[10px] text-white/40 mb-2">Tags are used to group your campaigns. Company names auto-added.</p>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          placeholder="Add tag..."
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newTagInput.trim()) {
                              setCustomTags((prev) => [...new Set([...prev, newTagInput.trim()])]);
                              setNewTagInput("");
                            }
                          }}
                          className="flex-1 bg-black/20 border border-white/10 rounded px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (newTagInput.trim()) {
                              setCustomTags((prev) => [...new Set([...prev, newTagInput.trim()])]);
                              setNewTagInput("");
                            }
                          }}
                          className="bg-white/10 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-white/20 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                      {customTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {customTags.map((tag, i) => (
                            <span key={i} className="inline-flex items-center gap-1 bg-white/10 text-white/70 text-xs px-2 py-0.5 rounded-full">
                              {tag}
                              <button type="button" onClick={() => setCustomTags((prev) => prev.filter((_, j) => j !== i))} className="text-white/40 hover:text-white/80">&times;</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sending Pattern */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-5">
                    <h2 className="text-base font-semibold text-white mb-1">Sending Pattern</h2>
                    <p className="text-xs text-white/50 mb-4">Specify how you want your emails to go.</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs text-white/50 mb-1">Time Gap Between Emails</label>
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="text-[10px] text-white/40 mb-0.5">Minimum time</div>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={1}
                                max={60}
                                value={emailGap}
                                onChange={(e) => setEmailGap(Math.max(1, Number(e.target.value) || 5))}
                                className="w-16 bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-white/30"
                              />
                              <span className="text-xs text-white/50">min</span>
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-white/40 mb-0.5">Random additional</div>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                max={30}
                                value={randomWaitMax}
                                onChange={(e) => setRandomWaitMax(Math.max(0, Number(e.target.value) || 2))}
                                className="w-16 bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-white/30"
                              />
                              <span className="text-xs text-white/50">min</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-white/50 mb-1">Max New Leads</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={maxNewLeads === null ? "" : String(maxNewLeads)}
                            placeholder="No limit"
                            onChange={(e) => {
                              const v = e.target.value.trim();
                              setMaxNewLeads(v ? Math.max(1, Number(v) || 0) || null : null);
                            }}
                            className="w-24 bg-black/20 border border-white/10 rounded px-2 py-1.5 text-sm text-white placeholder:text-white/30 text-center focus:outline-none focus:border-white/30"
                          />
                          <span className="text-xs text-white/50">per day</span>
                        </div>
                      </div>
                    </div>

                    <ToggleSwitch enabled={prioritizeNewLeads} onChange={setPrioritizeNewLeads} label="Prioritize New Leads" subtitle="Prioritize reaching out to new leads over scheduled follow-ups." />
                  </div>

                  {/* A/B Testing */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-5">
                    <h2 className="text-base font-semibold text-white mb-1">Auto Optimize A/Z Testing</h2>
                    <p className="text-xs text-white/50 mb-3">When using A/Z testing, the algorithm will automatically select the best performing variant after a certain number of emails have been sent.</p>
                    <ToggleSwitch enabled={abTesting} onChange={setAbTesting} label="Enable A/Z Testing" />
                    {abTesting && (
                      <div className="mt-2">
                        <label className="block text-xs text-white/50 mb-1">Choose Winning Metric</label>
                        <select
                          value={abWinningMetric}
                          onChange={(e) => setAbWinningMetric(e.target.value)}
                          className="bg-black/20 border border-white/10 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30"
                        >
                          <option value="reply_rate">Reply Rate</option>
                          <option value="open_rate">Open Rate</option>
                          <option value="click_rate">Click Rate</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Advanced Deliverability */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-5">
                    <h2 className="text-base font-semibold text-white mb-1">Advanced Deliverability</h2>
                    <ToggleSwitch enabled={providerMatching} onChange={setProviderMatching} label="Provider Matching" subtitle="Matches your lead's email provider with your mailbox provider for boosted deliverability. (Outlook to Outlook, Google to Google, etc.)" />
                    <ToggleSwitch enabled={insertUnsubscribeHeader} onChange={setInsertUnsubscribeHeader} label="Insert Unsubscribe Link Header" subtitle="Automatically adds an unsubscribe link to email headers for one-click unsubscription by supported email providers." />
                    <ToggleSwitch enabled={allowRiskyEmails} onChange={setAllowRiskyEmails} label="Allow Risky Emails" subtitle="When using verification, allow emails marked as risky to be contacted." />
                  </div>

                  {/* CC & BCC */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-semibold text-white">CC and BCC</h2>
                        <p className="text-xs text-white/50">Add CC and BCC recipients to all emails.</p>
                      </div>
                      <button type="button" onClick={() => setShowCcBcc(!showCcBcc)} className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                        {showCcBcc ? "Hide" : "Show CC & BCC"}
                      </button>
                    </div>
                    {showCcBcc && (
                      <div className="mt-4 space-y-3">
                        <div>
                          <label className="block text-xs text-white/50 mb-1">CC</label>
                          <div className="flex gap-2">
                            <input
                              type="email"
                              placeholder="cc@example.com"
                              value={ccInput}
                              onChange={(e) => setCcInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && ccInput.trim()) { setCcList((p) => [...p, ccInput.trim()]); setCcInput(""); }
                              }}
                              className="flex-1 bg-black/20 border border-white/10 rounded px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                            />
                            <button type="button" onClick={() => { if (ccInput.trim()) { setCcList((p) => [...p, ccInput.trim()]); setCcInput(""); } }} className="bg-white/10 text-white px-3 py-1.5 rounded text-sm hover:bg-white/20">Add</button>
                          </div>
                          {ccList.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {ccList.map((e, i) => (
                                <span key={i} className="inline-flex items-center gap-1 bg-white/10 text-white/70 text-xs px-2 py-0.5 rounded-full">
                                  {e} <button type="button" onClick={() => setCcList((p) => p.filter((_, j) => j !== i))} className="text-white/40 hover:text-white/80">&times;</button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">BCC</label>
                          <div className="flex gap-2">
                            <input
                              type="email"
                              placeholder="bcc@example.com"
                              value={bccInput}
                              onChange={(e) => setBccInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && bccInput.trim()) { setBccList((p) => [...p, bccInput.trim()]); setBccInput(""); }
                              }}
                              className="flex-1 bg-black/20 border border-white/10 rounded px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                            />
                            <button type="button" onClick={() => { if (bccInput.trim()) { setBccList((p) => [...p, bccInput.trim()]); setBccInput(""); } }} className="bg-white/10 text-white px-3 py-1.5 rounded text-sm hover:bg-white/20">Add</button>
                          </div>
                          {bccList.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {bccList.map((e, i) => (
                                <span key={i} className="inline-flex items-center gap-1 bg-white/10 text-white/70 text-xs px-2 py-0.5 rounded-full">
                                  {e} <button type="button" onClick={() => setBccList((p) => p.filter((_, j) => j !== i))} className="text-white/40 hover:text-white/80">&times;</button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Recipients Summary */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-5">
                    <h2 className="text-base font-semibold text-white mb-3">Recipients</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                      <div className="bg-black/20 rounded-lg py-3 px-2">
                        <div className="text-2xl font-bold text-white">{totalContacts}</div>
                        <div className="text-[10px] text-white/50">Contacts</div>
                      </div>
                      <div className="bg-black/20 rounded-lg py-3 px-2">
                        <div className="text-2xl font-bold text-white">{Array.isArray(campaign?.emails) ? campaign.emails.length : 0}</div>
                        <div className="text-[10px] text-white/50">Steps in sequence</div>
                      </div>
                      <div className="bg-black/20 rounded-lg py-3 px-2">
                        <div className="text-2xl font-bold text-white">{totalContacts * (Array.isArray(campaign?.emails) ? campaign.emails.length : 0)}</div>
                        <div className="text-[10px] text-white/50">Planned sends</div>
                      </div>
                      <div className="bg-black/20 rounded-lg py-3 px-2">
                        <div className="text-2xl font-bold text-white">{maxDailyCapacity}</div>
                        <div className="text-[10px] text-white/50">Max/day capacity</div>
                      </div>
                    </div>
                    {totalContacts > maxDailyCapacity && emailAccountCount > 0 && (
                      <div className="mt-3 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-3 py-2">
                        You have more contacts than your daily capacity. Add more email accounts or the campaign will take multiple days.
                      </div>
                    )}
                    {emailAccountCount === 0 && (
                      <div className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                        No email accounts configured. Enable pre-warmed accounts or add your own email above.
                      </div>
                    )}
                  </div>

                  {/* Launch Button */}
                  <div className="bg-white/5 border border-white/10 rounded-lg p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-semibold text-white">Launch Campaign</h2>
                        <p className="text-xs text-white/50 mt-0.5">Create and activate your campaign in Instantly.</p>
                      </div>
                      <button
                        type="button"
                        onClick={launchInstantly}
                        disabled={isLaunching || emailAccountCount === 0 || totalContacts === 0}
                        className="bg-emerald-600 text-white px-8 py-3 rounded-md font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2 text-sm"
                      >
                        {isLaunching ? (
                          <><InlineSpinner /><span>Launching...</span></>
                        ) : (
                          "Launch Campaign"
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Launch Result */}
              {launchResult && (
                <div className={`border rounded-lg p-5 ${launchResult.success ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"}`}>
                  <div className="flex items-center gap-2 mb-3">
                    {launchResult.success ? (
                      <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    <h3 className={`text-sm font-semibold ${launchResult.success ? "text-emerald-300" : "text-red-300"}`}>
                      {launchResult.success ? "Campaign Launched!" : "Launch Failed"}
                    </h3>
                  </div>
                  <p className="text-xs text-white/70 mb-3">{launchResult.message}</p>
                  {launchResult.success && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                      <div className="bg-black/20 rounded py-2 px-2">
                        <div className="text-sm font-bold text-white">{launchResult.campaign_id?.slice(0, 8)}...</div>
                        <div className="text-[10px] text-white/50">Campaign ID</div>
                      </div>
                      <div className="bg-black/20 rounded py-2 px-2">
                        <div className="text-sm font-bold text-white">{launchResult.email_accounts_used}</div>
                        <div className="text-[10px] text-white/50">Accounts</div>
                      </div>
                      <div className="bg-black/20 rounded py-2 px-2">
                        <div className="text-sm font-bold text-white">{launchResult.leads_added}</div>
                        <div className="text-[10px] text-white/50">Leads Added</div>
                      </div>
                      <div className="bg-black/20 rounded py-2 px-2">
                        <div className="text-sm font-bold text-emerald-300">{launchResult.activated ? "Active" : "Pending"}</div>
                        <div className="text-[10px] text-white/50">Status</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm text-red-300 font-medium">Error</span>
                  </div>
                  <p className="text-xs text-red-300/80 mt-1">{error}</p>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => router.push("/campaign")}
                  className="bg-white/10 text-white px-5 py-2.5 rounded-md text-sm font-medium hover:bg-white/20 transition-colors"
                >
                  &larr; Back
                </button>
                {launchResult?.success && (
                  <button
                    type="button"
                    onClick={() => router.push("/analytics")}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    View Analytics &rarr;
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
