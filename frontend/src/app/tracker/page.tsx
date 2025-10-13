'use client';

import { useState } from 'react';

// Mock application data
const mockApplications = [
  {
    id: 1,
    company: { name: "DataFlow", logo: "https://logo.clearbit.com/dataflow.ai" },
    role: "Senior Product Manager",
    status: "applied",
    appliedDate: "2025-01-10",
    lastContact: "2025-01-10",
    replyStatus: null,
    contacts: ["Sarah Chen"]
  },
  {
    id: 2,
    company: { name: "GlobalTech", logo: "https://logo.clearbit.com/globaltech.io" },
    role: "Director of Product",
    status: "interviewing",
    appliedDate: "2025-01-08",
    lastContact: "2025-01-13",
    replyStatus: "replied",
    contacts: ["Michael Torres"],
    interviews: [
      { date: "2025-01-15", type: "Phone Screen" },
      { date: "2025-01-18", type: "Onsite" }
    ]
  },
  {
    id: 3,
    company: { name: "Acme Corp", logo: "https://logo.clearbit.com/acme.com" },
    role: "Senior PM",
    status: "offer",
    appliedDate: "2025-01-05",
    lastContact: "2025-01-14",
    replyStatus: "replied",
    contacts: ["Emma Rodriguez"],
    interviews: [
      { date: "2025-01-07", type: "Phone" },
      { date: "2025-01-10", type: "Onsite" }
    ],
    offer: { amount: 165000, equity: "0.15%" }
  }
];

export default function TrackerPage() {
  const [view, setView] = useState<'board' | 'table'>('board');
  const [mode, setMode] = useState<'jobseeker' | 'recruiter'>('jobseeker');
  const [applications] = useState(mockApplications);

  const columns = mode === 'jobseeker'
    ? ['Saved', 'Applied', 'Interviewing', 'Offer', 'Rejected']
    : ['Leads', 'Contacted', 'Appointments', 'Offers', 'Won/Lost'];

  const statusMap: Record<string, string> = mode === 'jobseeker'
    ? { saved: 'Saved', applied: 'Applied', interviewing: 'Interviewing', offer: 'Offer', rejected: 'Rejected' }
    : { saved: 'Leads', applied: 'Contacted', interviewing: 'Appointments', offer: 'Offers', rejected: 'Won/Lost' };

  const exportCSV = () => {
    const headers = ['Company', 'Role', 'Status', 'Applied Date', 'Last Contact', 'Reply Status'];
    const rows = applications.map(app => [
      app.company.name,
      app.role,
      app.status,
      app.appliedDate,
      app.lastContact,
      app.replyStatus || 'No reply'
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tracker-export.csv';
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-blue-950 text-white py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Tracker</h1>
            <p className="text-slate-400 mt-1">Manage your applications</p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex bg-white/5 border border-white/10 rounded-lg p-1">
              <button
                onClick={() => setView('board')}
                className={`px-4 py-2 rounded-md font-semibold text-sm transition-all ${
                  view === 'board' ? 'bg-blue-500 text-white' : 'text-slate-400'
                }`}
              >
                Board
              </button>
              <button
                onClick={() => setView('table')}
                className={`px-4 py-2 rounded-md font-semibold text-sm transition-all ${
                  view === 'table' ? 'bg-blue-500 text-white' : 'text-slate-400'
                }`}
              >
                Table
              </button>
            </div>

            <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors font-semibold text-sm">
              Import CSV
            </button>
            <button 
              onClick={exportCSV}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors font-semibold text-sm"
            >
              Export CSV
            </button>
            <button className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-400 text-black font-bold rounded-lg hover:shadow-md transition-all">
              Add Application
            </button>
          </div>
        </div>

        {/* Board View */}
        {view === 'board' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {columns.map(columnName => {
              const statusKey = Object.keys(statusMap).find(k => statusMap[k] === columnName) || '';
              const columnApps = applications.filter(app => app.status === statusKey);

              return (
                <div key={columnName} className="bg-white/5 border border-white/10 rounded-xl p-4 min-h-[400px]">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                    <h3 className="font-bold text-sm uppercase tracking-wide">{columnName}</h3>
                    <span className="px-2 py-1 bg-white/10 rounded-full text-xs font-semibold">{columnApps.length}</span>
                  </div>

                  <div className="space-y-3">
                    {columnApps.map(app => (
                      <div key={app.id} className="bg-white/[0.02] border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-all cursor-pointer">
                        <div className="flex items-start gap-2 mb-2">
                          <img 
                            src={app.company.logo} 
                            alt={app.company.name}
                            className="w-8 h-8 rounded-md bg-white p-1 object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/role_ferry_black.png'; }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate">{app.role}</div>
                            <div className="text-xs text-slate-400 truncate">{app.company.name}</div>
                          </div>
                        </div>
                        
                        <div className="text-xs text-slate-500 space-y-1">
                          <div>Applied: {new Date(app.appliedDate).toLocaleDateString()}</div>
                          {app.replyStatus && (
                            <div className="inline-block px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold">
                              ✓ Replied
                            </div>
                          )}
                          {app.interviews && app.interviews.length > 0 && (
                            <div>📅 {app.interviews.length} interview(s)</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Table View */}
        {view === 'table' && (
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-white/5 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">Applied</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">Last Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">Reply</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map(app => (
                  <tr key={app.id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="px-4 py-3">{app.company.name}</td>
                    <td className="px-4 py-3">{app.role}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        app.status === 'offer' ? 'bg-green-500/20 text-green-400' :
                        app.status === 'interviewing' ? 'bg-blue-500/20 text-blue-400' :
                        app.status === 'applied' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{new Date(app.appliedDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm">{new Date(app.lastContact).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      {app.replyStatus ? (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold">Replied</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button className="px-3 py-1 bg-white/5 border border-white/10 rounded hover:bg-white/10 transition-colors text-sm">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Insights Section */}
        <div className="mt-8">
          <button className="px-6 py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors font-semibold">
            Show Insights & Analytics
          </button>
        </div>
      </div>
    </div>
  );
}

