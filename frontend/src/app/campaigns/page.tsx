"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Campaign = { id: string; name: string; variant: string; list_size: number; status: string; created_at: string };

export default function CampaignsPage() {
  const [status, setStatus] = useState<string>("");
  const [variant, setVariant] = useState<string>("");
  const [minList, setMinList] = useState<number>(0);
  const [items, setItems] = useState<Campaign[]>([]);

  const load = async () => {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (variant) qs.set("variant", variant);
    if (minList) qs.set("min_list", String(minList));
    const data = await api<{ campaigns: Campaign[] }>(`/sequence/campaigns${qs.toString() ? "?" + qs.toString() : ""}`, "GET");
    setItems(data.campaigns);
  };

  useEffect(() => { load(); }, []);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campaigns</h1>
      </div>
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <div className="text-xs opacity-70 mb-1">Status</div>
          <select className="px-3 py-2 rounded bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any</option>
            <option>active</option>
            <option>paused</option>
            <option>draft</option>
          </select>
        </div>
        <div>
          <div className="text-xs opacity-70 mb-1">Variant</div>
          <input className="px-3 py-2 rounded bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="preset_..." value={variant} onChange={(e) => setVariant(e.target.value)} />
        </div>
        <div>
          <div className="text-xs opacity-70 mb-1">Min list size</div>
          <input type="number" className="px-3 py-2 rounded bg-white/5 border border-white/10 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500" value={minList} onChange={(e) => setMinList(parseInt(e.target.value || "0"))} />
        </div>
        <button onClick={load} className="px-4 py-2 rounded brand-gradient text-black font-medium focus:outline-none focus:ring-2 focus:ring-blue-500">Apply</button>
      </div>
      <div className="rounded-lg border border-white/10 divide-y divide-white/10 overflow-hidden">
        {items.map((c) => (
          <div key={c.id} className="p-4 md:p-5 flex items-center justify-between gap-4 hover:bg-white/[.04]">
            <div className="space-y-1 min-w-0">
              <div className="font-medium truncate">{c.name}</div>
              <div className="text-xs opacity-70">Created {new Date(c.created_at).toLocaleString()}</div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge tone="info">{c.variant}</Badge>
              <Badge tone={c.status === "active" ? "success" : c.status === "paused" ? "warning" : "neutral"}>{c.status}</Badge>
              <Badge tone="neutral">{c.list_size} contacts</Badge>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function Badge({ children, tone }: { children: any; tone: "success" | "warning" | "neutral" | "info" }) {
  const map = {
    success: "bg-green-500/20 text-green-300 border-green-500/30",
    warning: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    neutral: "bg-white/10 text-white/80 border-white/20",
    info: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  } as const;
  return <span className={`px-2 py-0.5 text-xs rounded border ${map[tone]}`}>{children}</span>;
}


