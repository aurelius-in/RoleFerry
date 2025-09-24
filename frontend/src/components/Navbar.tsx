"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import HealthIndicator from "./HealthIndicator";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!open) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <header className="relative w-full flex items-center justify-between px-4 sm:px-6 py-3">
      <div className="flex items-center gap-4">
        <Image src="/role_ferry_black.png" alt="RoleFerry" width={140} height={38} />
        <nav className="hidden sm:flex items-center gap-5 text-base opacity-90">
          <Link href="/foundry" className="hover:underline">Foundry</Link>
          <Link href="/analytics" className="hover:underline">Analytics</Link>
          <Link href="/CRM" className="hover:underline">CRM</Link>
          <Link href="/ask" className="hover:underline">Ask</Link>
          <div className="relative">
            <button ref={btnRef} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} className="hover:underline">Data</button>
            {open ? (
              <div ref={menuRef} role="menu" className="absolute z-20 mt-2 w-56 rounded-md bg-white/5 border border-white/10 backdrop-blur p-2 space-y-1 shadow-lg">
                <Link role="menuitem" className="block px-2 py-1 rounded hover:bg-white/10" href="/messages">Messages</Link>
                <Link role="menuitem" className="block px-2 py-1 rounded hover:bg-white/10" href="/sequence">Sequence Rows</Link>
                <Link role="menuitem" className="block px-2 py-1 rounded hover:bg-white/10" href="/campaigns">Campaigns</Link>
                <Link role="menuitem" className="block px-2 py-1 rounded hover:bg-white/10" href="/onepager">One‑pagers</Link>
                <Link role="menuitem" className="block px-2 py-1 rounded hover:bg-white/10" href="/warm-angles">Warm Angles</Link>
                <Link role="menuitem" className="block px-2 py-1 rounded hover:bg-white/10" href="/audit">Audit Log</Link>
                <Link role="menuitem" className="block px-2 py-1 rounded hover:bg-white/10" href="/onboarding">Onboarding</Link>
                <Link role="menuitem" className="block px-2 py-1 rounded hover:bg-white/10" href="/deliverability">Deliverability</Link>
                <Link role="menuitem" className="block px-2 py-1 rounded hover:bg-white/10" href="/compliance">Compliance</Link>
              </div>
            ) : null}
          </div>
          <Link href="/tools" className="hover:underline">Tools</Link>
          <Link href="/settings" className="hover:underline">Settings</Link>
          <Link href="/about" className="hover:underline">About</Link>
        </nav>
      </div>
      {/* Centered wordmark at top edge */}
      <div className="absolute left-1/2 -translate-x-1/2 top-2 pointer-events-none select-none">
        <Image src="/wordmark.png" alt="RoleFerry" width={160} height={32} priority />
      </div>
      <div className="flex items-center gap-4">
        <HealthIndicator />
        <ThemeToggle />
      </div>
    </header>
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
    <button onClick={toggle} aria-label={isDark ? "Switch to day" : "Switch to night"} className={`w-9 h-9 rounded-md flex items-center justify-center border ${isDark ? "bg-black text-white border-white/20" : "bg-white text-black border-black/20"}`}>
      {isDark ? (
        // Sun icon
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.8 1.42-1.42zm10.45 14.32l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM12 4V1h-0v3h0zm0 19v-3h-0v3h0zm8-11h3v0h-3v0zm-19 0H1v0h3v0zm15.24-7.16l1.8-1.79-1.41-1.41-1.79 1.8 1.4 1.4zM4.22 19.78l-1.8 1.79 1.41 1.41 1.79-1.8-1.4-1.4zM12 6a6 6 0 100 12 6 6 0 000-12z"/></svg>
      ) : (
        // Moon icon
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21.64 13a9 9 0 01-11.31-11.31A9 9 0 1021.64 13z"/></svg>
      )}
    </button>
  );
}

