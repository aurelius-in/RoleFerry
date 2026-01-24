"use client";

import "./home_wireframe.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type StoneConfig = {
  step: number;
  tab: string;
  label: string;
  icon: string;
  href: string;
};

const STONES: StoneConfig[] = [
  { step: 1, tab: "job-preferences", label: "Job Preferences", icon: "🎯", href: "/job-preferences" },
  { step: 2, tab: "candidate-profile", label: "Your Resume", icon: "📄", href: "/resume" },
  { step: 3, tab: "personality", label: "Personality", icon: "🧠", href: "/personality" },
  { step: 4, tab: "job-descriptions", label: "Job Descriptions", icon: "📋", href: "/job-descriptions" },
  { step: 5, tab: "gap-analysis", label: "Gap Analysis", icon: "🧩", href: "/gap-analysis" },
  { step: 6, tab: "pain-point-match", label: "Pain Point Match", icon: "🔗", href: "/painpoint-match" },
  // Flow order: choose contacts first, then do contact-aware research.
  { step: 7, tab: "decision-makers", label: "Decision Makers", icon: "👤", href: "/find-contact" },
  { step: 8, tab: "background-research", label: "Background Research", icon: "🔍", href: "/context-research" },
  { step: 9, tab: "offer-creation", label: "Offer Creation", icon: "💼", href: "/offer-creation" },
  { step: 10, tab: "bio-page", label: "Bio Page", icon: "🌐", href: "/bio-page" },
  { step: 11, tab: "compose", label: "Compose", icon: "✍️", href: "/compose" },
  { step: 12, tab: "campaign", label: "Campaign", icon: "📧", href: "/campaign" },
];

const LEFT_FOOT_SRC = "/wireframes/assets/left-foot.gif";
const RIGHT_FOOT_SRC = "/wireframes/assets/right-foot.gif";

const POSITIONS: Record<number, { top: number; left: number }> = {
  1: { top: 40, left: 20 },
  2: { top: 40, left: 210 },
  3: { top: 40, left: 400 },
  4: { top: 40, left: 590 },
  5: { top: 160, left: 590 },
  6: { top: 160, left: 400 },
  7: { top: 160, left: 210 },
  8: { top: 160, left: 20 },
  9: { top: 320, left: 20 },
  10: { top: 320, left: 210 },
  11: { top: 320, left: 400 },
  12: { top: 320, left: 590 },
};

