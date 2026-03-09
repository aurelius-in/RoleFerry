"use client";

import { useState } from "react";

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export default function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  children,
  className = "",
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`rounded-lg border border-white/10 bg-black/20 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <svg
          className={`h-3.5 w-3.5 flex-shrink-0 text-white/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        <span className="flex-1 text-sm font-semibold text-white">{title}</span>
        {typeof count === "number" ? (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] tabular-nums text-white/60">
            {count}
          </span>
        ) : null}
      </button>
      {open ? <div className="px-3 pb-3">{children}</div> : null}
    </div>
  );
}
