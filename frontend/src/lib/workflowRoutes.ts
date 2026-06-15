export type RouteId = "1" | "2" | "3";

export type WorkflowStep = {
  step: number;
  tab: string;
  label: string;
  icon: string;
  href: string;
};

export const ALL_STEPS: WorkflowStep[] = [
  { step: 1, tab: "job-preferences", label: "Role Preferences", icon: "🎯", href: "/job-preferences" },
  { step: 2, tab: "candidate-profile", label: "Your Resume", icon: "📄", href: "/resume" },
  { step: 3, tab: "personality", label: "Personality", icon: "🧠", href: "/personality" },
  { step: 4, tab: "job-descriptions", label: "Role Search", icon: "🔎", href: "/job-descriptions" },
  { step: 5, tab: "gap-analysis", label: "Gap Analysis", icon: "🧩", href: "/gap-analysis" },
  { step: 6, tab: "painpoint-match", label: "Pain Point Match", icon: "🔗", href: "/painpoint-match" },
  { step: 7, tab: "company-research", label: "Company Research", icon: "🏢", href: "/company-research" },
  { step: 8, tab: "decision-makers", label: "Decision Makers", icon: "👤", href: "/find-contact" },
  { step: 9, tab: "offer", label: "Offer", icon: "✨", href: "/offer" },
  { step: 10, tab: "bio-page", label: "Bio Page", icon: "🌐", href: "/bio-page" },
  { step: 11, tab: "apply", label: "Apply", icon: "✅", href: "/apply" },
  { step: 12, tab: "campaign", label: "Campaign", icon: "📧", href: "/campaign" },
];

/** Route 1: full job-search path (roles → gaps → match → research …) */
export const ROUTE1_STEP_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Routes 2 & 3: skip role search; research before pain-point match */
export const ROUTE23_STEP_ORDER = [1, 2, 3, 7, 6, 8, 9, 10, 11, 12];

export const ROUTE_DEFINITIONS: Array<{
  id: RouteId;
  badge: string;
  title: string;
  subtitle: string;
  strategy: string;
  icon: string;
  difficulty: string;
  accent: string;
}> = [
  {
    id: "1",
    badge: "Route 1",
    title: "Open Roles",
    subtitle: "They are actively hiring for your type of role",
    strategy: "Direct outreach tied to posted roles. Easiest path.",
    icon: "📋",
    difficulty: "Easiest",
    accent: "border-emerald-500/40 bg-emerald-600/10 ring-emerald-500/30",
  },
  {
    id: "2",
    badge: "Route 2",
    title: "Need Exists",
    subtitle: "They need someone like you but have not posted it yet",
    strategy: "Lead with a free insight or mini-deliverable.",
    icon: "💡",
    difficulty: "Moderate",
    accent: "border-blue-500/40 bg-blue-600/10 ring-blue-500/30",
  },
  {
    id: "3",
    badge: "Route 3",
    title: "Hidden Market",
    subtitle: "No open role. You are creating the need.",
    strategy: "Lead with substantial free work upfront.",
    icon: "🧭",
    difficulty: "Hardest",
    accent: "border-purple-500/40 bg-purple-600/10 ring-purple-500/30",
  },
];

export const STORAGE_ACTIVE_ROUTE = "rf_active_route";

export function getActiveRoute(): RouteId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_ACTIVE_ROUTE);
    if (raw === "1" || raw === "2" || raw === "3") return raw;
    // Migrate legacy single positioning level
    const d100 = JSON.parse(localStorage.getItem("rf_dream100") || "null");
    const level = String(d100?.positioningLevel || d100?.selectedRoute || "").trim();
    if (level === "1" || level === "2" || level === "3") return level as RouteId;
  } catch {}
  return null;
}

export function setActiveRoute(route: RouteId) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_ACTIVE_ROUTE, route);
  try {
    const d100 = JSON.parse(localStorage.getItem("rf_dream100") || "{}");
    localStorage.setItem("rf_dream100", JSON.stringify({ ...d100, selectedRoute: route, positioningLevel: route }));
  } catch {}
  window.dispatchEvent(new CustomEvent("rf-route-changed", { detail: route }));
}

export function getStepsForRoute(route: RouteId | null): WorkflowStep[] {
  const order = route === "1" ? ROUTE1_STEP_ORDER : route ? ROUTE23_STEP_ORDER : ROUTE1_STEP_ORDER;
  const byStep = new Map(ALL_STEPS.map((s) => [s.step, s]));
  return order.map((n) => byStep.get(n)).filter(Boolean) as WorkflowStep[];
}

export function isStepVisibleForRoute(step: number, route: RouteId | null): boolean {
  if (!route) return true;
  const order = route === "1" ? ROUTE1_STEP_ORDER : ROUTE23_STEP_ORDER;
  return order.includes(step);
}

export function pathForStep(step: number): string | null {
  return ALL_STEPS.find((s) => s.step === step)?.href || null;
}

/** Visual grid positions in snake order (display index 0 → first stone). */
export const SNAKE_POSITIONS: Array<{ top: number; left: number }> = [
  { top: 40, left: 20 },
  { top: 40, left: 210 },
  { top: 40, left: 400 },
  { top: 40, left: 590 },
  { top: 160, left: 590 },
  { top: 160, left: 400 },
  { top: 160, left: 210 },
  { top: 160, left: 20 },
  { top: 320, left: 20 },
  { top: 320, left: 210 },
  { top: 320, left: 400 },
  { top: 320, left: 590 },
];

/** Steps skipped on routes 2 & 3 (role search + gap analysis). */
export const ROUTE23_SKIPPED_STEPS = [4, 5];

export function isStepSkippedForRoute(step: number, route: RouteId | null): boolean {
  if (!route || route === "1") return false;
  return ROUTE23_SKIPPED_STEPS.includes(step);
}
