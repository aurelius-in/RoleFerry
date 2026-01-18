"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Choice = -2 | -1 | 0 | 1 | 2;

type AxisId = "energy" | "info" | "decisions" | "structure";
type TemperamentAxis = "communication" | "action";

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

type TemperamentId = "Artisan" | "Guardian" | "Idealist" | "Rational";

type TemperamentQuestion = {
  id: string;
  axis: TemperamentAxis;
  prompt: string;
  leftLabel: string;  // -2
  rightLabel: string; // +2
};

type TemperamentResult = {
  version: string;
  completed_at: string;
  scores: Record<TemperamentAxis, number>; // communication: - = concrete, + = abstract; action: - = utilitarian, + = cooperative
  temperament: TemperamentId;
  summary: string;
  strengths: string[];
  suggested_roles: string[];
  environment_fit: string[];
};

const STORAGE_KEY = "personality_profile";
const TEMPERAMENT_STORAGE_KEY = "temperament_profile";

const TEMPERAMENT_QUESTIONS: TemperamentQuestion[] = [
  {
    id: "t1",
    axis: "communication",
    prompt: "When you explain an idea, you usually start with…",
    leftLabel: "Examples and facts",
    rightLabel: "Principles and concepts",
  },
  {
    id: "t2",
    axis: "communication",
    prompt: "In a new job, you feel most grounded by…",
    leftLabel: "Clear steps and concrete tasks",
    rightLabel: "A clear vision and direction",
  },
  {
    id: "t3",
    axis: "communication",
    prompt: "When reading a job description, you pay more attention to…",
    leftLabel: "Specific responsibilities",
    rightLabel: "The mission and strategy",
  },
  {
    id: "t4",
    axis: "communication",
    prompt: "When you learn, you prefer…",
    leftLabel: "Hands-on practice",
    rightLabel: "Theory first",
  },
  {
    id: "t5",
    axis: "action",
    prompt: "In group work, you’re more motivated by…",
    leftLabel: "Doing what works",
    rightLabel: "Doing what’s right",
  },
  {
    id: "t6",
    axis: "action",
    prompt: "In conflicts, your default is to…",
    leftLabel: "Optimize the outcome",
    rightLabel: "Protect relationships",
  },
  {
    id: "t7",
    axis: "action",
    prompt: "In interviews, you naturally emphasize…",
    leftLabel: "Results and impact",
    rightLabel: "Values and collaboration",
  },
  {
    id: "t8",
    axis: "action",
    prompt: "In your work style, you prefer…",
    leftLabel: "Autonomy and flexibility",
    rightLabel: "Alignment and coordination",
  },
];

const TEMPERAMENT_COLORS: Record<TemperamentId, { border: string; bg: string; text: string; icon: string }> = {
  Artisan: { border: "border-red-400/30", bg: "bg-red-500/15", text: "text-red-200", icon: "⚡" },
  Guardian: { border: "border-yellow-400/30", bg: "bg-yellow-500/15", text: "text-yellow-200", icon: "🏠" },
  Idealist: { border: "border-emerald-400/30", bg: "bg-emerald-500/15", text: "text-emerald-200", icon: "💚" },
  Rational: { border: "border-blue-400/30", bg: "bg-blue-500/15", text: "text-blue-200", icon: "💡" },
};

// Keirsey-style labels + common 4-letter shorthand people recognize online.
// We keep this lightweight and job-focused (no copied descriptions).
const TEMPERAMENT_SUBTYPES: Record<TemperamentId, Array<{ label: string; code: string; job_angle: string }>> = {
  Artisan: [
    { label: "Promoter", code: "ESTP", job_angle: "Fast action, persuasion, closing, fieldwork" },
    { label: "Crafter", code: "ISTP", job_angle: "Hands-on problem solving, technical troubleshooting" },
    { label: "Performer", code: "ESFP", job_angle: "High energy, people-first execution, live feedback loops" },
    { label: "Composer", code: "ISFP", job_angle: "Craft, quality, care in execution, quiet excellence" },
  ],
  Guardian: [
    { label: "Supervisor", code: "ESTJ", job_angle: "Execution leadership, standards, accountability" },
    { label: "Inspector", code: "ISTJ", job_angle: "Reliability, details, process, careful follow-through" },
    { label: "Provider", code: "ESFJ", job_angle: "Support, coordination, stakeholder care" },
    { label: "Protector", code: "ISFJ", job_angle: "Dependable service, stability, protecting quality" },
  ],
  Idealist: [
    { label: "Teacher", code: "ENFJ", job_angle: "Mentorship, leadership, influence, communication" },
    { label: "Counselor", code: "INFJ", job_angle: "Depth, empathy, pattern sensing, guidance" },
    { label: "Champion", code: "ENFP", job_angle: "Inspiration, storytelling, energizing teams" },
    { label: "Healer", code: "INFP", job_angle: "Values alignment, purpose, authentic communication" },
  ],
  Rational: [
    { label: "Fieldmarshal", code: "ENTJ", job_angle: "Strategy, systems, decisive leadership" },
    { label: "Mastermind", code: "INTJ", job_angle: "Long-horizon planning, architecture, optimization" },
    { label: "Inventor", code: "ENTP", job_angle: "Creative problem solving, debate, rapid iteration" },
    { label: "Architect", code: "INTP", job_angle: "Deep analysis, models, elegant systems" },
  ],
};

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

