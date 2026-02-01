"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface EmailStep {
  id: string;
  step_number: number;
  subject: string;
  body: string;
  delay_days: number;
  delay_hours: number;
  stop_on_reply: boolean;
  variables: Record<string, string>;
  template_variant_index?: number;
}

interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  emails: EmailStep[];
  created_at: string;
  updated_at: string;
  followups_enabled_count?: number; // 0..3 (Email 2/3/4)
}

export default function CampaignPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'job-seeker' | 'recruiter'>('job-seeker');
  const [contacts, setContacts] = useState<any[]>([]);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [campaignByContact, setCampaignByContact] = useState<Record<string, Campaign>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composeHelper, setComposeHelper] = useState<any>(null);
  const [buildStamp, setBuildStamp] = useState<string>("");
  const [researchHistory, setResearchHistory] = useState<Array<{ contact: any; research: any; researched_at: string }>>([]);
  const [followupsEnabledCount, setFollowupsEnabledCount] = useState<number>(2); // default: 3-email sequence
  const [activeStepNumber, setActiveStepNumber] = useState<number>(1);

  const campaign: Campaign | null = activeContactId ? (campaignByContact[activeContactId] || null) : null;

  const readResearchHistory = () => {
    try {
      const raw = localStorage.getItem("context_research_history");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const mergeContacts = (selected: any[], history: any[]) => {
    const out: any[] = [];
    const seen = new Set<string>();

    const add = (c: any) => {
      const id = String(c?.id || "").trim();
      if (!id) return;
      if (seen.has(id)) return;
      seen.add(id);
      out.push(c);
    };

    for (const c of Array.isArray(selected) ? selected : []) add(c);
    for (const h of Array.isArray(history) ? history : []) add(h?.contact);
    return out;
  };

  const campaignSeed = (composedEmail: any, contactList: any[]) => {
    // Used to decide if we should auto-regenerate after the user changes Offer/Compose.
    try {
      const subj = String(composedEmail?.subject || "").trim();
      const body = String(composedEmail?.body || "").trim();
      const offerId = String(localStorage.getItem("compose_selected_offer_id") || "").trim();
      const jobId = String(localStorage.getItem("selected_job_description_id") || "").trim();
      const contactIds = (Array.isArray(contactList) ? contactList : []).map((c) => String(c?.id || "")).filter(Boolean).sort();
      return JSON.stringify({ subj, body, offerId, jobId, contactIds });
    } catch {
      return "";
    }
  };

  const setActiveContact = (cid: string) => {
    const id = String(cid || "").trim();
    if (!id) return;
    setActiveContactId(id);
    setActiveStepNumber(1);
    try {
      localStorage.setItem("campaign_active_contact_id", id);
      // Keep research/offer/compose aligned to the same "active contact" concept.
      localStorage.setItem("context_research_active_contact_id", id);
    } catch {}
    // Best-effort: also update `context_research` so downstream steps (Offer/Compose) stay consistent.
    try {
      const rawBy = localStorage.getItem("context_research_by_contact");
      const by = rawBy ? JSON.parse(rawBy) : null;
      const hit = by && typeof by === "object" ? (by[id] || null) : null;
      if (hit) {
        localStorage.setItem("context_research", JSON.stringify(hit));
        localStorage.setItem("research_data", JSON.stringify(hit));
      }
    } catch {}
  };

  const signatureBlock = () => {
    try {
      const u = JSON.parse(localStorage.getItem("rf_user") || "null");
      const fn = String(u?.first_name || "").trim();
      const ln = String(u?.last_name || "").trim();
      const nm = `${fn} ${ln}`.trim();
      const phone = String(u?.phone || "").trim();
      const li = String(u?.linkedin_url || "").trim();
      return [nm || "[Your Name]", phone, li].filter(Boolean).join("\n");
    } catch {
      return "[Your Name]";
    }
  };

  const sign = (body: string) => {
    const s = String(body || "").trimEnd();
    const sig = signatureBlock();
    // Avoid duplicating signature if user pasted it into templates
    if (sig && s.toLowerCase().includes(sig.toLowerCase())) return s;
    return `${s}\n\nBest,\n${sig}`.trim() + "\n";
  };

  const applyVariables = (text: string, vars: Record<string, string>) => {
    let out = text;
    for (const [k, v] of Object.entries(vars)) {
      if (!k) continue;
      out = out.split(k).join(v ?? "");
    }
    return out;
  };

  const loadResearchForContact = (cid: string | null) => {
    if (!cid) return null;
    try {
      const raw = localStorage.getItem("context_research_by_contact");
      const by = raw ? JSON.parse(raw) : null;
      const entry = by && typeof by === "object" ? (by[String(cid)] || null) : null;
      return entry || null;
    } catch {
      return null;
    }
  };

  const inferPersona = (c: any): "recruiter" | "exec" | "manager" | "developer" | "sales" => {
    const title = String(c?.title || "").toLowerCase();
    const dept = String(c?.department || "").toLowerCase();
    const level = String(c?.level || "").toLowerCase();

    if (title.includes("recruit") || title.includes("talent") || dept.includes("recruit") || dept.includes("hr")) return "recruiter";
    if (title.includes("sales") || title.includes("account executive") || title.includes("rev") || dept.includes("sales")) return "sales";
    if (level.includes("c-") || title.includes("chief") || title.includes("cto") || title.includes("ceo") || title.includes("cfo")) return "exec";
    if (title.includes("vp") || title.includes("head of") || title.includes("director")) return "exec";
    if (title.includes("engineer") || title.includes("developer") || title.includes("sre") || title.includes("devops") || dept.includes("engineering")) return "developer";
    return "manager";
  };

  const pickComposeVariant = (persona: string): { subject?: string; body?: string } | null => {
    // Prefer helper variants (generated in Compose) that match the persona tone.
    const variants = (composeHelper?.variants || []) as any[];
    if (!Array.isArray(variants) || variants.length === 0) return null;

    const norm = (s: any) => String(s || "").toLowerCase();
    const scored = variants.map((v) => {
      const label = norm(v?.label);
      const audience = norm(v?.audience_tone);
      let score = 0;
      if (audience && audience.includes(persona)) score += 5;
      if (persona === "recruiter" && (label.includes("short") || label.includes("direct"))) score += 2;
      if (persona === "exec" && (label.includes("exec") || label.includes("roi") || label.includes("outcome"))) score += 2;
      if (persona === "developer" && (label.includes("dev") || label.includes("tech"))) score += 2;
      return { v, score };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0]?.v;
    if (!best) return null;
    return { subject: best.subject, body: best.body };
  };

  const buildFollowUps = (persona: string) => {
    // Returns the default templates for:
    // - Email 2: follow-up
    // - Email 3: follow-up (different angle)
    // - Email 4: breakup message
    if (persona === "recruiter") {
      return [
        {
          subject: "Re: {{job_title}} @ {{company_name}}",
          body: sign(
            `Hi {{first_name}},\n\n` +
              `Quick follow-up — is there a better person to route this to for the {{job_title}} role?\n\n` +
              `If helpful, I can share a 2–3 bullet plan for {{painpoint_1}}.`
          ),
        },
        {
          subject: "Follow-up — one more angle",
          body: sign(
            `Hi {{first_name}},\n\n` +
              `Following up once more — I can tailor my approach to {{painpoint_2}} (or the highest-priority gap on your side).\n\n` +
              `Would it help if I sent a short 3-bullet plan?`
          ),
        },
        {
          subject: "Breakup — should I close the loop?",
          body: sign(
            `Hi {{first_name}},\n\n` +
              `I don’t want to be a pest. If this isn’t a fit, no worries — just reply “no” and I’ll close the loop.\n\n` +
              `If it *is* a fit but you’re not the right person, who should I speak with?`
          ),
        },
      ];
    }
    if (persona === "exec") {
      return [
        {
          subject: "Re: {{company_name}} — {{painpoint_1}} idea",
          body: sign(
            `Hi {{first_name}},\n\n` +
              `Following up with one concrete angle: {{offer_snippet}}\n\n` +
              `If it’s useful, I can send a 2–3 bullet plan with expected impact and risks.`
          ),
        },
        {
          subject: "Follow-up — quick question",
          body: sign(
            `Hi {{first_name}},\n\n` +
              `Should I send a short 3-bullet plan, or is there someone on your team I should connect with instead?`
          ),
        },
        {
          subject: "Breakup — close the loop?",
          body: sign(
            `Hi {{first_name}},\n\n` +
              `Last note from me — if this isn’t a priority right now, totally fair. If so, I’ll stop reaching out.\n\n` +
              `If it *is* a priority, what’s the best next step?`
          ),
        },
      ];
    }
    if (persona === "developer") {
      return [
        {
          subject: "Re: {{job_title}} — implementation detail",
          body: sign(
            `Hi {{first_name}},\n\n` +
              `Quick follow-up with a concrete approach: {{offer_snippet}}\n\n` +
              `Happy to share a small implementation outline (tradeoffs + expected impact).`
          ),
        },
        {
          subject: "Follow-up — can I send a short outline?",
          body: sign(
            `Hi {{first_name}},\n\n` +
              `If helpful, I can send a short technical outline for {{painpoint_1}} (risks + tradeoffs + a metric to move).\n\n` +
              `Would that be useful?`
          ),
        },
        {
          subject: "Breakup — close the loop?",
          body: sign(
            `Hi {{first_name}},\n\n` +
              `Last follow-up from me — if this isn’t a fit, no worries, I’ll stop reaching out.\n\n` +
              `If it *is* a fit, I’m happy to share a quick outline and adapt it to your stack.`
          ),
        },
      ];
    }
    // manager/sales default
    return [
      {
        subject: "Re: {{job_title}} @ {{company_name}}",
        body: sign(
          `Hi {{first_name}},\n\n` +
            `Quick follow-up on my note about the {{job_title}} role at {{company_name}}.\n\n` +
            `If helpful, I can share a 2–3 bullet plan for {{painpoint_1}}.`
        ),
      },
      {
        subject: "Follow-up — one more angle",
        body: sign(
          `Hi {{first_name}},\n\n` +
            `Following up with one more angle: {{offer_snippet}}\n\n` +
            `If you’re open, I can send a short 3-bullet plan.`
        ),
      },
      {
        subject: "Breakup — close the loop?",
        body: sign(
          `Hi {{first_name}},\n\n` +
            `I haven’t heard back, so my guess is this isn’t a fit. No worries — I’ll stop reaching out.\n\n` +
            `If I should connect with someone else, who’s best?`
        ),
      },
    ];
  };

  const contactById = useMemo(() => {
    const m = new Map<string, any>();
    for (const c of Array.isArray(contacts) ? contacts : []) {
      const id = String(c?.id || "").trim();
      if (id) m.set(id, c);
    }
    return m;
  }, [contacts]);

  const buildVarMapForContact = (composedEmail: any, cid: string) => {
    const map: Record<string, string> = {};
    try {
      const vars = composedEmail?.variables || [];
      for (const v of vars) {
        if (v?.name) map[String(v.name)] = String(v.value ?? "");
      }
    } catch {}

    const c = contactById.get(String(cid || "").trim());
    const first = String(c?.name || "").trim().split(" ")[0] || "there";
    if (first) map["{{first_name}}"] = first;
    if (c?.company) map["{{company_name}}"] = String(c.company);
    if (c?.title) map["{{contact_title}}"] = String(c.title);

    const r = loadResearchForContact(cid);
    if (r?.company_summary?.description) map["{{company_summary}}"] = String(r.company_summary.description);
    if (r?.recent_news?.[0]?.summary) map["{{recent_news}}"] = String(r.recent_news[0].summary);
    if (r?.contact_bios?.[0]?.bio) map["{{contact_bio}}"] = String(r.contact_bios[0].bio);

    return map;
  };

  useEffect(() => {
    // Follow-ups enabled count (0..3): Email 2/3/4
    let initialFollowups = 2;
    try {
      const raw = localStorage.getItem("rf_campaign_followups_enabled_count");
      const n = Number(raw);
      if (Number.isFinite(n)) initialFollowups = Math.min(3, Math.max(0, n));
    } catch {}
    setFollowupsEnabledCount(initialFollowups);

    // Load mode from localStorage
    const stored = localStorage.getItem("rf_mode");
    if (stored === 'recruiter') {
      setMode('recruiter');
    }
    
    // Load contacts for per-contact editing.
    // Prefer `selected_contacts`, but also include any persisted researched contacts so users can
    // generate sequences for previously researched people (even across sessions).
    try {
      const selected = JSON.parse(localStorage.getItem("selected_contacts") || "[]");
      const hist = readResearchHistory();
      setResearchHistory(hist);
      const merged = mergeContacts(Array.isArray(selected) ? selected : [], hist);
      setContacts(merged);

      // Keep localStorage selected_contacts aligned so Launch sees the same contact set.
      try {
        if (merged.length) localStorage.setItem("selected_contacts", JSON.stringify(merged));
      } catch {}

      // Restore last active contact if we have one
      const savedActive = String(localStorage.getItem("campaign_active_contact_id") || "").trim();
      const fallbackId = merged?.[0]?.id ? String(merged[0].id) : "";
      setActiveContactId((savedActive && merged.some((c: any) => String(c?.id || "") === savedActive)) ? savedActive : (fallbackId || null));
    } catch {}

    // Load helper suggestions from Compose
    const helperRaw = localStorage.getItem("compose_helper");
    if (helperRaw) {
      try { setComposeHelper(JSON.parse(helperRaw)); } catch {}
    }

    // Ensure rf_user exists so follow-up emails don't show "[Your Name]" after refresh.
    (async () => {
      try {
        const existing = localStorage.getItem("rf_user");
        if (existing) return;
        const me = await api<any>("/auth/me", "GET");
        if (me?.success && me?.user) {
          localStorage.setItem("rf_user", JSON.stringify(me.user));
        }
      } catch {
        // ignore
      }
    })();

    // Load previously generated per-contact campaigns if present (so switching contacts changes content immediately)
    try {
      const byRaw = localStorage.getItem("campaign_by_contact");
      const by = byRaw ? JSON.parse(byRaw) : null;
      if (by && typeof by === "object") {
        setCampaignByContact(by);
      }
    } catch {}
    
    // Load composed email from previous step and generate a per-contact campaign set if needed
    try {
      const composedEmail = localStorage.getItem('composed_email');
      if (composedEmail) {
        const emailData = JSON.parse(composedEmail);
        const list = (() => {
          try {
            const selected = JSON.parse(localStorage.getItem("selected_contacts") || "[]");
            const hist = readResearchHistory();
            return mergeContacts(Array.isArray(selected) ? selected : [], hist);
          } catch {
            return [];
          }
        })();
        // If we don't already have saved per-contact campaigns (or the seed changed), generate them.
        const existing = (() => {
          try { return JSON.parse(localStorage.getItem("campaign_by_contact") || "null"); } catch { return null; }
        })();
        const hasExisting = existing && typeof existing === "object" && Object.keys(existing).length > 0;
        const existingKeys = hasExisting ? Object.keys(existing) : [];
        const missing = list.filter((c: any) => c?.id && !existingKeys.includes(String(c.id))).length > 0;

        const seed = campaignSeed(emailData, list);
        const prevSeed = String(localStorage.getItem("campaign_seed") || "");
        const seedChanged = seed && seed !== prevSeed;

        if (!hasExisting || missing || seedChanged) {
          generateCampaign(emailData, list, initialFollowups);
          try {
            if (seed) localStorage.setItem("campaign_seed", seed);
          } catch {}
        }
      }
    } catch {}
    
    // Listen for mode changes
    const handleModeChange = (event: CustomEvent) => {
      setMode(event.detail);
    };
    
    window.addEventListener('modeChanged', handleModeChange as EventListener);
    return () => window.removeEventListener('modeChanged', handleModeChange as EventListener);
  }, []);

  useEffect(() => {
    // Build stamp (debug): confirms whether Railway is serving the latest frontend build.
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
  }, []);

  const generateCampaign = async (composedEmail: any, contactList?: any[], followUpCountOverride?: number) => {
    setIsGenerating(true);
    setError(null);

    try {
      // Keep this snappy (this page is already "the editor").
      await new Promise(resolve => setTimeout(resolve, 250));

      const selectedContacts = Array.isArray(contactList) ? contactList : (() => {
        try {
          const sel = JSON.parse(localStorage.getItem("selected_contacts") || "[]");
          return Array.isArray(sel) ? sel : [];
        } catch {
          return [];
        }
      })();
      const now = new Date().toISOString();
      const byContact: Record<string, Campaign> = {};
      const followCount = Number.isFinite(Number(followUpCountOverride))
        ? Math.min(3, Math.max(0, Number(followUpCountOverride)))
        : followupsEnabledCount;
      for (const c of selectedContacts) {
        const cid = String(c?.id || "");
        if (!cid) continue;
        const persona = inferPersona(c);
        const v = pickComposeVariant(persona);
        const followUps = buildFollowUps(persona);
        const varMap = buildVarMapForContact(composedEmail, cid);

        const email1Subject = String(v?.subject || composedEmail.subject || "").trim() || "{{job_title}} at {{company_name}} — quick idea";
        const email1Body = String(v?.body || composedEmail.body || "").trim() || composedEmail.body;

        const delayByStep: Record<number, { days: number; hours: number }> = {
          1: { days: 0, hours: 0 },
          2: { days: 2, hours: 0 },
          3: { days: 4, hours: 0 },
          4: { days: 7, hours: 0 },
        };

        const emails: EmailStep[] = [];
        emails.push({
          id: `email_1_${cid}`,
          step_number: 1,
          subject: applyVariables(email1Subject, varMap),
          body: applyVariables(email1Body, varMap),
          delay_days: delayByStep[1].days,
          delay_hours: delayByStep[1].hours,
          stop_on_reply: true,
          variables: {},
        });

        for (let step = 2; step <= 1 + followCount; step++) {
          const idx = step - 2;
          const tpl = followUps[idx];
          if (!tpl) continue;
          emails.push({
            id: `email_${step}_${cid}`,
            step_number: step,
            subject: applyVariables(String(tpl.subject || ""), varMap),
            body: applyVariables(String(tpl.body || ""), varMap),
            delay_days: delayByStep[step]?.days ?? 0,
            delay_hours: delayByStep[step]?.hours ?? 0,
            stop_on_reply: true,
            variables: {},
            template_variant_index: 0,
          });
        }

        byContact[cid] = {
          id: `campaign_${cid}`,
          name: `${mode === 'job-seeker' ? 'Job Application' : 'Candidate Pitch'} Campaign • ${String(c?.name || "").split(" ")[0] || "Contact"}`,
          status: 'draft',
          emails: emails.map((e) => ({ ...e })),
          created_at: now,
          updated_at: now,
          followups_enabled_count: followCount,
        };
      }
      setCampaignByContact(byContact);
      try {
        localStorage.setItem("campaign_by_contact", JSON.stringify(byContact));
      } catch {}
    } catch (err) {
      setError("Failed to generate campaign. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const updateEmailStep = (stepId: string, updates: Partial<EmailStep>) => {
    if (!activeContactId) return;
    setCampaignByContact((prev) => {
      const cur = prev[activeContactId];
      if (!cur) return prev;
      const updatedEmails = cur.emails.map((email) => (email.id === stepId ? { ...email, ...updates } : email));
      return { ...prev, [activeContactId]: { ...cur, emails: updatedEmails, updated_at: new Date().toISOString() } };
    });
  };

  const setFollowupsCountAllContacts = (nextCount: number) => {
    const n = Math.min(3, Math.max(0, Number(nextCount) || 0));
    setFollowupsEnabledCount(n);
    try {
      localStorage.setItem("rf_campaign_followups_enabled_count", String(n));
    } catch {}

    const composed = (() => {
      try {
        const raw = localStorage.getItem("composed_email");
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();

    setCampaignByContact((prev) => {
      const out: Record<string, Campaign> = {};
      for (const [cid, cur] of Object.entries(prev || {})) {
        const contact = contactById.get(String(cid));
        const persona = inferPersona(contact);
        const followUps = buildFollowUps(persona);
        const varMap = buildVarMapForContact(composed, cid);

        const keep: EmailStep[] = (cur?.emails || [])
          .filter((e) => Number(e.step_number) === 1 || (Number(e.step_number) >= 2 && Number(e.step_number) <= 1 + n))
          .sort((a, b) => a.step_number - b.step_number)
          .map((e) => ({ ...e }));

        const haveSteps = new Set(keep.map((e) => Number(e.step_number)));
        const delayByStep: Record<number, { days: number; hours: number }> = {
          1: { days: 0, hours: 0 },
          2: { days: 2, hours: 0 },
          3: { days: 4, hours: 0 },
          4: { days: 7, hours: 0 },
        };

        for (let step = 2; step <= 1 + n; step++) {
          if (haveSteps.has(step)) continue;
          const idx = step - 2;
          const tpl = followUps[idx];
          if (!tpl) continue;
          keep.push({
            id: `email_${step}_${cid}`,
            step_number: step,
            subject: applyVariables(String(tpl.subject || ""), varMap),
            body: applyVariables(String(tpl.body || ""), varMap),
            delay_days: delayByStep[step]?.days ?? 0,
            delay_hours: delayByStep[step]?.hours ?? 0,
            stop_on_reply: true,
            variables: {},
            template_variant_index: 0,
          });
        }

        keep.sort((a, b) => a.step_number - b.step_number);

        out[cid] = {
          ...(cur as Campaign),
          emails: keep,
          updated_at: new Date().toISOString(),
          followups_enabled_count: n,
        };
      }
      try {
        localStorage.setItem("campaign_by_contact", JSON.stringify(out));
      } catch {}
      return out;
    });

    // If we reduced the length, ensure the selected step is still valid.
    setActiveStepNumber((s) => Math.min(s, 1 + n));
  };

  const resetActiveFollowUpToTemplate = (stepNumber: number) => {
    if (!activeContactId) return;
    if (stepNumber < 2 || stepNumber > 4) return;
    const cid = String(activeContactId);
    const contact = contactById.get(cid);
    const persona = inferPersona(contact);
    const followUps = buildFollowUps(persona);
    const tpl = followUps[stepNumber - 2];
    if (!tpl) return;
    const composed = (() => {
      try {
        const raw = localStorage.getItem("composed_email");
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();
    const varMap = buildVarMapForContact(composed, cid);
    const target = campaign?.emails?.find((e) => Number(e.step_number) === stepNumber);
    if (!target) return;
    updateEmailStep(target.id, {
      subject: applyVariables(String(tpl.subject || ""), varMap),
      body: applyVariables(String(tpl.body || ""), varMap),
      template_variant_index: 0,
    });
  };

  const handleContinue = () => {
    if (campaign) {
      try {
        localStorage.setItem('campaign_by_contact', JSON.stringify(campaignByContact));
        if (activeContactId) localStorage.setItem('campaign_active_contact_id', String(activeContactId));
      } catch {}
      localStorage.setItem('campaign_data', JSON.stringify(campaign));
      router.push('/deliverability-launch');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-4">
          <a href="/compose" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
            <span className="mr-2">←</span> Back to Compose
          </a>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Email Campaign Sequence</h1>
            <p className="text-white/70">
              {mode === 'job-seeker' 
                ? `Your outreach sequence (${1 + followupsEnabledCount} email${1 + followupsEnabledCount === 1 ? "" : "s"}).`
                : `Your candidate pitch sequence (${1 + followupsEnabledCount} email${1 + followupsEnabledCount === 1 ? "" : "s"}).`
              }
            </p>
            {buildStamp ? (
              <div className="mt-2 text-[11px] text-white/40 font-mono">
                {buildStamp}
              </div>
            ) : null}
          </div>

          {isGenerating ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Generating Campaign...</h3>
              <p className="text-white/70">Creating your 3-email sequence with optimal timing and messaging.</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Error</h3>
              <p className="text-white/70 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : campaign ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Contacts column (wireframe-style) */}
              <div className="lg:col-span-3">
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="text-sm font-bold text-white">Contacts</div>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          const composedRaw = localStorage.getItem("composed_email");
                          if (!composedRaw) return;
                          const emailData = JSON.parse(composedRaw);
                          generateCampaign(emailData, contacts);
                          const seed = campaignSeed(emailData, contacts);
                          if (seed) localStorage.setItem("campaign_seed", seed);
                        } catch {}
                      }}
                      className="text-[11px] underline text-white/70 hover:text-white"
                      title="Regenerate sequences for all contacts using the latest Compose draft"
                    >
                      Regenerate
                    </button>
                  </div>
                  {contacts.length === 0 ? (
                    <div className="text-sm text-white/60">No contacts selected.</div>
                  ) : (
                    <div className="space-y-2">
                      {contacts.map((c: any) => {
                        const cid = String(c?.id || "");
                        const active = cid && cid === String(activeContactId || "");
                        const title = String(c?.title || "").trim();
                        const company = String(c?.company || "").trim();
                        return (
                          <button
                            key={cid || String(c?.email || Math.random())}
                            type="button"
                            onClick={() => {
                              if (!cid) return;
                              setActiveContact(cid);
                            }}
                            className={`w-full text-left rounded-lg border p-3 transition-colors ${
                              active
                                ? "border-blue-400/60 bg-blue-500/10"
                                : "border-white/10 bg-white/5 hover:bg-white/10"
                            }`}
                          >
                            <div className="text-sm font-semibold text-white">{String(c?.name || "Contact")}</div>
                            <div className="text-xs text-white/60">
                              {(title ? title : "Decision maker") + (company ? ` • ${company}` : "")}
                            </div>
                            {campaignByContact?.[cid] ? (
                              <div className="mt-1 text-[10px] text-emerald-200/80">Sequence ready</div>
                            ) : (
                              <div className="mt-1 text-[10px] text-white/40">Not generated yet</div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Main editor */}
              <div className="lg:col-span-9 space-y-8">
              {/* Email 1 source (Compose) */}
              <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-white">Email 1 comes from Compose</div>
                    <div className="text-xs text-white/60 mt-1">
                      Compose is for crafting the primary message. Campaign is for sequencing (follow-ups, timing, and per-contact personalization).
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        if (activeContactId) {
                          localStorage.setItem("context_research_active_contact_id", String(activeContactId));
                          localStorage.setItem("campaign_active_contact_id", String(activeContactId));
                        }
                      } catch {}
                      router.push("/compose");
                    }}
                    className="shrink-0 px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                  >
                    Edit Email 1 in Compose →
                  </button>
                </div>
              </div>

              {composeHelper?.variants?.length > 0 && (
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="text-sm font-bold text-white">Smart Helper: variants (full)</div>
                    {composeHelper?.rationale && (
                      <div className="text-xs text-white/60">{composeHelper.rationale}</div>
                    )}
                  </div>
                  <div className="space-y-3 text-sm">
                    {composeHelper.variants.map((v: any, idx: number) => (
                      <div key={`${v.label || "variant"}_${idx}`} className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-white/90 font-semibold">
                              {v.label || `variant_${idx + 1}`}
                              {v.audience_tone ? (
                                <span className="ml-2 text-xs text-white/60">({v.audience_tone})</span>
                              ) : null}
                            </div>
                            {v.intended_for ? (
                              <div className="mt-1 text-xs text-white/60">{v.intended_for}</div>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!campaign) return;
                              const first = campaign.emails.find((e) => e.step_number === 1);
                              if (!first) return;
                              const composed = (() => {
                                try {
                                  const raw = localStorage.getItem("composed_email");
                                  return raw ? JSON.parse(raw) : null;
                                } catch {
                                  return null;
                                }
                              })();
                              const varMap = buildVarMapForContact(composed, String(activeContactId || ""));
                              updateEmailStep(first.id, {
                                subject: applyVariables(String(v.subject || first.subject), varMap),
                                body: applyVariables(String(v.body || first.body), varMap),
                              });
                            }}
                            className="shrink-0 px-3 py-2 rounded-md bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                            disabled={!campaign}
                          >
                            Use as Email 1
                          </button>
                        </div>
                        <div className="mt-2 text-white/80">Subject: {v.subject}</div>
                        <pre className="mt-2 whitespace-pre-wrap text-white/70">{String(v.body || "")}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Campaign Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">{campaign.name}</h2>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                      {campaign.status.toUpperCase()}
                    </span>
                    <span className="text-sm text-white/70">
                      {campaign.emails.length} emails • {campaign.emails.reduce((total, email) => total + email.delay_days, 0)} days total
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="text-xs text-white/60">
                  Selecting a contact switches to their sequence (follow-ups vary by persona, and we avoid showing raw placeholders here).
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-white/60 mr-1">Include:</div>
                  {[
                    { step: 2, label: "Email 2" },
                    { step: 3, label: "Email 3" },
                    { step: 4, label: "Email 4 (breakup)" },
                  ].map((x) => {
                    const enabled = followupsEnabledCount >= x.step - 1;
                    return (
                      <button
                        key={`fu_${x.step}`}
                        type="button"
                        onClick={() => {
                          const next = enabled ? (x.step - 2) : (x.step - 1);
                          setFollowupsCountAllContacts(next);
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          enabled
                            ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/25"
                            : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        {x.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Email Steps (single-pane editor to avoid overwhelming "brackets everywhere") */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Email Sequence</h3>
                {(() => {
                  const sorted = [...(campaign.emails || [])].sort((a, b) => a.step_number - b.step_number);
                  const activeEmail = sorted.find((e) => Number(e.step_number) === Number(activeStepNumber)) || sorted[0] || null;
                  if (!activeEmail) return <div className="text-sm text-white/70">No emails in this campaign.</div>;
                  const fmtDelay = (email: EmailStep) => {
                    const days = Number(email.delay_days || 0) || 0;
                    const hours = Number((email as any)?.delay_hours || 0) || 0;
                    if (days > 0) return `${days} day${days === 1 ? "" : "s"} later`;
                    if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"} later`;
                    return "Immediate";
                  };
                  return (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                      <div className="lg:col-span-4">
                        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                          <div className="text-sm font-semibold text-white/85">Emails</div>
                          <div className="mt-2 space-y-2">
                            {sorted.map((email) => {
                              const active = Number(email.step_number) === Number(activeEmail.step_number);
                              return (
                                <button
                                  key={`step_${email.id}`}
                                  type="button"
                                  onClick={() => setActiveStepNumber(Number(email.step_number))}
                                  className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                                    active ? "border-orange-400/50 bg-orange-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-semibold text-white/90">Email {email.step_number}</div>
                                    <div className="text-[11px] text-white/60">{fmtDelay(email)}</div>
                                  </div>
                                  <div className="mt-1 text-xs text-white/60 truncate">
                                    {String(email.subject || "").trim() || "(no subject)"}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="lg:col-span-8">
                        <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                              <div className="text-sm font-bold text-white">Email {activeEmail.step_number}</div>
                              <div className="text-xs text-white/60 mt-1">{fmtDelay(activeEmail)}</div>
                            </div>
                            {Number(activeEmail.step_number) >= 2 ? (
                              <button
                                type="button"
                                onClick={() => resetActiveFollowUpToTemplate(Number(activeEmail.step_number))}
                                className="shrink-0 px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white/80 text-xs font-semibold hover:bg-white/10"
                              >
                                Reset to template
                              </button>
                            ) : null}
                          </div>

                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-white/80 mb-2">
                                Subject
                              </label>
                              <input
                                type="text"
                                value={activeEmail.subject}
                                onChange={(e) => updateEmailStep(activeEmail.id, { subject: e.target.value })}
                                className="w-full rounded-md px-3 py-2 bg-white/5 border border-white/10 text-white"
                              />
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-white/80 mb-2">
                                Body
                              </label>
                              <textarea
                                value={activeEmail.body}
                                onChange={(e) => updateEmailStep(activeEmail.id, { body: e.target.value })}
                                className="w-full rounded-md px-3 py-2 bg-white/5 border border-white/10 text-white h-44"
                              />
                            </div>

                            <div className="flex items-center justify-between gap-3">
                              <label className="flex items-center gap-2 text-xs text-white/70">
                                <input
                                  type="checkbox"
                                  checked={activeEmail.stop_on_reply}
                                  onChange={(e) => updateEmailStep(activeEmail.id, { stop_on_reply: e.target.checked })}
                                />
                                Stop on reply
                              </label>
                              <div className="text-xs text-white/60">Timing</div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-white/80 mb-2">
                                  Delay (Days)
                                </label>
                                <input
                                  type="number"
                                  value={activeEmail.delay_days}
                                  onChange={(e) => updateEmailStep(activeEmail.id, { delay_days: parseInt(e.target.value) || 0 })}
                                  className="w-full rounded-md px-3 py-2 bg-white/5 border border-white/10 text-white"
                                  min="0"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-white/80 mb-2">
                                  Delay (Hours)
                                </label>
                                <input
                                  type="number"
                                  value={activeEmail.delay_hours}
                                  onChange={(e) => updateEmailStep(activeEmail.id, { delay_hours: parseInt(e.target.value) || 0 })}
                                  className="w-full rounded-md px-3 py-2 bg-white/5 border border-white/10 text-white"
                                  min="0"
                                  max="23"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => router.push('/compose')}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-md font-medium hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleContinue}
                  className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                >
                  Continue to Launch
                </button>
              </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Campaign Data</h3>
              <p className="text-gray-600 mb-6">
                Please complete the Compose step first to generate your campaign.
              </p>
              <button
                onClick={() => router.push('/compose')}
                className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                Go to Compose
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
