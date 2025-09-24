export default function Foundry() {
  const steps: { key: string; label: string; icon: string }[] = [
    { key: "ijp", label: "IJP", icon: "📋" },
    { key: "jobs", label: "Jobs", icon: "🧭" },
    { key: "candidate", label: "Candidate", icon: "👤" },
    { key: "match", label: "Match", icon: "🔗" },
    { key: "contacts", label: "Contacts", icon: "📇" },
    { key: "verify", label: "Verify", icon: "✅" },
    { key: "outreach", label: "Outreach", icon: "✉️" },
    { key: "sequence", label: "Sequence", icon: "📤" },
  ];
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {steps.map((s) => (
          <a key={s.key} href={`/foundry/${s.key}`} className="rounded-lg p-4 bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2">
            <span className="text-xl" aria-hidden>{s.icon}</span>
            <span>{s.label}</span>
          </a>
        ))}
      </div>
    </main>
  );
}

