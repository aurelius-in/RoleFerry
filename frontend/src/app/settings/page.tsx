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
      <Citizenship />
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
  const [saved, setSaved] = (require("react") as any).useState(false);
  return (
    <div className="rounded-lg p-4 bg-white/5 border border-white/10 space-y-2">
      <div className="text-sm">Email verification threshold: {val.toFixed(2)}</div>
      <Slider value={val} onChange={setVal} />
      <button onClick={async () => { await saveThreshold(val); setSaved(true); setTimeout(() => setSaved(false), 2000); }} className="px-3 py-2 rounded bg-white/10 border border-white/10 text-sm">Save</button>
      {saved ? <div className="text-xs opacity-80">Saved</div> : null}
    </div>
  );
}

function Citizenship() {
  const React = require("react");
  const [citizen, setCitizen] = React.useState<string>("US");
  const [status, setStatus] = React.useState<string>("Citizen");
  React.useEffect(() => {
    const c = localStorage.getItem("rf_citizenship_country") || "US";
    const s = localStorage.getItem("rf_citizenship_status") || "Citizen";
    setCitizen(c);
    setStatus(s);
  }, []);
  React.useEffect(() => {
    localStorage.setItem("rf_citizenship_country", citizen);
    localStorage.setItem("rf_citizenship_status", status);
  }, [citizen, status]);
  return (
    <div className="rounded-lg p-4 bg-white/5 border border-white/10 space-y-2">
      <div className="text-sm font-medium">Citizenship</div>
      <div className="flex gap-3">
        <div>
          <div className="text-xs opacity-70">Country</div>
          <select className="px-3 py-2 rounded bg-white/5 border border-white/10" value={citizen} onChange={(e) => setCitizen(e.target.value)}>
            <option value="US">United States</option>
            <option value="CA">Canada</option>
            <option value="UK">United Kingdom</option>
            <option value="EU">European Union</option>
            <option value="SG">Singapore</option>
            <option value="AU">Australia</option>
            <option value="IN">India</option>
            <option value="BR">Brazil</option>
          </select>
        </div>
        <div>
          <div className="text-xs opacity-70">Status</div>
          <select className="px-3 py-2 rounded bg-white/5 border border-white/10" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>Citizen</option>
            <option>Permanent Resident</option>
            <option>Work Visa</option>
            <option>Student Visa</option>
            <option>Other</option>
          </select>
        </div>
      </div>
      <div className="text-xs opacity-70">Saved locally for personalization and compliance hints.</div>
    </div>
  );
}

