"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useFoundry } from "@/context/FoundryContext";
import { downloadText } from "@/lib/download";

export default function SequencePage() {
  const { state } = useFoundry();
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
    try {
      const res = await api<{ filename: string; content: string }>("/sequence/export", "POST", { contacts: rows });
      downloadText(res.filename, res.content);
    } catch (e: any) {
      alert(`Export failed: ${e?.message || e}`);
    }
  };

  const pushToInstantly = async () => {
    try {
      await api("/sequence/push", "POST", { list_name: "RoleFerry Demo", contacts: rows });
      alert("Pushed to Instantly (demo)");
    } catch (e: any) {
      alert(`Push failed: ${e?.message || e}`);
    }
  };

  const loadFromContacts = () => {
    const contacts = (state.contacts || []).filter(
      (c) => c.verification_status === "valid" || (c.verification_status === "accept_all" && (c.verification_score || 0) >= 0.8)
    );
    const mapped = contacts.map((c) => ({
      email: c.email || "",
      first_name: (c.name || "").split(" ")[0] || "",
      last_name: (c.name || "").split(" ").slice(1).join(" ") || "",
      company: c.company || "",
      title: c.title || "",
      jd_link: "",
      portfolio_url: "",
      match_score: "",
      verification_status: c.verification_status || "",
      verification_score: c.verification_score || "",
      subject: "",
      message: "",
    }));
    setRows(mapped);
  };

  const applySeqFields = () => {
    if (!state.seqSubject && !state.seqMessage) return;
    setRows((prev) => prev.map((r) => ({ ...r, subject: state.seqSubject || r.subject, message: state.seqMessage || r.message })));
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Sequence Export</h1>
      <div className="text-sm opacity-80">Push mode: {process.env.NEXT_PUBLIC_API_BASE ? "API available" : "CSV fallback"}</div>
      <div className="flex items-center gap-3">
        <button onClick={exportCsv} className="px-4 py-2 rounded brand-gradient text-black font-medium">Download Instantly CSV</button>
        <button onClick={pushToInstantly} className="px-3 py-2 rounded bg-white/10 border border-white/10">Push to Instantly</button>
        <button onClick={loadFromContacts} className="px-3 py-2 rounded bg-white/10 border border-white/10">Load from contacts</button>
        <button onClick={applySeqFields} className="px-3 py-2 rounded bg-white/10 border border-white/10">Apply subject/body</button>
        <span className="text-sm opacity-80">Rows {rows.length} · File instantly.csv</span>
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

