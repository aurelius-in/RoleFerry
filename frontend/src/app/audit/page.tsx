import { api } from "@/lib/api";

export default async function Audit() {
  const data = await api<{ logs: any[] }>("/audit", "GET");
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Audit Log</h1>
      <div className="rounded-lg border border-white/10 divide-y divide-white/10">
        {data.logs.map((l, i) => (
          <pre key={i} className="p-3 whitespace-pre-wrap text-xs opacity-90">{JSON.stringify(l, null, 2)}</pre>
        ))}
      </div>
    </main>
  );
}

