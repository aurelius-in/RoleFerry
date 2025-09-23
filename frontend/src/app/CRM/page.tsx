"use client";
import { useState } from "react";

export default function CRM() {
  const lanes = ["People", "Conversation", "Meeting", "Deal"] as const;
  const [items, setItems] = useState<Record<string, string[]>>({
    People: ["Alex Example"],
    Conversation: [],
    Meeting: [],
    Deal: [],
  });
  const [dragId, setDragId] = useState<string | null>(null);
  function onDragStart(id: string) {
    setDragId(id);
  }
  function onDrop(lane: string) {
    if (!dragId) return;
    setItems((prev) => {
      const next: Record<string, string[]> = { ...prev };
      for (const k of Object.keys(next)) {
        next[k] = next[k].filter((x) => x !== dragId);
      }
      next[lane] = [...next[lane], dragId];
      return next;
    });
    setDragId(null);
  }
  return (
    <main className="max-w-full mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">CRM</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {lanes.map((lane) => (
          <div
            key={lane}
            className="rounded-lg border border-white/10 bg-white/5 min-h-[300px]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(lane)}
          >
            <div className="p-3 font-medium border-b border-white/10">{lane}</div>
            <div className="p-3 space-y-2">
              {items[lane].map((id) => (
                <div key={id} draggable onDragStart={() => onDragStart(id)} className="p-2 rounded bg-white/10 border border-white/10 cursor-move text-sm">
                  {id}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

