"use client";
import { api } from "@/lib/api";
import { useFoundry } from "@/context/FoundryContext";
import { useLoading } from "@/components/LoadingProvider";
import { useToast } from "@/components/ToastProvider";

export default function VerifyPage() {
  const { state, setState } = useFoundry();
  const { begin, end } = useLoading();
  const { notify } = useToast();

  const verify = async () => {
    const ids = (state.contacts || []).map((c) => c.id);
    if (ids.length === 0) return;
    begin();
    try {
      const res = await api<{ results: any[] }>("/contacts/verify", "POST", { contact_ids: ids });
      const map = new Map(res.results.map((r) => [r.contact_id, r]));
      const updated = (state.contacts || []).map((c) => {
        const r = map.get(c.id);
        return r ? { ...c, verification_status: r.verification_status, verification_score: r.verification_score } : c;
      });
      setState({ contacts: updated });
      notify("Verification complete");
    } finally {
      end();
    }
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Verify</h1>
      <button onClick={verify} className="px-4 py-2 rounded brand-gradient text-black font-medium">Verify Contacts</button>
    </main>
  );
}

