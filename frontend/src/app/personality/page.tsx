"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Choice = -2 | -1 | 0 | 1 | 2;

type AxisId = "energy" | "info" | "decisions" | "structure";

type Question = {
  id: string;
  axis: AxisId;
  prompt: string;
  leftLabel: string;  // -2
  rightLabel: string; // +2
};

type PersonalityResult = {
  version: string;
  completed_at: string;
  scores: Record<AxisId, number>; // negative => left-leaning, positive => right-leaning
  profile_code: string; // internal shorthand (NOT MBTI)
  summary: string;
  strengths: string[];
  role_environments: string[];
  suggested_roles: string[];
};

const STORAGE_KEY = "personality_profile";

const QUESTIONS: Question[] = [
  {
    id: "q1",
    axis: "energy",
    prompt: "In a new role, you recharge most by…",
    leftLabel: "Working independently",
    rightLabel: "Collaborating with people",
  },
  {
    id: "q2",
    axis: "energy",
    prompt: "For outreach and networking, you prefer…",
    leftLabel: "Small, targeted conversations",
    rightLabel: "High-volume networking and events",
  },
  {
    id: "q3",
    axis: "info",
    prompt: "When learning a new domain, you prefer…",
    leftLabel: "Concrete examples + checklists",
    rightLabel: "Big-picture concepts + patterns",
  },
  {
    id: "q4",
    axis: "info",
    prompt: "When evaluating a job post, you focus more on…",
    leftLabel: "Specific requirements",
    rightLabel: "The mission and impact",
  },
  {
    id: "q5",
    axis: "decisions",
    prompt: "In tough decisions, you tend to prioritize…",
    leftLabel: "Fairness and logic",
    rightLabel: "People and harmony",
  },
  {
    id: "q6",
    axis: "decisions",
    prompt: "Feedback that motivates you most is…",
    leftLabel: "Clear and direct",
    rightLabel: "Supportive and encouraging",
  },
  {
    id: "q7",
    axis: "structure",
    prompt: "Your ideal workday is…",
    leftLabel: "Planned and predictable",
    rightLabel: "Flexible and adaptive",
  },
  {
    id: "q8",
    axis: "structure",
    prompt: "When projects change midstream, you…",
    leftLabel: "Prefer stability and scope control",
    rightLabel: "Enjoy iterating quickly",
  },
  {
    id: "q9",
    axis: "energy",
    prompt: "The kind of work you naturally seek is…",
    leftLabel: "Deep focus work",
    rightLabel: "Relationship-building work",
  },
  {
    id: "q10",
    axis: "info",
    prompt: "When you’re stuck, you’re more likely to…",
    leftLabel: "Look for proven playbooks",
    rightLabel: "Invent a new approach",
  },
  {
    id: "q11",
    axis: "decisions",
    prompt: "You feel most confident when…",
    leftLabel: "The data supports the choice",
    rightLabel: "The team supports the choice",
  },
  {
    id: "q12",
    axis: "structure",
    prompt: "In a new job, you’d rather…",
    leftLabel: "Own a defined scope",
    rightLabel: "Explore different responsibilities",
  },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computeResult(answers: Record<string, Choice>): PersonalityResult {
  const scores: Record<AxisId, number> = { energy: 0, info: 0, decisions: 0, structure: 0 };
  for (const q of QUESTIONS) {
    scores[q.axis] += Number(answers[q.id] ?? 0);
  }

  const norm = {
    energy: clamp(scores.energy, -10, 10),
    info: clamp(scores.info, -10, 10),
    decisions: clamp(scores.decisions, -10, 10),
    structure: clamp(scores.structure, -10, 10),
  };

  const e = norm.energy >= 0 ? "P" : "F";      // People vs Focus
  const i = norm.info >= 0 ? "V" : "D";        // Vision vs Detail
  const d = norm.decisions >= 0 ? "H" : "L";   // Heart vs Logic
  const s = norm.structure >= 0 ? "A" : "S";   // Adaptive vs Structured

  const profileCode = `${e}${i}${d}${s}`;

  const summaryParts: string[] = [];
  summaryParts.push(e === "P" ? "People-forward" : "Focus-forward");
  summaryParts.push(i === "V" ? "Vision-oriented" : "Detail-oriented");
  summaryParts.push(d === "H" ? "Empathy-led" : "Logic-led");
  summaryParts.push(s === "A" ? "Adaptive" : "Structured");

  const strengths: string[] = [];
  if (e === "P") strengths.push("Relationship building", "Stakeholder alignment");
  else strengths.push("Deep work and execution", "Independent problem solving");
  if (i === "V") strengths.push("Pattern recognition", "Strategic framing");
  else strengths.push("Precision and follow-through", "Requirements clarity");
  if (d === "H") strengths.push("Empathy and communication", "Team cohesion");
  else strengths.push("Analytical decisions", "Clear prioritization");
  if (s === "A") strengths.push("Agility in ambiguity", "Iterative improvement");
  else strengths.push("Planning and reliability", "Process discipline");

  const roleEnvs: string[] = [];
  if (s === "A") roleEnvs.push("Fast-moving teams", "0→1 or high-change environments");
  else roleEnvs.push("Stable teams", "Clear scope and predictable execution");
  if (e === "P") roleEnvs.push("Cross-functional collaboration", "Customer-facing work");
  else roleEnvs.push("Maker time", "Hands-on delivery roles");

  const suggestedRoles: string[] = [];
  if (e === "P" && i === "V") suggestedRoles.push("Customer Success", "Solutions Consulting", "Product (Discovery)");
  if (e === "P" && i === "D") suggestedRoles.push("Recruiting", "Account Management", "Implementation Specialist");
  if (e === "F" && i === "V") suggestedRoles.push("Product Strategy", "Data/Insights", "Architecture / Systems");
  if (e === "F" && i === "D") suggestedRoles.push("Engineering", "QA / Test", "Operations / Analytics");
  // Make sure we always have something reasonable
  if (suggestedRoles.length < 6) {
    suggestedRoles.push("Program Management", "Operations");
  }

  return {
    version: "rf_personality_v1",
    completed_at: new Date().toISOString(),
    scores: norm,
    profile_code: profileCode,
    summary: summaryParts.join(" · "),
    strengths: Array.from(new Set(strengths)).slice(0, 8),
    role_environments: Array.from(new Set(roleEnvs)).slice(0, 6),
    suggested_roles: Array.from(new Set(suggestedRoles)).slice(0, 10),
  };
}

export default function PersonalityPage() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, Choice>>({});
  const [result, setResult] = useState<PersonalityResult | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setResult(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const isComplete = answeredCount === QUESTIONS.length;

  const onSubmit = () => {
    if (!isComplete) return;
    const next = computeResult(answers);
    setResult(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 mb-4">
        <a href="/resume" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
          <span className="mr-2">←</span> Back to Resume
        </a>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Personality (Job Fit)</h1>
              <p className="text-white/70">
                A short, job-focused assessment to help you choose roles and outreach angles—especially helpful if you’re early-career.
              </p>
            </div>
            <div className="bg-gray-900/70 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-lg border border-white/10">
              Step 3 of 12
            </div>
          </div>

          <div className="mb-6 rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-bold text-white">How it works</div>
            <div className="mt-1 text-xs text-white/60">
              Answer each question on a 5-point scale. This is RoleFerry’s own condensed job-fit lens (not a Myers-Briggs test).
            </div>
            <div className="mt-3 text-xs text-white/60">
              Progress: <span className="text-white/80 font-semibold">{answeredCount}</span> / {QUESTIONS.length}
            </div>
          </div>

          <div className="space-y-4">
            {QUESTIONS.map((q) => {
              const v = answers[q.id] ?? null;
              return (
                <div key={q.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="text-sm font-semibold text-white">{q.prompt}</div>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <div className="text-xs text-white/60">{q.leftLabel}</div>
                    <div className="flex items-center justify-center gap-2">
                      {([-2, -1, 0, 1, 2] as Choice[]).map((c) => (
                        <button
                          key={`${q.id}_${c}`}
                          type="button"
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: c }))}
                          aria-pressed={v === c}
                          className={`h-9 w-9 rounded-full border text-xs font-bold transition-colors ${
                            v === c
                              ? "border-orange-400/40 bg-orange-500/25 text-white"
                              : "border-white/10 bg-black/20 text-white/70 hover:bg-white/10"
                          }`}
                        >
                          {c === 0 ? "0" : c > 0 ? `+${c}` : String(c)}
                        </button>
                      ))}
                    </div>
                    <div className="text-xs text-white/60 md:text-right">{q.rightLabel}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-white/60">
              Tip: if you’re unsure, choose <span className="font-semibold text-white/80">0</span>.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAnswers({});
                  setResult(null);
                  try { localStorage.removeItem(STORAGE_KEY); } catch {}
                }}
                className="bg-white/10 text-white px-4 py-2 rounded-md font-medium hover:bg-white/15 transition-colors border border-white/10"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={!isComplete}
                className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                See results
              </button>
              <button
                type="button"
                onClick={() => router.push("/job-descriptions")}
                className="bg-white/10 text-white px-4 py-2 rounded-md font-medium hover:bg-white/15 transition-colors border border-white/10"
              >
                Continue to Jobs →
              </button>
            </div>
          </div>

          {result && (
            <div className="mt-8 rounded-lg border border-white/10 bg-black/20 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-sm font-bold text-white">Your profile</div>
                  <div className="mt-1 text-xs text-white/60">{result.summary}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-white/70">Code</div>
                  <div className="text-lg font-extrabold text-white">{result.profile_code}</div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs font-semibold text-white/70 mb-2">Strengths</div>
                  <ul className="space-y-1 text-sm text-white/80">
                    {result.strengths.map((s) => <li key={s}>• {s}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-semibold text-white/70 mb-2">Best-fit environments</div>
                  <ul className="space-y-1 text-sm text-white/80">
                    {result.role_environments.map((s) => <li key={s}>• {s}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-semibold text-white/70 mb-2">Suggested role directions</div>
                  <ul className="space-y-1 text-sm text-white/80">
                    {result.suggested_roles.slice(0, 8).map((s) => <li key={s}>• {s}</li>)}
                  </ul>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-bold text-white mb-2">Available Variables from this Step</div>
                <div className="text-xs text-white/60 mb-3">
                  These variables are available for downstream steps (Gaps/Compose/Campaign):
                </div>
                <div className="flex flex-wrap gap-2">
                  <code className="px-2 py-1 rounded-md border border-white/10 bg-black/30 text-[11px] text-green-200">
                    personality.profile_code={result.profile_code}
                  </code>
                  <code className="px-2 py-1 rounded-md border border-white/10 bg-black/30 text-[11px] text-green-200">
                    personality.summary
                  </code>
                  <code className="px-2 py-1 rounded-md border border-white/10 bg-black/30 text-[11px] text-green-200">
                    personality.strengths[]
                  </code>
                  <code className="px-2 py-1 rounded-md border border-white/10 bg-black/30 text-[11px] text-green-200">
                    personality.role_environments[]
                  </code>
                  <code className="px-2 py-1 rounded-md border border-white/10 bg-black/30 text-[11px] text-green-200">
                    personality.suggested_roles[]
                  </code>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

