async function getSettings() {
  const r = await fetch("/api/settings", { cache: "no-store" });
  return await r.json();
}

export default async function Settings() {
  const s = await getSettings();
  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <div className="rounded-lg p-4 bg-white/5 border border-white/10 space-y-2 text-sm">
        <div>Environment: {s.environment}</div>
        <div>MV Threshold: {s.mv_threshold}</div>
        <div>CORS Origins: {Array.isArray(s.cors_origins) ? s.cors_origins.join(", ") : String(s.cors_origins)}</div>
        <div>Instantly Enabled: {String(s.instantly_enabled)}</div>
      </div>
      <div className="text-sm"><a className="underline" href="/replies">Go to Replies tester</a></div>
    </main>
  );
}

