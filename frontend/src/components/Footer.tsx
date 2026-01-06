"use client";

import { usePathname } from "next/navigation";
import { toggleDemoDebugPanel } from "./DemoDebugPanel";

export default function Footer() {
  const pathname = usePathname();
  if (pathname === "/") return null; // homepage must match approved wireframe

  return (
    <footer className="w-full py-6 px-4 sm:px-6 text-center text-sm opacity-80">
      <div className="space-x-4">
        <a className="underline" href="/about">
          About
        </a>
        {/* Hidden unless clicked: debug panel */}
        <button
          type="button"
          onClick={toggleDemoDebugPanel}
          className="underline opacity-40 hover:opacity-90 transition-opacity"
          aria-label="Open debug panel"
        >
          Debug
        </button>
      </div>
      <div>Forge your first conversation. © 2025–2026 Reliable AI Network, Inc.</div>
    </footer>
  );
}