function computeTemperamentResult(answers: Record<string, Choice>): TemperamentResult {
  const scores: Record<TemperamentAxis, number> = { communication: 0, action: 0 };
  for (const q of TEMPERAMENT_QUESTIONS) {
    scores[q.axis] += Number(answers[q.id] ?? 0);
  }

  const comm = clamp(scores.communication, -10, 10);
  const act = clamp(scores.action, -10, 10);

  // Quadrants (Keirsey-style mapping):
  // communication: concrete (-) vs abstract (+)
  // action: utilitarian (-) vs cooperative (+)
  // concrete+utilitarian => Artisan
  // concrete+cooperative => Guardian
  // abstract+cooperative => Idealist
  // abstract+utilitarian => Rational
  let temperament: TemperamentId = "Guardian";
  if (comm < 0 && act < 0) temperament = "Artisan";
  if (comm < 0 && act >= 0) temperament = "Guardian";
  if (comm >= 0 && act >= 0) temperament = "Idealist";
  if (comm >= 0 && act < 0) temperament = "Rational";

  const summary =
    temperament === "Artisan"
      ? "Concrete + Utilitarian · Do what works"
      : temperament === "Guardian"
        ? "Concrete + Cooperative · Do what’s right"
        : temperament === "Idealist"
          ? "Abstract + Cooperative · Lead with values"
          : "Abstract + Utilitarian · Solve systems";

  const strengths: Record<TemperamentId, string[]> = {
    Artisan: ["Practical execution", "Adaptable problem solving", "Fast learning by doing", "Hands-on troubleshooting"],
    Guardian: ["Reliability and follow-through", "Operational excellence", "Consistency and standards", "Team dependability"],
    Idealist: ["Empathy and communication", "Purpose-driven leadership", "Coaching and development", "Culture building"],
    Rational: ["Systems thinking", "Strategic analysis", "Complex problem solving", "Technical depth"],
  };

  const roles: Record<TemperamentId, string[]> = {
    Artisan: ["Implementation Specialist", "Customer Support (Technical)", "Sales Engineer (Hands-on)", "Operations (Tactical)"],
    Guardian: ["Program/Project Coordinator", "Operations", "Compliance", "Recruiting Operations"],
    Idealist: ["Career Coach", "Customer Success", "People Ops", "Community / Partnerships"],
    Rational: ["Data/Analytics", "Engineering", "Architecture", "Product Strategy"],
  };

  const env: Record<TemperamentId, string[]> = {
    Artisan: ["Fast-paced teams", "Hands-on roles", "Clear ownership", "Rapid feedback loops"],
    Guardian: ["Structured teams", "Process clarity", "Stable execution", "Defined scope"],
    Idealist: ["Mission-driven teams", "High-trust collaboration", "People-first environments", "Mentorship culture"],
    Rational: ["High autonomy", "Challenging problems", "Strong technical peers", "Long-horizon thinking"],
  };

  return {
    version: "rf_temperaments_v1",
    completed_at: new Date().toISOString(),
    scores: { communication: comm, action: act },
    temperament,
    summary,
    strengths: strengths[temperament],
    suggested_roles: roles[temperament],
    environment_fit: env[temperament],
  };
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
  const [activeTest, setActiveTest] = useState<"temperaments" | "jobfit">("temperaments");

  const [temperamentAnswers, setTemperamentAnswers] = useState<Record<string, Choice>>({});
  const [temperamentResult, setTemperamentResult] = useState<TemperamentResult | null>(null);

  const [answers, setAnswers] = useState<Record<string, Choice>>({});
  const [result, setResult] = useState<PersonalityResult | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setResult(JSON.parse(raw));
    } catch {
      // ignore
    }

    try {
      const raw = localStorage.getItem(TEMPERAMENT_STORAGE_KEY);
      if (raw) setTemperamentResult(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const isComplete = answeredCount === QUESTIONS.length;

  const tAnsweredCount = useMemo(() => Object.keys(temperamentAnswers).length, [temperamentAnswers]);
  const tIsComplete = tAnsweredCount === TEMPERAMENT_QUESTIONS.length;

  const onSubmit = () => {
    if (!isComplete) return;
    const next = computeResult(answers);
    setResult(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const onSubmitTemperaments = () => {
    if (!tIsComplete) return;
    const next = computeTemperamentResult(temperamentAnswers);
    setTemperamentResult(next);
    try {
      localStorage.setItem(TEMPERAMENT_STORAGE_KEY, JSON.stringify(next));
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
                Use personality to align your job search, outreach strategy, and confidence—especially helpful if you’re early-career or pivoting.
              </p>
            </div>
            <div className="bg-gray-900/70 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-lg border border-white/10">
              Step 3 of 12
            </div>
          </div>

          <div className="mb-6 rounded-lg border border-white/10 bg-black/20 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-sm font-bold text-white">Choose a test</div>
                <div className="mt-1 text-xs text-white/60">
                  These are RoleFerry’s condensed, job-focused assessments (not official Myers-Briggs).
                </div>
              </div>
              <div className="inline-flex rounded-full border border-white/10 bg-black/25 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTest("temperaments")}
                  aria-pressed={activeTest === "temperaments"}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    activeTest === "temperaments" ? "brand-gradient text-black" : "text-white/80 hover:bg-white/10"
                  }`}
                >
                  4 Temperaments
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTest("jobfit")}
                  aria-pressed={activeTest === "jobfit"}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    activeTest === "jobfit" ? "brand-gradient text-black" : "text-white/80 hover:bg-white/10"
                  }`}
                >
                  Job Fit
                </button>
              </div>
            </div>

            <div className="mt-3 text-xs text-white/60">
              Progress:{" "}
              <span className="text-white/80 font-semibold">
                {activeTest === "temperaments" ? tAnsweredCount : answeredCount}
              </span>{" "}
              / {activeTest === "temperaments" ? TEMPERAMENT_QUESTIONS.length : QUESTIONS.length}
            </div>
          </div>

          <div className="space-y-4">
            {(activeTest === "temperaments" ? TEMPERAMENT_QUESTIONS : QUESTIONS).map((q: any) => {
              const v = (activeTest === "temperaments" ? temperamentAnswers : answers)[q.id] ?? null;
              const setFn = activeTest === "temperaments" ? setTemperamentAnswers : setAnswers;
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
                          onClick={() => setFn((prev: any) => ({ ...prev, [q.id]: c }))}
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
                  if (activeTest === "temperaments") {
                    setTemperamentAnswers({});
                    setTemperamentResult(null);
                    try { localStorage.removeItem(TEMPERAMENT_STORAGE_KEY); } catch {}
                  } else {
                    setAnswers({});
                    setResult(null);
                    try { localStorage.removeItem(STORAGE_KEY); } catch {}
                  }
                }}
                className="bg-white/10 text-white px-4 py-2 rounded-md font-medium hover:bg-white/15 transition-colors border border-white/10"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={activeTest === "temperaments" ? onSubmitTemperaments : onSubmit}
                disabled={activeTest === "temperaments" ? !tIsComplete : !isComplete}
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

          {temperamentResult && (
            <div className="mt-8 rounded-lg border border-white/10 bg-black/20 p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-semibold text-white/60">The four temperaments</div>
                  <div className="mt-1 text-2xl font-extrabold text-white">{temperamentResult.temperament}</div>
                  <div className="mt-1 text-xs text-white/60">{temperamentResult.summary}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold border ${TEMPERAMENT_COLORS[temperamentResult.temperament].border} ${TEMPERAMENT_COLORS[temperamentResult.temperament].bg} ${TEMPERAMENT_COLORS[temperamentResult.temperament].text}`}>
                    <span aria-hidden="true">{TEMPERAMENT_COLORS[temperamentResult.temperament].icon}</span>
                    {temperamentResult.temperament}
                  </span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-semibold text-white/70 mb-2">Temperament matrix</div>
                  <div className="text-[11px] text-white/60 mb-3">
                    Communication: <span className="font-semibold text-white/80">Concrete</span> ↔{" "}
                    <span className="font-semibold text-white/80">Abstract</span> · Action:{" "}
                    <span className="font-semibold text-white/80">Utilitarian</span> ↔{" "}
                    <span className="font-semibold text-white/80">Cooperative</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Concrete + Cooperative = Guardian */}
                    <div
                      className={`rounded-lg border p-3 ${TEMPERAMENT_COLORS.Guardian.border} ${TEMPERAMENT_COLORS.Guardian.bg}`}
                      style={{ opacity: temperamentResult.temperament === "Guardian" ? 1 : 0.55 }}
                    >
                      <div className={`text-xs font-extrabold ${TEMPERAMENT_COLORS.Guardian.text}`}>Guardian</div>
                      <div className="mt-1 text-[11px] text-white/70">Concrete + Cooperative</div>
                    </div>
                    {/* Abstract + Cooperative = Idealist */}
                    <div
                      className={`rounded-lg border p-3 ${TEMPERAMENT_COLORS.Idealist.border} ${TEMPERAMENT_COLORS.Idealist.bg}`}
                      style={{ opacity: temperamentResult.temperament === "Idealist" ? 1 : 0.55 }}
                    >
                      <div className={`text-xs font-extrabold ${TEMPERAMENT_COLORS.Idealist.text}`}>Idealist</div>
                      <div className="mt-1 text-[11px] text-white/70">Abstract + Cooperative</div>
                    </div>
                    {/* Concrete + Utilitarian = Artisan */}
                    <div
                      className={`rounded-lg border p-3 ${TEMPERAMENT_COLORS.Artisan.border} ${TEMPERAMENT_COLORS.Artisan.bg}`}
                      style={{ opacity: temperamentResult.temperament === "Artisan" ? 1 : 0.55 }}
                    >
                      <div className={`text-xs font-extrabold ${TEMPERAMENT_COLORS.Artisan.text}`}>Artisan</div>
                      <div className="mt-1 text-[11px] text-white/70">Concrete + Utilitarian</div>
                    </div>
                    {/* Abstract + Utilitarian = Rational */}
                    <div
                      className={`rounded-lg border p-3 ${TEMPERAMENT_COLORS.Rational.border} ${TEMPERAMENT_COLORS.Rational.bg}`}
                      style={{ opacity: temperamentResult.temperament === "Rational" ? 1 : 0.55 }}
                    >
                      <div className={`text-xs font-extrabold ${TEMPERAMENT_COLORS.Rational.text}`}>Rational</div>
                      <div className="mt-1 text-[11px] text-white/70">Abstract + Utilitarian</div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-semibold text-white/70 mb-2">Your 4 role patterns (within this temperament)</div>
                  <div className="text-[11px] text-white/60 mb-3">
                    These labels help you describe strengths in a job-search context. The 4-letter codes are common shorthand people recognize online.
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {TEMPERAMENT_SUBTYPES[temperamentResult.temperament].map((t) => (
                      <div key={t.code} className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-extrabold text-white truncate">{t.label}</div>
                            <div className="mt-1 text-[11px] text-white/60 truncate">{t.job_angle}</div>
                          </div>
                          <div className="shrink-0 rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[10px] font-extrabold text-white/80">
                            {t.code}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-xs font-semibold text-white/70 mb-2">Strengths</div>
                  <ul className="space-y-1 text-sm text-white/80">
                    {temperamentResult.strengths.map((s) => <li key={s}>• {s}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-semibold text-white/70 mb-2">Best-fit environments</div>
                  <ul className="space-y-1 text-sm text-white/80">
                    {temperamentResult.environment_fit.map((s) => <li key={s}>• {s}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-semibold text-white/70 mb-2">Suggested directions</div>
                  <ul className="space-y-1 text-sm text-white/80">
                    {temperamentResult.suggested_roles.slice(0, 8).map((s) => <li key={s}>• {s}</li>)}
                  </ul>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-bold text-white mb-2">Available Variables from this Step</div>
                <div className="text-xs text-white/60 mb-3">
                  These variables are available for downstream steps (Jobs/Gaps/Compose/Campaign):
                </div>
                <div className="flex flex-wrap gap-2">
                  <code className="px-2 py-1 rounded-md border border-white/10 bg-black/30 text-[11px] text-green-200">
                    temperament.type={temperamentResult.temperament}
                  </code>
                  <code className="px-2 py-1 rounded-md border border-white/10 bg-black/30 text-[11px] text-green-200">
                    temperament.summary
                  </code>
                  <code className="px-2 py-1 rounded-md border border-white/10 bg-black/30 text-[11px] text-green-200">
                    temperament.strengths[]
                  </code>
                  <code className="px-2 py-1 rounded-md border border-white/10 bg-black/30 text-[11px] text-green-200">
                    temperament.suggested_roles[]
                  </code>
                </div>
              </div>
            </div>
          )}

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

