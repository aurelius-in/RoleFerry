"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatCompanyName } from "@/lib/format";
import InlineSpinner from "@/components/InlineSpinner";
import CollapsibleSection from "@/components/CollapsibleSection";

const JARGON_PHRASES = [
  "fast-paced environment",
  "rockstar",
  "wear multiple hats",
  "self-starter",
  "move fast",
  "high ownership",
  "results-driven",
  "detail-oriented",
  "world-class",
  "best-in-class",
  "passion for excellence",
];

function extractJargon(text: string): string[] {
  const hay = (text || "").toLowerCase();
  const found: string[] = [];
  for (const p of JARGON_PHRASES) {
    if (hay.includes(p)) found.push(p);
  }
  // Prettify for display
  return found.map((p) => p.replace(/^\w/, (c) => c.toUpperCase()));
}

type FavoriteRank = number; // 1..N (unique across the visible jobs)
type PreferenceStars = 1 | 2 | 3 | 4 | 5;

interface JobDescription {
  id: string;
  title: string;
  company: string;
  url?: string;
  content: string;
  painPoints: string[];
  requiredSkills: string[];
  successMetrics: string[];
  location?: string;
  workMode?: string;
  employmentType?: string;
  salaryRange?: string;
  responsibilities?: string[];
  requirements?: string[];
  benefits?: string[];
  postedDate?: string;
  postedText?: string;
  jdJargon: string[];
  // New: user-selected preference rank (unique across the visible jobs).
  favoriteRank?: FavoriteRank;
  // New: user-selected preference (how much you want this job) as 1..5 stars.
  preferenceStars?: PreferenceStars;
  // Legacy (kept for back-compat reads only; dropped on load/persist)
  difficulty?: any;
  grade?: any;
  parsedAt: string;
}

interface BackendJobDescription {
  id: string;
  title: string;
  company: string;
  url?: string | null;
  content: string | null;
  pain_points: string[];
  required_skills: string[];
  success_metrics: string[];
  location?: string | null;
  work_mode?: string | null;
  employment_type?: string | null;
  salary_range?: string | null;
  responsibilities?: string[] | null;
  requirements?: string[] | null;
  benefits?: string[] | null;
  posted_date?: string | null;
  posted_text?: string | null;
  parsed_at: string;
}

interface JobDescriptionsListResponse {
  success: boolean;
  message: string;
  job_descriptions: BackendJobDescription[];
}

interface JobDescriptionResponse {
  success: boolean;
  message: string;
  job_description?: BackendJobDescription;
  job_descriptions?: BackendJobDescription[];
}

type JobRecommendation = {
  id: string;
  label: string;
  company: string;
  source: string;
  url: string;
  link_type?: "job_posting" | "job_board_search" | "career_search" | string;
  rationale: string;
  score?: number;
  created_at?: string;
};

type ScrapedRole = {
  id: string;
  title: string;
  company: string;
  url: string;
  source: string;
  location?: string | null;
  salary_range?: string | null;
  snippet?: string;
  match_score?: number;
   role_family?: string | null;
   work_mode?: string | null;
   match_reasons?: string[] | null;
  posted_text?: string | null;
};

type ScrapedRolesResponse = {
  success: boolean;
  message: string;
  roles: ScrapedRole[];
  helper?: {
    requested_roles?: number;
    target_companies?: number;
    unique_companies?: number;
    discovered_urls?: number;
    scored_candidates?: number;
    returned_roles?: number;
    source_breakdown?: Record<string, number>;
    fit_breakdown?: {
      great?: number;
      fair?: number;
      weak?: number;
      high?: number;
      medium?: number;
      exploratory?: number;
    };
    min_match_score?: number;
    require_us?: boolean;
    [k: string]: any;
  };
};

function clampPreferenceStars(n: any): PreferenceStars | undefined {
  const x = Number(n);
  if (!Number.isFinite(x)) return undefined;
  if (x < 1 || x > 5) return undefined;
  return x as PreferenceStars;
}

function normalizeFavoriteRanks(list: JobDescription[]): JobDescription[] {
  const n = Array.isArray(list) ? list.length : 0;
  if (!n) return [];

  const used = new Set<number>();
  const out = list.map((jd) => ({ ...jd }));
  for (let i = 0; i < out.length; i++) {
    const r = Number((out[i] as any).favoriteRank);
    const ok = Number.isFinite(r) && r >= 1 && r <= n;
    if (!ok) {
      delete (out[i] as any).favoriteRank;
      continue;
    }
    if (used.has(r)) {
      delete (out[i] as any).favoriteRank;
      continue;
    }
    used.add(r);
  }
  return out;
}

function postedLabel(jd: JobDescription): string {
  const text = String(jd?.postedText || "").trim();
  if (text) return text;
  const d = String(jd?.postedDate || "").trim();
  if (!d) return "Unknown";
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString();
}

function analyzeIndeedUrl(raw: string): {
  isIndeed: boolean;
  isSearchShare: boolean;
  jobKey?: string;
  normalizedViewJobUrl?: string;
} {
  const s = String(raw || "").trim();
  if (!s) return { isIndeed: false, isSearchShare: false };
  try {
    const u = new URL(s);
    const host = String(u.hostname || "").toLowerCase();
    const isIndeed = host.includes("indeed.");
    if (!isIndeed) return { isIndeed: false, isSearchShare: false };

    const path = String(u.pathname || "");
    const jobKey = String(u.searchParams.get("jk") || u.searchParams.get("vjk") || "").trim();
    const isSearchShare = path === "/jobs" || path.startsWith("/jobs");
    const normalizedViewJobUrl =
      isSearchShare && jobKey
        ? `${u.origin}/viewjob?jk=${encodeURIComponent(jobKey)}`
        : undefined;
    return { isIndeed: true, isSearchShare, jobKey: jobKey || undefined, normalizedViewJobUrl };
  } catch {
    return { isIndeed: false, isSearchShare: false };
  }
}

