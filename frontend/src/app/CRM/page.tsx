"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function CRM() {
  const lanes = ["People", "Conversation", "Meeting", "Deal"] as const;
  const [items, setItems] = useState<Record<string, any[]>>({ People: [], Conversation: [], Meeting: [], Deal: [] });
  useEffect(() => {
    api<{ lanes: Record<string, any[]> }>("/crm/board", "GET").then((d) => setItems(d.lanes));
  }, []);
  const [dragId, setDragId] = useState<string | null>(null);
  function onDragStart(id: string) {
    setDragId(id);
  }
  function onDrop(lane: string) {
    if (!dragId) return;
    setItems((prev) => {
      const next: Record<string, any[]> = { ...prev };
      for (const k of Object.keys(next)) {
        next[k] = next[k].filter((x) => x.id !== dragId);
      }
      next[lane] = [...next[lane], { id: dragId, name: dragId, note: "" }];
      return next;
    });
    setDragId(null);
    api("/crm/board", "POST", { lanes: items });
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
              {items[lane].map((card) => (
                <Card key={card.id} card={card} onDragStart={onDragStart} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function Card({ card, onDragStart }: { card: any; onDragStart: (id: string) => void }) {
  const [note, setNote] = useState(card.note || "");
  const [assignee, setAssignee] = useState(card.assignee || "");
  const [due, setDue] = useState(card.due_date || "");
  async function saveNote() {
    await fetch("/api/crm/note", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: card.id, note }) });
    alert("Saved");
  }
  async function saveMeta() {
    await fetch("/api/crm/card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: card.id, assignee, due_date: due }) });
    alert("Updated");
  }
  return (
    <div draggable onDragStart={() => onDragStart(card.id)} className="p-2 rounded bg-white/10 border border-white/10 cursor-move text-sm">
      <div className="font-medium">{card.name || card.id}</div>
      <div className="flex items-center gap-2 mt-1">
        <input className="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-xs" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Next step / note" />
        <button onClick={saveNote} className="px-2 py-1 rounded bg-white/10 border border-white/10 text-xs">Save</button>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <input className="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-xs" value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="Assignee" />
        <input type="date" className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs" value={due || ""} onChange={(e) => setDue(e.target.value)} />
        <button onClick={saveMeta} className="px-2 py-1 rounded bg-white/10 border border-white/10 text-xs">Update</button>
      </div>
    </div>
  );
}

