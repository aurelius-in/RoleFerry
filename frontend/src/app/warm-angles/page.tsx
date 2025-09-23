"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export default function WarmAngles() {
  const [linkedin, setLinkedin] = useState("");
  const [domain, setDomain] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const find = async () => {
    const res = await api<{ warm_angles: any[] }>("/warm-angles/find", "POST", { linkedin, domain });
    setItems(res.warm_angles);
  };
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Warm Angles</h1>
      <div className="flex gap-2">
        <input className="px-3 py-2 rounded bg-white/5 border border-white/10" placeholder="LinkedIn URL" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
        <input className="px-3 py-2 rounded bg-white/5 border border-white/10" placeholder="Company domain" value={domain} onChange={(e) => setDomain(e.target.value)} />
        <button onClick={find} className="px-4 py-2 rounded brand-gradient text-black font-medium">Find</button>
      </div>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="rounded-lg p-3 bg-white/5 border border-white/10 text-sm">
            {it.type}: {it.detail}
          </li>
        ))}
      </ul>
    </main>
  );
}

