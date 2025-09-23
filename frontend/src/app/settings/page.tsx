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
      <ThresholdForm current={s.mv_threshold} />
      <div className="text-sm space-x-4">
        <a className="underline" href="/replies">Go to Replies tester</a>
        <a className="underline" href="/api/metrics" target="_blank">Metrics</a>
      </div>
    </main>
  );
}

function Slider({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <input type="range" min={0.5} max={1.0} step={0.01} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
  );
}

async function saveThreshold(n: number) {
  await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mv_threshold: n }) });
}

function ThresholdForm({ current }: { current: number }) {
  const [val, setVal] = (require("react") as any).useState(current);
  return (
    <div className="rounded-lg p-4 bg-white/5 border border-white/10 space-y-2">
      <div className="text-sm">Email verification threshold: {val.toFixed(2)}</div>
      <Slider value={val} onChange={setVal} />
      <button onClick={() => saveThreshold(val)} className="px-3 py-2 rounded bg-white/10 border border-white/10 text-sm">Save</button>
    </div>
  );
}

