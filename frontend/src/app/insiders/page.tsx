'use client';

import { useState } from 'react';

const mockContacts = [
  { 
    id: 1, 
    name: "Sarah Chen", 
    title: "VP Product", 
    email: "sarah@dataflow.ai", 
    verified: true, 
    linkedin: "https://linkedin.com/in/sarachen",
    source: "Apollo"
  },
  { 
    id: 2, 
    name: "Tom Wilson", 
    title: "Senior Recruiter", 
    email: "tom@dataflow.ai", 
    verified: true, 
    linkedin: "https://linkedin.com/in/tomwilson",
    source: "Clay"
  },
  { 
    id: 3, 
    name: "Michael Torres", 
    title: "Head of Product", 
    email: "michael@globaltech.io", 
    verified: true, 
    linkedin: "https://linkedin.com/in/michaelt",
    source: "Apollo"
  }
];

export default function InsidersPage() {
  const [contacts] = useState(mockContacts);
  const [selectedContact, setSelectedContact] = useState<typeof mockContacts[0] | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);

  const openEmailModal = (contact: typeof mockContacts[0]) => {
    setSelectedContact(contact);
    setShowEmailModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-blue-950 text-white py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Insider Connections</h1>
            <p className="text-slate-400 mt-1">Find and contact decision-makers</p>
          </div>
          <button className="px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-400 text-black font-bold rounded-lg hover:shadow-md transition-all">
            Find New Contacts
          </button>
        </div>

        {/* Disclaimer */}
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">ℹ️</span>
            <div>
              <div className="font-semibold mb-1">About Insider Connections</div>
              <div className="text-sm text-slate-300">
                Contacts obtained from publicly available sources (LinkedIn, company websites). 
                Accuracy not guaranteed. Email verification performed via NeverBounce + Findymail.
              </div>
            </div>
          </div>
        </div>

        {/* Contacts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {contacts.map(contact => (
            <div key={contact.id} className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-all">
              <div className="flex items-center gap-4 mb-4">
                <img 
                  src={`https://i.pravatar.cc/80?u=${contact.email}`} 
                  alt={contact.name}
                  className="w-16 h-16 rounded-full border-2 border-white/20"
                />
                <div className="flex-1">
                  <div className="font-bold text-lg">{contact.name}</div>
                  <div className="text-sm text-slate-400">{contact.title}</div>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  {contact.verified ? '✅' : '❌'}
                  <span className="font-mono text-xs">{contact.email}</span>
                  {contact.verified && <span className="text-green-400 text-xs">(verified)</span>}
                </div>
                <a 
                  href={contact.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-400 hover:underline"
                >
                  🔗 LinkedIn Profile
                </a>
                <div className="text-xs text-slate-500">Source: {contact.source}</div>
              </div>

              <button 
                onClick={() => openEmailModal(contact)}
                className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-yellow-400 text-black font-bold rounded-lg hover:shadow-md transition-all"
              >
                Contact {contact.name.split(' ')[0]}
              </button>
            </div>
          ))}
        </div>

        {/* Email Modal */}
        {showEmailModal && selectedContact && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-white/10 rounded-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Connect via Email</h2>
                <button 
                  onClick={() => setShowEmailModal(false)}
                  className="w-8 h-8 flex items-center justify-center bg-white/5 rounded-md hover:bg-white/10"
                >
                  ✕
                </button>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 mb-6">
                <div className="text-xs text-blue-300">
                  ℹ️ This contact was obtained from publicly available sources. Accuracy not guaranteed.
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold mb-2">To</label>
                  <input 
                    type="text" 
                    value={`${selectedContact.name} <${selectedContact.email}>`}
                    readOnly
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Subject</label>
                  <input 
                    type="text" 
                    defaultValue="Quick question about Senior PM role"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Message</label>
                  <textarea 
                    rows={8}
                    defaultValue={`Hi ${selectedContact.name.split(' ')[0]},

I came across the Senior PM role at your company and wanted to reach out directly.

I have 6 years of PM experience, most recently at TechCorp where I increased engagement 45% and led a team of 8. I'm excited about your company's mission.

Would love to chat for 15 minutes if you're open. Happy to send my resume.

Thanks for considering,
Alex`}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input type="checkbox" id="attachResume" defaultChecked />
                  <label htmlFor="attachResume" className="text-sm">Attach resume</label>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => setShowEmailModal(false)}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button className="px-4 py-3 bg-blue-500/20 border border-blue-500/40 text-blue-300 rounded-lg hover:bg-blue-500/30 transition-colors font-semibold">
                  Use Author to Rewrite
                </button>
                <button 
                  onClick={() => {
                    alert('Email sent via RoleFerry!');
                    setShowEmailModal(false);
                  }}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-yellow-400 text-black font-bold rounded-lg hover:shadow-md transition-all"
                >
                  Send via RoleFerry
                </button>
              </div>

              <div className="mt-4 text-xs text-slate-500 text-center">
                Email will be sent from RoleFerry's warmed domain (alex@rf-send-01.com)
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

