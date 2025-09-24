"use client";
import Link from "next/link";

export default function Tools() {
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-5">
      <h1 className="text-2xl md:text-3xl font-semibold">Tools</h1>
      <ul className="list-disc list-inside space-y-2 text-base">
        <li><Link className="underline" href="/replies">Reply Classifier</Link></li>
        <li><Link className="underline" href="/warm-angles">Warm Angles</Link></li>
        <li><Link className="underline" href="/onepager">One-pager Generator</Link></li>
        <li><Link className="underline" href="/deliverability">Deliverability</Link></li>
        <li><Link className="underline" href="/compliance">Compliance</Link></li>
        <li><a className="underline" href="http://localhost:8000/docs" target="_blank">API Docs (OpenAPI)</a></li>
        <li><a className="underline" href="/api/health" target="_blank">Health</a></li>
        <li><Link className="underline" href="/audit">Audit Log</Link></li>
        <li><Link className="underline" href="/messages">Messages</Link></li>
        <li><Link className="underline" href="/onboarding">Onboarding</Link></li>
        <li><DemoButtons /></li>
      </ul>
    </main>
  );
}

function DemoButtons() {
  const seed = async () => {
    await fetch("/api/demo/seed", { method: "POST" });
    alert("Seeded demo data");
  };
  const cleanup = async () => {
    await fetch("/api/demo/cleanup", { method: "POST" });
    alert("Cleared demo data");
  };
  return (
    <div className="flex items-center gap-2 text-sm">
      <button onClick={seed} className="px-3 py-1 rounded bg-white/10 border border-white/10">Seed demo</button>
      <button onClick={cleanup} className="px-3 py-1 rounded bg-white/10 border border-white/10">Reset demo</button>
    </div>
  );
}

