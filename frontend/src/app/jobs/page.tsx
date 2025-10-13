'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// Mock data - in production would come from API
const mockJobs = [
  {
    id: 1,
    title: "Senior Product Manager",
    company: { name: "Acme Corp", domain: "acme.com", logo: "https://logo.clearbit.com/acme.com", size: "201-500", industry: "SaaS" },
    location: "Remote (US)",
    salary: { min: 150000, max: 180000 },
    posted: "2 days ago",
    h1b: false,
    matchScore: 92,
    matchBreakdown: { experience: 95, skills: 90, industry: 91 },
    description: "Lead product strategy for our AI-powered analytics platform.",
    requirements: ["5+ years PM experience", "B2B SaaS background"],
    saved: false,
    applied: false
  },
  {
    id: 2,
    title: "Director of Product",
    company: { name: "GlobalTech", domain: "globaltech.io", logo: "https://logo.clearbit.com/globaltech.io", size: "1001-5000", industry: "Fintech" },
    location: "San Francisco, CA",
    salary: { min: 180000, max: 220000 },
    posted: "5 days ago",
    h1b: true,
    matchScore: 85,
    matchBreakdown: { experience: 88, skills: 82, industry: 85 },
    description: "Oversee product org (15 PMs). Set vision, execute strategy.",
    requirements: ["8+ years PM", "3+ years leadership"],
    saved: true,
    applied: false
  },
  {
    id: 3,
    title: "Product Manager - AI/ML",
    company: { name: "DataFlow", domain: "dataflow.ai", logo: "https://logo.clearbit.com/dataflow.ai", size: "51-200", industry: "SaaS" },
    location: "Remote (US)",
    salary: { min: 140000, max: 170000 },
    posted: "1 week ago",
    h1b: false,
    matchScore: 78,
    matchBreakdown: { experience: 80, skills: 75, industry: 80 },
    description: "Build ML-powered features for data pipelines.",
    requirements: ["4+ years PM", "Technical background"],
    saved: false,
    applied: true
  }
];

export default function JobsPage() {
  const [jobs, setJobs] = useState(mockJobs);
  const [filters, setFilters] = useState({
    roles: ['Product Manager', 'Senior PM'],
    locations: ['Remote'],
    minSalary: 150000,
    companySizes: ['51-200', '201-1000'],
    industries: ['SaaS', 'Fintech']
  });

  const handleApply = (jobId: number) => {
    setJobs(jobs.map(j => j.id === jobId ? { ...j, applied: true } : j));
    alert('Application started! Finding contacts...');
  };

  const getMatchClass = (score: number) => {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'strong';
    if (score >= 50) return 'fair';
    return 'low';
  };

  const getMatchLabel = (score: number) => {
    if (score >= 90) return 'Excellent Match';
    if (score >= 75) return 'Strong Match';
    if (score >= 50) return 'Fair Match';
    return 'Low Match';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-blue-950 text-white">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Jobs</h1>
            <p className="text-slate-400 mt-1">Showing {jobs.length} jobs matched to your profile</p>
          </div>
          <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
            Refine Preferences
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Filters Sidebar */}
          <aside className="lg:col-span-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 sticky top-20">
              <h2 className="font-bold text-sm uppercase tracking-wide text-slate-400 mb-4">Filters</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-sm mb-2">Role</h3>
                  <div className="space-y-2">
                    {['Product Manager', 'Senior PM', 'Director of Product'].map(role => (
                      <label key={role} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={filters.roles.includes(role)} className="rounded" />
                        <span>{role}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-sm mb-2">Location</h3>
                  <div className="space-y-2">
                    {['Remote', 'San Francisco', 'New York'].map(loc => (
                      <label key={loc} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={filters.locations.includes(loc)} className="rounded" />
                        <span>{loc}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-sm mb-2">Salary Range</h3>
                  <input 
                    type="range" 
                    min="80000" 
                    max="300000" 
                    step="10000" 
                    value={filters.minSalary}
                    className="w-full"
                  />
                  <div className="text-orange-400 font-bold mt-2">${(filters.minSalary / 1000).toFixed(0)}K+</div>
                </div>

                <div>
                  <h3 className="font-semibold text-sm mb-2">Company Size</h3>
                  <div className="space-y-2">
                    {['1-50', '51-200', '201-1000', '1000+'].map(size => (
                      <label key={size} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={filters.companySizes.includes(size)} className="rounded" />
                        <span>{size}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <button className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors text-sm">
                  Clear All Filters
                </button>
              </div>
            </div>
          </aside>

          {/* Jobs List */}
          <div className="lg:col-span-9">
            <div className="space-y-4">
              {jobs.map(job => (
                <div 
                  key={job.id} 
                  className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <img 
                      src={job.company.logo} 
                      alt={job.company.name}
                      className="w-12 h-12 rounded-lg bg-white p-1 object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/role_ferry_black.png'; }}
                    />
                    <div className="flex-1">
                      <h2 className="text-xl font-bold mb-1">{job.title}</h2>
                      <div className="text-slate-400 mb-2">{job.company.name}</div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                        <span>📍 {job.location}</span>
                        <span>💰 ${(job.salary.min/1000).toFixed(0)}K-${(job.salary.max/1000).toFixed(0)}K</span>
                        <span>🕒 {job.posted}</span>
                        {job.h1b && <span>🛂 H1B</span>}
                      </div>
                    </div>
                    <div className={`px-4 py-2 rounded-full font-bold text-sm ${
                      job.matchScore >= 90 ? 'bg-green-500/20 text-green-400' :
                      job.matchScore >= 75 ? 'bg-green-500/10 text-green-300' :
                      job.matchScore >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {job.matchScore}% {getMatchLabel(job.matchScore)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleApply(job.id); }}
                        className="px-6 py-2 bg-gradient-to-r from-orange-500 to-yellow-400 text-black font-bold rounded-lg hover:shadow-md hover:-translate-y-0.5 transition-all"
                      >
                        Apply
                      </button>
                      <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors font-semibold text-sm">
                        Find Insiders
                      </button>
                      <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors font-semibold text-sm">
                        Ask Copilot
                      </button>
                    </div>
                    {job.saved && <span className="text-yellow-400">★ Saved</span>}
                    {job.applied && <span className="text-green-400">✓ Applied</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

