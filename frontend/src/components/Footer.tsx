"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { toggleDemoDebugPanel } from "./DemoDebugPanel";

export default function Footer() {
  const pathname = usePathname();
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    try {
      setShowDebug(window.localStorage.getItem("rf_show_debug") === "1");
    } catch {
      setShowDebug(false);
    }
  }, []);

  if (pathname === "/") return null; // homepage must match approved wireframe

  return (
    <footer className="w-full py-6 px-4 sm:px-6 text-center text-sm opacity-80">
      <div className="space-x-4">
        <a className="underline" href="/about">
          About
        </a>
        <a className="underline" href="/privacy">
          Privacy
        </a>
        {showDebug ? (
          <button
            type="button"
            onClick={toggleDemoDebugPanel}
            className="underline opacity-40 hover:opacity-90 transition-opacity"
            aria-label="Open debug panel"
          >
            Debug
          </button>
        ) : null}
      </div>
      <div>Forge your first conversation. © 2025-2026 Reliable AI Network, Inc.</div>
    </footer>
  );
}

