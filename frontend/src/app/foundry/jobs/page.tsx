"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useFoundry } from "@/context/FoundryContext";

export default function JobsPage() {
  const { setState } = useFoundry();
  const [query, setQuery] = useState("Product Manager remote");
  const [urls, setUrls] = useState("");

  const ingest = async () => {
    const jd_urls = urls
      .split(/\n|,/) // split by newlines or commas
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await api<{ job_id: string }>("/jobs/ingest", "POST", { query, jd_urls });
    setState({ jobs: [{ job_id: res.job_id }] });
    alert(`Ingest started: ${res.job_id}`);
  };

  const inputCls = "px-3 py-2 rounded bg-white/5 border border-white/10 w-full";
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Jobs</h1>
      <div className="grid grid-cols-1 gap-3">
        <label className="space-y-1">
          <div className="text-sm opacity-80">Search query</div>
          <input className={inputCls} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="space-y-1">
          <div className="text-sm opacity-80">JD URLs (comma or newline)</div>
          <textarea className={inputCls} rows={4} value={urls} onChange={(e) => setUrls(e.target.value)} />
        </label>
        <div>
          <button onClick={ingest} className="px-4 py-2 rounded brand-gradient text-black font-medium">Start ingest</button>
        </div>
      </div>
    </main>
  );
}

