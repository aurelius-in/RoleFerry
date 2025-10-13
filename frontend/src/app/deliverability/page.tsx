'use client';

import { useState } from 'react';

const mockMailboxes = [
  { id: 1, domain: "rf-send-01.com", mailbox: "alex@rf-send-01.com", healthScore: 98, warmupStatus: "active", dailyCap: 50, sentToday: 12, lastBounce: null, lastSpamFlag: null },
  { id: 2, domain: "rf-send-02.com", mailbox: "outreach@rf-send-02.com", healthScore: 95, warmupStatus: "active", dailyCap: 50, sentToday: 23, lastBounce: null, lastSpamFlag: null },
  { id: 3, domain: "rf-send-03.com", mailbox: "hello@rf-send-03.com", healthScore: 92, warmupStatus: "active", dailyCap: 50, sentToday: 35, lastBounce: "2025-01-12", lastSpamFlag: null },
  { id: 4, domain: "rf-send-04.com", mailbox: "team@rf-send-04.com", healthScore: 88, warmupStatus: "warmup", dailyCap: 30, sentToday: 8, lastBounce: null, lastSpamFlag: null },
  { id: 5, domain: "rf-send-05.com", mailbox: "info@rf-send-05.com", healthScore: 75, warmupStatus: "paused", dailyCap: 20, sentToday: 0, lastBounce: "2025-01-13", lastSpamFlag: "2025-01-13" }
];

export default function DeliverabilityPage() {
  const [mailboxes] = useState(mockMailboxes);
  const [domainRotation, setDomainRotation] = useState(true);
  const [autoWarmup, setAutoWarmup] = useState(true);
  const [disableOpenTracking, setDisableOpenTracking] = useState(true);

  const avgHealthScore = (mailboxes.reduce((sum, mb) => sum + mb.healthScore, 0) / mailboxes.length).toFixed(1);
  const activeDomains = mailboxes.filter(mb => mb.warmupStatus === 'active').length;
  const totalSentToday = mailboxes.reduce((sum, mb) => sum + mb.sentToday, 0);
  const totalCap = mailboxes.reduce((sum, mb) => sum + mb.dailyCap, 0);
  const spamRate = (1 / totalSentToday * 100 || 0).toFixed(2);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-blue-950 text-white py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Deliverability</h1>
          <p className="text-slate-400 mt-1">Manage email accounts and domain health</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Avg Health Score</div>
            <div className={`text-4xl font-bold ${parseFloat(avgHealthScore) >= 90 ? 'text-green-400' : parseFloat(avgHealthScore) >= 75 ? 'text-yellow-400' : 'text-red-400'}`}>
              {avgHealthScore}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Active Domains</div>
            <div className="text-4xl font-bold">{activeDomains}</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Emails Sent Today</div>
            <div className="text-4xl font-bold">{totalSentToday} / {totalCap}</div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wide mb-1">Spam Rate</div>
            <div className="text-4xl font-bold text-green-400">{spamRate}%</div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
          <h2 className="text-lg font-bold mb-4">Deliverability Settings</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={domainRotation} 
                  onChange={(e) => setDomainRotation(e.target.checked)}
                  className="w-5 h-5"
                />
                <div>
                  <div className="font-semibold">Enable domain rotation</div>
                  <div className="text-xs text-slate-500">Distribute sends across all domains</div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={autoWarmup} 
                  onChange={(e) => setAutoWarmup(e.target.checked)}
                  className="w-5 h-5"
                />
                <div>
                  <div className="font-semibold">Auto-warmup new domains</div>
                  <div className="text-xs text-slate-500">Gradually increase send volume</div>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={disableOpenTracking} 
                  onChange={(e) => setDisableOpenTracking(e.target.checked)}
                  className="w-5 h-5"
                />
                <div>
                  <div className="font-semibold">Disable open tracking (recommended)</div>
                  <div className="text-xs text-slate-500">Avoid "images hidden" warnings</div>
                </div>
              </label>
            </div>

            <div>
              <button className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors font-semibold mb-3">
                Configure Custom Tracking Domain
              </button>
              <div className="text-xs text-slate-500">
                💡 Custom tracking domains (CTD) rewrite links to keep emails spam-safe while tracking clicks.
              </div>
            </div>
          </div>
        </div>

        {/* Mailboxes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mailboxes.map(mb => (
            <div key={mb.id} className="bg-white/5 border border-white/10 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="font-bold text-sm truncate flex-1">{mb.mailbox}</div>
                <div className={`text-3xl font-bold ${
                  mb.healthScore >= 90 ? 'text-green-400' :
                  mb.healthScore >= 75 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {mb.healthScore}
                </div>
              </div>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Domain:</span>
                  <span className="font-mono text-xs">{mb.domain}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status:</span>
                  <span className={`font-semibold ${
                    mb.warmupStatus === 'active' ? 'text-green-400' :
                    mb.warmupStatus === 'warmup' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {mb.warmupStatus}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Sent Today:</span>
                  <span className="font-semibold">{mb.sentToday} / {mb.dailyCap}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-4">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400"
                  style={{ width: `${(mb.sentToday / mb.dailyCap) * 100}%` }}
                />
              </div>

              {/* Warnings */}
              {mb.lastBounce && (
                <div className="text-xs text-red-400 mb-2">⚠️ Last bounce: {mb.lastBounce}</div>
              )}
              {mb.lastSpamFlag && (
                <div className="text-xs text-red-400 mb-2">⚠️ Spam flag: {mb.lastSpamFlag}</div>
              )}

              <div className="flex gap-2 mt-4">
                <button className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors font-semibold text-sm">
                  Details
                </button>
                {mb.warmupStatus === 'paused' && (
                  <button className="flex-1 px-3 py-2 bg-green-500/20 border border-green-500/40 text-green-300 rounded-lg hover:bg-green-500/30 transition-colors font-semibold text-sm">
                    Resume
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Best Practices */}
        <div className="mt-8 bg-orange-500/10 border border-orange-500/30 rounded-xl p-6">
          <h3 className="text-lg font-bold mb-4 text-orange-300">📚 Deliverability Best Practices</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-semibold mb-2">✓ Do This:</div>
              <ul className="space-y-1 text-slate-300">
                <li>• Warm up domains gradually (1-2 months)</li>
                <li>• Rotate across multiple domains</li>
                <li>• Use custom tracking domains for links</li>
                <li>• Disable open tracking pixels</li>
                <li>• Monitor bounce/spam rates daily</li>
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-2">✗ Avoid This:</div>
              <ul className="space-y-1 text-slate-300">
                <li>• Sending from cold domains</li>
                <li>• Using image tracking pixels</li>
                <li>• Exceeding daily send limits</li>
                <li>• Ignoring bounce warnings</li>
                <li>• Batch sending (spread throughout day)</li>
      </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
