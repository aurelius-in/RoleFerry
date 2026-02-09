"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";
import DataModal from "./DataModal";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [dataOpen, setDataOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  
  useEffect(() => {
    // RoleFerry is currently Role-Seeker only.
    // Keep recruiter mode as a future fallback, but force the app into job-seeker mode now.
    try {
      localStorage.setItem("rf_mode", "job-seeker");
      window.dispatchEvent(new CustomEvent("modeChanged", { detail: "job-seeker" }));
    } catch {}

    // Default to live mode. Demo remains an internal fallback when an API is down.
    try {
      localStorage.setItem("rf_data_mode", "live");
      window.dispatchEvent(new CustomEvent("dataModeChanged", { detail: "live" }));
    } catch {}

    const saved = localStorage.getItem("rf_user");
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch {}
    }
  }, []);

  // Mark steps complete even if the user navigates via the navbar (not the dashboard stones).
  useEffect(() => {
    if (!pathname) return;
    if (typeof window === "undefined") return;
    try {
      const stepForPath = (p: string): number | null => {
        const path = String(p || "/");
        if (path === "/job-preferences" || path.startsWith("/job-preferences/")) return 1;
        if (path === "/resume" || path.startsWith("/resume/")) return 2;
        if (path === "/personality" || path.startsWith("/personality/")) return 3;
        if (path === "/job-descriptions" || path.startsWith("/job-descriptions/")) return 4;
        if (path === "/gap-analysis" || path.startsWith("/gap-analysis/")) return 5;
        if (path === "/painpoint-match" || path.startsWith("/painpoint-match/")) return 6;
        if (path === "/offer" || path.startsWith("/offer/")) return 7;
        if (path === "/company-research" || path.startsWith("/company-research/")) return 8;
        // Context research is part of the "Decision Makers" step in the wireframe flow.
        if (path === "/find-contact" || path.startsWith("/find-contact/")) return 9;
        if (path === "/bio-page" || path.startsWith("/bio-page/")) return 10;
        if (path === "/bio/preview" || path.startsWith("/bio/preview/")) return 10;
        if (path === "/campaign" || path.startsWith("/campaign/")) return 11;
        if (path === "/deliverability-launch" || path.startsWith("/deliverability-launch/")) return 12;
        return null;
      };

      const step = stepForPath(pathname);
      if (!step) return;

      const raw = window.localStorage.getItem("roleferry-progress");
      let steps: number[] = [];
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          steps = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.steps)
              ? parsed.steps
              : [];
        } catch {}
      }
      const next = Array.from(new Set([...(steps || []).filter((n) => Number.isFinite(n)), step]))
        .filter((n) => n >= 1 && n <= 12);
      // v4: Offer step moved to 7 (between Match and Research). Roles=4, Gaps=5, Match=6.
      window.localStorage.setItem("roleferry-progress", JSON.stringify({ v: 4, steps: next }));
      window.dispatchEvent(new CustomEvent("roleferry-progress-updated", { detail: { step } }));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function logout() {
    try {
      await api("/auth/logout", "POST");
      localStorage.removeItem("rf_user");
      router.push("/login");
      router.refresh();
    } catch {}
  }
  const hideOnAuth = pathname === "/login";
  if (hideOnAuth) return null;

  return (
    <header suppressHydrationWarning className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/20 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-2">
        {/* Top row: logo + utilities */}
        <div className="flex items-center justify-between gap-3">
          {/* Left: logo + wordmark */}
          <Link href="/" className="flex items-center gap-2">
          <img
            src="/rf_logo.png"
            alt="RoleFerry"
            className="h-9 w-auto sm:h-10"
            onError={(e) => {
              // Fallback for any asset-caching weirdness
              try { (e.currentTarget as HTMLImageElement).src = "/roleferry-med.gif"; } catch {}
            }}
          />
          <img
            src="/rf_wordmark.png"
            alt="RoleFerry"
            className="h-7 w-auto sm:h-8"
            onError={(e) => {
              try { (e.currentTarget as HTMLImageElement).src = "/role_ferry_white.png"; } catch {}
            }}
          />
          </Link>

          {/* Right: utility + toggles (tight) */}
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link
              href="/settings"
              aria-label="Settings"
              className="w-8 h-8 rounded-md flex items-center justify-center border bg-black text-white border-white/20"
            >
              {/* Hamburger icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/></svg>
            </Link>

            {/* User + logout (moved up so it doesn't collide with step pills) */}
            {user && (
              <div className="hidden sm:flex items-center gap-2 ml-1 pl-2 border-l border-white/10">
                <span className="text-[11px] text-white/70 whitespace-nowrap">Hi, {user.first_name}</span>
                <button
                  onClick={logout}
                  className="text-[11px] font-bold text-red-300/90 hover:text-red-200 whitespace-nowrap"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Second row: primary + utility nav directly under the logo (very compact) */}
        <nav className="mt-2 flex items-center justify-between gap-3 pb-1">
          {/* Left: Dashboard + workflow steps (scrollable) */}
          <div className="flex items-center min-w-0 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <NavPill href="/" pathname={pathname} kind="utility" size="md">Dashboard</NavPill>
            <span className="mx-2 h-4 w-px bg-white/15" />

            <NavPill href="/job-preferences" pathname={pathname}>Prefs</NavPill>
            <NavPill href="/resume" pathname={pathname}>Resume</NavPill>
            <NavPill href="/personality" pathname={pathname}>Personality</NavPill>
            <NavPill href="/job-descriptions" pathname={pathname}>Roles</NavPill>
            <NavPill href="/gap-analysis" pathname={pathname}>Gaps</NavPill>
            <NavPill href="/painpoint-match" pathname={pathname}>Match</NavPill>
            <NavPill href="/offer" pathname={pathname}>Offer</NavPill>
            <NavPill href="/company-research" pathname={pathname}>Research</NavPill>
            <NavPill href="/find-contact" pathname={pathname}>Contact</NavPill>
            <NavPill href="/bio-page" pathname={pathname}>Bio</NavPill>
            <NavPill href="/campaign" pathname={pathname}>Campaign</NavPill>
            <NavPill href="/deliverability-launch" pathname={pathname}>Launch</NavPill>

            {/* Big spacing: steps vs non-step utilities */}
            <span className="mx-5 h-5 w-px bg-white/20" />

            <NavPill href="/analytics" pathname={pathname} kind="utility" size="lg">
              <span className="inline-flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M3 3h2v18H3V3zm16 8h2v10h-2V11zM11 13h2v8h-2v-8zM7 9h2v12H7V9zm8-6h2v18h-2V3z"/>
                </svg>
                <span>Analytics</span>
              </span>
            </NavPill>
            <NavPill href="/tracker" pathname={pathname} kind="utility" size="lg">
              <span className="inline-flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M7 2h2v2h6V2h2v2h3v18H4V4h3V2zm13 6H6v12h14V8z"/>
                </svg>
                <span>Tracker</span>
              </span>
            </NavPill>
            <NavPill href="/inbox" pathname={pathname} kind="utility" size="lg">
              <span className="inline-flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
                <span>Inbox</span>
              </span>
            </NavPill>
          </div>

          {/* Right: utilities that should NOT look like steps */}
          <div className="flex items-center gap-1.5 shrink-0">
            <NavPill href="/help" pathname={pathname} kind="utility" size="md">Help</NavPill>
          </div>
        </nav>

        <DataModal open={dataOpen} onClose={() => setDataOpen(false)} />
      </div>
    </header>
  );
}

