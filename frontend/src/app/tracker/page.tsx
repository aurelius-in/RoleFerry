'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { DataMode, getCurrentDataMode, subscribeToDataModeChanges } from '@/lib/dataMode';
import StarRating from '@/components/StarRating';

type TrackerMode = 'jobseeker' | 'recruiter';
type TrackerApp = {
  id: string;
  company: { name: string; logo?: string };
  role: string;
  status: string;
  appliedDate: string;
  lastContact: string;
  replyStatus?: string | null;
  contacts?: string[];
  interviews?: { date: string; type: string }[];
  offer?: { amount?: number; equity?: string };
  source?: string;
};

const STORAGE_KEY = "tracker_applications";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

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
  const [mode, setMode] = useState<TrackerMode>('jobseeker');
  const [dataMode, setDataMode] = useState<DataMode>('demo');
  const [applications, setApplications] = useState<TrackerApp[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const initial = getCurrentDataMode();
    setDataMode(initial);
    const unsubscribe = subscribeToDataModeChanges(setDataMode);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (dataMode === 'demo') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed) && parsed.length) {
          setApplications(parsed);
          return;
        }
      } catch {}
      // Seed with demo data only if nothing is stored yet.
      const seeded = (mockApplications as any[]).map((a) => ({
        ...a,
        id: String(a.id),
        appliedDate: String(a.appliedDate || todayISO()),
        lastContact: String(a.lastContact || todayISO()),
      })) as TrackerApp[];
      setApplications(seeded);
    } else {
      // Live mode - for now we still use local storage as primary UI state
      // but in a real app we would fetch from /api/applications
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        setApplications(Array.isArray(parsed) ? parsed : []);
      } catch {}
    }
  }, [dataMode]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(applications));
    } catch {}
  }, [applications]);

  const columns = mode === 'jobseeker'
    ? ['Saved', 'Applied', 'Interviewing', 'Offer', 'Rejected']
    : ['Leads', 'Contacted', 'Appointments', 'Offers', 'Won/Lost'];

  const statusMap: Record<string, string> = mode === 'jobseeker'
    ? { saved: 'Saved', applied: 'Applied', interviewing: 'Interviewing', offer: 'Offer', rejected: 'Rejected' }
    : { saved: 'Leads', applied: 'Contacted', interviewing: 'Appointments', offer: 'Offers', rejected: 'Won/Lost' };

  const laneKeys = useMemo(() => Object.keys(statusMap), [statusMap]);

  const filteredApps = useMemo(() => {
    if (!searchQuery) return applications;
    const q = searchQuery.toLowerCase();
    return applications.filter(app => 
      app.company.name.toLowerCase().includes(q) || 
      app.role.toLowerCase().includes(q) ||
      app.contacts?.some(c => c.toLowerCase().includes(q))
    );
  }, [applications, searchQuery]);

  const addBlank = () => {
    const id = `trk_${Date.now()}`;
    setApplications((prev) => [
      {
        id,
        company: { name: "New Company" },
        role: "Role",
        status: laneKeys[0] || "saved",
        appliedDate: todayISO(),
        lastContact: todayISO(),
        replyStatus: null,
      },
      ...prev,
    ]);
  };

  const onDragStart = (e: React.DragEvent, appId: string) => {
    try {
      e.dataTransfer.setData("text/plain", appId);
    } catch {}
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent, statusKey: string) => {
    e.preventDefault();
    const appId = e.dataTransfer.getData("text/plain");
    if (!appId) return;
    setApplications((prev) =>
      prev.map((a) =>
        a.id === appId ? { ...a, status: statusKey, lastContact: a.lastContact || todayISO() } : a
      )
    );
  };

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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Tracker</h1>
            <p className="text-slate-400 mt-1">Manage your {mode === 'jobseeker' ? 'applications' : 'leads'}</p>
          </div>
          
          <div className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by company, role, or contact..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex bg-white/5 border border-white/10 rounded-lg p-1">
              <button
                onClick={() => setView('board')}
                className={`px-4 py-2 rounded-md font-semibold text-sm transition-all ${
                  view === 'board' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Board
              </button>
              <button
                onClick={() => setView('table')}
                className={`px-4 py-2 rounded-md font-semibold text-sm transition-all ${
                  view === 'table' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Table
              </button>
            </div>

            <button 
              onClick={exportCSV}
              className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
              title="Export CSV"
            >
              <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button onClick={addBlank} className="px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-400 text-black font-bold rounded-lg hover:shadow-lg transition-all shadow-orange-500/20">
              Add Item
            </button>
          </div>
        </div>

        {/* Board View */}
        {view === 'board' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {columns.map(columnName => {
              const statusKey = Object.keys(statusMap).find(k => statusMap[k] === columnName) || '';
              const columnApps = filteredApps.filter(app => app.status === statusKey);

              return (
                <div
                  key={columnName}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 min-h-[400px]"
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, statusKey)}
                >
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                    <h3 className="font-bold text-sm uppercase tracking-wide">{columnName}</h3>
                    <span className="px-2 py-1 bg-white/10 rounded-full text-xs font-semibold">{columnApps.length}</span>
                  </div>

                  <div className="space-y-3">
                    {columnApps.map(app => (
                      <div
                        key={app.id}
                        className="bg-white/[0.02] border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-all cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => onDragStart(e, app.id)}
                      >
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
                        
                        <div className="text-xs text-slate-500 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span>Applied: {new Date(app.appliedDate).toLocaleDateString()}</span>
                            {app.source && (
                              <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded border border-white/5 text-slate-400">
                                {app.source}
                              </span>
                            )}
                          </div>
                          
                          {app.contacts && app.contacts.length > 0 && (
                            <div className="flex items-center gap-1 text-blue-400 font-medium">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span>{app.contacts[0]}</span>
                            </div>
                          )}

                          {app.replyStatus && (
                            <div className="inline-block px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px] font-bold uppercase tracking-wider">
                              ✓ Replied
                            </div>
                          )}
                          
                          {app.interviews && app.interviews.length > 0 && (
                            <div className="flex items-center gap-1 text-orange-400">
                              <span>📅 {app.interviews.length} interview(s)</span>
                            </div>
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
                {filteredApps.map(app => (
                  <tr key={app.id} className="border-t border-white/10 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">{app.company.name}</td>
                    <td className="px-4 py-3">{app.role}</td>
                    <td className="px-4 py-3">
                      <select
                        value={app.status}
                        onChange={(e) =>
                          setApplications((prev) => prev.map((a) => (a.id === app.id ? { ...a, status: e.target.value } : a)))
                        }
                        className="bg-black/30 border border-white/15 rounded-md px-2 py-1 text-xs"
                      >
                        {Object.entries(statusMap).map(([k, lbl]) => (
                          <option key={k} value={k}>
                            {lbl}
                          </option>
                        ))}
                      </select>
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

