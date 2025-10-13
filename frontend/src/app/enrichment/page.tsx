'use client';

import { useState } from 'react';

const mockEnrichments = [
  {
    id: 1,
    domain: 'dataflow.ai',
    company: 'DataFlow',
    status: 'completed',
    techStack: ['React', 'Python', 'AWS', 'PostgreSQL', 'Kubernetes'],
    signals: ['Hiring aggressively', 'Recent Series B', 'Y Combinator alum'],
    contacts: [
      { name: 'Sarah Chen', title: 'VP Product', email: 'sarah@dataflow.ai', verified: true },
      { name: 'Tom Wilson', title: 'Recruiter', email: 'tom@dataflow.ai', verified: true }
    ],
    freshness: '2d ago',
    cost: 0.08
  },
  {
    id: 2,
    domain: 'globaltech.io',
    company: 'GlobalTech',
    status: 'completed',
    techStack: ['Node.js', 'React', 'GCP', 'MongoDB', 'Docker'],
    signals: ['IPO rumors', 'Expanding to EMEA', 'Fortune 500 clients'],
    contacts: [
      { name: 'Michael Torres', title: 'Head of Product', email: 'michael@globaltech.io', verified: true },
      { name: 'Lisa Park', title: 'Head of Talent', email: 'lisa@globaltech.io', verified: true }
    ],
    freshness: '1d ago',
    cost: 0.09
  },
  {
    id: 3,
    domain: 'acme.com',
    company: 'Acme Corp',
    status: 'in_progress',
    techStack: ['Vue.js', 'Ruby on Rails', 'AWS'],
    signals: ['Building ML team', 'Enterprise focus'],
    contacts: [
      { name: 'Emma Rodriguez', title: 'Director of Product', email: 'emma@acme.com', verified: true }
    ],
    freshness: 'Running...',
    cost: null
  }
];

export default function EnrichmentPage() {
  const [enrichments] = useState(mockEnrichments);
  const [selectedEnrichment, setSelectedEnrichment] = useState<typeof mockEnrichments[0] | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-blue-950 text-white py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Enrichment</h1>
            <p className="text-slate-400 mt-1">Contact discovery waterfall</p>
          </div>
          <button className="px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-400 text-black font-bold rounded-lg hover:shadow-md transition-all">
            Run Enrichment
          </button>
        </div>

        {/* Enrichment Pipeline Visualization */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 mb-8">
          <h2 className="text-lg font-bold mb-6">Enrichment Pipeline</h2>
          <div className="flex items-center justify-center gap-4">
            <div className="flex-1 bg-white/[0.02] border border-white/10 rounded-lg p-4">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-xl font-bold mb-3 mx-auto">
                1
              </div>
              <div className="font-semibold text-center mb-1">Find Company Domain</div>
              <div className="text-xs text-slate-500 text-center">Clearbit + Google</div>
            </div>

            <div className="text-3xl text-orange-400">→</div>

            <div className="flex-1 bg-white/[0.02] border border-white/10 rounded-lg p-4">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-xl font-bold mb-3 mx-auto">
                2
              </div>
              <div className="font-semibold text-center mb-1">Find People at Company</div>
              <div className="text-xs text-slate-500 text-center">Apollo + Clay</div>
            </div>

            <div className="text-3xl text-orange-400">→</div>

            <div className="flex-1 bg-white/[0.02] border border-white/10 rounded-lg p-4">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-xl font-bold mb-3 mx-auto">
                3
              </div>
              <div className="font-semibold text-center mb-1">Verify Work Email</div>
              <div className="text-xs text-slate-500 text-center">NeverBounce + Findymail</div>
            </div>
          </div>
        </div>

        {/* Enrichment Results */}
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">Domain</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">Company</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">Tech Stack</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">Signals</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">Contacts</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-400">Cost</th>
              </tr>
            </thead>
            <tbody>
              {enrichments.map(enr => (
                <tr 
                  key={enr.id} 
                  className="border-t border-white/10 hover:bg-white/5 cursor-pointer"
                  onClick={() => setSelectedEnrichment(enr)}
                >
                  <td className="px-4 py-3">
                    <div className="font-mono text-sm">{enr.domain}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{enr.company}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {enr.techStack.slice(0, 3).map((tech, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-500/20 border border-blue-500/40 rounded text-xs">
                          {tech}
                        </span>
                      ))}
                      {enr.techStack.length > 3 && (
                        <span className="px-2 py-1 bg-slate-500/20 text-xs">+{enr.techStack.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-slate-400">{enr.signals.length} signals</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">
                      {enr.contacts.length} / {enr.contacts.filter(c => c.verified).length}
                    </div>
                    <div className="text-xs text-slate-500">found / verified</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      enr.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      enr.status === 'in_progress' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>
                      {enr.status === 'in_progress' ? 'Running...' : 'Completed'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {enr.cost !== null ? (
                      <div className="font-mono text-sm">${enr.cost.toFixed(2)}</div>
                    ) : (
                      <div className="text-slate-500">—</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Detail Modal */}
        {selectedEnrichment && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-white/10 rounded-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">{selectedEnrichment.company}</h2>
                <button 
                  onClick={() => setSelectedEnrichment(null)}
                  className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-md hover:bg-white/10"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-sm font-semibold text-slate-400 mb-2">Domain</div>
                  <div className="font-mono">{selectedEnrichment.domain}</div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-400 mb-2">Tech Stack</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedEnrichment.techStack.map((tech, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-500/20 border border-blue-500/40 rounded-md text-sm">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-400 mb-2">Signals</div>
                  <ul className="space-y-1">
                    {selectedEnrichment.signals.map((signal, idx) => (
                      <li key={idx} className="text-sm">• {signal}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="text-sm font-semibold text-slate-400 mb-3">Contacts Found ({selectedEnrichment.contacts.length})</div>
                  <div className="space-y-3">
                    {selectedEnrichment.contacts.map((contact, idx) => (
                      <div key={idx} className="p-4 bg-white/[0.02] border border-white/10 rounded-lg">
                        <div className="flex items-center gap-3 mb-2">
                          <img 
                            src={`https://i.pravatar.cc/48?u=${contact.email}`} 
                            alt={contact.name}
                            className="w-12 h-12 rounded-full"
                          />
                          <div>
                            <div className="font-semibold">{contact.name}</div>
                            <div className="text-sm text-slate-400">{contact.title}</div>
                          </div>
                        </div>
                        <div className="text-sm text-slate-400">
                          {contact.verified ? '✅' : '❌'} {contact.email}
                          {contact.verified && <span className="ml-2 text-green-400">(verified)</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedEnrichment.cost !== null && (
                  <div>
                    <div className="text-sm font-semibold text-slate-400 mb-1">Enrichment Cost</div>
                    <div className="font-mono text-lg">${selectedEnrichment.cost.toFixed(2)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

