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
    <main className="max-w-6xl mx-auto p-3 sm:p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-4xl mx-auto">
        {steps.map((s) => (
          <a key={s.key} href={`/foundry/${s.key}`} className="relative aspect-square rounded-md bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center group">
            <span className="text-8xl md:text-9xl lg:text-[10rem] leading-none" aria-hidden>{s.icon}</span>
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-base md:text-lg lg:text-xl font-bold opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-y-[-2px] drop-shadow">
              {s.label}
            </span>
          </a>
        ))}
      </div>
    </main>
  );
}

