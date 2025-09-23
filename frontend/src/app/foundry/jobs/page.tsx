"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useFoundry } from "@/context/FoundryContext";

export default function JobsPage() {
  const { state, setState } = useFoundry();
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

  const fetchResults = async () => {
    const job_id = (Array.isArray((state as any)?.jobs) ? (state as any).jobs[0]?.job_id : undefined) as string | undefined;
    if (!job_id) return;
    const res = await api<{ postings: any[] }>(`/jobs/${job_id}`, "GET");
    setState({ jobs: [{ job_id, postings: res.postings }] });
  };

  const inputCls = "px-3 py-2 rounded bg-white/5 border border-white/10 w-full";
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Jobs</h1>
      {Array.isArray((state as any)?.jobs) && (state as any).jobs[0]?.job_id ? (
        <div className="rounded-md p-2 bg-white/5 border border-white/10 text-sm">Saved job_id: {(state as any).jobs[0].job_id}</div>
      ) : null}
      {Array.isArray((state as any)?.jobs) && (state as any).jobs[0]?.postings ? (
        <div className="text-sm opacity-80">Postings: {(state as any).jobs[0].postings.length}</div>
      ) : null}
      <div className="grid grid-cols-1 gap-3">
        <label className="space-y-1">
          <div className="text-sm opacity-80">Search query</div>
          <input className={inputCls} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="space-y-1">
          <div className="text-sm opacity-80">JD URLs (comma or newline)</div>
          <textarea className={inputCls} rows={4} value={urls} onChange={(e) => setUrls(e.target.value)} />
        </label>
        <div className="flex gap-2">
          <button onClick={ingest} className="px-4 py-2 rounded brand-gradient text-black font-medium">Start ingest</button>
          <button onClick={fetchResults} className="px-4 py-2 rounded bg-white/10 border border-white/10">Fetch results</button>
        </div>
      </div>
      {Array.isArray((state as any)?.jobs) && (state as any).jobs[0]?.postings?.length ? (
        <div className="rounded-lg border border-white/10 divide-y divide-white/10">
          {(state as any).jobs[0].postings.map((p: any) => (
            <div key={p.id} className="p-3">
              <div className="font-medium">{p.title} · {p.company}</div>
              <div className="text-sm opacity-80">{p.location} · <a className="underline" href={p.jd_url} target="_blank">JD</a></div>
            </div>
          ))}
          <div className="p-3">
            <a className="px-3 py-2 rounded bg-white/10 border border-white/10 text-sm" href={(state as any).jobs[0].postings[0]?.jd_url} target="_blank">Open first JD</a>
          </div>
        </div>
      ) : null}
    </main>
  );
}

