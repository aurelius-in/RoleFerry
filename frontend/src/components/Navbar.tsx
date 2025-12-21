"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import HealthIndicator from "./HealthIndicator";
import DataModal from "./DataModal";
import ToolsModal from "./ToolsModal";
import { DataMode, getCurrentDataMode, setCurrentDataMode } from "@/lib/dataMode";

export default function Navbar() {
  const [dataOpen, setDataOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const pathname = usePathname();
  const hideOnHome = pathname === "/"; // homepage must match approved wireframe
  if (hideOnHome) return null;

  return (
    <header suppressHydrationWarning className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/20 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-2">
        {/* Top row: logo + utilities */}
        <div className="flex items-center justify-between gap-3">
          {/* Left: logo + wordmark */}
          <Link href="/" className="flex items-center gap-2">
          <Image
            src="/roleferry_trans.png"
            alt="RoleFerry"
            width={190}
            height={52}
            priority
            className="h-9 w-auto sm:h-10"
          />
          <Image
            src="/wordmark.png"
            alt="RoleFerry"
            width={210}
            height={44}
            priority
            className="h-7 w-auto sm:h-8"
          />
          </Link>

          {/* Right: utility + toggles (tight) */}
          <div className="flex items-center gap-1.5">
            <ModeToggle />
            <DataModeToggle />
            <HealthIndicator />
            <ThemeToggle />
            <button
              aria-label="Tools"
              className="w-8 h-8 rounded-md flex items-center justify-center border bg-black text-white border-white/20"
              onClick={() => setToolsOpen(true)}
            >
              {/* Wrench icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.7 19.3l-6.4-6.4a6.5 6.5 0 01-8.1-8.1l4.1 4.1 2.8-.7.7-2.8L11.7 1a6.5 6.5 0 008.1 8.1l6.4 6.4-3.5 3.5zM2 22l6-6 2 2-6 6H2v-2z"/></svg>
            </button>
            <Link
              href="/settings"
              aria-label="Settings"
              className="w-8 h-8 rounded-md flex items-center justify-center border bg-black text-white border-white/20"
            >
              {/* Hamburger icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/></svg>
            </Link>
          </div>
        </div>

        {/* Second row: primary + utility nav directly under the logo (very compact) */}
        <nav className="mt-2 flex items-center gap-0 overflow-x-auto whitespace-nowrap pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <NavPill href="/job-preferences" pathname={pathname}>Job Prefs</NavPill>
          <NavPill href="/resume" pathname={pathname}>Resume</NavPill>
          <NavPill href="/job-descriptions" pathname={pathname}>Jobs</NavPill>
          <NavPill href="/painpoint-match" pathname={pathname}>Match</NavPill>
          <NavPill href="/find-contact" pathname={pathname}>Contact</NavPill>
          <NavPill href="/context-research" pathname={pathname}>Research</NavPill>
          <NavPill href="/offer-creation" pathname={pathname}>Offer</NavPill>
          <NavPill href="/compose" pathname={pathname}>Compose</NavPill>
          <NavPill href="/campaign" pathname={pathname}>Campaign</NavPill>
          <NavPill href="/deliverability-launch" pathname={pathname}>Launch</NavPill>
          <span className="mx-1 h-4 w-px bg-white/10" />
          <NavPill href="/" pathname={pathname} kind="utility">Dashboard</NavPill>
          <NavPill href="/analytics" pathname={pathname} kind="utility">Analytics</NavPill>
          <NavPill href="/settings" pathname={pathname} kind="utility">Settings</NavPill>
          <NavPill href="/help" pathname={pathname} kind="utility">Help</NavPill>
        </nav>

        <DataModal open={dataOpen} onClose={() => setDataOpen(false)} />
        <ToolsModal open={toolsOpen} onClose={() => setToolsOpen(false)} />
      </div>
    </header>
  );
}

function NavPill({
  href,
  pathname,
  children,
  kind = "primary",
}: {
  href: string;
  pathname: string | null;
  children: React.ReactNode;
  kind?: "primary" | "utility";
}) {
  const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
  const base =
    "inline-flex items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tracking-normal transition-colors select-none leading-4";
  const inactive =
    kind === "utility"
      ? "bg-white/5 text-white/80 border-white/10 hover:bg-white/10 hover:text-white"
      : "bg-black/20 text-white/80 border-white/10 hover:bg-white/10 hover:text-white";
  const activeCls =
    kind === "utility"
      ? "brand-gradient text-black border-white/10 shadow-sm shadow-black/20"
      : "brand-gradient text-black border-white/10 shadow-sm shadow-black/20";

  return (
    <Link href={href} className={`${base} ${active ? activeCls : inactive}`}>
      {children}
    </Link>
  );
}

function ModeToggle() {
  const [mode, setMode] = useState<'job-seeker' | 'recruiter'>('job-seeker');
  
  useEffect(() => {
    const stored = localStorage.getItem("rf_mode");
    if (stored === 'recruiter') {
      setMode('recruiter');
    }
  }, []);

  const toggle = () => {
    const newMode = mode === 'job-seeker' ? 'recruiter' : 'job-seeker';
    setMode(newMode);
    localStorage.setItem("rf_mode", newMode);
    // Trigger re-render of components that depend on mode
    window.dispatchEvent(new CustomEvent('modeChanged', { detail: newMode }));
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggle}
        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
          mode === 'job-seeker' 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
      >
        Job Seeker
      </button>
      <button
        onClick={toggle}
        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
          mode === 'recruiter' 
            ? 'bg-blue-600 text-white' 
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
      >
        Recruiter
      </button>
    </div>
  );
}

function DataModeToggle() {
  const [mode, setMode] = useState<DataMode>("demo");

  useEffect(() => {
    setMode(getCurrentDataMode());
  }, []);

  const handleChange = (next: DataMode) => {
    setMode(next);
    setCurrentDataMode(next);
  };

  return (
    <div className="hidden md:flex items-center text-[11px] font-semibold rounded-md border border-white/20 bg-black/40 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => handleChange("demo")}
        className={`px-2 py-0.5 transition-colors ${mode === "demo" ? "bg-white text-black" : "text-white/80 hover:bg-white/10"}`}
      >
        Demo
      </button>
      <button
        type="button"
        onClick={() => handleChange("live")}
        className={`px-2 py-0.5 border-l border-white/20 transition-colors ${mode === "live" ? "bg-white text-black" : "text-white/80 hover:bg-white/10"}`}
      >
        Live
      </button>
    </div>
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

