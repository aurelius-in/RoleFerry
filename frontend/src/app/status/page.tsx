export default async function Status() {
  const res = await fetch("/api/health", { cache: "no-store" });
  const data = await res.json();
  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Status</h1>
      <pre className="rounded-lg p-4 bg-white/5 border border-white/10 text-sm whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
}

