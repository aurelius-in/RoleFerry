import { api } from "@/lib/api";

export default async function Analytics() {
  const data = await api<{ delivered: number; open: number; reply: number; positive: number; meetings: number }>(
    "/analytics/campaign",
    "GET"
  );
  const rate = (num: number, denom: number) => (denom ? Math.round((num / denom) * 100) : 0);
  const openRate = rate(data.open, data.delivered);
  const replyRate = rate(data.reply, data.delivered);
  const posRate = rate(data.positive, data.reply);
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Delivered" value={data.delivered} />
        <Stat label="Open" value={data.open} suffix={`(${openRate}%)`} />
        <Stat label="Reply" value={data.reply} suffix={`(${replyRate}%)`} />
        <Stat label="Positive" value={data.positive} suffix={`(${posRate}%)`} />
        <Stat label="Meetings" value={data.meetings} />
      </div>
    </main>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-lg p-4 bg-white/5 border border-white/10">
      <div className="text-sm opacity-80">{label}</div>
      <div className="text-2xl font-semibold">
        {value} {suffix ? <span className="text-base opacity-80">{suffix}</span> : null}
      </div>
    </div>
  );
}

