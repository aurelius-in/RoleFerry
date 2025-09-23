export default function CRM() {
  const lanes = ["People", "Conversation", "Meeting", "Deal"];
  return (
    <main className="max-w-full mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">CRM</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {lanes.map((lane) => (
          <div key={lane} className="rounded-lg border border-white/10 bg-white/5 min-h-[300px]">
            <div className="p-3 font-medium border-b border-white/10">{lane}</div>
            <div className="p-3 text-sm opacity-80">Drag-and-drop coming soon.</div>
          </div>
        ))}
      </div>
    </main>
  );
}

