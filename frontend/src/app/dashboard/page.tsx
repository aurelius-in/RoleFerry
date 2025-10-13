'use client';

import Link from 'next/link';

export default function DashboardPage() {
  const stats = {
    applications: 23,
    replyRate: 17,
    interviews: 4,
    offers: 1
  };

  const recentActivity = [
    { icon: '📧', text: 'Reply received from Michael Torres at GlobalTech', time: '2 hours ago' },
    { icon: '✅', text: 'Applied to Senior PM at DataFlow', time: '1 day ago' },
    { icon: '🎉', text: 'Offer received from Acme Corp - Director of Product', time: '3 days ago' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-blue-950 text-white py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-slate-400 mt-1">Your job search at a glance</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Applications</div>
            <div className="text-4xl font-bold mb-1">{stats.applications}</div>
            <div className="text-xs text-green-400 font-semibold">+5 this week</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Reply Rate</div>
            <div className="text-4xl font-bold mb-1">{stats.replyRate}%</div>
            <div className="text-xs text-green-400 font-semibold">+2% vs avg</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Interviews</div>
            <div className="text-4xl font-bold mb-1">{stats.interviews}</div>
            <div className="text-xs text-green-400 font-semibold">2 this week</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Offers</div>
            <div className="text-4xl font-bold mb-1">{stats.offers}</div>
            <div className="text-xs text-slate-500">Pending decision</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link href="/jobs" className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 hover:shadow-lg hover:-translate-y-1 transition-all">
            <div className="text-4xl mb-2">🎯</div>
            <div className="font-semibold">Apply to Jobs</div>
          </Link>

          <Link href="/tracker" className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 hover:shadow-lg hover:-translate-y-1 transition-all">
            <div className="text-4xl mb-2">📊</div>
            <div className="font-semibold">View Tracker</div>
          </Link>

          <Link href="/sequence" className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 hover:shadow-lg hover:-translate-y-1 transition-all">
            <div className="text-4xl mb-2">✉️</div>
            <div className="font-semibold">Create Sequence</div>
          </Link>

          <Link href="/settings" className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 hover:shadow-lg hover:-translate-y-1 transition-all">
            <div className="text-4xl mb-2">⚙️</div>
            <div className="font-semibold">Update Preferences</div>
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-6">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.map((activity, idx) => (
              <div key={idx} className="flex items-start gap-4 p-4 bg-white/[0.02] rounded-lg">
                <div className="text-2xl">{activity.icon}</div>
                <div className="flex-1">
                  <div className="font-medium mb-1" dangerouslySetInnerHTML={{ __html: activity.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                  <div className="text-xs text-slate-500">{activity.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

