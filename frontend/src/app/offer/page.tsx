"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import InlineSpinner from "@/components/InlineSpinner";
import { api } from "@/lib/api";

type OfferCaseStudy = {
  title: string;
  problem: string;
  actions: string;
  impact: string;
};

type OfferV1 = {
  version: 1;
  updated_at: string;
  one_liner: string;
  proof_points: string[]; // 3-6 bullets
  case_studies: OfferCaseStudy[]; // 0-2
  credibility: string[]; // short tags
  default_cta: string;
  soft_cta?: string;
  hard_cta?: string;
  snippet: string; // compiled preview
};

const STORAGE_KEY = "rf_offer_v1";
const STORAGE_BY_JOB_KEY = "rf_offer_v1_by_job";

type JobDescription = {
  id: string;
  title: string;
  company: string;
  url?: string;
  content?: string;
  painPoints?: string[];
  requiredSkills?: string[];
  successMetrics?: string[];
  responsibilities?: string[];
  requirements?: string[];
};

type PainPointMatchLite = {
  painpoint_1?: string;
  solution_1?: string;
  metric_1?: string;
  painpoint_2?: string;
  solution_2?: string;
  metric_2?: string;
  painpoint_3?: string;
  solution_3?: string;
  metric_3?: string;
  alignment_score?: number;
};

type ComposeOfferSnippetResponse = {
  success: boolean;
  message: string;
  snippet: string;
  used_llm?: boolean;
};

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

function clampLines(s: string, maxChars: number) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars).trim();
}

function normalizeNoEmDash(s: string) {
  // Em/en dashes can read as "AI-generated". Prefer commas/colons.
  return String(s || "")
    .replace(/[—–]+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function metricLine(metric: any, value: any, context: any) {
  const m = normalizeNoEmDash(String(metric || ""));
  const v = normalizeNoEmDash(String(value || ""));
  const c = normalizeNoEmDash(String(context || ""));
  const endSentence = (s: string) => {
    const t = String(s || "").trim();
    if (!t) return "";
    return /[.!?]$/.test(t) ? t : `${t}.`;
  };
  if (m && v && c) {
    const byPart = /^by\b/i.test(v) ? `${m} ${v}` : `${m} by ${v}`;
    return `${endSentence(byPart)} ${endSentence(c)}`.trim();
  }
  if (m && v) {
    const byPart = /^by\b/i.test(v) ? `${m} ${v}` : `${m} by ${v}`;
    return endSentence(byPart);
  }
  if (m && c) return `${endSentence(m)} ${endSentence(c)}`.trim();
  return m || v || c;
}

function buildSnippet(d: {
  one_liner: string;
  proof_points: string[];
  case_studies: OfferCaseStudy[];
  soft_cta: string;
  hard_cta: string;
}) {
  const one = clampLines(d.one_liner, 220);
  const proofs = (d.proof_points || []).map((x) => clampLines(x, 140)).filter(Boolean).slice(0, 3);
  const cs = (d.case_studies || []).filter((c) => c && (c.problem || c.actions || c.impact));
  const softCta = clampLines(d.soft_cta, 140);
  const hardCta = clampLines(d.hard_cta, 140);

  const parts: string[] = [];
  if (one) parts.push(one);
  if (proofs.length) parts.push(`Proof: ${proofs.join(" • ")}`);
  if (cs.length) {
    const c0 = cs[0];
    const bit = [c0.problem, c0.actions, c0.impact].map((x) => clampLines(x, 110)).filter(Boolean).join(" → ");
    if (bit) parts.push(`Example: ${bit}`);
  }
  if (softCta) parts.push(`Soft CTA: ${softCta}`);
  if (hardCta) parts.push(`Hard CTA: ${hardCta}`);
  return parts.join("\n");
}

function deriveCredibilitySignals(resume: any, roleSkills: string[]): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    const t = String(s || "").trim();
    if (!t) return;
    if (!out.includes(t)) out.push(t);
  };

  const skills = Array.isArray(resume?.skills)
    ? resume.skills.map((x: any) => String(x || "").trim()).filter(Boolean)
    : [];
  const skillsLow = skills.map((s: string) => s.toLowerCase());
  const overlap = (roleSkills || []).filter((s) => skillsLow.includes(String(s || "").toLowerCase())).slice(0, 2);
  if (overlap.length) push(`Role-skill overlap: ${overlap.join(" + ")}`);

  const positions = Array.isArray(resume?.positions) ? resume.positions : [];
  const titles = positions.map((p: any) => String(p?.title || "").trim()).filter(Boolean);
  const titlesLow = titles.map((t: string) => t.toLowerCase()).join(" | ");
  if (/\b(architect|principal|staff)\b/.test(titlesLow)) push("Architecture-level ownership");
  if (/\b(manager|lead|director|head)\b/.test(titlesLow)) push("Cross-functional leadership");

  if (skillsLow.some((s: string) => ["aws", "azure", "gcp", "kubernetes", "docker", "terraform"].some((k) => s.includes(k)))) {
    push("Cloud/platform delivery");
  }
  if (skillsLow.some((s: string) => ["python", "react", "fastapi", "sql", "typescript", "node"].some((k) => s.includes(k)))) {
    push("Hands-on software engineering");
  }

  const metrics = Array.isArray(resume?.keyMetrics) ? resume.keyMetrics : [];
  if (metrics.length) push("Measurable outcomes delivered");
  const accomplishments = Array.isArray(resume?.accomplishments) ? resume.accomplishments : [];
  if (accomplishments.length && !out.includes("Measurable outcomes delivered")) push("Track record of shipped results");

  return out.slice(0, 3);
}

