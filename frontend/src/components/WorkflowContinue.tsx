"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const WORKFLOW: Array<{ path: string; label: string }> = [
  { path: "/job-preferences", label: "Preferences" },
  { path: "/resume", label: "Resume" },
  { path: "/personality", label: "Personality" },
  { path: "/job-descriptions", label: "Roles" },
  { path: "/gap-analysis", label: "Gap Analysis" },
  { path: "/painpoint-match", label: "Pain Point Match" },
  { path: "/company-research", label: "Company Research" },
  { path: "/find-contact", label: "Decision Makers" },
  { path: "/offer", label: "Offer" },
  { path: "/bio-page", label: "Bio Page" },
  { path: "/apply", label: "Apply" },
  { path: "/campaign", label: "Campaign" },
];

export default function WorkflowContinue({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const currentIdx = WORKFLOW.findIndex(
    (s) => pathname === s.path || (s.path !== "/" && pathname?.startsWith(s.path))
  );
  if (currentIdx === -1 || currentIdx >= WORKFLOW.length - 1) return null;
  const next = WORKFLOW[currentIdx + 1];

  return (
    <div className={`mt-8 flex items-center justify-end ${className}`}>
      <Link
        href={next.path}
        className="inline-flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-600/15 px-5 py-2.5 text-sm font-semibold text-blue-200 hover:bg-blue-600/25 hover:border-blue-400/60 transition-colors"
      >
        Continue to {next.label}
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
