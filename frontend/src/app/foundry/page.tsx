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
      <div className="grid grid-cols-3 gap-2 sm:gap-2 mx-auto w-[420px] sm:w-[480px] justify-items-center">
        {steps.map((s) => (
          <a key={s.key} href={`/foundry/${s.key}`} className="relative w-24 sm:w-28 aspect-square rounded-md bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center group p-0">
            <span className="text-[3.8rem] sm:text-[4.2rem] leading-none" aria-hidden>{s.icon}</span>
            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-xs md:text-sm lg:text-sm font-bold opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-y-[-2px] drop-shadow">
              {s.label}
            </span>
          </a>
        ))}
      </div>
    </main>
  );
}

