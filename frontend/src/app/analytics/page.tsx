import { api } from "@/lib/api";

type CampaignResp = { delivered: number; open: number; reply: number; positive: number; meetings: number; variants?: Record<string, { delivered: number; open: number; reply: number; positive: number }> };

export default async function Analytics() {
  let data: CampaignResp | null = null;
  let error: string | null = null;
  try {
    data = await api<CampaignResp>("/analytics/campaign", "GET");
  } catch (e: any) {
    error = String(e?.message || e);
  }
  const rate = (num: number, denom: number) => (denom ? Math.round((num / denom) * 100) : 0);
  const openRate = data ? rate(data.open, data.delivered) : 0;
  const replyRate = data ? rate(data.reply, data.delivered) : 0;
  const posRate = data ? rate(data.positive, data.reply) : 0;
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>
      {error ? (
        <div className="rounded-lg p-4 bg-white/5 border border-white/10 space-y-2">
          <div className="text-sm">We couldn’t load metrics right now.</div>
          <div className="text-xs opacity-80 break-all">{error}</div>
          <div className="text-sm">
            Try again shortly, or check <a className="underline" href="/status">API Status</a>.
          </div>
        </div>
      ) : null}
      {data ? (
        <>
          <div>
            <a className="px-3 py-2 rounded bg-white/10 border border-white/10 text-sm" href="/api/analytics/csv" target="_blank">Download CSV</a>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Delivered" value={data.delivered} />
            <Stat label="Open" value={data.open} suffix={`(${openRate}%)`} />
            <Stat label="Reply" value={data.reply} suffix={`(${replyRate}%)`} />
            <Stat label="Positive" value={data.positive} suffix={`(${posRate}%)`} />
            <Stat label="Meetings" value={data.meetings} />
          </div>
        </>
      ) : null}
      {data?.variants && Object.keys(data.variants).length ? (
        <div>
          <h2 className="text-xl font-semibold mt-4">Variants</h2>
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left p-2">Variant</th>
                  <th className="text-left p-2">Delivered</th>
                  <th className="text-left p-2">Open</th>
                  <th className="text-left p-2">Reply</th>
                  <th className="text-left p-2">Positive</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.variants).map(([v, row]) => (
                  <tr key={v} className="odd:bg-white/0 even:bg-white/[.03]">
                    <td className="p-2">{v || "(none)"}</td>
                    <td className="p-2">{row.delivered}</td>
                    <td className="p-2">{row.open}</td>
                    <td className="p-2">{row.reply}</td>
                    <td className="p-2">{row.positive}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
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