export default function OfferPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [roles, setRoles] = useState<JobDescription[]>([]);
  const [activeRoleId, setActiveRoleId] = useState<string>("");

  const [oneLiner, setOneLiner] = useState("");
  const [proofPoints, setProofPoints] = useState<string[]>(["", "", ""]);
  const [caseStudies, setCaseStudies] = useState<OfferCaseStudy[]>([
    { title: "Case study 1", problem: "", actions: "", impact: "" },
    { title: "Case study 2", problem: "", actions: "", impact: "" },
  ]);
  const [credibility, setCredibility] = useState<string[]>([]);
  const [credInput, setCredInput] = useState("");
  const [softCta, setSoftCta] = useState("Worth exploring, or totally not a priority right now?");
  const [defaultCta, setDefaultCta] = useState("Open to a 10-minute chat this week?");
  const [aiSnippet, setAiSnippet] = useState("");
  const [isGeneratingSnippet, setIsGeneratingSnippet] = useState(false);
  const [showStepHelp, setShowStepHelp] = useState(false);

  // Pull best-effort context for suggestions (no extra API calls).
  const resume = useMemo(() => safeJson<any>(typeof window !== "undefined" ? localStorage.getItem("resume_extract") : null, null), []);
  const prefs = useMemo(() => safeJson<any>(typeof window !== "undefined" ? localStorage.getItem("job_preferences") : null, null), []);
  const selectedRole = useMemo(() => safeJson<any>(typeof window !== "undefined" ? localStorage.getItem("selected_job_description") : null, null), []);
  const selectedRoleId = useMemo(() => String(typeof window !== "undefined" ? localStorage.getItem("selected_job_description_id") : "" || "").trim(), []);
  const painpointByJob = useMemo(
    () => safeJson<Record<string, PainPointMatchLite[]>>(typeof window !== "undefined" ? localStorage.getItem("painpoint_matches_by_job") : null, {}),
    []
  );

  const activeRole = useMemo(() => {
    const id = String(activeRoleId || "").trim();
    return roles.find((r) => String(r.id || "") === id) || roles[0] || null;
  }, [roles, activeRoleId]);

  function loadOfferToState(saved: OfferV1 | null) {
    const roleSkills = (Array.isArray(activeRole?.requiredSkills) ? activeRole.requiredSkills : [])
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, 4);
    const autoCredibility = deriveCredibilitySignals(resume, roleSkills);

    if (saved?.version === 1) {
      setOneLiner(normalizeNoEmDash(String(saved.one_liner || "")));
      setProofPoints(
        Array.isArray(saved.proof_points) && saved.proof_points.length
          ? saved.proof_points.map((p) => normalizeNoEmDash(String(p || "")))
          : ["", "", ""]
      );
      setCaseStudies(
        Array.isArray(saved.case_studies) && saved.case_studies.length
          ? saved.case_studies.slice(0, 2).map((c, idx) => ({
              title: String(c?.title || `Case study ${idx + 1}`),
              problem: normalizeNoEmDash(String(c?.problem || "")),
              actions: normalizeNoEmDash(String(c?.actions || "")),
              impact: normalizeNoEmDash(String(c?.impact || "")),
            }))
          : [
              { title: "Case study 1", problem: "", actions: "", impact: "" },
              { title: "Case study 2", problem: "", actions: "", impact: "" },
            ]
      );
      const savedCred = Array.isArray(saved.credibility) ? saved.credibility.map((x) => String(x || "").trim()).filter(Boolean) : [];
      setCredibility(savedCred.length ? savedCred : autoCredibility);
      setSoftCta(String(saved.soft_cta || "Worth exploring, or totally not a priority right now?"));
      setDefaultCta(String(saved.hard_cta || saved.default_cta || "Open to a 10-minute chat this week?"));
      return;
    }

    // First-time helpful defaults (role-specific).
    const title = String(activeRole?.title || selectedRole?.title || "").trim();
    const company = String(activeRole?.company || selectedRole?.company || "").trim();
    const industry = Array.isArray(prefs?.industries) ? String(prefs.industries[0] || "").trim() : "";
    const roleSkills = (Array.isArray(activeRole?.requiredSkills) ? activeRole?.requiredSkills : [])
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, 4);
    const resumeSkills = Array.isArray(resume?.skills) ? resume.skills.map((x: any) => String(x || "").trim()).filter(Boolean) : [];
    const overlap = roleSkills.filter((s) => resumeSkills.some((r: string) => r.toLowerCase() === s.toLowerCase())).slice(0, 2);
    const painpoints = (Array.isArray(activeRole?.painPoints) ? activeRole?.painPoints : [])
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, 2);
    const outcome = painpoints[0] ? clampLines(painpoints[0], 90) : "get important work done faster";

    const seed = [
      title ? `For ${title}${company ? ` at ${company}` : ""}: I help teams ${outcome}.` : "",
      overlap.length ? `Strengths: ${overlap.join(" + ")}.` : roleSkills.length ? `Strengths: ${roleSkills.slice(0, 2).join(" + ")}.` : "",
      industry ? `Context: ${industry}.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    setOneLiner(seed);

    // Seed proof points with resume metrics (role-specific flavor).
    const km = Array.isArray(resume?.keyMetrics) ? resume.keyMetrics : [];
    const metricLines = km
      .slice(0, 2)
      .map((m: any) => metricLine(m?.metric, m?.value, m?.context))
      .map((s: string) => clampLines(s, 140))
      .filter(Boolean);
    const pp3 = roleSkills.length ? `Relevant skills: ${roleSkills.slice(0, 3).join(", ")}.` : "";
    const nextProof = [metricLines[0] || "", metricLines[1] || "", pp3 || ""].filter((_, i) => i < 3);
    while (nextProof.length < 3) nextProof.push("");
    setProofPoints(nextProof.slice(0, 3));

    // Seed a micro-case-study from Pain Point Match (if available for this role).
    const m0 = (painpointByJob as any)?.[String(activeRoleId || "")]?.[0] as PainPointMatchLite | undefined;
    setCaseStudies([
      {
        title: "Case study 1",
        problem: clampLines(String(m0?.painpoint_1 || ""), 180),
        actions: clampLines(String(m0?.solution_1 || ""), 180),
        impact: clampLines(String(m0?.metric_1 || ""), 140),
      },
      { title: "Case study 2", problem: "", actions: "", impact: "" },
    ]);
    setCredibility(autoCredibility);
    setSoftCta("Worth exploring, or totally not a priority right now?");
    setDefaultCta("Open to a 10-minute chat this week?");
  }

  const roleSignals = useMemo(() => {
    const r = activeRole;
    const skills = (Array.isArray(r?.requiredSkills) ? r?.requiredSkills : []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 8);
    const pains = (Array.isArray(r?.painPoints) ? r?.painPoints : []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 6);
    const metrics = (Array.isArray(r?.successMetrics) ? r?.successMetrics : []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 6);
    const match0 = (activeRoleId && (painpointByJob as any)?.[activeRoleId]?.[0]) ? ((painpointByJob as any)[activeRoleId][0] as PainPointMatchLite) : null;
    return { skills, pains, metrics, match0 };
  }, [activeRole, activeRoleId, painpointByJob]);

  const persistOfferForRole = (roleId: string, payload: OfferV1, opts?: { updateLegacy?: boolean }) => {
    const rid = String(roleId || "").trim() || "default";
    const byJob = safeJson<Record<string, OfferV1>>(localStorage.getItem(STORAGE_BY_JOB_KEY), {});
    const nextBy = { ...(byJob || {}), [rid]: payload };
    localStorage.setItem(STORAGE_BY_JOB_KEY, JSON.stringify(nextBy));
    if (opts?.updateLegacy) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      localStorage.setItem("offer_snippet", payload.snippet);
    }
  };

  const saveDraftToCurrentRole = (opts?: { silent?: boolean; updateLegacy?: boolean }) => {
    try {
      const rid = String(activeRoleId || "").trim() || String(activeRole?.id || "").trim() || "default";
      const payload: OfferV1 = {
        version: 1,
        updated_at: nowIso(),
        one_liner: normalizeNoEmDash(String(oneLiner || "").trim()),
        proof_points: (proofPoints || []).map((x) => normalizeNoEmDash(String(x || "").trim())).filter(Boolean).slice(0, 6),
        case_studies: (caseStudies || [])
          .map((c) => ({
            title: String(c?.title || "").trim() || "Case study",
            problem: normalizeNoEmDash(String(c?.problem || "").trim()),
            actions: normalizeNoEmDash(String(c?.actions || "").trim()),
            impact: normalizeNoEmDash(String(c?.impact || "").trim()),
          }))
          .filter((c) => c.problem || c.actions || c.impact)
          .slice(0, 2),
        credibility: (credibility || []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 10),
        default_cta: String(defaultCta || "").trim(),
        soft_cta: String(softCta || "").trim(),
        hard_cta: String(defaultCta || "").trim(),
        snippet,
      };
      persistOfferForRole(rid, payload, { updateLegacy: Boolean(opts?.updateLegacy) });
      if (!opts?.silent) {
        setNotice("Saved offer for this role.");
        window.setTimeout(() => setNotice(null), 1600);
      }
    } catch {}
  };

  useEffect(() => {
    try {
      const jds = safeJson<JobDescription[]>(localStorage.getItem("job_descriptions"), []);
      setRoles(Array.isArray(jds) ? jds : []);

      // Choose initial active role:
      const fallbackId = String((jds?.[0] as any)?.id || "").trim();
      const init = selectedRoleId || String(selectedRole?.id || "").trim() || fallbackId;
      if (init) setActiveRoleId(init);

      // Migrate legacy single-offer into per-role store (best-effort).
      const legacy = safeJson<OfferV1 | null>(localStorage.getItem(STORAGE_KEY), null);
      const byJob = safeJson<Record<string, OfferV1>>(localStorage.getItem(STORAGE_BY_JOB_KEY), {});
      if (legacy?.version === 1) {
        const key = init || "default";
        if (key && !(byJob as any)[key]) {
          const nextBy = { ...(byJob || {}), [key]: legacy };
          localStorage.setItem(STORAGE_BY_JOB_KEY, JSON.stringify(nextBy));
        }
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load offer for active role (role-specific).
  useEffect(() => {
    if (!activeRoleId) return;
    try {
      const byJob = safeJson<Record<string, OfferV1>>(localStorage.getItem(STORAGE_BY_JOB_KEY), {});
      const saved = (byJob as any)?.[activeRoleId] || null;
      loadOfferToState(saved);
    } catch {
      loadOfferToState(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoleId]);

  const deterministicSnippet = useMemo(
    () => buildSnippet({ one_liner: oneLiner, proof_points: proofPoints, case_studies: caseStudies, soft_cta: softCta, hard_cta: defaultCta }),
    [oneLiner, proofPoints, caseStudies, softCta, defaultCta]
  );
  const snippet = (aiSnippet || deterministicSnippet || "").trim();

  const suggestedMetrics = useMemo(() => {
    const km = Array.isArray(resume?.keyMetrics) ? resume.keyMetrics : [];
    return km
      .slice(0, 6)
      .map((m: any) => metricLine(m?.metric, m?.value, m?.context))
      .map((s: string) => clampLines(s, 140))
      .filter(Boolean);
  }, [resume]);

  const suggestedSkills = useMemo(() => {
    const skills = Array.isArray(resume?.skills) ? resume.skills : [];
    const uniq = Array.from(new Set(skills.map((s: any) => String(s || "").trim()).filter(Boolean)));
    return uniq.slice(0, 10);
  }, [resume]);

  const addCredibility = (text: string) => {
    const t = String(text || "").trim();
    if (!t) return;
    setCredibility((prev) => Array.from(new Set([...(prev || []), t])).slice(0, 10));
    setCredInput("");
  };

  const save = (next?: { goNext?: boolean }) => {
    setIsSaving(true);
    try {
      const payload: OfferV1 = {
        version: 1,
        updated_at: nowIso(),
        one_liner: normalizeNoEmDash(String(oneLiner || "").trim()),
        proof_points: (proofPoints || []).map((x) => normalizeNoEmDash(String(x || "").trim())).filter(Boolean).slice(0, 6),
        case_studies: (caseStudies || [])
          .map((c) => ({
            title: String(c?.title || "").trim() || "Case study",
            problem: normalizeNoEmDash(String(c?.problem || "").trim()),
            actions: normalizeNoEmDash(String(c?.actions || "").trim()),
            impact: normalizeNoEmDash(String(c?.impact || "").trim()),
          }))
          .filter((c) => c.problem || c.actions || c.impact)
          .slice(0, 2),
        credibility: (credibility || []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 10),
        default_cta: String(defaultCta || "").trim(),
        soft_cta: String(softCta || "").trim(),
        hard_cta: String(defaultCta || "").trim(),
        snippet,
      };
      const key = String(activeRoleId || "").trim() || String(activeRole?.id || "").trim() || "default";
      persistOfferForRole(key, payload, { updateLegacy: true });
      setNotice("Saved offer for this role.");
    } catch {
      // ignore storage failures
    } finally {
      setIsSaving(false);
    }
    if (next?.goNext) {
      router.push("/company-research");
    }
  };

  const composeSnippetWithAI = async () => {
    setIsGeneratingSnippet(true);
    try {
      const res = await api<ComposeOfferSnippetResponse>("/offer-creation/compose-snippet", "POST", {
        one_liner: oneLiner,
        proof_points: proofPoints,
        case_studies: caseStudies,
        default_cta: defaultCta,
        soft_cta: softCta,
        hard_cta: defaultCta,
        role_title: String(activeRole?.title || "").trim(),
        role_company: String(activeRole?.company || "").trim(),
        required_skills: Array.isArray(activeRole?.requiredSkills) ? activeRole.requiredSkills : [],
        pain_points: Array.isArray(activeRole?.painPoints) ? activeRole.painPoints : [],
        success_metrics: Array.isArray(activeRole?.successMetrics) ? activeRole.successMetrics : [],
      });
      const s = String(res?.snippet || "").trim();
      if (s) {
        setAiSnippet(s);
        setNotice("AI snippet updated.");
        window.setTimeout(() => setNotice(null), 1200);
      }
    } catch {
      // Keep deterministic fallback visible.
      setNotice("Couldn’t generate AI snippet right now. Using fallback.");
      window.setTimeout(() => setNotice(null), 1500);
    } finally {
      setIsGeneratingSnippet(false);
    }
  };

  useEffect(() => {
    // Role-specific snippets should refresh when switching roles.
    setAiSnippet("");
    if (!activeRole) return;
    if (!String(oneLiner || "").trim() && !(proofPoints || []).some((p) => String(p || "").trim())) return;
    const t = window.setTimeout(() => {
      composeSnippetWithAI();
    }, 200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoleId]);

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
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">Offer - Value Proposition</h1>
                <p className="text-white/70">
                  This is the core story RoleFerry uses in your emails. It’s not your resume. It’s the{" "}
                  <span className="font-semibold text-white/80">why you</span>, in plain language.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStepHelp((v) => !v)}
                className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xs font-bold text-white/85 hover:bg-white/15"
                title="What this step fixes"
                aria-label="What this step fixes"
              >
                ?
              </button>
            </div>
            {showStepHelp ? (
              <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-bold text-white">What this step fixes</div>
                <ul className="mt-2 space-y-1 text-sm text-white/70">
                  <li>- Prevents polite but generic emails by giving the AI a real spine.</li>
                  <li>- Keeps your story consistent across contacts, roles, and follow-ups.</li>
                  <li>- Makes personalization credible: you reference proof, not just research.</li>
                </ul>
              </div>
            ) : null}
            <div className="mt-3 text-sm text-white/70">
              {activeRole ? (
                <>
                  Editing offer for: <span className="font-semibold text-white">{activeRole.title}</span>{" "}
                  <span className="text-white/50">@</span>{" "}
                  <span className="font-semibold text-white">{String(activeRole.company || "").trim() || "—"}</span>
                </>
              ) : (
                <>Select a role on the left to write a role-specific offer.</>
              )}
            </div>
            {notice ? <div className="mt-2 text-[11px] text-emerald-200/90">{notice}</div> : null}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
                <div className="px-3 py-2 border-b border-white/10 bg-white/5">
                  <div className="text-xs font-semibold text-white/70 uppercase tracking-wider">Roles</div>
                  <div className="mt-1 text-[11px] text-white/60">
                    Pick a role, then write an offer tailored to that role.
                  </div>
                </div>
                <div className="max-h-[640px] overflow-auto">
                  {(roles || []).map((r) => {
                    const isActive = String(activeRoleId) === String(r.id);
                    return (
                      <button
                        key={`offer_role_${r.id}`}
                        type="button"
                        onClick={() => {
                          const nextId = String(r.id || "");
                          if (nextId && nextId !== activeRoleId) {
                            // Prevent "oops I switched roles and lost my work".
                            saveDraftToCurrentRole({ silent: true, updateLegacy: false });
                            setActiveRoleId(nextId);
                            setNotice("Switched roles.");
                            window.setTimeout(() => setNotice(null), 900);
                          }
                        }}
                        className={`w-full text-left px-3 py-3 border-b border-white/10 hover:bg-white/5 transition-colors ${
                          isActive ? "bg-white/5" : ""
                        }`}
                      >
                        <div className="text-sm font-bold text-white truncate">{r.title}</div>
                        <div className="text-xs text-white/60 truncate">{String(r.company || "").trim() || "—"}</div>
                        {String(r.id || "") === (selectedRoleId || "") ? (
                          <div className="mt-1 inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                            Saved role (from Gaps)
                          </div>
                        ) : null}
                      </button>
                    );
                  })}
                  {!roles?.length ? (
                    <div className="p-4 text-sm text-white/60">
                      No roles found yet. Go back to <a className="underline" href="/job-descriptions">Role Search</a>.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-white">Offer snippet (auto)</div>
                    <div className="mt-1 text-[11px] text-white/60">AI-composed from your role signals + proof points. Campaign reuses this across emails.</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={composeSnippetWithAI}
                      disabled={isGeneratingSnippet}
                      className="text-[11px] font-semibold rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-white/80 hover:bg-white/10 disabled:opacity-50 inline-flex items-center gap-1.5"
                      title="Regenerate snippet with AI"
                    >
                      {isGeneratingSnippet ? <InlineSpinner className="h-3 w-3" /> : null}
                      <span>{isGeneratingSnippet ? "Generating" : "Regenerate (AI)"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          navigator.clipboard.writeText(snippet || "");
                        } catch {}
                      }}
                      className="text-[11px] font-semibold rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-white/80 hover:bg-white/10"
                      title="Copy snippet"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-md border border-white/10 bg-black/30 p-3 text-[12px] text-white/85 min-h-[140px]">
                  {snippet || "Start with a one-liner + 3 proof points to generate your snippet."}
                </pre>
                <div className="mt-2 text-[11px] text-white/55">
                  Variable:{" "}
                  <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                    {"{{offer.snippet}}"}
                  </code>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 p-5">
                <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">Call-to-Action Strategy</div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="rounded-md border border-white/10 bg-white/5 p-3">
                    <div className="text-sm font-bold text-amber-200">Strong / Hard CTA</div>
                    <div className="mt-1 text-[11px] text-white/60">Ask for clear commitment (time, scheduling, or decision).</div>
                    <input
                      value={defaultCta}
                      onChange={(e) => setDefaultCta(e.target.value)}
                      className="mt-2 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Can we do 15 minutes next week — Tue 11am or Thu 2pm?"
                    />
                    <div className="mt-2 text-[11px] text-white/55">
                      Variable:{" "}
                      <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                        {"{{offer.hard_cta}}"}
                      </code>
                    </div>
                  </div>
                  <div className="rounded-md border border-white/10 bg-white/5 p-3">
                    <div className="text-sm font-bold text-sky-200">Soft CTA</div>
                    <div className="mt-1 text-[11px] text-white/60">Ask for a low-friction response (easy yes/no or routing).</div>
                    <input
                      value={softCta}
                      onChange={(e) => setSoftCta(e.target.value)}
                      className="mt-2 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Worth exploring, or totally not a priority right now?"
                    />
                    <div className="mt-2 text-[11px] text-white/55">
                      Variable:{" "}
                      <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                        {"{{offer.soft_cta}}"}
                      </code>
                    </div>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-white/55">
                  Legacy variable (maps to hard CTA):{" "}
                  <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                    {"{{offer.default_cta}}"}
                  </code>
                </div>
              </div>

            </div>

            <div className="lg:col-span-7 space-y-6">
              {(roleSignals.skills.length || roleSignals.pains.length || roleSignals.metrics.length) ? (
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">Role signals (from this posting)</div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-5">
                      <div className="text-xs font-bold text-sky-200 mb-1.5">Pain Points</div>
                      <div className="flex flex-wrap gap-1.5">
                        {roleSignals.pains.slice(0, 4).map((p) => (
                          <button
                            key={`rp_${p}`}
                            type="button"
                            onClick={() =>
                              setCaseStudies((prev) => {
                                const next = [...(prev || [])];
                                const c0 = next[0] || { title: "Case study 1", problem: "", actions: "", impact: "" };
                                if (!String(c0.problem || "").trim()) next[0] = { ...c0, problem: p };
                                else {
                                  // fallback: add as a proof point
                                  setProofPoints((pps) => {
                                    const arr = [...(pps || [])];
                                    const idx = arr.findIndex((x) => !String(x || "").trim());
                                    const t = idx >= 0 ? idx : Math.min(arr.length - 1, 5);
                                    arr[t] = `Pain point: ${clampLines(p, 120)}`;
                                    return arr.slice(0, 6);
                                  });
                                }
                                return next;
                              })
                            }
                            className="px-2 py-1 rounded-full border border-white/10 bg-black/30 text-[10px] text-white/80 hover:bg-black/40"
                            title="Insert"
                          >
                            + {clampLines(p, 36)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-3">
                      <div className="text-xs font-bold text-violet-200 mb-1.5">Required Skills</div>
                      <div className="flex flex-wrap gap-1.5">
                        {roleSignals.skills.slice(0, 6).map((s) => (
                          <button
                            key={`rs_${s}`}
                            type="button"
                            onClick={() =>
                              setProofPoints((prev) => {
                                const next = [...(prev || [])];
                                const idx = next.findIndex((x) => !String(x || "").trim());
                                const t = idx >= 0 ? idx : Math.min(next.length - 1, 5);
                                next[t] = String(next[t] || "").trim() ? next[t] : `Relevant: ${s}`;
                                return next.slice(0, 6);
                              })
                            }
                            className="px-2 py-1 rounded-full border border-white/10 bg-black/30 text-[10px] text-white/80 hover:bg-black/40"
                            title="Insert into proof points"
                          >
                            + {clampLines(s, 22)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-4">
                      <div className="text-xs font-bold text-emerald-200 mb-1.5">Success Metrics</div>
                      <div className="flex flex-wrap gap-1.5">
                        {roleSignals.metrics.slice(0, 4).map((m) => (
                          <button
                            key={`rm_${m}`}
                            type="button"
                            onClick={() =>
                              setCaseStudies((prev) => {
                                const next = [...(prev || [])];
                                const c0 = next[0] || { title: "Case study 1", problem: "", actions: "", impact: "" };
                                if (!String(c0.impact || "").trim()) next[0] = { ...c0, impact: m };
                                else setDefaultCta((x) => x); // no-op; keep UX consistent
                                return next;
                              })
                            }
                            className="px-2 py-1 rounded-full border border-white/10 bg-black/30 text-[10px] text-white/80 hover:bg-black/40"
                            title="Insert into case study impact"
                          >
                            + {clampLines(m, 28)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              ) : null}

              <div className="rounded-lg border border-white/10 bg-black/20 p-5">
                <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">One-liner</div>
                <textarea
                  value={oneLiner}
                  onChange={(e) => setOneLiner(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Example: I help data teams deliver reliable analytics faster by building pragmatic pipelines and clear stakeholder alignment."
                />
                <div className="mt-2 text-[11px] text-white/55">
                  Variable:{" "}
                  <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                    {"{{offer.one_liner}}"}
                  </code>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-white/70 uppercase tracking-wider">Proof points (3–6)</div>
                    <div className="mt-1 text-[11px] text-white/55">Think: metrics, wins, “I’ve done this before” statements. Not responsibilities.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProofPoints((prev) => ([...(prev || []), ""]).slice(0, 6))}
                    className="text-[11px] font-semibold rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-white/80 hover:bg-white/10"
                  >
                    + Add
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {proofPoints.map((p, idx) => (
                    <div key={`pp_${idx}`} className="flex items-start gap-2">
                      <div className="mt-2 text-[11px] text-white/50 tabular-nums w-5">{idx + 1}.</div>
                      <input
                        value={p}
                        onChange={(e) => {
                          const v = e.target.value;
                          setProofPoints((prev) => prev.map((x, i) => (i === idx ? v : x)));
                        }}
                        className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Example: Reduced pipeline runtime by 42% by re-architecting batch jobs + ownership."
                      />
                      <button
                        type="button"
                        onClick={() => setProofPoints((prev) => prev.filter((_, i) => i !== idx))}
                        className="mt-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[11px] text-white/55">
                  Variable:{" "}
                  <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                    {"{{offer.proof_points[]}}"}
                  </code>
                </div>

                {(suggestedMetrics.length || suggestedSkills.length) ? (
                  <div className="mt-4 rounded-md border border-white/10 bg-white/5 p-3">
                    <div className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">Quick inserts (from your resume)</div>
                    {suggestedMetrics.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {suggestedMetrics.slice(0, 6).map((m) => (
                          <button
                            key={`m_${m}`}
                            type="button"
                            onClick={() =>
                              setProofPoints((prev) => {
                                const next = [...(prev || [])];
                                const idx = next.findIndex((x) => !String(x || "").trim());
                                const target = idx >= 0 ? idx : Math.min(next.length - 1, 5);
                                next[target] = m;
                                return next.slice(0, 6);
                              })
                            }
                            className="px-2 py-1 rounded-full border border-white/10 bg-black/20 text-[11px] text-white/80 hover:bg-black/30"
                            title="Insert into proof points"
                          >
                            + {m}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {suggestedSkills.length ? (
                      <div className="mt-3 text-[11px] text-white/60">
                        Skills: <span className="text-white/75">{suggestedSkills.join(", ")}</span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 p-5">
                <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">Micro case studies (optional)</div>
                <div className={`grid grid-cols-1 ${caseStudies.length > 1 ? "md:grid-cols-2" : "md:grid-cols-1"} gap-4`}>
                  {caseStudies.map((c, idx) => (
                    <div key={`cs_${idx}`} className="rounded-md border border-white/10 bg-white/5 p-3">
                      <div className="text-[11px] font-bold text-white/80">{c.title || `Case study ${idx + 1}`}</div>
                      <div className="mt-2 space-y-2">
                        <input
                          value={c.problem}
                          onChange={(e) => setCaseStudies((prev) => prev.map((x, i) => (i === idx ? { ...x, problem: e.target.value } : x)))}
                          className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Problem (what was broken?)"
                        />
                        <input
                          value={c.actions}
                          onChange={(e) => setCaseStudies((prev) => prev.map((x, i) => (i === idx ? { ...x, actions: e.target.value } : x)))}
                          className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Actions (what did you do?)"
                        />
                        <input
                          value={c.impact}
                          onChange={(e) => setCaseStudies((prev) => prev.map((x, i) => (i === idx ? { ...x, impact: e.target.value } : x)))}
                          className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Impact (what changed?)"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[11px] text-white/55">
                  Variable:{" "}
                  <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                    {"{{offer.case_studies[]}}"}
                  </code>
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 p-5">
                <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">Credibility / Trust Signal(s) (optional)</div>
                <div className="flex items-center gap-2">
                  <input
                    value={credInput}
                    onChange={(e) => setCredInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCredibility(credInput);
                      }
                    }}
                    className="flex-1 rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder='Examples: "ex-Google", "AWS cert", "built HIPAA pipeline"'
                  />
                  <button
                    type="button"
                    onClick={() => addCredibility(credInput)}
                    className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
                  >
                    Add
                  </button>
                </div>
                {credibility.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {credibility.map((c) => (
                      <button
                        key={`cred_${c}`}
                        type="button"
                        onClick={() => setCredibility((prev) => prev.filter((x) => x !== c))}
                        className="px-2 py-1 rounded-full border border-white/10 bg-black/20 text-[11px] text-white/80 hover:bg-black/30"
                        title="Click to remove"
                      >
                        {c} <span className="text-white/50">×</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-white/55">Add 1–3 tags that make your claim feel real.</div>
                )}
                <div className="mt-2 text-[11px] text-white/55">
                  Variable:{" "}
                  <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                    {"{{offer.credibility[]}}"}
                  </code>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/personality")}
                  className="rounded-md border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => save({ goNext: true })}
                  disabled={isSaving}
                  className={`px-6 py-3 rounded-md font-semibold transition-colors disabled:opacity-50 inline-flex items-center gap-2 ${
                    isSaving ? "bg-blue-700 text-white/90" : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                  title="Save your offer and continue"
                >
                  {isSaving ? (
                    <>
                      <InlineSpinner className="h-3.5 w-3.5" />
                      <span>Saving</span>
                    </>
                  ) : (
                    "Save & Continue"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
