"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import HealthIndicator from "./HealthIndicator";

export default function Navbar() {
  const [dark, setDark] = useState(false);
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

