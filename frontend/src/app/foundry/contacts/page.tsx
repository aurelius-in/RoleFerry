"use client";
import { api } from "@/lib/api";
import { useFoundry } from "@/context/FoundryContext";
import VerificationBadge from "@/components/VerificationBadge";
import { useState } from "react";

export default function ContactsPage() {
  const { state, setState } = useFoundry();
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("Director of Product");

  const find = async () => {
    const res = await api<{ contacts: any[] }>("/contacts/find", "POST", { company, titles: [title] });
    setState({ contacts: res.contacts });
  };

  const toggleSendable = () => setState({ sendableOnly: !state.sendableOnly });

  const list = (state.contacts || []).filter((c) => {
    if (!state.sendableOnly) return true;
    if (c.verification_status === "valid") return true;
    if (c.verification_status === "accept_all" && (c.verification_score || 0) >= 0.8) return true;
    return false;
  });

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Contacts</h1>
      <div className="text-sm opacity-80">Total {(state.contacts || []).length} · Sendable {list.length}</div>
      <div className="flex gap-2">
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" className="px-3 py-2 rounded bg-white/5 border border-white/10 w-64" />
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="px-3 py-2 rounded bg-white/5 border border-white/10 w-64" />
        <button onClick={find} className="px-4 py-2 rounded brand-gradient text-black font-medium">Find</button>
        <label className="ml-auto inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!state.sendableOnly} onChange={toggleSendable} /> Sendable only
        </label>
      </div>
      <div className="rounded-lg border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Title</th>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Verification</th>
              <th className="text-left p-2">Sendable</th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="odd:bg-white/0 even:bg-white/[.03]">
                <td className="p-2">{c.name}</td>
                <td className="p-2">{c.title}</td>
                <td className="p-2">{c.email}</td>
                <td className="p-2"><VerificationBadge status={c.verification_status} score={c.verification_score} /></td>
                <td className="p-2">
                  {c.verification_status === "valid" || (c.verification_status === "accept_all" && (c.verification_score || 0) >= 0.8) ? "✅" : "⚠️"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

