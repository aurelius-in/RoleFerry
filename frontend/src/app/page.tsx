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
  // Flow order (per wireframes): company research first, then decision makers.
  { step: 7, tab: "company-research", label: "Company Research", icon: "🏢", href: "/company-research" },
  { step: 8, tab: "decision-makers", label: "Decision Makers", icon: "👤", href: "/find-contact" },
  // Compose removed: Bio → Campaign.
  { step: 10, tab: "bio-page", label: "Bio Page", icon: "🌐", href: "/bio-page" },
  { step: 11, tab: "campaign", label: "Campaign", icon: "📧", href: "/campaign" },
  { step: 12, tab: "launch", label: "Launch", icon: "🚀", href: "/deliverability-launch" },
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
    function loadCompletedFromStorage() {
      const saved = window.localStorage.getItem("roleferry-progress");
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved);
        const vRaw = (parsed && typeof parsed === "object" && !Array.isArray(parsed)) ? (parsed as any).v : undefined;
        const version = Number.isFinite(Number(vRaw)) ? Number(vRaw) : 0;
        const steps: number[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray((parsed as any)?.steps)
            ? (parsed as any).steps
            : [];

        // New format (v2): already uses the current 12-step flow (10=Bio, 11=Compose, 12=Campaign).
        // IMPORTANT: do not run legacy remaps or we can accidentally drop step 12 and never unlock Launch.
        if (version >= 2) {
          const final = Array.from(new Set((steps || []).filter((n) => Number.isFinite(n) && n >= 1 && n <= 12)));
          setCompleted(new Set(final));
          return;
        }

        // Backwards-compat for older/localStorage shapes (no explicit version).
        // We remap step numbers from prior step layouts into the current 12-step layout.
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

        // Next legacy change: Bio Page inserted at step 10 and Campaign became step 12.
        // Old (pre-change): 10=Compose, 11=Launch, 12=Tracker
        // New: 10=Bio, 11=Compose, 12=Campaign
        //
        // For migration, if the user reached Compose/Launch/Tracker in the old flow,
        // we treat Bio as completed (otherwise Launch can stay locked forever).
        const hadEndOfFlow = out.some((n) => n === 10 || n === 11 || n === 12);
        const remapped2: number[] = [];
        for (const n of out) {
          if (n === 10) remapped2.push(11); // old Compose -> new Compose
          else if (n === 11) remapped2.push(12); // old Launch -> new Campaign (final step)
          else if (n === 12) remapped2.push(12); // old Tracker -> new Campaign (final step)
          else remapped2.push(n);
        }
        if (hadEndOfFlow) remapped2.push(10); // new Bio

        // Clamp + de-dupe for safety.
        const final = Array.from(new Set(remapped2.filter((n) => n >= 1 && n <= 12)));
        setCompleted(new Set(final));
      } catch {
        // ignore
      }
    }

    loadCompletedFromStorage();
    const handler = () => loadCompletedFromStorage();
    window.addEventListener("roleferry-progress-updated", handler as EventListener);
    return () => window.removeEventListener("roleferry-progress-updated", handler as EventListener);
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
            // Row 2 (steps 5–8) animates right-to-left, so flip footprints to match direction.
            // Row 1 and Row 3 animate left-to-right (default orientation).
            const flipFootstep = stone.step >= 5 && stone.step <= 8;
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
                {showFootstep && (
                  <img
                    src={footSrc}
                    alt="Footstep"
                    className="footstep-gif"
                    style={flipFootstep ? { transform: "scaleX(-1)" } : undefined}
                  />
                )}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