function NavPill({
  href,
  pathname,
  children,
  kind = "primary",
  size = "sm",
}: {
  href: string;
  pathname: string | null;
  children: React.ReactNode;
  kind?: "primary" | "utility";
  size?: "sm" | "md" | "lg";
}) {
  const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
  const base = "inline-flex items-center justify-center rounded-full border font-semibold tracking-normal transition-colors select-none";
  const sizing =
    size === "md"
      ? "px-2.5 py-1 text-[11px] leading-4"
      : size === "lg"
        ? "px-3 py-1.5 text-[12px] leading-4"
      : "px-1.5 py-0.5 text-[10px] leading-4";
  const inactive =
    kind === "utility"
      ? "bg-white/5 text-white/80 border-white/10 hover:bg-white/10 hover:text-white"
      : "bg-black/20 text-white/80 border-white/10 hover:bg-white/10 hover:text-white";
  const activeCls =
    kind === "utility"
      ? "brand-gradient text-black border-white/10 shadow-sm shadow-black/20"
      : "brand-gradient text-black border-white/10 shadow-sm shadow-black/20";

  return (
    <Link href={href} className={`${base} ${sizing} ${active ? activeCls : inactive}`}>
      {children}
    </Link>
  );
}

function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const root = document.documentElement;
    const stored = localStorage.getItem("rf_theme");
    if (stored === "dark") {
      root.classList.add("dark");
    } else if (stored === "light") {
      root.classList.remove("dark");
    }
    setIsDark(root.classList.contains("dark"));
  }, []);
  const toggle = () => {
    const root = document.documentElement;
    root.classList.toggle("dark");
    setIsDark(root.classList.contains("dark"));
    localStorage.setItem("rf_theme", root.classList.contains("dark") ? "dark" : "light");
  };
  return (
    <button onClick={toggle} aria-label={isDark ? "Switch to day" : "Switch to night"} className={`w-8 h-8 rounded-md flex items-center justify-center border ${isDark ? "bg-black text-white border-white/20" : "bg-white text-black border-black/20"}`}>
      {isDark ? (
        // Sun icon
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zm10.45 14.32l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM12 4V1h-0v3h0zm0 19v-3h-0v3h0zm8-11h3v0h-3v0zm-19 0H1v0h3v0zm15.24-7.16l1.8-1.79-1.41-1.41-1.79 1.8 1.4 1.4zM4.22 19.78l-1.8 1.79 1.41 1.41 1.79-1.8-1.4-1.4zM12 6a6 6 0 100 12 6 6 0 000-12z"/></svg>
      ) : (
        // Moon icon
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21.64 13a9 9 0 01-11.31-11.31A9 9 0 1021.64 13z"/></svg>
      )}
    </button>
  );
}

