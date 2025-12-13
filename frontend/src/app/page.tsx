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
  { step: 3, tab: "job-descriptions", label: "Job Descriptions", icon: "📋", href: "/job-descriptions" },
  { step: 4, tab: "job-tracker", label: "Job Tracker", icon: "📌", href: "/tracker" },
  { step: 5, tab: "pain-point-match", label: "Pain Point Match", icon: "🔗", href: "/pinpoint-match" },
  { step: 6, tab: "company-research", label: "Company Research", icon: "🔍", href: "/context-research" },
  { step: 7, tab: "decision-makers", label: "Decision Makers", icon: "👤", href: "/find-contact" },
  { step: 8, tab: "offer-creation", label: "Offer Creation", icon: "💼", href: "/offer-creation" },
  { step: 9, tab: "campaign", label: "Campaign", icon: "📧", href: "/campaign" },
  { step: 10, tab: "deliverability-launch", label: "Launch Campaign", icon: "🚀", href: "/deliverability-launch" },
  { step: 11, tab: "analytics", label: "Analytics", icon: "📊", href: "/analytics" },
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
        const arr: number[] = JSON.parse(saved);
        setCompleted(new Set(arr));
      } catch {
        // ignore
      }
    }
  }, []);

  const progressCount = completed.size;

  const footstepsForStep = useMemo(() => {
    const m = new Map<number, string>();
    for (let i = 1; i <= 11; i++) {
      const isOdd = i % 2 === 1;
      m.set(i, isOdd ? LEFT_FOOT_SRC : RIGHT_FOOT_SRC);
    }
    return m;
  }, []);

  function saveProgress(next: Set<number>) {
    window.localStorage.setItem("roleferry-progress", JSON.stringify(Array.from(next)));
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

      <div className="keypad-container">
        <div className="progress-indicator">
          <div>
            Steps completed: <span id="progressText">{progressCount}</span>
          </div>
        </div>

        <div className="keypad-header">
          <div className="branding-section">
            <img src="/wordmark.png" alt="RoleFerry" className="wordmark-logo" />
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
      </div>
    </div>
  );
}
