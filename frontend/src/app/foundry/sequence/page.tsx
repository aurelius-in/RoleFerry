"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { downloadText } from "@/lib/download";

export default function SequencePage() {
  const [rows, setRows] = useState<any[]>([
    {
      email: "alex@example.com",
      first_name: "Alex",
      last_name: "Example",
      company: "Acme",
      title: "Director of Product",
      jd_link: "https://example.com/job",
      portfolio_url: "https://example.com/folio",
      match_score: 87,
      verification_status: "valid",
      verification_score: 1.0,
      subject: "Quick intro",
      message: "Hi Alex...",
    },
  ]);

  const exportCsv = async () => {
    const res = await api<{ filename: string; content: string }>("/sequence/export", "POST", { contacts: rows });
    downloadText(res.filename, res.content);
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Sequence Export</h1>
      <div>
        <button onClick={exportCsv} className="px-4 py-2 rounded brand-gradient text-black font-medium">Download Instantly CSV</button>
      </div>
      <div className="rounded-lg border border-white/10 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-white/5">
            <tr>
              {Object.keys(rows[0] || {}).map((k) => (
                <th key={k} className="text-left p-2 whitespace-nowrap">{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="odd:bg-white/0 even:bg-white/[.03]">
                {Object.keys(rows[0] || {}).map((k) => (
                  <td key={k} className="p-2 whitespace-nowrap">{String(r[k])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

