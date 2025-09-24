"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import HealthIndicator from "./HealthIndicator";
import DataModal from "./DataModal";
import ToolsModal from "./ToolsModal";

export default function Navbar() {
  const [dataOpen, setDataOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {}, []);

  return (
    <header suppressHydrationWarning className="relative w-full flex items-center justify-between px-4 sm:px-6 py-3">
      {/* Left: logo + wordmark */}
      <div className="flex items-center gap-3">
        <Image src="/roleferry_trans.png" alt="RoleFerry" width={140} height={38} priority />
        <Image src="/wordmark.png" alt="RoleFerry" width={160} height={32} priority />
      </div>
      {/* Center: navigation */}
      <nav className="hidden sm:flex flex-1 items-center justify-center gap-6 text-lg font-semibold">
        <NavLink href="/foundry" pathname={pathname}>Dashboard</NavLink>
        <NavLink href="/analytics" pathname={pathname}>Analytics</NavLink>
        <NavLink href="/CRM" pathname={pathname}>CRM</NavLink>
        <button onClick={() => setDataOpen(true)} className="hover:underline">Data</button>
      </nav>
      <div className="flex items-center gap-4">
        <HealthIndicator />
        <ThemeToggle />
        <button aria-label="Tools" className="w-9 h-9 rounded-md flex items-center justify-center border bg-black text-white border-white/20" onClick={() => setToolsOpen(true)}>
          {/* Wrench icon */}
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.7 19.3l-6.4-6.4a6.5 6.5 0 01-8.1-8.1l4.1 4.1 2.8-.7.7-2.8L11.7 1a6.5 6.5 0 008.1 8.1l6.4 6.4-3.5 3.5zM2 22l6-6 2 2-6 6H2v-2z"/></svg>
        </button>
        <Link href="/settings" aria-label="Settings" className="w-9 h-9 rounded-md flex items-center justify-center border bg-black text-white border-white/20">
          {/* Hamburger icon */}
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/></svg>
        </Link>
      </div>
      <DataModal open={dataOpen} onClose={() => setDataOpen(false)} />
      <ToolsModal open={toolsOpen} onClose={() => setToolsOpen(false)} />
    </header>
  );
}

function NavLink({ href, pathname, children }: { href: string; pathname: string | null; children: React.ReactNode }) {
  const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
  return (
    <Link href={href} className={`hover:underline ${active ? "text-orange-400" : "opacity-90"}`}>
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

