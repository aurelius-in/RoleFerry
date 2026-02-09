"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import InlineSpinner from "@/components/InlineSpinner";

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
  snippet: string; // compiled preview
};

const STORAGE_KEY = "rf_offer_v1";
const STORAGE_BY_JOB_KEY = "rf_offer_v1_by_job";

type JobDescription = {
  id: string;
  title: string;
  company: string;
  url?: string;
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

function buildSnippet(d: {
  one_liner: string;
  proof_points: string[];
  case_studies: OfferCaseStudy[];
  default_cta: string;
}) {
  const one = clampLines(d.one_liner, 220);
  const proofs = (d.proof_points || []).map((x) => clampLines(x, 140)).filter(Boolean).slice(0, 3);
  const cs = (d.case_studies || []).filter((c) => c && (c.problem || c.actions || c.impact));
  const cta = clampLines(d.default_cta, 140);

  const parts: string[] = [];
  if (one) parts.push(one);
  if (proofs.length) parts.push(`Proof: ${proofs.join(" • ")}`);
  if (cs.length) {
    const c0 = cs[0];
    const bit = [c0.problem, c0.actions, c0.impact].map((x) => clampLines(x, 110)).filter(Boolean).join(" → ");
    if (bit) parts.push(`Example: ${bit}`);
  }
  if (cta) parts.push(`CTA: ${cta}`);
  return parts.join("\n");
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
  const [defaultCta, setDefaultCta] = useState("Open to a 10-minute chat this week?");

  // Pull best-effort context for suggestions (no extra API calls).
  const resume = useMemo(() => safeJson<any>(typeof window !== "undefined" ? localStorage.getItem("resume_extract") : null, null), []);
  const prefs = useMemo(() => safeJson<any>(typeof window !== "undefined" ? localStorage.getItem("job_preferences") : null, null), []);
  const selectedRole = useMemo(() => safeJson<any>(typeof window !== "undefined" ? localStorage.getItem("selected_job_description") : null, null), []);
  const selectedRoleId = useMemo(() => String(typeof window !== "undefined" ? localStorage.getItem("selected_job_description_id") : "" || "").trim(), []);

  const activeRole = useMemo(() => {
    const id = String(activeRoleId || "").trim();
    return roles.find((r) => String(r.id || "") === id) || roles[0] || null;
  }, [roles, activeRoleId]);

  function loadOfferToState(saved: OfferV1 | null) {
    if (saved?.version === 1) {
      setOneLiner(String(saved.one_liner || ""));
      setProofPoints(Array.isArray(saved.proof_points) && saved.proof_points.length ? saved.proof_points : ["", "", ""]);
      setCaseStudies(
        Array.isArray(saved.case_studies) && saved.case_studies.length
          ? saved.case_studies.slice(0, 2).map((c, idx) => ({
              title: String(c?.title || `Case study ${idx + 1}`),
              problem: String(c?.problem || ""),
              actions: String(c?.actions || ""),
              impact: String(c?.impact || ""),
            }))
          : [
              { title: "Case study 1", problem: "", actions: "", impact: "" },
              { title: "Case study 2", problem: "", actions: "", impact: "" },
            ]
      );
      setCredibility(Array.isArray(saved.credibility) ? saved.credibility : []);
      setDefaultCta(String(saved.default_cta || "Open to a 10-minute chat this week?"));
      return;
    }

    // First-time helpful defaults (role-specific).
    const title = String(activeRole?.title || selectedRole?.title || "").trim();
    const company = String(activeRole?.company || selectedRole?.company || "").trim();
    const industry = Array.isArray(prefs?.industries) ? String(prefs.industries[0] || "").trim() : "";
    const seed = [
      title ? `I help teams win in ${title} roles${company ? ` at companies like ${company}` : ""}.` : "",
      industry ? `I’m especially strong in ${industry} contexts.` : "",
    ]
      .filter(Boolean)
      .join(" ");
    setOneLiner(seed);
    setProofPoints(["", "", ""]);
    setCaseStudies([
      { title: "Case study 1", problem: "", actions: "", impact: "" },
      { title: "Case study 2", problem: "", actions: "", impact: "" },
    ]);
    setCredibility([]);
    setDefaultCta("Open to a 10-minute chat this week?");
  }

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

  const snippet = useMemo(
    () => buildSnippet({ one_liner: oneLiner, proof_points: proofPoints, case_studies: caseStudies, default_cta: defaultCta }),
    [oneLiner, proofPoints, caseStudies, defaultCta]
  );

  const suggestedMetrics = useMemo(() => {
    const km = Array.isArray(resume?.keyMetrics) ? resume.keyMetrics : [];
    return km
      .slice(0, 6)
      .map((m: any) => [m?.metric, m?.value, m?.context].filter(Boolean).join(" — "))
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
        one_liner: String(oneLiner || "").trim(),
        proof_points: (proofPoints || []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 6),
        case_studies: (caseStudies || [])
          .map((c) => ({
            title: String(c?.title || "").trim() || "Case study",
            problem: String(c?.problem || "").trim(),
            actions: String(c?.actions || "").trim(),
            impact: String(c?.impact || "").trim(),
          }))
          .filter((c) => c.problem || c.actions || c.impact)
          .slice(0, 2),
        credibility: (credibility || []).map((x) => String(x || "").trim()).filter(Boolean).slice(0, 10),
        default_cta: String(defaultCta || "").trim(),
        snippet,
      };
      // Persist per-role offer.
      const byJob = safeJson<Record<string, OfferV1>>(localStorage.getItem(STORAGE_BY_JOB_KEY), {});
      const key = String(activeRoleId || "").trim() || String(activeRole?.id || "").trim() || "default";
      const nextBy = { ...(byJob || {}), [key]: payload };
      localStorage.setItem(STORAGE_BY_JOB_KEY, JSON.stringify(nextBy));

      // Keep legacy keys updated for backward compatibility (store the active role's offer).
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      localStorage.setItem("offer_snippet", payload.snippet);
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
            <h1 className="text-3xl font-bold text-white mb-2">Offer (Value Prop)</h1>
            <p className="text-white/70">
              This is the core story RoleFerry uses in your emails. It’s not your resume. It’s the{" "}
              <span className="font-semibold text-white/80">why you</span>, in plain language.
            </p>
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
            <div className="lg:col-span-4">
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
                        onClick={() => setActiveRoleId(String(r.id || ""))}
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
            </div>

            <div className="lg:col-span-8 space-y-6">
              <div className="rounded-lg border border-white/10 bg-black/20 p-5">
                <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">One-liner</div>
                <textarea
                  value={oneLiner}
                  onChange={(e) => setOneLiner(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Example: I help data teams ship reliable analytics faster by building pragmatic pipelines and crisp stakeholder alignment."
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">Credibility hooks (optional)</div>
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

              <div className="rounded-lg border border-white/10 bg-black/20 p-5">
                <div className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">Default CTA</div>
                <input
                  value={defaultCta}
                  onChange={(e) => setDefaultCta(e.target.value)}
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Example: Open to a quick 10-minute chat this week?"
                />
                <div className="mt-2 text-[11px] text-white/55">
                  Variable:{" "}
                  <code className="px-1.5 py-0.5 rounded border border-white/10 bg-black/30 text-emerald-200">
                    {"{{offer.default_cta}}"}
                  </code>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-lg border border-white/10 bg-black/20 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-white">Offer snippet (auto)</div>
                    <div className="mt-1 text-[11px] text-white/60">This is what the Campaign step will reuse across emails.</div>
                  </div>
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
                <div className="text-sm font-bold text-white">What this step fixes</div>
                <ul className="mt-2 space-y-1 text-sm text-white/70">
                  <li>- Prevents “polite but generic” emails by giving the AI a real spine.</li>
                  <li>- Keeps your story consistent across contacts, roles, and follow-ups.</li>
                  <li>- Makes personalization credible: you reference proof, not just research.</li>
                </ul>
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