export default function Home() {
  const router = useRouter();
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [isAnimating, setIsAnimating] = useState(false);
  const [visibleFootstepsUpTo, setVisibleFootstepsUpTo] = useState<number>(0);
  const [bannerClosed, setBannerClosed] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("roleferry-progress");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const steps: number[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.steps)
            ? parsed.steps
            : [];

        // Backwards-compat (safe, heuristic-based):
        // - If the saved array includes 12, it came from the era where
        //   10=Compose, 11=Launch, 12=Tracker (Analytics already removed).
        // - If it does NOT include 12, it may predate the Personality insertion
        //   where 3=Job Descriptions and 11=Analytics.
        let out: number[] = (steps || []).filter((n) => Number.isFinite(n));

        const hasTwelve = out.includes(12);
        if (!hasTwelve) {
          // Legacy: insert Personality at step 3 and drop old Analytics at step 11.
          const remapped: number[] = [];
          for (const n of out) {
            if (n === 11) continue; // old Analytics
            if (n >= 3 && n <= 10) remapped.push(n + 1);
            else remapped.push(n);
          }
          out = remapped;
        }

        // New: remove Tracker from keypad, insert Bio Page at step 10,
        // and make Campaign the final step. Old (pre-change): 10=Compose, 11=Launch, 12=Tracker
        // New: 10=Bio, 11=Compose, 12=Campaign (Launch removed from keypad)
        const remapped2: number[] = [];
        for (const n of out) {
          if (n === 12) continue; // Tracker removed from keypad
          if (n === 10) remapped2.push(11);
          else if (n === 11) remapped2.push(12);
          else remapped2.push(n);
        }

        // Clamp + de-dupe for safety.
        const final = Array.from(new Set(remapped2.filter((n) => n >= 1 && n <= 12)));
        setCompleted(new Set(final));
      } catch {
        // ignore
      }
    }
  }, []);

  const progressCount = completed.size;

  const footstepsForStep = useMemo(() => {
    const m = new Map<number, string>();
    for (let i = 1; i <= 12; i++) {
      const isOdd = i % 2 === 1;
      m.set(i, isOdd ? LEFT_FOOT_SRC : RIGHT_FOOT_SRC);
    }
    return m;
  }, []);

  function saveProgress(next: Set<number>) {
    window.localStorage.setItem("roleferry-progress", JSON.stringify({ v: 2, steps: Array.from(next) }));
  }

  function playFootstepSequence(targetStep: number, onComplete: () => void) {
    setIsAnimating(true);
    setVisibleFootstepsUpTo(0);

    for (let i = 1; i <= targetStep; i++) {
      window.setTimeout(() => {
        setVisibleFootstepsUpTo(i);
        if (i === targetStep) {
          window.setTimeout(() => {
            setIsAnimating(false);
            onComplete();
          }, 300);
        }
      }, (i - 1) * 250);
    }
  }

  function handleStepClick(stone: StoneConfig) {
    if (isAnimating) return;

    const next = new Set(completed);
    next.add(stone.step);
    setCompleted(next);
    saveProgress(next);

    playFootstepSequence(stone.step, () => router.push(stone.href));
  }

  return (
    <div className="rf-home-body">
      {!bannerClosed && (
        <div className="feedback-banner" id="feedbackBanner">
          <span>It&apos;s Friday! Time for your weekly feedback.</span>
          <Link href="/feedback">Give Feedback</Link>
          <button className="close-btn" onClick={() => setBannerClosed(true)} aria-label="Close banner">
            &times;
          </button>
        </div>
      )}

      <Link href="/settings" className="settings-link" aria-label="Settings">
        ⚙️
      </Link>
      <Link
        href="/analytics"
        className="settings-link"
        aria-label="Analytics"
        style={{
          right: "5.5rem",
          width: "auto",
          height: "auto",
          borderRadius: 12,
          padding: "0.75rem 0.9rem",
          fontSize: "0.9rem",
          gap: "0.35rem",
        }}
      >
        📊 <span style={{ fontWeight: 700 }}>Analytics</span>
      </Link>

      <div className="keypad-container">
        <div className="progress-indicator">
          <div>
            Steps completed: <span id="progressText">{progressCount}</span>
          </div>
        </div>

        <div className="keypad-header">
          <div className="branding-section">
            <img src="/rf_wordmark.png" alt="RoleFerry" className="wordmark-logo" />
            <img src="/ani-sm.gif" alt="RoleFerry Animation" className="animated-logo" />
          </div>
          <h1 className="keypad-title">The Path to Your Next Role</h1>
          <p className="keypad-subtitle">Transform your job search with intelligent automation</p>
        </div>

        <div className="path-container" id="pathContainer">
          {STONES.map((stone) => {
            const pos = POSITIONS[stone.step];
            const showFootstep = visibleFootstepsUpTo >= stone.step;
            const footSrc = footstepsForStep.get(stone.step) || LEFT_FOOT_SRC;
            return (
              <div
                key={stone.step}
                className={`stone ${completed.has(stone.step) ? "completed" : ""}`}
                data-tab={stone.tab}
                data-step={stone.step}
                title={stone.label}
                onClick={() => handleStepClick(stone)}
                style={{ top: pos.top, left: pos.left }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handleStepClick(stone)}
              >
                <img src="/assets/stones.png" alt="Stone" className="stone-image" />
                <div className="stone-content">
                  <div className="stone-step-number">{stone.step}</div>
                  <div className="icon">{stone.icon}</div>
                  <div className="stone-label-text">{stone.label}</div>
                </div>
                {showFootstep && <img src={footSrc} alt="Footstep" className="footstep-gif" />}
              </div>
            );
          })}
        </div>

        {(() => {
          const hasAllSteps = (() => {
            for (let i = 1; i <= 12; i++) if (!completed.has(i)) return false;
            return true;
          })();
          const disabled = isAnimating || !hasAllSteps;
          return (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  router.push("/deliverability-launch");
                }}
                className={`w-full max-w-[600px] rounded-2xl border px-6 py-5 text-xl font-extrabold tracking-wide transition-colors ${
                  disabled
                    ? "bg-white/5 border-white/10 text-white/40"
                    : "bg-emerald-500/20 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/25"
                }`}
                title={disabled ? "Complete all 12 steps above to unlock Warm-up + Launch" : "Warm-up + Launch"}
              >
                🚀 Warm-up + Launch
              </button>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
