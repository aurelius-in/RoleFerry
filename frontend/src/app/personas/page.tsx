'use client';

import { useState } from 'react';

// Mock personas
const mockPersonas = [
  {
    id: 1,
    name: "Senior PM - B2B SaaS",
    titles: ["Senior Product Manager", "Product Manager", "Associate Product Manager"],
    departments: ["Product", "Product Management"],
    managementLevel: ["IC", "Manager"],
    locations: ["United States", "Remote"],
    employeeCount: ["51-200", "201-500", "501-1000"],
    industries: ["SaaS", "Software Development"],
    createdAt: "2025-01-01"
  },
  {
    id: 2,
    name: "VP/Head of Product",
    titles: ["VP Product", "Head of Product", "Director of Product"],
    departments: ["Product", "Executive"],
    managementLevel: ["VP", "Head", "Director"],
    locations: ["United States"],
    employeeCount: ["201-500", "501-1000", "1001-5000"],
    industries: ["SaaS", "Fintech", "HealthTech"],
    createdAt: "2025-01-01"
  }
];

export default function PersonasPage() {
  const [personas] = useState(mockPersonas);
  const [showCreateModal, setShowCreateModal] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-blue-950 text-white py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Personas</h1>
            <p className="text-slate-400 mt-1">Define target contact profiles</p>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-400 text-black font-bold rounded-lg hover:shadow-md transition-all"
          >
            Create Persona
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {personas.map(persona => (
            <div key={persona.id} className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">{persona.name}</h3>
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-semibold">
                  Active
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-xs text-slate-500 mb-2 font-semibold uppercase">Job Titles ({persona.titles.length})</div>
                  <div className="flex flex-wrap gap-2">
                    {persona.titles.map((title, idx) => (
                      <span key={idx} className="px-3 py-1 bg-blue-500/20 border border-blue-500/40 rounded-md text-xs">
                        {title}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 mb-2 font-semibold uppercase">Management Level</div>
                  <div className="flex flex-wrap gap-2">
                    {persona.managementLevel.map((level, idx) => (
                      <span key={idx} className="px-3 py-1 bg-purple-500/20 border border-purple-500/40 rounded-md text-xs">
                        {level}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 mb-2 font-semibold uppercase">Industries</div>
                  <div className="flex flex-wrap gap-2">
                    {persona.industries.map((industry, idx) => (
                      <span key={idx} className="px-3 py-1 bg-orange-500/20 border border-orange-500/40 rounded-md text-xs">
                        {industry}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 mb-2 font-semibold uppercase">Company Size</div>
                  <div className="flex flex-wrap gap-2">
                    {persona.employeeCount.map((size, idx) => (
                      <span key={idx} className="px-3 py-1 bg-green-500/20 border border-green-500/40 rounded-md text-xs">
                        {size} employees
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 mb-2 font-semibold uppercase">Locations</div>
                  <div className="flex flex-wrap gap-2">
                    {persona.locations.map((loc, idx) => (
                      <span key={idx} className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/40 rounded-md text-xs">
                        {loc}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex gap-2">
                <button className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors font-semibold text-sm">
                  Edit
                </button>
                <button className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors font-semibold text-sm">
                  Duplicate
                </button>
                <button className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/40 rounded-lg hover:bg-red-500/30 transition-colors font-semibold text-sm">
                  Delete
                </button>
              </div>

              <div className="text-xs text-slate-500 mt-4">
                Created: {new Date(persona.createdAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>

        {/* Create Modal (simplified) */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-white/10 rounded-xl max-w-2xl w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Create Persona</h2>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-md hover:bg-white/10"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Persona Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g., Senior PM - B2B SaaS"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Job Titles (comma-separated)</label>
                  <input 
                    type="text" 
                    placeholder="Product Manager, Senior PM, Director of Product"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors font-semibold"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => { setShowCreateModal(false); alert('Persona created!'); }}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-400 text-black font-bold rounded-lg hover:shadow-md transition-all"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

