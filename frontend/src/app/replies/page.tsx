"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export default function ReplyTester() {
  const [text, setText] = useState("");
  const [label, setLabel] = useState<string | null>(null);
  const classify = async () => {
    const res = await api<{ label: string }>("/replies/classify", "POST", { text });
    setLabel(res.label);
  };
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Reply Classifier</h1>
      <textarea className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 min-h-40" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a reply here" />
      <div className="flex items-center gap-2">
        <button onClick={classify} className="px-4 py-2 rounded brand-gradient text-black font-medium">Classify</button>
        {label ? <span className="text-sm opacity-80">Label: {label}</span> : null}
      </div>
    </main>
  );
}

