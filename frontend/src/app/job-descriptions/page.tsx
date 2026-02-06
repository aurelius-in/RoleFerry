"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatCompanyName } from "@/lib/format";
import InlineSpinner from "@/components/InlineSpinner";

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

export default function JobDescriptionsPage() {
  const router = useRouter();
  // Important: avoid reading localStorage during the initial render to prevent
  // React hydration mismatches (which can break click interactions).
  const [hasMounted, setHasMounted] = useState(false);
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
  const trackerPulseTimer = useRef<number | null>(null);
  const suggestedUrl =
    "https://www.google.com/about/careers/applications/jobs/results/?employment_type=FULL_TIME&degree=MASTERS&skills=software%2C%20architecture%2C%20ai";

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

  const handleImport = async () => {
    const hasUrl = importType === "url" && Boolean(importUrl.trim());
    const hasText = importType === "text" && Boolean(importText.trim());
    if (!hasUrl && !hasText) return;

    setImportError(null);
    setIsImporting(true);

    try {
      const payload = {
        url: hasUrl ? importUrl.trim() : null,
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
      // Only clear inputs on success
      setImportUrl("");
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
              <h1 className="text-3xl font-bold text-white mb-2">Role Descriptions</h1>
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
            <div className="text-sm font-bold text-white">Websites to find role descriptions</div>
            <div className="mt-1 text-xs text-white/60">
              Open a site, find a posting, then paste the URL or posting text below.
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-md border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold text-white/70 mb-2">General boards</div>
                <ul className="space-y-1 text-sm">
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
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://joinhandshake.com/" target="_blank" rel="noopener noreferrer">Handshake (Early career)</a></li>
                </ul>
              </div>

              <div className="rounded-md border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold text-white/70 mb-2">Startups & remote</div>
                <ul className="space-y-1 text-sm">
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://wellfound.com/jobs" target="_blank" rel="noopener noreferrer">Wellfound (AngelList Talent)</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.ycombinator.com/jobs" target="_blank" rel="noopener noreferrer">Work at a Startup (YC)</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://remoteok.com/" target="_blank" rel="noopener noreferrer">Remote OK</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://weworkremotely.com/" target="_blank" rel="noopener noreferrer">We Work Remotely</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://remotive.com/" target="_blank" rel="noopener noreferrer">Remotive</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://remote.co/remote-jobs/" target="_blank" rel="noopener noreferrer">Remote.co</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.workingnomads.com/jobs" target="_blank" rel="noopener noreferrer">Working Nomads</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://himalayas.app/jobs" target="_blank" rel="noopener noreferrer">Himalayas</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.flexjobs.com/" target="_blank" rel="noopener noreferrer">FlexJobs</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://app.welcometothejungle.com/" target="_blank" rel="noopener noreferrer">Welcome to the Jungle (formerly Otta)</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.ventureloop.com/" target="_blank" rel="noopener noreferrer">VentureLoop (Startups)</a></li>
                </ul>
              </div>

              <div className="rounded-md border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold text-white/70 mb-2">Tech boards</div>
                <ul className="space-y-1 text-sm">
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.builtin.com/jobs" target="_blank" rel="noopener noreferrer">Built In (Tech)</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.dice.com/" target="_blank" rel="noopener noreferrer">Dice</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.techcareers.com/" target="_blank" rel="noopener noreferrer">TechCareers</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.techfetch.com/" target="_blank" rel="noopener noreferrer">TechFetch</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.levels.fyi/jobs/" target="_blank" rel="noopener noreferrer">Levels.fyi Jobs</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://hnhiring.com/" target="_blank" rel="noopener noreferrer">HN Hiring</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://authenticjobs.com/" target="_blank" rel="noopener noreferrer">Authentic Jobs (Tech + Design)</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://simplify.jobs/" target="_blank" rel="noopener noreferrer">Simplify.jobs</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://jobright.ai/" target="_blank" rel="noopener noreferrer">Jobright.ai</a></li>
                  <li><a className="text-blue-300 underline hover:text-blue-200" href="https://www.hired.com/jobs" target="_blank" rel="noopener noreferrer">Hired (Tech hiring marketplace)</a></li>
                </ul>
              </div>

              <div className="rounded-md border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold text-white/70 mb-2">Top Company Boards</div>
                <ul className="space-y-1 text-sm">
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
          </div>

          <div className="mb-6 flex justify-between items-center">
            <div className="flex-1">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
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

          {!hasMounted || jobDescriptions.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white mb-2">No Role Descriptions</h3>
              <p className="text-white/70 mb-6">
                Import role descriptions from URLs or paste text to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedJobDescriptions.map((jd) => (
                <div key={jd.id} className="rounded-lg border border-white/10 bg-black/20 p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-start gap-3">
                        <div className="min-w-0">
                          {editMeta?.id === jd.id && editMeta.field === "title" ? (
                            <div className="flex items-center gap-2">
                              <input
                                value={editMeta.value}
                                onChange={(e) => setEditMeta({ ...editMeta, value: e.target.value })}
                                className="w-full max-w-xl rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                                aria-label="Edit title"
                              />
                              <button
                                type="button"
                                onClick={saveEdit}
                                className="shrink-0 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditMeta(null)}
                                className="shrink-0 rounded-md bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/15"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <h3 className="text-xl font-semibold text-white break-words">{jd.title}</h3>
                              <button
                                type="button"
                                onClick={() => startEdit(jd, "title")}
                                className="shrink-0 inline-flex items-center rounded-full border border-orange-400/30 bg-orange-500/15 px-2 py-0.5 text-[11px] font-semibold text-orange-200 hover:bg-orange-500/20 hover:text-orange-100"
                              >
                                Edit title
                              </button>
                            </div>
                          )}

                          {editMeta?.id === jd.id && editMeta.field === "company" ? (
                            <div className="mt-1 flex items-center gap-2">
                              <input
                                value={editMeta.value}
                                onChange={(e) => setEditMeta({ ...editMeta, value: e.target.value })}
                                className="w-full max-w-md rounded-md border border-white/15 bg-black/30 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                                aria-label="Edit company"
                              />
                              <button
                                type="button"
                                onClick={saveEdit}
                                className="shrink-0 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditMeta(null)}
                                className="shrink-0 rounded-md bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/15"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="mt-1 flex items-center gap-2">
                              <p className="text-white/70 break-words">{formatCompanyName(jd.company)}</p>
                              <button
                                type="button"
                                onClick={() => startEdit(jd, "company")}
                                className="inline-flex items-center rounded-full border border-orange-400/30 bg-orange-500/15 px-2 py-0.5 text-[11px] font-semibold text-orange-200 hover:bg-orange-500/20 hover:text-orange-100"
                              >
                                Edit company
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      {(jd.salaryRange || jd.location || jd.workMode || jd.employmentType) && (
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                          {jd.salaryRange ? (
                            <span className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/80">
                              {jd.salaryRange}
                            </span>
                          ) : null}
                          {jd.location ? (
                            <span className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/80">
                              Location: {jd.location}
                            </span>
                          ) : null}
                          {jd.workMode ? (
                            <span className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/80">
                              {jd.workMode}
                            </span>
                          ) : null}
                          {jd.employmentType ? (
                            <span className="px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/80">
                              {jd.employmentType}
                            </span>
                          ) : null}
                        </div>
                      )}
                      {jd.url && (
                        <a 
                          href={jd.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          View Original
                        </a>
                      )}
                    </div>
                    <div className="flex items-center space-x-4">
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
                        return (
                          <div className="flex flex-col items-end gap-1">
                            <div className="text-[10px] font-semibold text-white/60">Favorite Rank</div>
                            {(() => {
                              const available: Array<number | null> = [
                                null,
                                ...Array.from({ length: maxRank }, (_, i) => i + 1).filter((n) => !used.has(n)),
                              ];
                              const cur: number | null = currentOk ? current : null;
                              const curIdx = Math.max(0, available.indexOf(cur));
                              const display = cur === null ? "—" : String(cur);

                              const cycle = (dir: -1 | 1) => {
                                if (!available.length) {
                                  handleFavoriteRankChange(jd.id, null);
                                  return;
                                }
                                const nextIdx = (curIdx + dir + available.length) % available.length;
                                handleFavoriteRankChange(jd.id, available[nextIdx]);
                              };

                              return (
                                <div
                                  className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/20 px-1 py-1"
                                  title="Favorite Rank: unique per job (1..N). Use ◀/▶ or click the rank to cycle unused values."
                                >
                                  <button
                                    type="button"
                                    onClick={() => cycle(-1)}
                                    className="rounded-md px-2 py-0.5 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    aria-label="Previous favorite rank"
                                  >
                                    ◀
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => cycle(1)}
                                    className="min-w-[2.25rem] rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums text-white/80 hover:bg-white/10 hover:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    aria-label={`Favorite rank: ${display}. Click to cycle.`}
                                  >
                                    {display}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => cycle(1)}
                                    className="rounded-md px-2 py-0.5 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                    aria-label="Next favorite rank"
                                  >
                                    ▶
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() => addToTracker(jd)}
                        className="text-white/80 hover:text-white text-sm underline"
                      >
                        Add to Role Tracker
                        {trackerPulseId === jd.id ? (
                          <span className="ml-1 inline-flex items-center text-green-300" aria-label="Added">
                            ✅
                          </span>
                        ) : null}
                      </button>
                      <button
                        onClick={() => handleDelete(jd.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

                    {/* JD Jargon intentionally removed (low-signal for job seekers) */}
                  </div>

                  <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-xs text-white/60">
                      Parsed on {new Date(jd.parsedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {jobDescriptions.length > 0 && (
            <div className="mt-8 flex justify-end space-x-4">
              <button
                onClick={() => router.push('/resume')}
                className="bg-white/10 text-white px-6 py-3 rounded-md font-medium hover:bg-white/15 transition-colors border border-white/10"
              >
                Back
              </button>
              <button
                onClick={handleContinue}
                className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                Continue to Gap Analysis
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