export default function JobDescriptionsPage() {
  const router = useRouter();
  const AUTO_POS_KW_KEY = "rf_auto_roles_positive_keywords_v1";
  const AUTO_NEG_KW_KEY = "rf_auto_roles_negative_keywords_v1";
  // Important: avoid reading localStorage during the initial render to prevent
  // React hydration mismatches (which can break click interactions).
  const [hasMounted, setHasMounted] = useState(false);
  const [jobSitesOpen, setJobSitesOpen] = useState(false);
  const [jobDescriptions, setJobDescriptions] = useState<JobDescription[]>([]);
  const [editMeta, setEditMeta] = useState<{
    id: string;
    field: "title" | "company" | "salaryRange";
    value: string;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [importText, setImportText] = useState("");
  const [importType, setImportType] = useState<'url' | 'text'>('url');
  const [sortBy, setSortBy] = useState<'date' | 'favoriteRank'>('date');
  const [trackerNotice, setTrackerNotice] = useState<string | null>(null);
  const [trackerPulseId, setTrackerPulseId] = useState<string | null>(null);
  const [scrapedRoles, setScrapedRoles] = useState<ScrapedRole[]>([]);
  const [isLoadingScrapedRoles, setIsLoadingScrapedRoles] = useState(false);
  const [scrapedRolesError, setScrapedRolesError] = useState<string | null>(null);
  const [scrapedRolesMessage, setScrapedRolesMessage] = useState<string>("");
  const [scrapedRolesMeta, setScrapedRolesMeta] = useState<{ requested_roles?: number; target_companies?: number; unique_companies?: number; discovered_urls?: number; scored_candidates?: number; source_breakdown?: Record<string, number>; fit_breakdown?: { great?: number; fair?: number; weak?: number; high?: number; medium?: number; exploratory?: number } } | null>(null);
  const [hasEverLoadedRoles, setHasEverLoadedRoles] = useState(false);
  const [strictness, setStrictness] = useState(25);
  const funnelMode = strictness > 50 ? "strict" : "broad";
  const discoveryLimit: 120 | 220 | 300 = strictness > 70 ? 120 : strictness > 40 ? 220 : 300;
  const highFitOnly = false;
  const [ignoredScrapedRoleIds, setIgnoredScrapedRoleIds] = useState<string[]>([]);
  const [importedScrapedRoleIds, setImportedScrapedRoleIds] = useState<string[]>([]);
  const [expandedRoleDetails, setExpandedRoleDetails] = useState<Record<string, boolean>>({});
  const [positiveKeywords, setPositiveKeywords] = useState<string[]>([]);
  const [negativeKeywords, setNegativeKeywords] = useState<string[]>([]);
  const [positiveSuggestions, setPositiveSuggestions] = useState<string[]>([]);
  const [negativeSuggestions, setNegativeSuggestions] = useState<string[]>([
    "intern",
    "entry level",
    "seasonal",
    "part-time",
    "contract",
    "commission",
    "volunteer",
  ]);
  const [positiveInput, setPositiveInput] = useState("");
  const [negativeInput, setNegativeInput] = useState("");
  const [csvFile, setCsvFile] = useState<string | null>(null);
  const [csvContent, setCsvContent] = useState("");
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvMsg, setCsvMsg] = useState<string | null>(null);
  const [csvErr, setCsvErr] = useState<string | null>(null);
  const trackerPulseTimer = useRef<number | null>(null);
  const preferredSectionRef = useRef<HTMLDivElement | null>(null);
  const [suggestedUrl, setSuggestedUrl] = useState(
    "https://www.indeed.com/jobs?q=jobs&l=United+States"
  );

  const normalizeKeyword = (v: any) =>
    String(v || "")
      .replace(/^[-–—]+/, "")
      .replace(/^[""']+|[""']+$/g, "")
      .split(/\s+/)
      .join(" ")
      .trim()
      .toLowerCase();

  const persistKeywordPrefs = (pos: string[], neg: string[]) => {
    try {
      localStorage.setItem(AUTO_POS_KW_KEY, JSON.stringify(pos));
      localStorage.setItem(AUTO_NEG_KW_KEY, JSON.stringify(neg));
    } catch {}
  };

  const addKeyword = (kind: "positive" | "negative", raw: string) => {
    const kw = normalizeKeyword(raw);
    if (!kw) return;
    const kwLow = kw.toLowerCase();
    if (kind === "positive") {
      // Remove from negative if present (cross-list guard)
      const cleanedNeg = negativeKeywords.filter((x) => normalizeKeyword(x).toLowerCase() !== kwLow);
      const next = Array.from(new Set([...positiveKeywords, kw].map((x) => normalizeKeyword(x)))).filter(Boolean).slice(0, 20);
      setPositiveKeywords(next);
      if (cleanedNeg.length !== negativeKeywords.length) setNegativeKeywords(cleanedNeg);
      setPositiveSuggestions((prev) =>
        Array.from(new Set([...(Array.isArray(prev) ? prev : []), kw].map((x) => normalizeKeyword(x)))).filter(Boolean).slice(0, 20)
      );
      persistKeywordPrefs(next, cleanedNeg);
      return;
    }
    // Remove from positive if present (cross-list guard)
    const cleanedPos = positiveKeywords.filter((x) => normalizeKeyword(x).toLowerCase() !== kwLow);
    if (cleanedPos.length !== positiveKeywords.length) setPositiveKeywords(cleanedPos);
    const combined = [...negativeKeywords, kw].map((x) => normalizeKeyword(x)).filter(Boolean);
    const seenLower = new Set<string>();
    const next: string[] = [];
    for (const c of combined) {
      const lo = c.toLowerCase();
      if (seenLower.has(lo)) continue;
      seenLower.add(lo);
      next.push(c);
    }
    setNegativeKeywords(next.slice(0, 20));
    setNegativeSuggestions((prev) =>
      Array.from(new Set([...(Array.isArray(prev) ? prev : []), kw].map((x) => normalizeKeyword(x)))).filter(Boolean).slice(0, 20)
    );
    persistKeywordPrefs(cleanedPos, next);
  };

  const addKeywordsFromInput = (kind: "positive" | "negative", rawInput: string): number => {
    const parts = String(rawInput || "")
      .split(/[,\n;]+/)
      .map((x) => normalizeKeyword(x))
      .filter(Boolean)
      .slice(0, 20);
    if (!parts.length) return 0;
    const cur = kind === "positive" ? positiveKeywords : negativeKeywords;
    const curNorm = new Set(cur.map((x) => normalizeKeyword(x).toLowerCase()));
    let added = 0;
    for (const kw of parts) {
      const k = normalizeKeyword(kw).toLowerCase();
      if (!k || curNorm.has(k)) continue;
      addKeyword(kind, kw);
      curNorm.add(k);
      added += 1;
    }
    return added;
  };

  const removeKeyword = (kind: "positive" | "negative", kw: string) => {
    const target = normalizeKeyword(kw).toLowerCase();
    if (kind === "positive") {
      const next = positiveKeywords.filter((x) => normalizeKeyword(x).toLowerCase() !== target);
      setPositiveKeywords(next);
      persistKeywordPrefs(next, negativeKeywords);
      return;
    }
    const next = negativeKeywords.filter((x) => normalizeKeyword(x).toLowerCase() !== target);
    setNegativeKeywords(next);
    persistKeywordPrefs(positiveKeywords, next);
  };

  const toggleKeyword = (kind: "positive" | "negative", kw: string) => {
    const target = normalizeKeyword(kw).toLowerCase();
    if (!target) return;
    const cur = kind === "positive" ? positiveKeywords : negativeKeywords;
    const exists = cur.some((x) => normalizeKeyword(x).toLowerCase() === target);
    if (exists) removeKeyword(kind, kw);
    else addKeyword(kind, kw);
  };

  useEffect(() => {
    setHasMounted(true);
    try {
      const cached = localStorage.getItem("job_descriptions");
      if (cached) {
        const parsed = JSON.parse(cached) as JobDescription[];
        // Drop old demo placeholder JDs so they don't keep showing up as "mock output".
        const cleanedRaw = (parsed || []).filter((jd) => {
          const isOldDemoId = (jd.id || "").startsWith("jd_demo_");
          const isOldDemoContent =
            (jd.company || "") === "TechCorp Inc." &&
            (jd.content || "").startsWith("Job description content from URL");
          return !isOldDemoId && !isOldDemoContent;
        });

        // Drop legacy "difficulty/grade" (replaced by preferenceStars) and normalize ranks.
        const cleaned = normalizeFavoriteRanks(cleanedRaw.map((jd) => {
          const { grade: _legacyGrade, difficulty: _legacyDifficulty, ...rest } = jd as any;
          const preferenceStars = clampPreferenceStars((jd as any)?.preferenceStars);
          if (preferenceStars) return { ...rest, preferenceStars } as JobDescription;
          return { ...rest } as JobDescription;
        }));

        setJobDescriptions(cleaned);
        localStorage.setItem("job_descriptions", JSON.stringify(cleaned));
      }
    } catch {
      // ignore malformed cache
    }
  }, []);

  useEffect(() => {
    try {
      const posRaw = localStorage.getItem(AUTO_POS_KW_KEY);
      const negRaw = localStorage.getItem(AUTO_NEG_KW_KEY);
      const posSaved = posRaw ? JSON.parse(posRaw) : [];
      const negSaved = negRaw ? JSON.parse(negRaw) : [];
      const pos = Array.isArray(posSaved) ? posSaved.map(normalizeKeyword).filter(Boolean) : [];
      const neg = Array.isArray(negSaved) ? negSaved.map(normalizeKeyword).filter(Boolean) : [];

      const resumeRaw = localStorage.getItem("resume_extract");
      const selectedRaw = localStorage.getItem("selected_job_description");
      const prefsRaw = localStorage.getItem("job_preferences");
      const personalityRaw = localStorage.getItem("personality_profile") || localStorage.getItem("personality_assessment");
      const resume = resumeRaw ? JSON.parse(resumeRaw) : null;
      const selected = selectedRaw ? JSON.parse(selectedRaw) : null;
      const prefs = prefsRaw ? JSON.parse(prefsRaw) : null;
      const personality = personalityRaw ? JSON.parse(personalityRaw) : null;

      const resumeSkills = Array.isArray(resume?.skills) ? resume.skills : [];
      const roleSkills = Array.isArray(selected?.required_skills)
        ? selected.required_skills
        : Array.isArray(selected?.requiredSkills)
        ? selected.requiredSkills
        : [];
      const prefSkills = Array.isArray(prefs?.skills)
        ? prefs.skills
        : Array.isArray(prefs?.Skills)
        ? prefs.Skills
        : [];
      const prefRoleCats = Array.isArray(prefs?.role_categories)
        ? prefs.role_categories
        : Array.isArray(prefs?.roleCategories)
        ? prefs.roleCategories
        : [];
      const personalityPositive = [
        ...(Array.isArray(personality?.strengths) ? personality.strengths : []),
        ...(Array.isArray(personality?.traits) ? personality.traits : []),
        ...(Array.isArray(personality?.preferred_roles) ? personality.preferred_roles : []),
        ...(Array.isArray(personality?.preferredRoles) ? personality.preferredRoles : []),
      ];
      const personalityNegative = [
        ...(Array.isArray(personality?.avoid_roles) ? personality.avoid_roles : []),
        ...(Array.isArray(personality?.avoidRoles) ? personality.avoidRoles : []),
        ...(Array.isArray(personality?.dislikes) ? personality.dislikes : []),
      ];
      const seedPool = [...resumeSkills, ...prefSkills, ...roleSkills, ...prefRoleCats]
        .concat(Array.isArray(personalityPositive) ? personalityPositive : [])
        .map((x) => normalizeKeyword(x))
        .filter(Boolean);
      const locationSeed = Array.isArray(prefs?.location_preferences)
        ? prefs.location_preferences
        : Array.isArray(prefs?.locationPreferences)
        ? prefs.locationPreferences
        : [];
      const firstQueryBits = [...prefRoleCats, ...prefSkills, ...resumeSkills].map((x) => normalizeKeyword(x)).filter(Boolean).slice(0, 4);
      const query = encodeURIComponent(firstQueryBits.join(" "));
      const where = encodeURIComponent(
        normalizeKeyword(
          (Array.isArray(locationSeed) && locationSeed[0]) ||
            prefs?.state ||
            prefs?.location_text ||
            "United States"
        )
      );
      if (query) {
        setSuggestedUrl(`https://www.indeed.com/jobs?q=${query}&l=${where || "United+States"}`);
      }

      let posInit = Array.from(new Set(pos)).slice(0, 20);
      if (!posInit.length) {
        posInit = Array.from(new Set(seedPool)).slice(0, 8);
      }

      const sugg = Array.from(
        new Set(
          [
            ...posInit,
            ...seedPool,
          ]
        )
      )
        .filter(Boolean)
        .slice(0, 14);

      setPositiveKeywords(posInit);
      setNegativeKeywords(neg.slice(0, 20));
      setPositiveSuggestions(sugg);
      if (neg.length === 0) {
        // Generic exclusions that apply across industries.
        setNegativeSuggestions((prev) =>
          Array.from(
            new Set(
              [
                ...(Array.isArray(prev) ? prev : []),
                ...(Array.isArray(personalityNegative) ? personalityNegative : []),
                "intern",
                "entry level",
                "seasonal",
                "part-time",
                "commission",
                "volunteer",
              ].map((x) => normalizeKeyword(x))
            )
          )
            .filter(Boolean)
            .slice(0, 20)
        );
      }
      if (!pos.length || !neg.length) persistKeywordPrefs(posInit, neg.slice(0, 20));
    } catch {
      // keep defaults
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadScrapedRoles = async () => {
    setScrapedRolesError(null);
    setIsLoadingScrapedRoles(true);
    try {
      const buildParams = (opts?: { simple?: boolean }) => {
        const params = new URLSearchParams({
          limit: String(opts?.simple ? Math.min(discoveryLimit, 180) : discoveryLimit),
          funnel_mode: funnelMode,
        });
        if (!opts?.simple) {
          try {
            const prefsRaw = localStorage.getItem("job_preferences");
            const resumeRaw = localStorage.getItem("resume_extract");
            const prefs = prefsRaw ? JSON.parse(prefsRaw) : null;
            const resume = resumeRaw ? JSON.parse(resumeRaw) : null;
            const listToCsv = (arr: unknown) =>
              Array.isArray(arr)
                ? arr
                    .map((x) => normalizeKeyword(x))
                    .filter(Boolean)
                    .slice(0, 20)
                    .join(", ")
                : "";
            const roleCategories = listToCsv(prefs?.role_categories || prefs?.roleCategories);
            const industries = listToCsv(prefs?.industries || prefs?.Industries);
            const resumeSkills = listToCsv(resume?.skills || resume?.Skills);
            const locations = listToCsv(prefs?.location_preferences || prefs?.locationPreferences);
            const minimumSalary = normalizeKeyword(prefs?.minimum_salary || prefs?.minimumSalary);
            const state = normalizeKeyword(prefs?.state);
            if (roleCategories) params.set("role_categories", roleCategories);
            if (industries) params.set("industries", industries);
            if (resumeSkills) params.set("resume_skills", resumeSkills);
            if (locations) params.set("location_preferences", locations);
            if (minimumSalary) params.set("minimum_salary_pref", minimumSalary);
            if (state) params.set("state", state);
          } catch {
            // best-effort context
          }
          if (positiveKeywords.length) params.set("positive_keywords", positiveKeywords.join(", "));
          if (negativeKeywords.length) params.set("negative_keywords", negativeKeywords.join(", "));
        }
        return params;
      };

      let res: ScrapedRolesResponse;
      let recovered = false;
      try {
        const params = buildParams();
        res = await api<ScrapedRolesResponse>(`/job-descriptions/scraped-roles?${params.toString()}`, "GET");
      } catch {
        // Degraded retry mode: simpler query profile to avoid hard failures.
        const params = buildParams({ simple: true });
        res = await api<ScrapedRolesResponse>(`/job-descriptions/scraped-roles?${params.toString()}`, "GET");
        recovered = true;
      }
      const roles = Array.isArray(res?.roles) ? res.roles : [];
      setScrapedRoles(roles);
      setHasEverLoadedRoles(true);
      setIgnoredScrapedRoleIds([]);
      setScrapedRolesMessage(
        recovered
          ? `Recovered using compatibility mode (reduced filters). ${String(res?.message || "")}`.trim()
          : String(res?.message || "")
      );
      setScrapedRolesMeta((res?.helper || null) as any);
    } catch (e: any) {
      setScrapedRoles([]);
      setScrapedRolesError(String(e?.message || "Failed to load matched roles."));
      setScrapedRolesMessage("");
      setScrapedRolesMeta(null);
    } finally {
      setIsLoadingScrapedRoles(false);
    }
  };

  const persistJobDescriptions = (next: JobDescription[]) => {
    setJobDescriptions(next);
    try {
      localStorage.setItem("job_descriptions", JSON.stringify(next));
    } catch {}
  };

  useEffect(() => {
    return () => {
      if (trackerPulseTimer.current) window.clearTimeout(trackerPulseTimer.current);
    };
  }, []);

  useEffect(() => {
    loadScrapedRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasMounted) return;
    const t = window.setTimeout(() => {
      loadScrapedRoles();
    }, 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMounted, positiveKeywords, negativeKeywords]);

  const importFromUrl = async (raw: string, opts?: { clearImporterInput?: boolean; seedImporterInput?: boolean }) => {
    const rawUrl = String(raw || "").trim();
    if (!rawUrl) return;

    // Guard: Indeed "share/search" URLs are often not the actual application page.
    // If we can, normalize them to a direct viewjob link; otherwise instruct the user.
    let finalUrl = rawUrl;
    const indeed = analyzeIndeedUrl(rawUrl);
    if (indeed.isIndeed && indeed.isSearchShare) {
      if (indeed.normalizedViewJobUrl) {
        finalUrl = indeed.normalizedViewJobUrl;
      } else {
        throw new Error(
          "That looks like an Indeed search/share URL. Please open the job, click “Apply” / “Apply on company site”, then copy the URL from the application page (or paste the role text instead)."
        );
      }
    }

    if (opts?.seedImporterInput) setImportUrl(finalUrl);

    const resp = await api<JobDescriptionResponse>("/job-descriptions/import", "POST", {
      url: finalUrl,
      text: null,
    });
    const jds = (resp.job_descriptions && resp.job_descriptions.length)
      ? resp.job_descriptions
      : (resp.job_description ? [resp.job_description] : []);

    if (jds.length) {
      const mappedAll: JobDescription[] = jds.map((jd) => ({
        id: jd.id,
        title: jd.title,
        company: jd.company,
        url: jd.url || undefined,
        content: jd.content || "",
        painPoints: jd.pain_points || [],
        requiredSkills: jd.required_skills || [],
        successMetrics: jd.success_metrics || [],
        location: jd.location || undefined,
        workMode: jd.work_mode || undefined,
        employmentType: jd.employment_type || undefined,
        salaryRange: jd.salary_range || undefined,
        responsibilities: (jd.responsibilities || undefined) as any,
        requirements: (jd.requirements || undefined) as any,
        benefits: (jd.benefits || undefined) as any,
        postedDate: jd.posted_date || undefined,
        postedText: jd.posted_text || undefined,
        jdJargon: extractJargon(jd.content || ""),
        preferenceStars: undefined,
        parsedAt: jd.parsed_at || new Date().toISOString(),
      }));

      setJobDescriptions((prev) => {
        const next = [...prev];
        for (const m of mappedAll) {
          const idx = next.findIndex((p) => p.id === m.id);
          if (idx >= 0) next[idx] = { ...next[idx], ...m };
          else next.push(m);
        }
        const normalized = normalizeFavoriteRanks(next);
        if (typeof window !== "undefined") localStorage.setItem("job_descriptions", JSON.stringify(normalized));
        return normalized;
      });
    }

    if (opts?.clearImporterInput) setImportUrl("");
  };

  const handleImport = async () => {
    const hasUrl = importType === "url" && Boolean(importUrl.trim());
    const hasText = importType === "text" && Boolean(importText.trim());
    if (!hasUrl && !hasText) return;

    setImportError(null);
    setIsImporting(true);

    try {
      if (importType === "url") {
        await importFromUrl(importUrl.trim(), { clearImporterInput: true, seedImporterInput: true });
      } else {
        const payload = {
          url: null,
          text: hasText ? importText.trim() : null,
        };
        const resp = await api<JobDescriptionResponse>("/job-descriptions/import", "POST", payload);
        const jds = (resp.job_descriptions && resp.job_descriptions.length)
          ? resp.job_descriptions
          : (resp.job_description ? [resp.job_description] : []);

        if (jds.length) {
          const mappedAll: JobDescription[] = jds.map((jd) => ({
            id: jd.id,
            title: jd.title,
            company: jd.company,
            url: jd.url || undefined,
            content: jd.content || "",
            painPoints: jd.pain_points || [],
            requiredSkills: jd.required_skills || [],
            successMetrics: jd.success_metrics || [],
            location: jd.location || undefined,
            workMode: jd.work_mode || undefined,
            employmentType: jd.employment_type || undefined,
            salaryRange: jd.salary_range || undefined,
            responsibilities: (jd.responsibilities || undefined) as any,
            requirements: (jd.requirements || undefined) as any,
            benefits: (jd.benefits || undefined) as any,
            postedDate: jd.posted_date || undefined,
            postedText: jd.posted_text || undefined,
            jdJargon: extractJargon(jd.content || ""),
            preferenceStars: undefined,
            parsedAt: jd.parsed_at || new Date().toISOString(),
          }));

          setJobDescriptions((prev) => {
            // Merge by id: replace existing items (so re-importing the same URL updates the card),
            // and append truly new ones.
            const next = [...prev];
            for (const m of mappedAll) {
              const idx = next.findIndex((p) => p.id === m.id);
              if (idx >= 0) next[idx] = { ...next[idx], ...m };
              else next.push(m);
            }
            const normalized = normalizeFavoriteRanks(next);
            if (typeof window !== "undefined") localStorage.setItem("job_descriptions", JSON.stringify(normalized));
            return normalized;
          });
        }
      }
      // Only clear inputs on success
      setImportText("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setImportError(msg);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDelete = (id: string) => {
    setJobDescriptions(prev => {
      const next = normalizeFavoriteRanks(prev.filter(jd => jd.id !== id));
      try { localStorage.setItem("job_descriptions", JSON.stringify(next)); } catch {}
      return next;
    });
    setEditMeta((cur) => (cur?.id === id ? null : cur));
  };

  const handleFavoriteRankChange = (id: string, nextRank: number | null) => {
    setJobDescriptions((prev) => {
      const max = prev.length;
      const wanted = nextRank === null ? null : Math.max(1, Math.min(max, Number(nextRank)));
      const usedByOther = new Set<number>();
      for (const jd of prev) {
        if (jd.id === id) continue;
        const r = Number((jd as any).favoriteRank);
        if (Number.isFinite(r) && r >= 1 && r <= max) usedByOther.add(r);
      }
      if (wanted !== null && usedByOther.has(wanted)) return prev;

      const next = normalizeFavoriteRanks(
        prev.map((jd) => {
          if (jd.id !== id) return jd;
          const out: JobDescription = { ...jd };
          if (wanted === null) delete (out as any).favoriteRank;
          else out.favoriteRank = wanted;
          return out;
        })
      );
      try { localStorage.setItem("job_descriptions", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const renderPreferencePicker = (jd: JobDescription) => {
    const cur = clampPreferenceStars((jd as any)?.preferenceStars);
    const stars = [1, 2, 3, 4, 5] as PreferenceStars[];
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="text-[10px] font-semibold text-white/60">Preference</div>
        <div className="inline-flex items-center gap-0.5 rounded-md border border-white/10 bg-black/20 px-2 py-1">
          {stars.map((s) => {
            const filled = (cur || 0) >= s;
            return (
              <button
                key={`pref_${jd.id}_${s}`}
                type="button"
                onClick={() => handlePreferenceStarsChange(jd.id, cur === s ? null : s)}
                className={`text-[14px] leading-none ${filled ? "text-yellow-300" : "text-white/25"} hover:text-yellow-200`}
                aria-label={`Set preference to ${s} star${s === 1 ? "" : "s"}`}
                title={`Preference: ${s}/5`}
              >
                ★
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const handlePreferenceStarsChange = (id: string, stars: PreferenceStars | null) => {
    setJobDescriptions((prev) => {
      const next = prev.map((jd) => {
        if (jd.id !== id) return jd;
        const out: JobDescription = { ...jd };
        if (!stars) delete (out as any).preferenceStars;
        else out.preferenceStars = stars;
        return out;
      });
      try { localStorage.setItem("job_descriptions", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const sortedJobDescriptions = [...jobDescriptions].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.parsedAt).getTime() - new Date(a.parsedAt).getTime();
    }
    const ar = Number((a as any).favoriteRank);
    const br = Number((b as any).favoriteRank);
    const aHas = Number.isFinite(ar) && ar >= 1;
    const bHas = Number.isFinite(br) && br >= 1;
    if (aHas && bHas) return ar - br;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    return new Date(b.parsedAt).getTime() - new Date(a.parsedAt).getTime();
  });

  const handleContinue = () => {
    if (jobDescriptions.length > 0) {
      localStorage.setItem('job_descriptions', JSON.stringify(jobDescriptions));
      router.push('/gap-analysis');
    }
  };

  const startEdit = (jd: JobDescription, field: "title" | "company" | "salaryRange") => {
    const value =
      field === "title" ? jd.title :
      field === "company" ? jd.company :
      (
        (jd.salaryRange || "").toLowerCase().includes("salary not provided")
          ? ""
          : (jd.salaryRange || "")
      );
    setEditMeta({ id: jd.id, field, value });
  };

  const saveEdit = () => {
    if (!editMeta) return;
    const { id, field } = editMeta;
    const raw = String(editMeta.value || "");
    const value = raw.trim();
    // Basic validation: title/company should not be blank
    if ((field === "title" || field === "company") && !value) return;

    setJobDescriptions((prev) => {
      const next = prev.map((jd) => {
        if (jd.id !== id) return jd;
        if (field === "title") return { ...jd, title: value };
        if (field === "company") return { ...jd, company: value };
        // salaryRange: allow empty (means "not provided")
        return { ...jd, salaryRange: value || "Salary not provided" };
      });
      try { localStorage.setItem("job_descriptions", JSON.stringify(next)); } catch {}
      return next;
    });

    setEditMeta(null);
  };

  const addToTracker = (jd: JobDescription) => {
    try {
      const key = "tracker_applications";
      const raw = localStorage.getItem(key);
      const prev = raw ? JSON.parse(raw) : [];
      const list = Array.isArray(prev) ? prev : [];

      const id = `trk_${Date.now()}`;
      const nextItem = {
        id,
        company: {
          name: jd.company,
          logo: jd.company ? `https://logo.clearbit.com/${jd.company.toLowerCase().replace(/\\s+/g, "")}.com` : undefined,
        },
        role: jd.title,
        favoriteRank: jd.favoriteRank ?? null,
        preferenceStars: jd.preferenceStars ?? null,
        status: "saved",
        appliedDate: new Date().toISOString().slice(0, 10),
        lastContact: new Date().toISOString().slice(0, 10),
        replyStatus: null,
        source: jd.url || "job_descriptions",
      };

      localStorage.setItem(key, JSON.stringify([nextItem, ...list]));
      setTrackerNotice(`Added to Role Tracker: ${jd.title} @ ${formatCompanyName(jd.company)}`);
      window.setTimeout(() => setTrackerNotice(null), 2500);

      // Notify other screens (Tracker) in the same SPA session.
      // (The native "storage" event won't fire in the same tab that writes localStorage.)
      try {
        window.dispatchEvent(new CustomEvent("trackerUpdated", { detail: nextItem }));
      } catch {}

      // Instant feedback right where the click happened
      setTrackerPulseId(jd.id);
      if (trackerPulseTimer.current) window.clearTimeout(trackerPulseTimer.current);
      trackerPulseTimer.current = window.setTimeout(() => setTrackerPulseId(null), 900);
    } catch {
      setTrackerNotice("Couldn’t add to Role Tracker.");
      window.setTimeout(() => setTrackerNotice(null), 2500);
    }
  };

  const toggleRoleDetails = (id: string) => {
    setExpandedRoleDetails((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  type ImportedRole = {
    id: string;
    title: string;
    company: string;
    url: string;
    location?: string | null;
    match_score?: number | null;
    salary_range?: string | null;
    posted_date?: string | null;
    posted_text?: string | null;
    requirements_summary?: string | null;
  };
  type CsvImportResponse = {
    success: boolean;
    message: string;
    imported_roles: ImportedRole[];
    helper?: { input_rows?: number; imported?: number; dropped?: number };
  };

  const onPickCsv = (f: File | null) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvContent(String(reader.result || ""));
      setCsvFile(f.name);
    };
    reader.readAsText(f);
  };

  const importCsv = async () => {
    setCsvErr(null);
    setCsvMsg(null);
    if (!csvContent.trim()) {
      setCsvErr("Choose a CSV file first.");
      return;
    }
    setCsvBusy(true);
    try {
      const resp = await api<CsvImportResponse>("/applications/import/matches-csv", "POST", {
        csv_content: csvContent,
      });
      const rows = Array.isArray(resp?.imported_roles) ? resp.imported_roles : [];
      if (!rows.length) {
        setCsvMsg("No importable rows found in the CSV.");
        return;
      }
      const merged = [...jobDescriptions];
      const byId = new Map(merged.map((jd) => [jd.id, jd]));
      for (const r of rows) {
        const jd: JobDescription = {
          id: r.id,
          title: String(r.title || "").trim(),
          company: String(r.company || "").trim(),
          url: String(r.url || "").trim() || undefined,
          content: String(r.requirements_summary || "").trim(),
          painPoints: byId.get(r.id)?.painPoints || [],
          requiredSkills: String(r.requirements_summary || "")
            .split(/[;,]/)
            .map((x) => x.trim())
            .filter(Boolean)
            .slice(0, 12),
          successMetrics: byId.get(r.id)?.successMetrics || [],
          location: String(r.location || "").trim() || undefined,
          salaryRange: String(r.salary_range || "").trim() || undefined,
          postedDate: String(r.posted_date || "").trim() || undefined,
          postedText: String(r.posted_text || "").trim() || undefined,
          jdJargon: [],
          parsedAt: new Date().toISOString(),
        };
        if (byId.has(r.id)) {
          const idx = merged.findIndex((x) => x.id === r.id);
          if (idx >= 0) merged[idx] = { ...merged[idx], ...jd };
        } else {
          merged.push(jd);
        }
      }
      const normalized = normalizeFavoriteRanks(merged);
      persistJobDescriptions(normalized);
      setCsvMsg(`Imported ${rows.length} roles from CSV.`);
    } catch (e: any) {
      setCsvErr(String(e?.message || "CSV import failed."));
    } finally {
      setCsvBusy(false);
    }
  };

  const exportRolesCsv = () => {
    if (!jobDescriptions.length) return;
    const headers = [
      "Job Title",
      "Company",
      "Location",
      "Salary Range",
      "Posted Date",
      "Job URL",
      "Preference Stars",
      "Favorite Rank",
      "Work Mode",
      "Employment Type",
      "Required Skills",
      "Pain Points",
      "Success Metrics",
      "Imported On",
    ];
    const esc = (v: string) => {
      const s = String(v || "").replace(/"/g, '""');
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
    };
    const rows = jobDescriptions.map((jd) => [
      esc(jd.title),
      esc(jd.company),
      esc(jd.location || ""),
      esc(jd.salaryRange || ""),
      esc(jd.postedText || jd.postedDate || ""),
      esc(jd.url || ""),
      jd.preferenceStars != null ? String(jd.preferenceStars) : "",
      jd.favoriteRank != null ? String(jd.favoriteRank) : "",
      esc(jd.workMode || ""),
      esc(jd.employmentType || ""),
      esc((jd.requiredSkills || []).join("; ")),
      esc((jd.painPoints || []).join("; ")),
      esc((jd.successMetrics || []).join("; ")),
      esc(jd.parsedAt ? new Date(jd.parsedAt).toLocaleDateString() : ""),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const name = (() => {
      try {
        const raw = localStorage.getItem("resume_extract");
        const resume = raw ? JSON.parse(raw) : null;
        const n = String(resume?.name || "").trim().replace(/\s+/g, "_");
        if (n) return `${n}_roles_${new Date().toISOString().slice(0, 10)}.csv`;
      } catch {}
      return `roleferry_roles_${new Date().toISOString().slice(0, 10)}.csv`;
    })();
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const [enrichedBusy, setEnrichedBusy] = useState(false);
  const [enrichedMsg, setEnrichedMsg] = useState<string | null>(null);

  const exportEnrichedCsv = async () => {
    if (!jobDescriptions.length) return;
    setEnrichedBusy(true);
    setEnrichedMsg(null);
    try {
      const contacts: any[] = (() => {
        try {
          const raw = localStorage.getItem("selected_contacts");
          const arr = raw ? JSON.parse(raw) : [];
          return Array.isArray(arr) ? arr : [];
        } catch { return []; }
      })();
      const customerName = (() => {
        try {
          const raw = localStorage.getItem("resume_extract");
          const resume = raw ? JSON.parse(raw) : null;
          return String(resume?.name || "").trim() || "customer";
        } catch { return "customer"; }
      })();
      const roles = jobDescriptions.map((jd) => ({
        job_id: jd.id,
        title: jd.title,
        company: jd.company,
        location: jd.location || null,
        job_url: jd.url || null,
        match_score: (jd as any).matchScore ?? null,
        eligible: true,
        requirements_summary: (jd.requiredSkills || []).join("; ") || null,
        date_posted: jd.postedText || jd.postedDate || null,
      }));
      const resp = await api<{ filename: string; content: string }>("/applications/export/enriched", "POST", {
        customer_name: customerName,
        roles,
        contacts: contacts.map((c: any) => ({
          id: c.id || null,
          name: c.name || null,
          title: c.title || null,
          email: c.email || null,
          linkedin_url: c.linkedin_url || c.linkedinUrl || null,
          company: c.company || null,
        })),
      });
      const blob = new Blob([resp.content], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = resp.filename || `enriched_roles_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const contactCount = contacts.length;
      setEnrichedMsg(`Downloaded enriched CSV with ${roles.length} roles and ${contactCount} contacts.`);
    } catch (e: any) {
      setEnrichedMsg(`Export failed: ${e?.message || "Unknown error"}`);
    } finally {
      setEnrichedBusy(false);
    }
  };

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 mb-4">
          <a href="/personality" className="inline-flex items-center text-white/70 hover:text-white font-medium transition-colors">
            <span className="mr-2">←</span> Back to Personality
        </a>
      </div>
      <div className="max-w-6xl mx-auto px-4">
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="flex justify-between items-center mb-8">
            <div>
            <h1 className="text-3xl font-bold text-white mb-2">Role Search</h1>
              <p className="text-white/70">
                Import role descriptions (job postings) to extract business challenges, required skills, and success metrics.
              </p>
            </div>
            <div className="bg-gray-900/70 text-white px-4 py-2 rounded-lg font-semibold text-sm shadow-lg border border-white/10">
              Step 4 of 12
            </div>
          </div>

          {trackerNotice && (
            <div className="mb-6 rounded-lg border border-blue-400/20 bg-blue-500/10 p-4 text-sm text-blue-100">
              {trackerNotice}
            </div>
          )}

          <div className="mb-6 rounded-lg border border-white/10 bg-black/20 p-4">
            <button
              type="button"
              onClick={() => setJobSitesOpen((v) => !v)}
              className="flex w-full items-center justify-between text-sm font-bold text-white hover:text-white/90"
            >
              <span>Job Sites</span>
              <span className="text-white/50 text-xs">{jobSitesOpen ? "▲" : "▼"}</span>
            </button>

            {jobSitesOpen ? (
            <>
            <div className="mt-2 text-xs text-white/60">
              Open a site, find a posting, then paste the URL or posting text below.
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-md border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold text-white/70 mb-2">General boards</div>
                <ul className="space-y-0.5 text-xs">
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.linkedin.com/jobs/" target="_blank" rel="noopener noreferrer">LinkedIn Jobs</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.indeed.com/" target="_blank" rel="noopener noreferrer">Indeed</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.google.com/search?q=jobs" target="_blank" rel="noopener noreferrer">Google Jobs</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.glassdoor.com/Job/index.htm" target="_blank" rel="noopener noreferrer">Glassdoor</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.ziprecruiter.com/" target="_blank" rel="noopener noreferrer">ZipRecruiter</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.monster.com/jobs/" target="_blank" rel="noopener noreferrer">Monster</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.careerbuilder.com/" target="_blank" rel="noopener noreferrer">CareerBuilder</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.simplyhired.com/" target="_blank" rel="noopener noreferrer">SimplyHired</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.themuse.com/jobs" target="_blank" rel="noopener noreferrer">The Muse</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.usajobs.gov/" target="_blank" rel="noopener noreferrer">USAJOBS (US Government)</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://joinhandshake.com/" target="_blank" rel="noopener noreferrer">Handshake (Students)</a></li>
                </ul>
              </div>

              <div className="rounded-md border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold text-white/70 mb-2">Startups & remote</div>
                <ul className="space-y-0.5 text-xs">
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://wellfound.com/jobs" target="_blank" rel="noopener noreferrer">Wellfound (AngelList Talent)</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.ycombinator.com/jobs" target="_blank" rel="noopener noreferrer">Work at a Startup (YC)</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://remoteok.com/" target="_blank" rel="noopener noreferrer">Remote OK</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://weworkremotely.com/" target="_blank" rel="noopener noreferrer">We Work Remotely</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://remotive.com/" target="_blank" rel="noopener noreferrer">Remotive</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://remote.co/remote-jobs/" target="_blank" rel="noopener noreferrer">Remote.co</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.workingnomads.com/jobs" target="_blank" rel="noopener noreferrer">Working Nomads</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://himalayas.app/jobs" target="_blank" rel="noopener noreferrer">Himalayas</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://app.welcometothejungle.com/" target="_blank" rel="noopener noreferrer">Welcome to the Jungle (formerly Otta)</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.ventureloop.com/" target="_blank" rel="noopener noreferrer">VentureLoop (Startups)</a></li>
                </ul>
              </div>

              <div className="rounded-md border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold text-white/70 mb-2">Tech boards</div>
                <ul className="space-y-0.5 text-xs">
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.builtin.com/jobs" target="_blank" rel="noopener noreferrer">Built In (Tech)</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.dice.com/" target="_blank" rel="noopener noreferrer">Dice</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.techcareers.com/" target="_blank" rel="noopener noreferrer">TechCareers</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.levels.fyi/jobs/" target="_blank" rel="noopener noreferrer">Levels.fyi Jobs (Salary Data)</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://simplify.jobs/" target="_blank" rel="noopener noreferrer">Simplify.jobs</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://jobright.ai/" target="_blank" rel="noopener noreferrer">Jobright.ai</a></li>
                </ul>
              </div>

              <div className="rounded-md border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold text-white/70 mb-2">Top Company Boards</div>
                <ul className="space-y-0.5 text-xs">
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://careers.google.com/" target="_blank" rel="noopener noreferrer">Google Careers</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://jobs.careers.microsoft.com/" target="_blank" rel="noopener noreferrer">Microsoft Careers</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.amazon.jobs/" target="_blank" rel="noopener noreferrer">Amazon Jobs</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://jobs.apple.com/" target="_blank" rel="noopener noreferrer">Apple Jobs</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.metacareers.com/" target="_blank" rel="noopener noreferrer">Meta Careers</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://jobs.netflix.com/" target="_blank" rel="noopener noreferrer">Netflix Jobs</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.shopify.com/careers" target="_blank" rel="noopener noreferrer">Shopify Careers</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://stripe.com/jobs" target="_blank" rel="noopener noreferrer">Stripe Jobs</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://careers.airbnb.com/" target="_blank" rel="noopener noreferrer">Airbnb Careers</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.salesforce.com/company/careers/" target="_blank" rel="noopener noreferrer">Salesforce Careers</a></li>
                </ul>
              </div>
            </div>
            </>
            ) : null}
          </div>

          <div className="mb-6 flex justify-between items-center">
            <div className="flex-1">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="inline-flex items-center gap-2">
                      <div className="inline-flex rounded-full border border-white/10 bg-black/25 p-1">
                        <button
                          type="button"
                          onClick={() => setImportType("url")}
                          aria-pressed={importType === "url"}
                          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                            importType === "url"
                              ? "brand-gradient text-black"
                              : "text-white/80 hover:bg-white/10"
                          }`}
                        >
                          Import URL
                        </button>
                        <button
                          type="button"
                          onClick={() => setImportType("text")}
                          aria-pressed={importType === "text"}
                          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                            importType === "text"
                              ? "brand-gradient text-black"
                              : "text-white/80 hover:bg-white/10"
                          }`}
                        >
                          Paste text
                        </button>
                      </div>
                      {csvContent.trim() ? (
                        <button
                          type="button"
                          onClick={importCsv}
                          disabled={csvBusy}
                          className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-4 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
                        >
                          {csvBusy ? "Importing..." : `Import ${csvFile || "CSV"}`}
                        </button>
                      ) : (
                        <label className="inline-flex cursor-pointer items-center rounded-full border border-white/10 bg-black/25 px-4 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10">
                          Choose CSV
                          <input
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={(e) => onPickCsv((e.target.files && e.target.files[0]) || null)}
                          />
                        </label>
                      )}
                    </div>
                    {csvMsg ? <div className="text-xs text-emerald-200">{csvMsg}</div> : null}
                    {csvErr ? <div className="text-xs text-red-300">{csvErr}</div> : null}
                  </div>

                  {importType === "url" ? (
                    <>
                      <div className="text-xs text-white/70 mb-1">Paste a role URL</div>
                      <input
                        type="url"
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        placeholder="Paste a role URL (or a listing URL) and import"
                        className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {(() => {
                        const indeed = analyzeIndeedUrl(importUrl);
                        if (!indeed.isIndeed) return null;
                        if (!indeed.isSearchShare) return null;
                        return (
                          <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">
                            <div className="font-semibold">Indeed tip</div>
                            <div className="mt-1 text-amber-100/90">
                              Don’t paste the “share/search” URL from the results page. Open the job, click{" "}
                              <span className="font-semibold">Apply</span> /{" "}
                              <span className="font-semibold">Apply on company site</span>, then copy the URL from that
                              application page (often not on `indeed.com`). You can also use “Paste text”.
                            </div>
                            {indeed.normalizedViewJobUrl ? (
                              <button
                                type="button"
                                className="mt-2 underline font-semibold hover:text-white"
                                onClick={() => setImportUrl(indeed.normalizedViewJobUrl || "")}
                                title="Use a direct Indeed viewjob URL"
                              >
                                Use direct link: {indeed.normalizedViewJobUrl}
                              </button>
                            ) : null}
                          </div>
                        );
                      })()}
                      <div className="mt-1 text-xs text-white/60">
                        Suggested:{" "}
                        <button
                          type="button"
                          className="underline hover:text-white"
                          onClick={() => {
                            // Always switch to URL mode so the user immediately sees the populated field.
                            setImportType("url");
                            setImportUrl(suggestedUrl);
                          }}
                        >
                          Google Careers results page
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs text-white/70 mb-1">Paste role description</div>
                      <textarea
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        placeholder="Paste role description"
                        className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500 min-h-[280px] resize-y"
                      />
                    </>
                  )}

                  {importError && (
                    <div className="mt-2 text-xs text-red-300">
                      Import failed: {importError}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleImport}
                    disabled={
                      isImporting ||
                      (importType === "url" ? !importUrl.trim() : !importText.trim())
                    }
                    className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {isImporting ? (
                      <>
                        <InlineSpinner />
                        <span>Parsing</span>
                      </>
                    ) : (
                      "Import"
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            {hasMounted && jobDescriptions.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="text-[11px] font-semibold text-white/60">Sort</div>
                <div className="inline-flex items-center rounded-full border border-white/10 bg-black/20 p-1">
                  <button
                    type="button"
                    onClick={() => setSortBy("date")}
                    aria-pressed={sortBy === "date"}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      sortBy === "date" ? "brand-gradient text-black" : "text-white/80 hover:bg-white/10"
                    }`}
                    title="Sort by newest import"
                  >
                    Date
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy("favoriteRank")}
                    aria-pressed={sortBy === "favoriteRank"}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      sortBy === "favoriteRank" ? "brand-gradient text-black" : "text-white/80 hover:bg-white/10"
                    }`}
                    title="Sort by Favorite Rank (1..N)"
                  >
                    Rank
                  </button>
                </div>
              </div>
            )}
          </div>

          <div ref={preferredSectionRef} className="mt-8 grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-8 md:order-1 space-y-1">
              <CollapsibleSection title="Preferred Roles" count={jobDescriptions.length} defaultOpen>
              {!hasMounted || jobDescriptions.length === 0 ? (
                <div className="text-center py-8">
                  <h3 className="text-lg font-medium text-white mb-2">No Roles Yet</h3>
                  <p className="text-white/70 mb-2 text-sm">
                    Import role descriptions from URLs or paste text to get started, or click Preferred on a matched role below.
                  </p>
                </div>
              ) : (
                sortedJobDescriptions.map((jd) => (
                  <div key={jd.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-white break-words">{jd.title}</h3>
                        <p className="mt-0.5 text-white/70 break-words text-sm">{formatCompanyName(jd.company)}</p>
                        <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                          {jd.salaryRange && !/^salary/i.test(jd.salaryRange.trim()) && !/not (listed|provided)/i.test(jd.salaryRange) && !/^\{/.test(jd.salaryRange.trim()) && !/^\$0\s*-\s*\$0/.test(jd.salaryRange) ? (
                            <span className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/80">
                              {jd.salaryRange}
                            </span>
                          ) : null}
                          {postedLabel(jd) && postedLabel(jd) !== "Unknown" ? (
                            <span className="px-2 py-1 rounded-full border border-blue-400/25 bg-blue-500/10 text-blue-100">
                              Posted: {postedLabel(jd)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {renderPreferencePicker(jd)}
                        {(() => {
                          const maxRank = jobDescriptions.length;
                          const current = Number((jd as any).favoriteRank);
                          const currentOk = Number.isFinite(current) && current >= 1 && current <= maxRank;
                          const used = new Set<number>();
                          for (const other of jobDescriptions) {
                            if (other.id === jd.id) continue;
                            const r = Number((other as any).favoriteRank);
                            if (Number.isFinite(r) && r >= 1 && r <= maxRank) used.add(r);
                          }
                          const available: Array<number | null> = [null, ...Array.from({ length: maxRank }, (_, i) => i + 1).filter((n) => !used.has(n))];
                          const cur: number | null = currentOk ? current : null;
                          const curIdx = Math.max(0, available.indexOf(cur));
                          const display = cur === null ? "—" : String(cur);
                          const cycle = (dir: -1 | 1) => {
                            if (!available.length) return handleFavoriteRankChange(jd.id, null);
                            const nextIdx = (curIdx + dir + available.length) % available.length;
                            handleFavoriteRankChange(jd.id, available[nextIdx]);
                          };
                          return (
                            <div className="flex flex-col items-end gap-1">
                              <div className="text-[10px] font-semibold text-white/60">Favorite Rank</div>
                              <div className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/20 px-1 py-1">
                                <button type="button" onClick={() => cycle(-1)} className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white">◀</button>
                                <button type="button" onClick={() => cycle(1)} className="min-w-[2rem] rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white/80 hover:bg-white/10 hover:text-white">{display}</button>
                                <button type="button" onClick={() => cycle(1)} className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white">▶</button>
                              </div>
                            </div>
                          );
                        })()}
                        <button
                          type="button"
                          onClick={() => addToTracker(jd)}
                          className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
                        >
                          Add to Role Tracker
                          {trackerPulseId === jd.id ? (
                            <span className="ml-1 inline-flex items-center text-green-300" aria-label="Added">
                              ✅
                            </span>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(jd.id)}
                          className="rounded-md border border-red-500/25 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-200 hover:bg-red-500/15"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 border-t border-white/10 pt-2 flex items-center gap-2">
                      {jd.url ? (
                        <a
                          href={jd.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs font-semibold text-blue-200 hover:bg-white/10 hover:text-blue-100"
                        >
                          View Online
                          <span aria-hidden="true">↗</span>
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => toggleRoleDetails(jd.id)}
                        className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-white/80 hover:bg-white/10"
                      >
                        <span>{expandedRoleDetails[jd.id] ? "Hide details" : "Show details"}</span>
                        <span>{expandedRoleDetails[jd.id] ? "▲" : "▼"}</span>
                      </button>
                    </div>

                    {expandedRoleDetails[jd.id] ? (
                      <>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Pain Points */}
                    <div>
                      <h4 className="font-semibold text-white mb-3">Business Challenges</h4>
                      <ul className="space-y-2">
                        {jd.painPoints.map((point, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="text-red-500 mt-1">•</span>
                            <span className="text-sm text-white/80">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Salary + Required Skills */}
                    <div>
                      <h4 className="font-semibold text-white mb-3">Salary</h4>
                      <div className="mb-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold text-white/70 mb-1">Range</div>
                          {editMeta?.id === jd.id && editMeta.field === "salaryRange" ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={saveEdit}
                                className="rounded-md bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditMeta(null)}
                                className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/15"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEdit(jd, "salaryRange")}
                              className="inline-flex items-center rounded-full border border-orange-400/30 bg-orange-500/15 px-2 py-0.5 text-[11px] font-semibold text-orange-200 hover:bg-orange-500/20 hover:text-orange-100"
                            >
                              Edit salary
                            </button>
                          )}
                        </div>

                        {editMeta?.id === jd.id && editMeta.field === "salaryRange" ? (
                          <input
                            value={editMeta.value}
                            onChange={(e) => setEditMeta({ ...editMeta, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                saveEdit();
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                setEditMeta(null);
                              }
                            }}
                            placeholder="e.g., $120,000 - $150,000 (or leave blank)"
                            className="mt-2 w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Edit salary"
                            autoFocus
                          />
                        ) : (
                          <div className="text-sm text-white/80">
                            {jd.salaryRange ? jd.salaryRange : "Salary not provided"}
                          </div>
                        )}
                      </div>
                      <div className="h-px w-full bg-white/10 my-3" />
                      <h4 className="font-semibold text-white mb-3">Required Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {jd.requiredSkills.map((skill, index) => (
                          <span
                            key={index}
                            className="bg-blue-50 text-blue-200 px-2 py-1 rounded-full text-xs border border-white/10"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Success Metrics */}
                    <div>
                      <h4 className="font-semibold text-white mb-3">Success Metrics</h4>
                      <ul className="space-y-2">
                        {jd.successMetrics.map((metric, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <span className="text-green-500 mt-1">•</span>
                            <span className="text-sm text-white/80">{metric}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Requirements / Benefits (best-effort) */}
                    <div>
                      <h4 className="font-semibold text-white mb-3">Requirements & Benefits</h4>
                      {(jd.requirements && jd.requirements.length > 0) ? (
                        <div className="mb-3">
                          <div className="text-xs font-semibold text-white/70 mb-1">Requirements</div>
                          <ul className="space-y-1">
                            {jd.requirements.slice(0, 4).map((r, i) => (
                              <li key={`req_${i}`} className="text-sm text-white/80">• {r}</li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <div className="text-xs text-white/50 mb-2">No requirements extracted yet.</div>
                      )}
                      {(jd.benefits && jd.benefits.length > 0) ? (
                        <div>
                          <div className="text-xs font-semibold text-white/70 mb-1">Benefits</div>
                          <ul className="space-y-1">
                            {jd.benefits.slice(0, 4).map((b, i) => (
                              <li key={`ben_${i}`} className="text-sm text-white/80">• {b}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>

                    </div>
                    {/* JD Jargon intentionally removed (low-signal for job seekers) */}
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="text-xs text-white/60">Posted: {postedLabel(jd)}</div>
                      <div className="text-xs text-white/50">Imported on {new Date(jd.parsedAt).toLocaleDateString()}</div>
                    </div>
                    </>
                    ) : null}
                  </div>
                ))
              )}
              </CollapsibleSection>
            </div>
            <div className="md:col-span-4 md:order-2">
              <CollapsibleSection title="Keywords" defaultOpen>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          loadScrapedRoles();
                          const el = document.getElementById("matched-roles-section");
                          if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 300);
                        }}
                        disabled={isLoadingScrapedRoles}
                        className="min-w-[170px] rounded-md border border-emerald-400/35 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                        title={hasEverLoadedRoles ? "Refresh matched roles" : "Generate and view matched roles"}
                      >
                        {isLoadingScrapedRoles ? (
                          <>
                            <InlineSpinner className="h-3.5 w-3.5" />
                            <span>Refreshing</span>
                          </>
                        ) : hasEverLoadedRoles ? (
                          "Refresh Roles"
                        ) : (
                          "See Matched Roles"
                        )}
                      </button>
                    </div>
                    <div className="mt-2 text-[11px]">
                      <div className="flex items-center gap-3">
                        <span className="text-white/50 font-semibold shrink-0">Broad</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={strictness}
                          onChange={(e) => setStrictness(Number(e.target.value))}
                          className="flex-1 h-1.5 accent-emerald-400 cursor-pointer"
                          title={`Strictness: ${strictness}%`}
                        />
                        <span className="text-white/50 font-semibold shrink-0">Strict</span>
                      </div>
                      <div className="mt-1 text-[10px] text-white/40 text-center">
                        {strictness <= 33
                          ? "At least a few keyword matches"
                          : strictness <= 66
                          ? "More keyword matches"
                          : "Most keyword matches"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-3 rounded-md border border-white/10 bg-black/20 p-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Positive keywords</div>
                    {positiveKeywords.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {positiveKeywords.map((kw) => (
                          <button
                            key={`pos_kw_${kw}`}
                            type="button"
                            onClick={() => removeKeyword("positive", kw)}
                            className="rounded-full border border-emerald-400/50 bg-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-100"
                            title="Remove keyword"
                          >
                            <span>{kw}</span>
                            <span className="ml-1 text-emerald-300/60">✕</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {positiveSuggestions.slice(0, 14).map((kw) => {
                        const on = positiveKeywords.some((x) => normalizeKeyword(x).toLowerCase() === normalizeKeyword(kw).toLowerCase());
                        return (
                          <button
                            key={`pos_s_${kw}`}
                            type="button"
                            onClick={() => toggleKeyword("positive", kw)}
                            className={`rounded-full border px-2 py-0.5 text-[11px] ${
                              on ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100" : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                            }`}
                          >
                            {kw}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={positiveInput}
                        onChange={(e) => setPositiveInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const added = addKeywordsFromInput("positive", positiveInput);
                            setPositiveInput("");
                            setScrapedRolesMessage(
                              added > 0
                                ? `Added ${added} positive keyword${added === 1 ? "" : "s"}.`
                                : "No new positive keywords were added."
                            );
                          }
                        }}
                        placeholder="Add positive keyword"
                        className="flex-1 rounded-md border border-white/15 bg-black/30 px-2.5 py-1.5 text-xs text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const added = addKeywordsFromInput("positive", positiveInput);
                          setPositiveInput("");
                          setScrapedRolesMessage(
                            added > 0
                              ? `Added ${added} positive keyword${added === 1 ? "" : "s"}.`
                              : "No new positive keywords were added."
                          );
                        }}
                        className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Negative keywords</div>
                    {negativeKeywords.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {negativeKeywords.map((kw) => (
                          <button
                            key={`neg_kw_${kw}`}
                            type="button"
                            onClick={() => removeKeyword("negative", kw)}
                            className="rounded-full border border-rose-400/50 bg-rose-500/20 px-2 py-0.5 text-[11px] text-rose-100"
                            title="Remove keyword"
                          >
                            <span className="font-bold text-red-300 mr-0.5">−</span>
                            <span>{kw}</span>
                            <span className="ml-1 text-red-300/60">✕</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {negativeSuggestions.slice(0, 14).map((kw) => {
                        const on = negativeKeywords.some((x) => normalizeKeyword(x).toLowerCase() === normalizeKeyword(kw).toLowerCase());
                        return (
                          <button
                            key={`neg_s_${kw}`}
                            type="button"
                            onClick={() => toggleKeyword("negative", kw)}
                            className={`rounded-full border px-2 py-0.5 text-[11px] ${
                              on ? "border-rose-400/50 bg-rose-500/20 text-rose-100" : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"
                            }`}
                          >
                            {kw}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={negativeInput}
                        onChange={(e) => setNegativeInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const added = addKeywordsFromInput("negative", negativeInput);
                            setNegativeInput("");
                            setScrapedRolesMessage(
                              added > 0
                                ? `Added ${added} negative keyword${added === 1 ? "" : "s"}.`
                                : "No new negative keywords were added."
                            );
                          }
                        }}
                        placeholder="Add negative keyword"
                        className="flex-1 rounded-md border border-white/15 bg-black/30 px-2.5 py-1.5 text-xs text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const added = addKeywordsFromInput("negative", negativeInput);
                          setNegativeInput("");
                          setScrapedRolesMessage(
                            added > 0
                              ? `Added ${added} negative keyword${added === 1 ? "" : "s"}.`
                              : "No new negative keywords were added."
                          );
                        }}
                        className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

              </CollapsibleSection>
            </div>
          </div>

          <div id="matched-roles-section" className="mt-8">
          <CollapsibleSection title="Matched Roles" count={scrapedRoles.length} defaultOpen>
            {isLoadingScrapedRoles ? (
              <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-center">
                <InlineSpinner className="mx-auto h-5 w-5" />
                <div className="mt-2 text-sm text-white/70">Finding matched roles...</div>
              </div>
            ) : null}

            {scrapedRolesError ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                {scrapedRolesError}
              </div>
            ) : null}

            {!isLoadingScrapedRoles && scrapedRoles.length === 0 && !scrapedRolesError ? (
              <div className="text-center py-6 text-sm text-white/60">
                No matched roles yet. Set your keywords above and click <span className="font-semibold text-emerald-200">See Matched Roles</span>.
              </div>
            ) : null}

            {(() => {
              const minScore = strictness <= 33 ? 0 : strictness <= 66 ? 25 : 50;
              const visibleScrapedRoles = scrapedRoles
                .filter((r) => !ignoredScrapedRoleIds.includes(String(r.id || "")))
                .filter((r) => Number(r.match_score || 0) >= minScore)
                .filter((r) => {
                  if (!negativeKeywords.length) return true;
                  const blob = `${r.title} ${r.snippet || ""}`.toLowerCase();
                  return !negativeKeywords.some((kw) => blob.includes(kw.toLowerCase()));
                });
              const greatFit = visibleScrapedRoles.filter((r) => Number(r.match_score || 0) >= 55);
              const fairFit = visibleScrapedRoles.filter((r) => { const s = Number(r.match_score || 0); return s >= 40 && s < 55; });
              const weakFit = visibleScrapedRoles.filter((r) => Number(r.match_score || 0) < 40).slice(0, 5);
              const displayRoles = [...greatFit, ...fairFit, ...weakFit];

              const fitLabel = (score: number) => {
                if (score >= 55) return { text: "great fit", cls: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" };
                if (score >= 40) return { text: "fair fit", cls: "border-amber-400/30 bg-amber-500/10 text-amber-100" };
                return { text: "weak fit", cls: "border-white/15 bg-white/5 text-white/50" };
              };

              return displayRoles.length > 0 ? (
              <div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-white">Matched Roles</h3>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-white/80">
                      {displayRoles.length} roles
                    </span>
                    {typeof scrapedRolesMeta?.unique_companies === "number" ? (
                      <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-white/70">
                        {scrapedRolesMeta.unique_companies} companies
                      </span>
                    ) : null}
                    {greatFit.length > 0 ? (
                      <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-emerald-100">
                        {greatFit.length} great fit
                      </span>
                    ) : null}
                    {fairFit.length > 0 ? (
                      <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-amber-100">
                        {fairFit.length} fair fit
                      </span>
                    ) : null}
                    {weakFit.length > 0 ? (
                      <span className="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-white/60">
                        {weakFit.length} weak fit
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="space-y-3">
                  {displayRoles.map((r) => {
                    const score = Number(r.match_score || 0);
                    const fit = fitLabel(score);
                    const alreadyImported = importedScrapedRoleIds.includes(String(r.id || ""));
                    return (
                    <div key={r.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold text-white break-words">{r.title}</h3>
                          <p className="mt-0.5 text-white/70 break-words text-sm">{formatCompanyName(String(r.company || "Unknown"))}</p>
                          <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                            {r.salary_range && !/^\$0\s*-\s*\$0/.test(r.salary_range) ? (
                              <span className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/80">
                                {r.salary_range}
                              </span>
                            ) : null}
                            {r.posted_text ? (
                              <span className="px-2 py-1 rounded-full border border-blue-400/25 bg-blue-500/10 text-blue-100">
                                Posted: {r.posted_text}
                              </span>
                            ) : null}
                            {r.location ? (
                              <span className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/70">
                                {r.location}
                              </span>
                            ) : null}
                            {r.work_mode ? (
                              <span className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/70">
                                {r.work_mode}
                              </span>
                            ) : null}
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${fit.cls}`}>
                              {Math.max(0, Math.min(100, score))}% &middot; {fit.text}
                            </span>
                          </div>
                          {r.role_family ? (
                            <div className="mt-1 text-[10px] text-white/50">{r.role_family}</div>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {alreadyImported ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 cursor-default">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                              Added
                            </span>
                          ) : (
                          <button
                            type="button"
                            className="rounded-md border border-emerald-400/40 bg-emerald-500/20 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/30"
                            disabled={isImporting}
                            onClick={async () => {
                              const roleUrl = String(r.url || "").trim();
                              setImportError(null);
                              setIsImporting(true);
                              try {
                                if (roleUrl) {
                                  try {
                                    await importFromUrl(roleUrl);
                                  } catch {
                                    const fallbackJd: JobDescription = {
                                      id: `scr_import_${r.id}`,
                                      title: r.title || "Untitled",
                                      company: r.company || "Unknown",
                                      url: roleUrl || undefined,
                                      content: r.snippet || "",
                                      painPoints: [],
                                      requiredSkills: [],
                                      successMetrics: [],
                                      location: r.location || undefined,
                                      workMode: r.work_mode || undefined,
                                      salaryRange: r.salary_range || undefined,
                                      postedText: r.posted_text || undefined,
                                      jdJargon: extractJargon(r.snippet || ""),
                                      parsedAt: new Date().toISOString(),
                                    };
                                    setJobDescriptions((prev) => {
                                      const next = [...prev];
                                      if (!next.find((j) => j.id === fallbackJd.id)) next.push(fallbackJd);
                                      const normalized = normalizeFavoriteRanks(next);
                                      if (typeof window !== "undefined") localStorage.setItem("job_descriptions", JSON.stringify(normalized));
                                      return normalized;
                                    });
                                  }
                                } else {
                                  const fallbackJd: JobDescription = {
                                    id: `scr_import_${r.id}`,
                                    title: r.title || "Untitled",
                                    company: r.company || "Unknown",
                                    content: r.snippet || "",
                                    painPoints: [],
                                    requiredSkills: [],
                                    successMetrics: [],
                                    location: r.location || undefined,
                                    workMode: r.work_mode || undefined,
                                    salaryRange: r.salary_range || undefined,
                                    postedText: r.posted_text || undefined,
                                    jdJargon: extractJargon(r.snippet || ""),
                                    parsedAt: new Date().toISOString(),
                                  };
                                  setJobDescriptions((prev) => {
                                    const next = [...prev];
                                    if (!next.find((j) => j.id === fallbackJd.id)) next.push(fallbackJd);
                                    const normalized = normalizeFavoriteRanks(next);
                                    if (typeof window !== "undefined") localStorage.setItem("job_descriptions", JSON.stringify(normalized));
                                    return normalized;
                                  });
                                }
                                setImportedScrapedRoleIds((prev) => prev.includes(String(r.id)) ? prev : [...prev, String(r.id)]);
                                setTimeout(() => preferredSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
                              } catch (err) {
                                const msg = err instanceof Error ? err.message : String(err);
                                setImportError(msg);
                              } finally {
                                setIsImporting(false);
                              }
                            }}
                            title="Add to your Preferred Roles"
                          >
                            Preferred
                          </button>
                          )}
                          <button
                            type="button"
                            className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/10"
                            onClick={() => {
                              const id = String(r.id || "");
                              if (!id) return;
                              setIgnoredScrapedRoleIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
                            }}
                            title="Hide this suggestion"
                          >
                            Ignore
                          </button>
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/10"
                            title="View original posting"
                          >
                            View ↗
                          </a>
                        </div>
                      </div>
                      {(r.match_reasons || []).length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {(r.match_reasons || []).map((reason, ri) => (
                            <span key={`mr_${r.id}_${ri}`} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60">
                              {reason}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    );
                  })}
                </div>
              </div>
              ) : null;
            })()}
          </CollapsibleSection>
          </div>

          {jobDescriptions.length > 0 && (
            <>
              <div className="mt-8 rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-white">Export Roles to CSV</div>
                    <p className="mt-1 text-xs text-white/60">
                      Download all {jobDescriptions.length} imported role{jobDescriptions.length === 1 ? "" : "s"} as a CSV file.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={exportRolesCsv}
                      className="rounded-md border border-blue-400/35 bg-blue-500/20 px-4 py-2 text-xs font-semibold text-blue-100 hover:bg-blue-500/30 inline-flex items-center gap-2"
                    >
                      <span>⬇</span> Basic CSV
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end space-x-4">
                <button
                  onClick={() => router.push('/personality')}
                  className="bg-white/10 text-white px-6 py-3 rounded-md font-medium hover:bg-white/15 transition-colors border border-white/10"
                >
                  Back
                </button>
                <button
                  onClick={handleContinue}
                  className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                >
                  Save &amp; Continue
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
