'use client';

import { useState } from 'react';

export default function AuthorPage() {
  const [emailDraft, setEmailDraft] = useState({
    subject: "Quick question about {{role}} at {{company}}",
    body: `Hi {{first_name}},

I came across the {{role}} role at {{company}} and wanted to reach out directly.

I have {{years_experience}} years of PM experience, most recently at TechCorp where I {{key_metric_1}}. I'm excited about {{company}}'s mission and think my background in {{industry}} would be a great fit.

Would love to chat for 15 minutes if you're open. Happy to send my resume.

Thanks for considering,
{{your_name}}`
  });

  const [resumeExtract] = useState({
    roles_experience: ["Senior Product Manager at TechCorp (2020-2024)", "Product Manager at StartupXYZ (2018-2020)"],
    tenure: ["4 years at TechCorp", "2 years at StartupXYZ"],
    key_metrics: ["Increased user engagement 45%", "Led team of 8 PMs", "Shipped 12 major features", "$5M ARR growth"],
    notable_accomplishments: ["Launched AI-powered recommendations", "Built 0-1 product (10K users)"],
    business_problems_solved: ["Reduced churn 30%", "Improved onboarding completion 2x"]
  });

  const generateDraft = () => {
    alert('Draft generated using AI! In production, this would call Anthropic Claude or GPT-4 to create a personalized email based on your resume and the job description.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-blue-950 text-white py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Author</h1>
          <p className="text-slate-400 mt-1">AI-powered email drafting from your resume</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Resume Extract */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4">Resume Extract</h2>
            
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold text-slate-400 mb-2">Experience</div>
                <div className="space-y-2">
                  {resumeExtract.roles_experience.map((role, idx) => (
                    <div key={idx} className="text-sm p-2 bg-white/[0.02] rounded">{role}</div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-400 mb-2">Key Metrics</div>
                <div className="space-y-2">
                  {resumeExtract.key_metrics.map((metric, idx) => (
                    <div key={idx} className="text-sm p-2 bg-green-500/10 border border-green-500/30 rounded">
                      ✓ {metric}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-400 mb-2">Accomplishments</div>
                <div className="space-y-2">
                  {resumeExtract.notable_accomplishments.map((acc, idx) => (
                    <div key={idx} className="text-sm p-2 bg-white/[0.02] rounded">• {acc}</div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold text-slate-400 mb-2">Business Problems Solved</div>
                <div className="space-y-2">
                  {resumeExtract.business_problems_solved.map((problem, idx) => (
                    <div key={idx} className="text-sm p-2 bg-blue-500/10 border border-blue-500/30 rounded">
                      💡 {problem}
                    </div>
                  ))}
                </div>
              </div>

              <button className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors font-semibold text-sm">
                Re-extract from Resume
              </button>
            </div>
          </div>

          {/* Email Draft */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4">Email Draft</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-400 mb-2">Subject Line</label>
              <input
                type="text"
                value={emailDraft.subject}
                onChange={(e) => setEmailDraft({ ...emailDraft, subject: e.target.value })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-400 mb-2">Body</label>
              <textarea
                value={emailDraft.body}
                onChange={(e) => setEmailDraft({ ...emailDraft, body: e.target.value })}
                rows={12}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-4">
              <div className="text-xs text-blue-300 mb-1">💡 Available Variables:</div>
              <div className="text-xs text-slate-400 flex flex-wrap gap-2">
                <code className="bg-white/5 px-2 py-1 rounded">{'{{first_name}}'}</code>
                <code className="bg-white/5 px-2 py-1 rounded">{'{{company}}'}</code>
                <code className="bg-white/5 px-2 py-1 rounded">{'{{role}}'}</code>
                <code className="bg-white/5 px-2 py-1 rounded">{'{{my_metric}}'}</code>
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={generateDraft}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-yellow-400 text-black font-bold rounded-lg hover:shadow-md transition-all"
              >
                🤖 Generate with AI
              </button>
              <button className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors font-semibold">
                Save Template
              </button>
            </div>
          </div>
        </div>

        {/* LLM Provider Selection */}
        <div className="mt-8 bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4">AI Provider</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/10 rounded-lg cursor-pointer hover:bg-white/5">
              <input type="radio" name="llm" defaultChecked />
              <div>
                <div className="font-semibold">Anthropic Claude Sonnet</div>
                <div className="text-xs text-slate-500">Best for long context</div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/10 rounded-lg cursor-pointer hover:bg-white/5">
              <input type="radio" name="llm" />
              <div>
                <div className="font-semibold">GPT-4</div>
                <div className="text-xs text-slate-500">Fallback option</div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/10 rounded-lg cursor-pointer hover:bg-white/5">
              <input type="radio" name="llm" />
              <div>
                <div className="font-semibold">GPT-3.5 Turbo</div>
                <div className="text-xs text-slate-500">Fastest, lower cost</div>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

