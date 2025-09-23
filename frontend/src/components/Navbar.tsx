"use client";
import Image from "next/image";
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
      <div className="flex items-center gap-2">
        {dark ? (
          <Image src="/role_ferry_white.png" alt="RoleFerry" width={140} height={38} />
        ) : (
          <Image src="/role_ferry_black.png" alt="RoleFerry" width={140} height={38} />
        )}
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
    setIsDark(root.classList.contains("dark"));
  }, []);
  const toggle = () => {
    const root = document.documentElement;
    root.classList.toggle("dark");
    setIsDark(root.classList.contains("dark"));
  };
  return (
    <button onClick={toggle} className="px-3 py-1 rounded-md brand-gradient text-black font-medium">
      {isDark ? "Day" : "Night"}
    </button>
  );
}

