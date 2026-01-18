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
  profile_code: string; // 4-letter shorthand (unofficial): I/E S/N T/F J/P
  summary: string;
  strengths: string[];
  role_environments: string[];
  suggested_roles: string[];
  action_steps: Array<{ title: string; bullets: string[] }>;
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

const TEMPERAMENT_BLURBS: Record<TemperamentId, string> = {
  Artisan: "Tactical, adaptable doers. “Do what works.”",
  Guardian: "Steady, reliable builders. “Do what’s right.”",
  Idealist: "People-first, values-led guides. “Lead with values.”",
  Rational: "Systems, strategy, and deep problem-solving. “Solve systems.”",
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

// Job Fit questions: written in role-oriented, job-search-task language (unofficial/condensed).
const QUESTIONS: Question[] = [
  {
    id: "q1",
    axis: "energy",
    prompt: "In a new role, you recharge most by…",
    leftLabel: "Deep focus work (independent)",
    rightLabel: "Live collaboration (with people)",
  },
  {
    id: "q2",
    axis: "energy",
    prompt: "For networking (job search), your best channel is…",
    leftLabel: "Small, targeted 1:1 conversations",
    rightLabel: "High-volume networking + events",
  },
  {
    id: "q3",
    axis: "info",
    prompt: "When learning a new domain for a target role, you prefer…",
    leftLabel: "Concrete examples + checklists",
    rightLabel: "Big-picture concepts + patterns",
  },
  {
    id: "q4",
    axis: "info",
    prompt: "When choosing roles to apply to, you focus more on…",
    leftLabel: "Specific requirements + scope",
    rightLabel: "Mission + strategic impact",
  },
  {
    id: "q5",
    axis: "decisions",
    prompt: "In career decisions, you’re most persuaded by…",
    leftLabel: "Logic + evidence",
    rightLabel: "People + values alignment",
  },
  {
    id: "q6",
    axis: "decisions",
    prompt: "Interview feedback that helps you improve fastest is…",
    leftLabel: "Clear, direct, actionable",
    rightLabel: "Supportive, encouraging, relational",
  },
  {
    id: "q7",
    axis: "structure",
    prompt: "Your ideal workday (and job-search routine) is…",
    leftLabel: "Planned and predictable",
    rightLabel: "Flexible and adaptive",
  },
  {
    id: "q8",
    axis: "structure",
    prompt: "When priorities change midstream, you…",
    leftLabel: "Prefer stability + scope control",
    rightLabel: "Enjoy iterating quickly",
  },
  {
    id: "q9",
    axis: "energy",
    prompt: "In your target role, your “best work” looks like…",
    leftLabel: "Deep focus + individual ownership",
    rightLabel: "Influence + relationship building",
  },
  {
    id: "q10",
    axis: "info",
    prompt: "When you’re stuck (at work or in your job search), you…",
    leftLabel: "Look for proven playbooks",
    rightLabel: "Invent a new approach",
  },
  {
    id: "q11",
    axis: "decisions",
    prompt: "You feel confident saying “yes” to a role when…",
    leftLabel: "The data supports the choice",
    rightLabel: "The people + culture feel right",
  },
  {
    id: "q12",
    axis: "structure",
    prompt: "In a new role, you’d rather…",
    leftLabel: "Own a defined scope",
    rightLabel: "Explore different responsibilities",
  },
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function temperamentFromScores(comm: number, act: number): TemperamentId {
  let temperament: TemperamentId = "Guardian";
  if (comm < 0 && act < 0) temperament = "Artisan";
  if (comm < 0 && act >= 0) temperament = "Guardian";
  if (comm >= 0 && act >= 0) temperament = "Idealist";
  if (comm >= 0 && act < 0) temperament = "Rational";
  return temperament;
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
  const temperament = temperamentFromScores(comm, act);

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

  // Unofficial 4-letter shorthand many people recognize (NOT an official instrument):
  // energy: I (independent) vs E (collaborative)
  // info: S (concrete) vs N (big-picture)
  // decisions: T (logic) vs F (values/people)
  // structure: J (planned) vs P (adaptive)
  const IE = norm.energy >= 0 ? "E" : "I";
  const SN = norm.info >= 0 ? "N" : "S";
  const TF = norm.decisions >= 0 ? "F" : "T";
  const JP = norm.structure >= 0 ? "P" : "J";

  const profileCode = `${IE}${SN}${TF}${JP}`;

  const summaryParts: string[] = [];
  summaryParts.push(IE === "E" ? "Collaboration-charged" : "Focus-charged");
  summaryParts.push(SN === "N" ? "Big-picture" : "Concrete/details");
  summaryParts.push(TF === "F" ? "Values + people" : "Logic + evidence");
  summaryParts.push(JP === "P" ? "Adaptive" : "Planned");

  const strengths: string[] = [];
  if (IE === "E") strengths.push("Relationship building", "Stakeholder alignment");
  else strengths.push("Deep work and execution", "Independent problem solving");
  if (SN === "N") strengths.push("Pattern recognition", "Strategic framing");
  else strengths.push("Precision and follow-through", "Requirements clarity");
  if (TF === "F") strengths.push("Empathy and communication", "Team cohesion");
  else strengths.push("Analytical decisions", "Clear prioritization");
  if (JP === "P") strengths.push("Agility in ambiguity", "Iterative improvement");
  else strengths.push("Planning and reliability", "Process discipline");

  const roleEnvs: string[] = [];
  if (JP === "P") roleEnvs.push("Fast-moving teams", "0→1 or high-change environments");
  else roleEnvs.push("Stable teams", "Clear scope and predictable execution");
  if (IE === "E") roleEnvs.push("Cross-functional collaboration", "Customer-facing work");
  else roleEnvs.push("Maker time", "Hands-on delivery roles");

  const suggestedRoles: string[] = [];
  if (IE === "E" && SN === "N") suggestedRoles.push("Customer Success", "Solutions Consulting", "Product (Discovery)");
  if (IE === "E" && SN === "S") suggestedRoles.push("Recruiting", "Account Management", "Implementation Specialist");
  if (IE === "I" && SN === "N") suggestedRoles.push("Product Strategy", "Data/Insights", "Architecture / Systems");
  if (IE === "I" && SN === "S") suggestedRoles.push("Engineering", "QA / Test", "Operations / Analytics");
  // Make sure we always have something reasonable
  if (suggestedRoles.length < 6) {
    suggestedRoles.push("Program Management", "Operations");
  }

  // Job-fit action steps (deterministic, role-oriented). We tailor guidance per axis.
  const action_steps: Array<{ title: string; bullets: string[] }> = [];

  action_steps.push({
    title: "Networking & outreach (how to do it without draining yourself)",
    bullets:
      IE === "I"
        ? [
            "Default to 1:1: send 5 targeted messages/week (not 50 blasts).",
            "Use a 10–12 minute chat script: role → pain point → one metric → small ask.",
            "Batch outreach into 2 short blocks/week; protect recovery time after.",
          ]
        : [
            "Use momentum: 2–3 networking touchpoints/week (events, communities, referrals).",
            "Ask for introductions and “warm” group conversations where you can build energy.",
            "Follow-up system: same-day follow-up + a 7-day reminder so relationships compound.",
          ],
  });

  action_steps.push({
    title: "How to choose roles (what to filter for)",
    bullets:
      SN === "S"
        ? [
            "Prioritize roles with clear scope, explicit responsibilities, and concrete success metrics.",
            "Build a checklist: must-have skills, nice-to-have skills, and proof you can show for each.",
            "Use role fit over hype: pick roles you can explain with examples fast.",
          ]
        : [
            "Prioritize roles with mission clarity, strategic mandate, and room to shape direction.",
            "Write a 3-line “why this role matters” narrative for each target company.",
            "Lead with patterns: show how your past work generalizes to their problem space.",
          ],
  });

  action_steps.push({
    title: "Interview style (how to answer under pressure)",
    bullets:
      TF === "T"
        ? [
            "Anchor answers in evidence: data → decision → tradeoff → result.",
            "Prewrite 6 STAR stories with numbers and constraints; reuse across interviews.",
            "In behavioral rounds, add one line about collaboration so you don’t read as cold.",
          ]
        : [
            "Anchor answers in outcomes for people: stakeholder → conflict → alignment → result.",
            "Prepare 6 stories that show influence, empathy, and how you resolve tension.",
            "In technical rounds, add one concrete metric so you don’t read as vague.",
          ],
  });

  action_steps.push({
    title: "Planning your weekly job-search routine",
    bullets:
      JP === "J"
        ? [
            "Pick 5 weekly moves and schedule them (applications, outreach, prep, follow-ups, learning).",
            "Keep a tracker with due dates; you win by consistency.",
            "Set a strict cutoff so perfectionism doesn’t slow shipping.",
          ]
        : [
            "Use flexible structure: 3 ‘anchor blocks’ per week, then adapt based on responses.",
            "Keep a short daily “next best action” list (max 3 items).",
            "Add one weekly review so flexibility doesn’t become drift.",
          ],
  });

  return {
    version: "rf_jobfit_v2",
    completed_at: new Date().toISOString(),
    scores: norm,
    profile_code: profileCode,
    summary: summaryParts.join(" · "),
    strengths: Array.from(new Set(strengths)).slice(0, 8),
    role_environments: Array.from(new Set(roleEnvs)).slice(0, 6),
    suggested_roles: Array.from(new Set(suggestedRoles)).slice(0, 10),
    action_steps,
  };
}

export default function PersonalityPage() {
  const router = useRouter();
  const [activeTest, setActiveTest] = useState<"temperaments" | "jobfit">("temperaments");

  const [temperamentAnswers, setTemperamentAnswers] = useState<Record<string, Choice>>({});
  const [temperamentResult, setTemperamentResult] = useState<TemperamentResult | null>(null);
  const [tStep, setTStep] = useState<number>(0);

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

  const tLive = useMemo(() => {
    let comm = 0;
    let act = 0;
    let commAnswered = 0;
    let actAnswered = 0;

    for (const q of TEMPERAMENT_QUESTIONS) {
      const v = temperamentAnswers[q.id];
      if (typeof v !== "number") continue;
      if (q.axis === "communication") {
        comm += Number(v);
        commAnswered += 1;
      } else {
        act += Number(v);
        actAnswered += 1;
      }
    }

    const totalComm = TEMPERAMENT_QUESTIONS.filter((q) => q.axis === "communication").length;
    const totalAct = TEMPERAMENT_QUESTIONS.filter((q) => q.axis === "action").length;
    const remComm = totalComm - commAnswered;
    const remAct = totalAct - actAnswered;

    const minComm = comm - 2 * remComm;
    const maxComm = comm + 2 * remComm;
    const minAct = act - 2 * remAct;
    const maxAct = act + 2 * remAct;

    const canConcrete = minComm < 0;
    const canAbstract = maxComm >= 0;
    const canUtilitarian = minAct < 0;
    const canCooperative = maxAct >= 0;

    const possible: Record<TemperamentId, boolean> = {
      Artisan: canConcrete && canUtilitarian,
      Guardian: canConcrete && canCooperative,
      Idealist: canAbstract && canCooperative,
      Rational: canAbstract && canUtilitarian,
    };

    const remainingPossible = (Object.keys(possible) as TemperamentId[]).filter((k) => possible[k]);
    const guess = temperamentFromScores(comm, act);

    // Confidence heuristic: how strongly we’re pushed into the quadrant given what’s still possible.
    // This is NOT a scientific probability—just UX feedback for “how narrowed down are we?”
    const commMarginToFlip = Math.min(Math.abs(minComm), Math.abs(maxComm));
    const actMarginToFlip = Math.min(Math.abs(minAct), Math.abs(maxAct));
    const narrowedPct = clamp(Math.round(((TEMPERAMENT_QUESTIONS.length - (remComm + remAct)) / TEMPERAMENT_QUESTIONS.length) * 100), 0, 100);
    const eliminations = 4 - remainingPossible.length;

    return {
      comm,
      act,
      remComm,
      remAct,
      possible,
      remainingPossible,
      guess,
      eliminations,
      narrowedPct,
      commMarginToFlip,
      actMarginToFlip,
    };
  }, [temperamentAnswers]);

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

  const resetTemperaments = () => {
    setTemperamentAnswers({});
    setTemperamentResult(null);
    setTStep(0);
    try {
      localStorage.removeItem(TEMPERAMENT_STORAGE_KEY);
    } catch {}
  };

  const renderLikert = (opts: {
    questionId: string;
    value: Choice | null;
    leftLabel: string;
    rightLabel: string;
    onPick: (c: Choice) => void;
    size?: "sm" | "md";
  }) => {
    const size = opts.size ?? "sm";
    const pillBase =
      size === "md"
        ? "h-11 px-3 rounded-full text-[12px] font-extrabold"
        : "h-9 px-3 rounded-full text-[11px] font-bold";

    const Btn = (p: { choice: Choice; label: string }) => (
      <button
        key={`${opts.questionId}_${p.choice}`}
        type="button"
        onClick={() => opts.onPick(p.choice)}
        aria-pressed={opts.value === p.choice}
        className={`${pillBase} border transition-colors ${
          opts.value === p.choice
            ? "border-orange-400/40 bg-orange-500/25 text-white"
            : "border-white/10 bg-black/20 text-white/70 hover:bg-white/10"
        }`}
      >
        {p.label}
      </button>
    );

    return (
      <div className="mt-2 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="text-white/90">
          <div className={`${size === "md" ? "text-lg" : "text-base"} font-extrabold leading-snug`}>{opts.leftLabel}</div>
          <div className="mt-0.5 text-[11px] text-white/60">Lean this direction</div>
        </div>

        <div className="flex items-center justify-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Btn choice={-2} label="Very like me" />
            <Btn choice={-1} label="Somewhat like me" />
          </div>
          <Btn choice={0} label="It depends" />
          <div className="flex items-center gap-2">
            <Btn choice={1} label="Somewhat like me" />
            <Btn choice={2} label="Very like me" />
          </div>
        </div>

        <div className="text-white/90 md:text-right">
          <div className={`${size === "md" ? "text-lg" : "text-base"} font-extrabold leading-snug`}>{opts.rightLabel}</div>
          <div className="mt-0.5 text-[11px] text-white/60">Lean this direction</div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (activeTest !== "temperaments") return;
    // Keep step pointer sane (e.g. after reset or stored state load)
    const next = clamp(tStep, 0, TEMPERAMENT_QUESTIONS.length - 1);
    if (next !== tStep) setTStep(next);
  }, [activeTest, tStep]);

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
                  These are RoleFerry’s condensed, job-focused assessments (unofficial).
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

          <div className="space-y-3">
            {activeTest === "temperaments" ? (
              <div className="rounded-lg border border-white/10 bg-black/20 p-5">
                {/* Big icon tiles stay visible and “narrow down” in real-time */}
                <div className="flex items-start justify-between gap-3 flex-col md:flex-row md:items-center">
                  <div>
                    <div className="text-sm font-bold text-white">4 Temperaments Type Finder</div>
                    <div className="mt-1 text-xs text-white/60">
                      Answer a few questions and watch the likely types narrow down (process of elimination).
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-white/70">
                      Possible types: <span className="font-extrabold text-white/85">{tLive.remainingPossible.length}</span> / 4
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-white/70">
                      Eliminated: <span className="font-extrabold text-white/85">{tLive.eliminations}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(["Artisan", "Guardian", "Idealist", "Rational"] as TemperamentId[]).map((tid) => {
                    const possible = tLive.possible[tid];
                    const isLead = tLive.guess === tid && tAnsweredCount > 0;
                    return (
                      <div
                        key={tid}
                        className={`rounded-xl border p-4 transition-all ${TEMPERAMENT_COLORS[tid].border} ${TEMPERAMENT_COLORS[tid].bg} ${
                          isLead ? "ring-2 ring-white/20" : ""
                        }`}
                        style={{ opacity: possible ? 1 : 0.25 }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className={`text-xs font-extrabold ${TEMPERAMENT_COLORS[tid].text}`}>{tid}</div>
                            <div className="mt-1 text-[11px] text-white/70 line-clamp-2">{TEMPERAMENT_BLURBS[tid]}</div>
                          </div>
                          <div className="shrink-0">
                            <div className="text-3xl leading-none" aria-hidden="true">
                              {TEMPERAMENT_COLORS[tid].icon}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-white/60">Status</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold border ${
                              possible ? "border-white/10 bg-black/25 text-white/80" : "border-white/10 bg-black/20 text-white/50"
                            }`}
                          >
                            {possible ? (isLead ? "Leading" : "Still possible") : "Eliminated"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Question wizard */}
                {!temperamentResult && (
                  <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-white/70">
                        Question {Math.min(tStep + 1, TEMPERAMENT_QUESTIONS.length)} / {TEMPERAMENT_QUESTIONS.length}
                      </div>
                      <div className="text-[11px] text-white/60">
                        Current guess:{" "}
                        <span className={`font-extrabold ${TEMPERAMENT_COLORS[tLive.guess].text}`}>
                          {tAnsweredCount === 0 ? "—" : tLive.guess}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 h-2 w-full rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full brand-gradient"
                        style={{ width: `${(tAnsweredCount / TEMPERAMENT_QUESTIONS.length) * 100}%` }}
                      />
                    </div>

                    {(() => {
                      const q = TEMPERAMENT_QUESTIONS[tStep];
                      const v = temperamentAnswers[q.id] ?? null;

                      const answerAndAdvance = (c: Choice) => {
                        setTemperamentAnswers((prev) => ({ ...prev, [q.id]: c }));
                        const isLast = tStep >= TEMPERAMENT_QUESTIONS.length - 1;
                        if (isLast) {
                          // Submit on the next tick to ensure state is applied
                          setTimeout(() => {
                            const nextAnswers = { ...temperamentAnswers, [q.id]: c };
                            const next = computeTemperamentResult(nextAnswers);
                            setTemperamentResult(next);
                            try {
                              localStorage.setItem(TEMPERAMENT_STORAGE_KEY, JSON.stringify(next));
                            } catch {}
                          }, 0);
                          return;
                        }
                        setTStep((s) => clamp(s + 1, 0, TEMPERAMENT_QUESTIONS.length - 1));
                      };

                      return (
                        <div className="mt-3">
                          <div className="text-base md:text-lg font-extrabold text-white">{q.prompt}</div>

                          {renderLikert({
                            questionId: q.id,
                            value: v,
                            leftLabel: q.leftLabel,
                            rightLabel: q.rightLabel,
                            onPick: answerAndAdvance,
                            size: "md",
                          })}

                          <div className="mt-4 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setTStep((s) => clamp(s - 1, 0, TEMPERAMENT_QUESTIONS.length - 1))}
                              disabled={tStep === 0}
                              className="bg-white/10 text-white px-4 py-2 rounded-md font-medium hover:bg-white/15 transition-colors border border-white/10 disabled:opacity-40"
                            >
                              ← Back
                            </button>
                            <div className="text-[11px] text-white/60">
                              Tip: if unsure, choose <span className="font-semibold text-white/80">It depends</span>.
                            </div>
                            <button
                              type="button"
                              onClick={() => setTStep((s) => clamp(s + 1, 0, TEMPERAMENT_QUESTIONS.length - 1))}
                              className="bg-white/10 text-white px-4 py-2 rounded-md font-medium hover:bg-white/15 transition-colors border border-white/10"
                            >
                              Skip →
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {temperamentResult && (
                  <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-white/60">Your temperament</div>
                        <div className="mt-1 flex items-center gap-3">
                          <div className="text-4xl leading-none" aria-hidden="true">
                            {TEMPERAMENT_COLORS[temperamentResult.temperament].icon}
                          </div>
                          <div>
                            <div className="text-2xl font-extrabold text-white">{temperamentResult.temperament}</div>
                            <div className="text-xs text-white/60">{TEMPERAMENT_BLURBS[temperamentResult.temperament]}</div>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={resetTemperaments}
                        className="bg-white/10 text-white px-4 py-2 rounded-md font-medium hover:bg-white/15 transition-colors border border-white/10"
                      >
                        Retake
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              QUESTIONS.map((q) => {
                const v = answers[q.id] ?? null;
                return (
                  <div key={q.id} className="rounded-lg border border-white/10 bg-black/15 overflow-hidden">
                    {/* Prompt header (distinct from the options) */}
                    <div className="px-4 py-3 bg-white/5 border-b border-white/10">
                      <div className="text-sm font-semibold text-white/85">{q.prompt}</div>
                    </div>
                    {/* Options area */}
                    <div className="px-4 pb-3">
                      {renderLikert({
                        questionId: q.id,
                        value: v,
                        leftLabel: q.leftLabel,
                        rightLabel: q.rightLabel,
                        onPick: (c) => setAnswers((prev) => ({ ...prev, [q.id]: c })),
                        size: "sm",
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-xs text-white/60">
              {activeTest === "temperaments"
                ? "Tip: choose “It depends” if you’re unsure."
                : "Tip: choose “It depends” if you’re unsure."}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (activeTest === "temperaments") {
                    resetTemperaments();
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
                  <div className="text-sm font-bold text-white">Job Fit Playbook</div>
                  <div className="mt-1 text-xs text-white/60">
                    Role-oriented guidance based on your answers. (The 4-letter code is common shorthand, not an official instrument.)
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-white/70">Type code</div>
                  <div className="text-lg font-extrabold text-white">{result.profile_code}</div>
                </div>
              </div>

              <div className="mt-3 text-xs text-white/60">
                Summary: <span className="text-white/80 font-semibold">{result.summary}</span>
                {temperamentResult ? (
                  <>
                    {" "}
                    · Temperament context:{" "}
                    <span className={`font-extrabold ${TEMPERAMENT_COLORS[temperamentResult.temperament].text}`}>
                      {temperamentResult.temperament}
                    </span>
                  </>
                ) : null}
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-semibold text-white/70 mb-2">Best-fit environments</div>
                  <ul className="space-y-1 text-sm text-white/80">
                    {result.role_environments.map((s) => <li key={s}>• {s}</li>)}
                  </ul>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="text-xs font-semibold text-white/70 mb-2">Suggested role directions</div>
                  <ul className="space-y-1 text-sm text-white/80">
                    {result.suggested_roles.slice(0, 8).map((s) => <li key={s}>• {s}</li>)}
                  </ul>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.action_steps.map((s) => (
                  <div key={s.title} className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="text-sm font-extrabold text-white">{s.title}</div>
                    <ul className="mt-2 space-y-1 text-sm text-white/80">
                      {s.bullets.map((b) => (
                        <li key={b}>• {b}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-bold text-white mb-2">Available Variables from this Step</div>
                <div className="text-xs text-white/60 mb-3">
                  These variables are available for downstream steps (Gaps/Compose/Campaign):
                </div>
                <div className="flex flex-wrap gap-2">
                  <code className="px-2 py-1 rounded-md border border-white/10 bg-black/30 text-[11px] text-green-200">
                    personality.type_code={result.profile_code}
                  </code>
                  <code className="px-2 py-1 rounded-md border border-white/10 bg-black/30 text-[11px] text-green-200">
                    personality.summary
                  </code>
                  <code className="px-2 py-1 rounded-md border border-white/10 bg-black/30 text-[11px] text-green-200">
                    personality.action_steps[]
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

