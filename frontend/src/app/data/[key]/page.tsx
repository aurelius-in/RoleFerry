import { getMockTable, type DataKey } from "@/lib/mockData";

export default function DataPage({ params }: { params: { key: DataKey } }) {
  const table = getMockTable(params.key);
  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
      <h1 className="text-2xl font-semibold">{table.title}</h1>
      <div className="overflow-auto bg-white/5 border border-white/10 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-white/10">
            <tr>
              {table.columns.map((c) => (
                <th key={c} className="text-left px-3 py-2 font-semibold">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} className="odd:bg-white/5">
                {table.columns.map((c) => (
                  <td key={c} className="px-3 py-2 whitespace-nowrap">{String((row as any)[c] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}


