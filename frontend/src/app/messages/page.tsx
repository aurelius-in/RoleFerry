import { api } from "@/lib/api";

export default async function Messages() {
  const data = await api<{ messages: any[] }>("/messages", "GET");
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Messages</h1>
      <div className="rounded-lg border border-white/10 divide-y divide-white/10">
        {data.messages.map((m, i) => (
          <MessageRow key={i} m={m} />
        ))}
      </div>
    </main>
  );
}

function MessageRow({ m }: { m: any }) {
  async function mark(type: "open" | "reply" | "positive") {
    const body: any = { id: m.id };
    if (type === "open") body.opened = true;
    if (type === "reply") body.replied = true;
    if (type === "positive") body.label = "positive";
    await fetch("/api/messages/mock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    location.reload();
  }
  return (
    <div className="p-3 text-sm flex items-center justify-between">
      <div>
        <span className="opacity-70">{m.id}</span> · opened: {String(m.opened)} · replied: {String(m.replied)} · label: {m.label || "-"}
      </div>
      <div className="flex gap-2">
        <button className="px-2 py-1 rounded bg-white/10 border border-white/10" onClick={() => mark("open")}>Mark Open</button>
        <button className="px-2 py-1 rounded bg-white/10 border border-white/10" onClick={() => mark("reply")}>Mark Reply</button>
        <button className="px-2 py-1 rounded bg-white/10 border border-white/10" onClick={() => mark("positive")}>Mark Positive</button>
      </div>
    </div>
  );
}

