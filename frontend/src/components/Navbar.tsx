"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import HealthIndicator from "./HealthIndicator";

export default function Navbar() {
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <header className="w-full flex items-center justify-between px-4 sm:px-6 py-3">
      <div className="flex items-center gap-4">
        {dark ? (
          <Image src="/role_ferry_white.png" alt="RoleFerry" width={140} height={38} />
        ) : (
          <Image src="/role_ferry_black.png" alt="RoleFerry" width={140} height={38} />
        )}
        <nav className="hidden sm:flex items-center gap-3 text-sm opacity-90">
          <Link href="/foundry" className="hover:underline">Foundry</Link>
          <Link href="/analytics" className="hover:underline">Analytics</Link>
          <Link href="/crm" className="hover:underline">CRM</Link>
          <div className="relative">
            <button onClick={() => setOpen(!open)} className="hover:underline">Data</button>
            {open ? (
              <div onMouseLeave={() => setOpen(false)} className="absolute z-20 mt-2 w-56 rounded-md bg-white/5 border border-white/10 backdrop-blur p-2 space-y-1">
                <Link className="block px-2 py-1 rounded hover:bg-white/10" href="/messages">Messages</Link>
                <Link className="block px-2 py-1 rounded hover:bg-white/10" href="/sequence">Sequence Rows</Link>
                <Link className="block px-2 py-1 rounded hover:bg-white/10" href="/campaigns">Campaigns</Link>
                <Link className="block px-2 py-1 rounded hover:bg-white/10" href="/onepager">One‑pagers</Link>
                <Link className="block px-2 py-1 rounded hover:bg-white/10" href="/warm-angles">Warm Angles</Link>
                <Link className="block px-2 py-1 rounded hover:bg-white/10" href="/audit">Audit Log</Link>
                <Link className="block px-2 py-1 rounded hover:bg-white/10" href="/onboarding">Onboarding</Link>
                <Link className="block px-2 py-1 rounded hover:bg-white/10" href="/deliverability">Deliverability</Link>
                <Link className="block px-2 py-1 rounded hover:bg-white/10" href="/compliance">Compliance</Link>
              </div>
            ) : null}
          </div>
          <Link href="/tools" className="hover:underline">Tools</Link>
          <Link href="/settings" className="hover:underline">Settings</Link>
          <Link href="/about" className="hover:underline">About</Link>
        </nav>
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
    <button onClick={toggle} className="px-3 py-1 rounded-md brand-gradient text-black font-medium">
      {isDark ? "Day" : "Night"}
    </button>
  );
}

