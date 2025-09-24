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
    { key: "offers", label: "Offers", icon: "📄" },
  ];
  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {steps.map((s) => (
          <a key={s.key} href={`/foundry/${s.key}`} className="relative aspect-square rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center p-[2px] group">
            <span className="text-6xl md:text-7xl lg:text-8xl" aria-hidden>{s.icon}</span>
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-lg md:text-xl lg:text-2xl font-bold opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-y-[-2px] drop-shadow">
              {s.label}
            </span>
          </a>
        ))}
      </div>
    </main>
  );
}

