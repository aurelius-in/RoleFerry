'use client';

import { useState } from 'react';
import { formatCompanyName } from "@/lib/format";

const mockLivePages = [
  {
    id: 1,
    contactName: "Sarah",
    companyName: "DataFlow",
    role: "Senior Product Manager",
    views: 2,
    ctaClicks: 1,
    scrollDepth: 85,
    createdAt: "2025-01-10T14:30:00Z",
    calendarLink: "https://calendly.com/alex-johnson/15min",
    metrics: ["Increased engagement 45%", "Led team of 8", "$5M ARR growth"]
  },
  {
    id: 2,
    contactName: "Michael",
    companyName: "GlobalTech",
    role: "Director of Product",
    views: 5,
    ctaClicks: 2,
    scrollDepth: 100,
    createdAt: "2025-01-08T10:00:00Z",
    calendarLink: "https://calendly.com/alex-johnson/15min",
    metrics: ["Shipped 12 major features", "Reduced churn 30%", "Built 0-1 product"]
  },
  {
    id: 3,
    contactName: "Emma",
    companyName: "Acme Corp",
    role: "Senior PM",
    views: 8,
    ctaClicks: 3,
    scrollDepth: 92,
    createdAt: "2025-01-05T09:00:00Z",
    calendarLink: "https://calendly.com/alex-johnson/15min",
    metrics: ["10+ years PM experience", "Y Combinator alum", "Led $50M product"]
  }
];

export default function LivePagesPage() {
  const [pages] = useState(mockLivePages);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-blue-950 text-white py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">LivePages</h1>
            <p className="text-slate-400 mt-1">Personalized landing pages for your outreach</p>
          </div>
          <button className="px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-400 text-black font-bold rounded-lg hover:shadow-md transition-all">
            Create LivePage
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pages.map(page => (
            <div key={page.id} className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
              <div className="mb-4">
                <h3 className="text-lg font-bold mb-1">{page.role}</h3>
                <div className="text-sm text-slate-400">{formatCompanyName(page.companyName)}</div>
                <div className="text-sm text-slate-500 mt-1">For: {page.contactName}</div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-white/[0.02] border border-white/10 rounded-lg">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Views</div>
                  <div className="text-2xl font-bold">{page.views}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Clicks</div>
                  <div className="text-2xl font-bold">{page.ctaClicks}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Scroll</div>
                  <div className="text-2xl font-bold">{page.scrollDepth}%</div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="text-xs text-slate-400">Key Metrics:</div>
                {page.metrics.map((metric, idx) => (
                  <div key={idx} className="text-xs text-slate-300">• {metric}</div>
                ))}
              </div>

              <div className="text-xs text-slate-500 mb-4">
                Created: {new Date(page.createdAt).toLocaleDateString()}
              </div>

              <div className="flex gap-2">
                <button className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors font-semibold text-sm">
                  View Page
                </button>
                <button className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors font-semibold text-sm">
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

