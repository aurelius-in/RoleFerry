"use client";
import Link from "next/link";

export default function ToolsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden></div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-lg border border-white/10 bg-neutral-900/95 backdrop-blur shadow-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-lg font-semibold">Tools</h2>
            <button onClick={onClose} className="px-2 py-1 rounded hover:bg-white/10">✕</button>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
            <Link className="px-3 py-2 rounded bg-white/10 hover:bg-white/15" href="/replies">Reply Classifier</Link>
            <Link className="px-3 py-2 rounded bg-white/10 hover:bg-white/15" href="/warm-angles">Warm Angles</Link>
            <Link className="px-3 py-2 rounded bg-white/10 hover:bg-white/15" href="/onepager">One‑pager Generator</Link>
            <Link className="px-3 py-2 rounded bg-white/10 hover:bg-white/15" href="/deliverability">Deliverability</Link>
            <Link className="px-3 py-2 rounded bg-white/10 hover:bg-white/15" href="/compliance">Compliance</Link>
            <Link className="px-3 py-2 rounded bg-white/10 hover:bg-white/15" href="/audit">Audit Log</Link>
            <Link className="px-3 py-2 rounded bg-white/10 hover:bg-white/15" href="/messages">Messages</Link>
            <Link className="px-3 py-2 rounded bg-white/10 hover:bg-white/15" href="/onboarding">Onboarding</Link>
            <a className="px-3 py-2 rounded bg-white/10 hover:bg-white/15" href="/api/health" target="_blank">Health</a>
            <a className="px-3 py-2 rounded bg-white/10 hover:bg-white/15" href="http://localhost:8000/docs" target="_blank">API Docs</a>
          </div>
        </div>
      </div>
    </div>
  );
}


