export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 sm:p-16">
      <main className="w-full max-w-3xl mx-auto text-center space-y-6">
        <div className="flex flex-col items-center justify-center gap-3">
          <img src="/wordmark.png" alt="RoleFerry" className="h-10 md:h-12" />
          <img src="/roleferry-med.gif" alt="RoleFerry animation" className="w-[260px] md:w-[320px] rounded" />
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">
          Forge your first conversation.
        </h1>
        <p className="text-base sm:text-lg opacity-90">
          Relationship-first outreach for prospecting and hiring.
        </p>
        <div className="flex items-center justify-center gap-3">
          <a href="/foundry" className="inline-flex rounded-full px-4 py-2 text-black font-medium brand-gradient">Go to Foundry</a>
          <a href="/analytics" className="inline-flex rounded-full px-4 py-2 text-black font-medium bg-white/10 border border-white/10">View Analytics</a>
          <a href="/tools" className="inline-flex rounded-full px-4 py-2 text-black font-medium bg-white/10 border border-white/10">Tools</a>
        </div>
      </main>
    </div>
  );
}
