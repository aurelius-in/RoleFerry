'use client';

import { useState } from 'react';

type WizardStep = 'values' | 'role' | 'location' | 'level' | 'salary' | 'review';

export default function IJPPage() {
  const [currentStep, setCurrentStep] = useState<WizardStep>('values');
  const [preferences, setPreferences] = useState({
    values: [] as string[],
    roleTypes: [] as string[],
    locations: [] as string[],
    roleLevel: '',
    companySize: [] as string[],
    industries: [] as string[],
    skills: [] as string[],
    minSalary: 0,
    jobSearchStatus: ''
  });

  const steps: WizardStep[] = ['values', 'role', 'location', 'level', 'salary', 'review'];
  const currentStepIndex = steps.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const valueOptions = [
    '🚀 Innovation', '📈 Growth', '💡 Impact', '🎯 Mission-Driven', '🌍 Diversity', 
    '⚖️ Work-Life Balance', '🏆 Autonomy', '🤝 Collaboration', '💼 Compensation', '📚 Learning'
  ];

  const roleOptions = [
    'Product Manager', 'Senior Product Manager', 'Director of Product', 'VP Product',
    'Engineering Manager', 'Software Engineer', 'Data Scientist', 'Designer'
  ];

  const locationOptions = [
    '🌐 Remote (Anywhere)', '🇺🇸 Remote (US)', 'San Francisco, CA', 'New York, NY',
    'Austin, TX', 'Seattle, WA', 'Boston, MA', 'Los Angeles, CA'
  ];

  const levelOptions = ['Entry Level', 'Mid-Level', 'Senior', 'Lead', 'Manager', 'Director', 'VP', 'C-Level'];

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    } else {
      alert('Preferences saved!');
    }
  };

  const handlePrev = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
  };

  const toggleSelection = (field: keyof typeof preferences, value: string, multi = true) => {
    if (multi) {
      const current = preferences[field] as string[];
      setPreferences({
        ...preferences,
        [field]: current.includes(value)
          ? current.filter(v => v !== value)
          : [...current, value]
      });
    } else {
      setPreferences({ ...preferences, [field]: value });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-blue-950 text-white py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Job Preferences</h1>
          <p className="text-slate-400">Help us find the perfect jobs for you</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {steps.map((step, idx) => (
              <div key={step} className={`text-xs font-semibold uppercase tracking-wide ${idx <= currentStepIndex ? 'text-orange-400' : 'text-slate-600'}`}>
                {step}
              </div>
            ))}
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-orange-500 to-yellow-400 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Wizard Content */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 mb-6">
          {/* Values Step */}
          {currentStep === 'values' && (
            <div>
              <h2 className="text-2xl font-bold mb-2">What matters most to you?</h2>
              <p className="text-slate-400 mb-6">Pick up to 3 values</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {valueOptions.map(value => (
                  <button
                    key={value}
                    onClick={() => {
                      if (preferences.values.includes(value)) {
                        toggleSelection('values', value);
                      } else if (preferences.values.length < 3) {
                        toggleSelection('values', value);
                      }
                    }}
                    className={`p-4 rounded-lg border-2 font-semibold text-sm transition-all ${
                      preferences.values.includes(value)
                        ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className="text-sm text-slate-500 mt-4">
                Selected: {preferences.values.length} / 3
              </div>
            </div>
          )}

          {/* Role Type Step */}
          {currentStep === 'role' && (
            <div>
              <h2 className="text-2xl font-bold mb-2">What roles are you looking for?</h2>
              <p className="text-slate-400 mb-6">Select all that apply</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {roleOptions.map(role => (
                  <button
                    key={role}
                    onClick={() => toggleSelection('roleTypes', role)}
                    className={`p-4 rounded-lg border-2 font-semibold text-left transition-all ${
                      preferences.roleTypes.includes(role)
                        ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Location Step */}
          {currentStep === 'location' && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Where do you want to work?</h2>
              <p className="text-slate-400 mb-6">Select preferred locations</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {locationOptions.map(location => (
                  <button
                    key={location}
                    onClick={() => toggleSelection('locations', location)}
                    className={`p-4 rounded-lg border-2 font-semibold text-left transition-all ${
                      preferences.locations.includes(location)
                        ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {location}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Level Step */}
          {currentStep === 'level' && (
            <div>
              <h2 className="text-2xl font-bold mb-2">What's your experience level?</h2>
              <p className="text-slate-400 mb-6">Select one</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {levelOptions.map(level => (
                  <button
                    key={level}
                    onClick={() => setPreferences({ ...preferences, roleLevel: level })}
                    className={`p-4 rounded-lg border-2 font-semibold transition-all ${
                      preferences.roleLevel === level
                        ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Salary Step */}
          {currentStep === 'salary' && (
            <div>
              <h2 className="text-2xl font-bold mb-2">What's your minimum salary?</h2>
              <p className="text-slate-400 mb-6">We'll only show jobs above this threshold</p>
              <div className="max-w-md mx-auto">
                <input
                  type="range"
                  min="50000"
                  max="300000"
                  step="10000"
                  value={preferences.minSalary}
                  onChange={(e) => setPreferences({ ...preferences, minSalary: parseInt(e.target.value) })}
                  className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
                <div className="text-center mt-6">
                  <div className="text-5xl font-bold text-orange-400">
                    ${(preferences.minSalary / 1000).toFixed(0)}K
                  </div>
                  <div className="text-sm text-slate-500 mt-2">per year</div>
                </div>
              </div>
            </div>
          )}

          {/* Review Step */}
          {currentStep === 'review' && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Review Your Preferences</h2>
              <p className="text-slate-400 mb-6">Make sure everything looks good</p>
              
              <div className="space-y-4">
                <div className="p-4 bg-white/[0.02] border border-white/10 rounded-lg">
                  <div className="text-xs text-slate-500 mb-2 font-semibold uppercase">Values</div>
                  <div className="flex flex-wrap gap-2">
                    {preferences.values.map(v => (
                      <span key={v} className="px-3 py-1 bg-orange-500/20 border border-orange-500/40 rounded-md text-sm">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-white/[0.02] border border-white/10 rounded-lg">
                  <div className="text-xs text-slate-500 mb-2 font-semibold uppercase">Roles</div>
                  <div className="flex flex-wrap gap-2">
                    {preferences.roleTypes.map(r => (
                      <span key={r} className="px-3 py-1 bg-blue-500/20 border border-blue-500/40 rounded-md text-sm">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-white/[0.02] border border-white/10 rounded-lg">
                  <div className="text-xs text-slate-500 mb-2 font-semibold uppercase">Locations</div>
                  <div className="flex flex-wrap gap-2">
                    {preferences.locations.map(l => (
                      <span key={l} className="px-3 py-1 bg-green-500/20 border border-green-500/40 rounded-md text-sm">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>

                {preferences.roleLevel && (
                  <div className="p-4 bg-white/[0.02] border border-white/10 rounded-lg">
                    <div className="text-xs text-slate-500 mb-2 font-semibold uppercase">Experience Level</div>
                    <div className="font-semibold">{preferences.roleLevel}</div>
                  </div>
                )}

                {preferences.minSalary > 0 && (
                  <div className="p-4 bg-white/[0.02] border border-white/10 rounded-lg">
                    <div className="text-xs text-slate-500 mb-2 font-semibold uppercase">Minimum Salary</div>
                    <div className="font-semibold text-orange-400">${(preferences.minSalary / 1000).toFixed(0)}K / year</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className="px-6 py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <button
            onClick={handleNext}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-400 text-black font-bold rounded-lg hover:shadow-md transition-all"
          >
            {currentStepIndex === steps.length - 1 ? 'Save Preferences' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

