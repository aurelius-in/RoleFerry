import { api } from "@/lib/api";

export default async function Messages() {
  const data = await api<{ messages: any[] }>("/messages", "GET");
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Messages</h1>
      <div className="rounded-lg border border-white/10 divide-y divide-white/10">
        {data.messages.map((m, i) => (
          <div key={i} className="p-3 text-sm">
            <span className="opacity-70">{m.id}</span> · opened: {String(m.opened)} · replied: {String(m.replied)} · label: {m.label || "-"}
          </div>
        ))}
      </div>
    </main>
  );
}

