"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCompanyName } from "@/lib/format";
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

function ensureSentenceEnd(s: string): string {
  const t = String(s || "").trim();
  if (!t) return "";
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

function lowerFirst(s: string): string {
  if (!s) return "";
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function painPointToOutcome(raw: string): string {
  let s = String(raw || "").trim();
  if (!s) return "";
  s = s
    .replace(/^(the\s+)?need\s+for\s+(a\s+)?/i, "build ")
    .replace(/^(the\s+)?need\s+to\s+/i, "")
    .replace(/^(the\s+)?lack\s+of\s+(a\s+)?/i, "strengthen ")
    .replace(/^(the\s+)?absence\s+of\s+(a\s+)?/i, "establish ")
    .replace(/^(the\s+)?challenge\s+of\s+/i, "tackle ")
    .replace(/^(the\s+)?difficulty\s+(of|in)\s+/i, "simplify ")
    .replace(/^(the\s+)?requirement\s+(for|to)\s+/i, "deliver ")
    .replace(/\.\s*$/, "")
    .trim();
  s = lowerFirst(s);
  if (/^(a|an|the|better|more|improved|scalable|robust|reliable|strong|new|solid|effective)\s/i.test(s)) {
    s = `build ${s}`;
  }
  // Gerund phrases ("enhancing developer productivity") → strip gerund, prepend verb
  if (/^[a-z]\w+ing\s/i.test(s) && !/^(build|deliver|establish|strengthen|tackle|simplify|turn)/i.test(s)) {
    const rest = s.slice(s.indexOf(" ") + 1).trim();
    if (rest) s = `elevate ${rest}`;
  }
  if (s.length > 60) {
    const short = s.split(/[,;]/)[0]?.trim();
    if (short && short.length >= 15) s = short;
  }
  return s;
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

  const parts: string[] = [];
  if (one) parts.push(ensureSentenceEnd(one));

  if (proofs.length) {
    parts.push(proofs.map((p) => ensureSentenceEnd(p)).join(" "));
  }

  if (cs.length) {
    const c0 = cs[0];
    const problem = clampLines(c0.problem, 110);
    const actions = clampLines(c0.actions, 110);
    const impact = clampLines(c0.impact, 110);
    if (problem && actions && impact) {
      parts.push(
        `${ensureSentenceEnd(problem)} I addressed this by ${lowerFirst(ensureSentenceEnd(actions))} The result: ${lowerFirst(ensureSentenceEnd(impact))}`
      );
    } else if (problem && actions) {
      parts.push(`${ensureSentenceEnd(problem)} I addressed this by ${lowerFirst(ensureSentenceEnd(actions))}`);
    } else if (problem) {
      parts.push(ensureSentenceEnd(problem));
    }
  }

  return parts.join("\n\n");
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

function emptyOffer(): OfferV1 {
  return {
    version: 1,
    updated_at: nowIso(),
    one_liner: "",
    proof_points: [],
    case_studies: [],
    credibility: [],
    default_cta: "",
    soft_cta: "",
    hard_cta: "",
    snippet: "",
  };
}

export default function OfferPage() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [roles, setRoles] = useState<JobDescription[]>([]);
  const [activeRoleId, setActiveRoleId] = useState<string>("");
  const [savedRoleIds, setSavedRoleIds] = useState<Set<string>>(new Set());

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
  const [collapsedSubs, setCollapsedSubs] = useState<Set<string>>(new Set());

  const [resume, setResume] = useState<any>(null);
  const [prefs, setPrefs] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [painpointByJob, setPainpointByJob] = useState<Record<string, PainPointMatchLite[]>>({});
  const [companySignals, setCompanySignals] = useState<any[]>([]);
  const [contactSignals, setContactSignals] = useState<any[]>([]);

  useEffect(() => {
    setResume(safeJson<any>(localStorage.getItem("resume_extract"), null));
    setPrefs(safeJson<any>(localStorage.getItem("job_preferences"), null));
    setSelectedRole(safeJson<any>(localStorage.getItem("selected_job_description"), null));
    setSelectedRoleId(String(localStorage.getItem("selected_job_description_id") || "").trim());
    setPainpointByJob(safeJson<Record<string, PainPointMatchLite[]>>(localStorage.getItem("painpoint_matches_by_job"), {}));
    setCompanySignals(safeJson<any[]>(localStorage.getItem("rf_selected_company_signals"), []));
    setContactSignals(safeJson<any[]>(localStorage.getItem("rf_selected_contact_signals"), []));
  }, []);

  const activeRole = useMemo(() => {
    const id = String(activeRoleId || "").trim();
    return roles.find((r) => String(r.id || "") === id) || null;
  }, [roles, activeRoleId]);

  function loadOfferToState(saved: OfferV1 | null) {
    const roleSkills = (Array.isArray(activeRole?.requiredSkills) ? activeRole.requiredSkills : [])
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, 4);
    const autoCredibility = deriveCredibilitySignals(resume, roleSkills);

    const looksLikeOldOneLiner = (s: string) => {
      const t = String(s || "");
      return /My strengths include/i.test(t) || /Background in/i.test(t) || /Strengths:/i.test(t) || /Context:/i.test(t) || /^For .+ at .+:/i.test(t);
    };

    const needsOneLinerReseed = !saved?.version || looksLikeOldOneLiner(String(saved?.one_liner || ""));

    if (saved?.version === 1) {
      if (!needsOneLinerReseed) {
        setOneLiner(normalizeNoEmDash(String(saved.one_liner || "")));
      }
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
      if (!needsOneLinerReseed) return;
    }

    const title = String(activeRole?.title || selectedRole?.title || "").trim();
    const company = String(activeRole?.company || selectedRole?.company || "").trim();
    const resumeSkills = Array.isArray(resume?.skills) ? resume.skills.map((x: any) => String(x || "").trim()).filter(Boolean) : [];
    const overlap = roleSkills.filter((s) => resumeSkills.some((r: string) => r.toLowerCase() === s.toLowerCase())).slice(0, 2);
    const painpoints = (Array.isArray(activeRole?.painPoints) ? activeRole?.painPoints : [])
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .slice(0, 2);

    const outcomeRaw = painpoints[0] ? painPointToOutcome(clampLines(painpoints[0], 90)) : "";
    const skillPhrase = overlap.length
      ? overlap.join(" and ")
      : roleSkills.length
        ? roleSkills.slice(0, 2).join(" and ")
        : "";

    let seed = "";
    if (outcomeRaw) {
      seed = `I ${outcomeRaw}.`;
    } else if (title && skillPhrase) {
      seed = `${title} who turns ${skillPhrase} into real results.`;
    } else if (title) {
      seed = `${title} who helps teams ship what matters.`;
    } else if (skillPhrase) {
      seed = `I turn ${skillPhrase} into real results.`;
    }
    seed = seed.replace(/\.\./g, ".").replace(/^i\s/i, "I ");

    setOneLiner(seed);

    if (saved?.version === 1) return;

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
    setSavedRoleIds((prev) => new Set([...prev, rid]));
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

      const byJob = safeJson<Record<string, OfferV1>>(localStorage.getItem(STORAGE_BY_JOB_KEY), {});
      setSavedRoleIds(new Set(Object.keys(byJob).filter((k) => (byJob as any)[k]?.version === 1)));

      // Migrate legacy single-offer into per-role store (best-effort).
      const legacy = safeJson<OfferV1 | null>(localStorage.getItem(STORAGE_KEY), null);
      if (legacy?.version === 1) {
        const fallbackId = String((jds?.[0] as any)?.id || "").trim();
        const init = selectedRoleId || String(selectedRole?.id || "").trim() || fallbackId;
        if (init && !(byJob as any)[init]) {
          const nextBy = { ...(byJob || {}), [init]: legacy };
          localStorage.setItem(STORAGE_BY_JOB_KEY, JSON.stringify(nextBy));
          setSavedRoleIds((prev) => new Set([...prev, init]));
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const suggestedCaseStudies = useMemo(() => {
    const out: Array<{ problem: string; actions: string; impact: string }> = [];
    const seen = new Set<string>();

    const positions = Array.isArray(resume?.positions) ? resume.positions : [];
    const accomplishments = Array.isArray(resume?.accomplishments) ? resume.accomplishments : [];
    const km = Array.isArray(resume?.keyMetrics) ? resume.keyMetrics : [];

    for (const pos of positions.slice(0, 4)) {
      const desc = String(pos?.description || "").trim();
      const bullets = Array.isArray(pos?.accomplishments)
        ? pos.accomplishments.map((a: any) => String(a || "").trim()).filter(Boolean)
        : desc ? desc.split(/[•\n]/).map((s: string) => s.trim()).filter((s: string) => s.length > 20) : [];
      for (const b of bullets.slice(0, 2)) {
        const key = b.toLowerCase().slice(0, 40);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ problem: "", actions: clampLines(b, 120), impact: "" });
      }
    }

    for (const acc of accomplishments.slice(0, 4)) {
      const text = String(acc?.text || acc || "").trim();
      if (!text || text.length < 15) continue;
      const key = text.toLowerCase().slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ problem: "", actions: clampLines(text, 120), impact: "" });
    }

    for (const m of km.slice(0, 3)) {
      const line = metricLine(m?.metric, m?.value, m?.context);
      if (!line) continue;
      const key = line.toLowerCase().slice(0, 40);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ problem: "", actions: "", impact: clampLines(line, 120) });
    }

    return out.slice(0, 6);
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
      if (activeRoleId) {
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
      }
    } catch {} finally {
      setIsSaving(false);
    }
    if (next?.goNext) {
      router.push("/bio-page");
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
        company_signals: companySignals,
        contact_signals: contactSignals,
      });
      const s = String(res?.snippet || "").trim();
      if (s) {
        setAiSnippet(s);
        setNotice("AI snippet updated.");
        window.setTimeout(() => setNotice(null), 1200);
      }
    } catch {
      setNotice("Couldn't generate AI snippet right now. Using fallback.");
      window.setTimeout(() => setNotice(null), 1500);
    } finally {
      setIsGeneratingSnippet(false);
    }
  };

  useEffect(() => {
    setAiSnippet("");
    if (!activeRole) return;
    if (!String(oneLiner || "").trim() && !(proofPoints || []).some((p) => String(p || "").trim())) return;
    const t = window.setTimeout(() => {
      composeSnippetWithAI();
    }, 200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoleId]);

  const toggleRole = (roleId: string) => {
    const id = String(roleId || "").trim();
    if (id === activeRoleId) {
      saveDraftToCurrentRole({ silent: true, updateLegacy: false });
      setActiveRoleId("");
    } else {
      if (activeRoleId) saveDraftToCurrentRole({ silent: true, updateLegacy: false });
      setActiveRoleId(id);
    }
  };

  const applyToAllRoles = (field: "one_liner" | "proof_points" | "case_studies" | "credibility" | "cta") => {
    try {
      const byJob = safeJson<Record<string, OfferV1>>(localStorage.getItem(STORAGE_BY_JOB_KEY), {});

      for (const role of roles) {
        const rid = String(role.id || "").trim();
        if (!rid) continue;
        const existing: OfferV1 = byJob[rid] || emptyOffer();

        switch (field) {
          case "one_liner":
            existing.one_liner = normalizeNoEmDash(String(oneLiner || "").trim());
            break;
          case "proof_points":
            existing.proof_points = (proofPoints || []).map((x) => normalizeNoEmDash(String(x || "").trim())).filter(Boolean).slice(0, 6);
            break;
          case "case_studies":
            existing.case_studies = (caseStudies || [])
              .map((c) => ({
                title: String(c?.title || "").trim() || "Case study",
                problem: normalizeNoEmDash(String(c?.problem || "").trim()),
                actions: normalizeNoEmDash(String(c?.actions || "").trim()),
                impact: normalizeNoEmDash(String(c?.impact || "").trim()),
              }))
              .filter((c) => c.problem || c.actions || c.impact)
              .slice(0, 2);
            break;
          case "credibility":
            existing.credibility = (credibility || []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 10);
            break;
          case "cta":
            existing.soft_cta = String(softCta || "").trim();
            existing.hard_cta = String(defaultCta || "").trim();
            existing.default_cta = String(defaultCta || "").trim();
            break;
        }

        existing.updated_at = nowIso();
        existing.version = 1;
        byJob[rid] = existing;
      }

      localStorage.setItem(STORAGE_BY_JOB_KEY, JSON.stringify(byJob));
      setSavedRoleIds(new Set(Object.keys(byJob)));
      setNotice(`Applied to all ${roles.length} roles.`);
      window.setTimeout(() => setNotice(null), 1600);
    } catch {}
  };

  const toggleSub = (key: string) =>
    setCollapsedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const subHeader = (label: string, subKey: string, extra?: React.ReactNode) => {
    const open = !collapsedSubs.has(subKey);
    return (
      <button
        type="button"
        onClick={() => toggleSub(subKey)}
        className="w-full flex items-center gap-2 text-left group"
      >
        <svg
          className={`w-2.5 h-2.5 text-white/50 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
        <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">{label}</span>
        {extra}
      </button>
    );
  };

  const defaultAllBtn = (field: "one_liner" | "proof_points" | "case_studies" | "credibility" | "cta") => (
    <div className="flex justify-end mt-2">
      <button
        type="button"
        onClick={() => applyToAllRoles(field)}
        className="text-[10px] font-bold text-white hover:text-blue-300 border border-white/25 rounded-md px-2.5 py-1 hover:bg-white/10 transition-colors whitespace-nowrap"
      >
        Default for All Roles
      </button>
    </div>
  );

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-4">
          <a href="/find-contact" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
            <span className="mr-2">&larr;</span> Back to Contact
          </a>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">Offer &ndash; Value Proposition</h1>
                <p className="text-white/70">
                  This is the core story RoleFerry uses in your emails. It&rsquo;s not your resume. It&rsquo;s the{" "}
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
            {notice ? <div className="mt-2 text-[11px] text-emerald-200/90">{notice}</div> : null}
          </div>

          {/* Section heading */}
          <div className="mb-3">
            <div className="text-xs font-semibold text-white/70 uppercase tracking-wider">Roles</div>
            <div className="mt-1 text-[11px] text-white/60">
              Expand a role to craft its value proposition. Use <span class="font-bold text-white">Default for All Roles</span> at the bottom of each section to apply it across every role.
            </div>
          </div>

          {/* Role cards */}
          {!roles.length ? (
            <div className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm text-white/60">
              No roles found yet. Go back to <a className="underline" href="/job-descriptions">Role Search</a>.
            </div>
          ) : (
            <div className="space-y-1">
              {roles.map((r) => {
                const isOpen = activeRoleId === String(r.id || "");
                const hasSaved = savedRoleIds.has(String(r.id || ""));
                const isFromGaps = String(r.id || "") === (selectedRoleId || "");
                return (
                  <div key={`offer_role_${r.id}`} className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
                    {/* Collapsed header */}
                    <button
                      type="button"
                      onClick={() => toggleRole(r.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
                    >
                      <svg
                        className={`w-3 h-3 text-white/40 shrink-0 transition-transform ${isOpen ? "rotate-90" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white truncate">{r.title}</span>
                          <span className="text-xs text-white/50 truncate">{formatCompanyName(String(r.company || ""))}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isFromGaps ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-blue-400/20 bg-blue-500/10 text-[10px] text-blue-200">
                            From Gaps
                          </span>
                        ) : null}
                        {hasSaved ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 text-[10px] text-emerald-200">
                            Saved
                          </span>
                        ) : null}
                      </div>
                    </button>

                    {/* Expanded content */}
                    {isOpen && (
                      <div className="border-t border-white/5 px-4 pb-5" style={{ paddingLeft: 14 }}>
                        {/* ── Role Signals ── */}
                        {(roleSignals.skills.length > 0 || roleSignals.pains.length > 0 || roleSignals.metrics.length > 0) ? (
                          <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4" style={{ marginLeft: 12 }}>
                            {subHeader("Role Signals", `${r.id}:signals`)}
                            {!collapsedSubs.has(`${r.id}:signals`) && (
                            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
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
                              <div>
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
                              <div>
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
                            )}
                          </div>
                        ) : null}

                        {/* ── One-liner ── */}
                        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4" style={{ marginLeft: 12 }}>
                          {subHeader("One-liner", `${r.id}:oneliner`)}
                          {!collapsedSubs.has(`${r.id}:oneliner`) && (
                          <div className="mt-2">
                            <div className="text-[10px] text-white/40 mb-2">One punchy sentence that brands you. Think tagline, not resume.</div>
                            <textarea
                              value={oneLiner}
                              onChange={(e) => setOneLiner(e.target.value)}
                              rows={3}
                              className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Example: I build scalable data platforms that turn raw pipelines into reliable business decisions."
                            />
                            <div className="mt-2 text-[11px] text-white/55">
                              Variable:{" "}
                              <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                                {"{{offer.one_liner}}"}
                              </code>
                            </div>
                            {defaultAllBtn("one_liner")}
                          </div>
                          )}
                        </div>

                        {/* ── Proof Points ── */}
                        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4" style={{ marginLeft: 12 }}>
                          {subHeader("Proof Points", `${r.id}:proof`, (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setProofPoints((prev) => ([...(prev || []), ""]).slice(0, 6)); }}
                              className="ml-auto text-[11px] font-semibold rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-white/80 hover:bg-white/10 shrink-0"
                            >
                              + Add
                            </button>
                          ))}
                          {!collapsedSubs.has(`${r.id}:proof`) && (
                          <div className="mt-2">
                          <div className="mb-2 text-[11px] text-white/55">Think: metrics, wins, &ldquo;I&rsquo;ve done this before&rdquo; statements.</div>
                          <div className="space-y-2">
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
                                  &times;
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

                          {/* Quick inserts */}
                          {suggestedMetrics.length > 0 || suggestedSkills.length > 0 ? (
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
                          {defaultAllBtn("proof_points")}
                          </div>
                          )}
                        </div>

                        {/* ── Case Studies ── */}
                        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4" style={{ marginLeft: 12 }}>
                          {subHeader("Micro Case Studies", `${r.id}:cases`)}
                          {!collapsedSubs.has(`${r.id}:cases`) && (
                          <div className="mt-2">
                          <div className={`grid grid-cols-1 ${caseStudies.length > 1 ? "md:grid-cols-2" : "md:grid-cols-1"} gap-4`}>
                            {caseStudies.map((c, idx) => (
                              <div key={`cs_${idx}`} className="rounded-md border border-white/10 bg-black/20 p-3">
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

                          {/* Quick inserts for case studies */}
                          {suggestedCaseStudies.length > 0 ? (
                            <div className="mt-4 rounded-md border border-white/10 bg-white/5 p-3">
                              <div className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">Quick inserts (from your resume)</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {suggestedCaseStudies.map((s, si) => {
                                  const label = clampLines(s.actions || s.impact || s.problem, 60);
                                  if (!label) return null;
                                  return (
                                    <button
                                      key={`csq_${si}`}
                                      type="button"
                                      onClick={() =>
                                        setCaseStudies((prev) => {
                                          const next = [...(prev || [])];
                                          const idx = next.findIndex(
                                            (x) => !String(x.problem || "").trim() && !String(x.actions || "").trim() && !String(x.impact || "").trim()
                                          );
                                          const target = idx >= 0 ? idx : 0;
                                          next[target] = {
                                            ...next[target],
                                            problem: s.problem || next[target].problem,
                                            actions: s.actions || next[target].actions,
                                            impact: s.impact || next[target].impact,
                                          };
                                          return next;
                                        })
                                      }
                                      className="px-2 py-1 rounded-full border border-white/10 bg-black/20 text-[11px] text-white/80 hover:bg-black/30"
                                      title="Insert into case study"
                                    >
                                      + {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                          {defaultAllBtn("case_studies")}
                          </div>
                          )}
                        </div>

                        {/* ── Credibility & Trust Signals ── */}
                        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4" style={{ marginLeft: 12 }}>
                          {subHeader("Credibility & Trust Signals", `${r.id}:cred`)}
                          {!collapsedSubs.has(`${r.id}:cred`) && (
                          <div className="mt-2">
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
                                  {c} <span className="text-white/50">&times;</span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 text-[11px] text-white/55">Add 1&ndash;3 tags that make your claim feel real.</div>
                          )}
                          <div className="mt-2 text-[11px] text-white/55">
                            Variable:{" "}
                            <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                              {"{{offer.credibility[]}}"}
                            </code>
                          </div>
                          {defaultAllBtn("credibility")}
                          </div>
                          )}
                        </div>

                        {/* ── Offer Snippet ── */}
                        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4" style={{ marginLeft: 12 }}>
                          {subHeader("Offer Snippet", `${r.id}:snippet`, (
                            <div className="ml-auto flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); composeSnippetWithAI(); }}
                                disabled={isGeneratingSnippet}
                                className="text-[11px] font-semibold rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-white/80 hover:bg-white/10 disabled:opacity-50 inline-flex items-center gap-1.5"
                                title="Regenerate snippet with AI"
                              >
                                {isGeneratingSnippet ? <InlineSpinner className="h-3 w-3" /> : null}
                                <span>{isGeneratingSnippet ? "Generating" : "Regenerate (AI)"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  try { navigator.clipboard.writeText(snippet || ""); } catch {}
                                }}
                                className="text-[11px] font-semibold rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-white/80 hover:bg-white/10"
                                title="Copy snippet"
                              >
                                Copy
                              </button>
                            </div>
                          ))}
                          {!collapsedSubs.has(`${r.id}:snippet`) && (
                          <div className="mt-2">
                            <div className="mb-2 text-[11px] text-white/60">
                              AI-composed from your role signals + proof points. Campaign reuses this across emails.
                            </div>
                            <pre className="whitespace-pre-wrap rounded-md border border-white/10 bg-black/30 p-3 text-[12px] text-white/85 min-h-[100px]">
                              {snippet || "Start with a one-liner + 3 proof points to generate your snippet."}
                            </pre>
                            <div className="mt-2 text-[11px] text-white/55">
                              Variable:{" "}
                              <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                                {"{{offer.snippet}}"}
                              </code>
                            </div>
                          </div>
                          )}
                        </div>

                        {/* ── Call-to-Action Strategy ── */}
                        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4" style={{ marginLeft: 12 }}>
                          {subHeader("Call-to-Action Strategy", `${r.id}:cta`)}
                          {!collapsedSubs.has(`${r.id}:cta`) && (
                          <div className="mt-2">
                          <div className="grid grid-cols-1 gap-4">
                            <div className="rounded-md border border-white/10 bg-black/20 p-3">
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
                            <div className="rounded-md border border-white/10 bg-black/20 p-3">
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
                          {defaultAllBtn("cta")}
                          </div>
                          )}
                        </div>

                        <div className="mt-5 flex justify-center">
                          <button
                            type="button"
                            onClick={() => toggleRole(r.id)}
                            className="px-3 py-1 rounded border border-white/10 bg-white/5 text-[10px] font-semibold uppercase tracking-wider text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
                          >
                            Collapse
                          </button>
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
              onClick={() => {
                if (activeRoleId) saveDraftToCurrentRole({ silent: true });
                router.push("/find-contact");
              }}
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
  );
}
