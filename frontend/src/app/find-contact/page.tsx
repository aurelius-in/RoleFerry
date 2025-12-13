"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Contact {
  id: string;
  name: string;
  title: string;
  email: string;
  linkedin_url?: string;
  confidence: number;
  verification_status: 'valid' | 'risky' | 'invalid' | 'unknown';
  verification_score?: number;
  company: string;
  department: string;
  level: string;
}

interface VerificationBadge {
  label: string;
  color: string;
  icon: string;
}

export default function FindContactPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verifyingEmails, setVerifyingEmails] = useState<string[]>([]);

  useEffect(() => {
    // Load any existing contacts from localStorage
    const savedContacts = localStorage.getItem('found_contacts');
    if (savedContacts) {
      setContacts(JSON.parse(savedContacts));
    }
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    
    // Simulate contact search and verification
    setTimeout(() => {
      const mockContacts: Contact[] = [
        {
          id: "contact_1",
          name: "Sarah Johnson",
          title: "VP of Engineering",
          email: "sarah.johnson@techcorp.com",
          linkedin_url: "https://linkedin.com/in/sarahjohnson",
          confidence: 0.95,
          verification_status: 'valid',
          verification_score: 92,
          company: "TechCorp Inc.",
          department: "Engineering",
          level: "VP"
        },
        {
          id: "contact_2", 
          name: "Mike Chen",
          title: "Head of Talent Acquisition",
          email: "mike.chen@techcorp.com",
          linkedin_url: "https://linkedin.com/in/mikechen",
          confidence: 0.88,
          verification_status: 'risky',
          verification_score: 65,
          company: "TechCorp Inc.",
          department: "HR",
          level: "Head"
        },
        {
          id: "contact_3",
          name: "Jennifer Martinez",
          title: "Senior Engineering Manager",
          email: "j.martinez@techcorp.com",
          linkedin_url: "https://linkedin.com/in/jennifermartinez",
          confidence: 0.92,
          verification_status: 'valid',
          verification_score: 89,
          company: "TechCorp Inc.",
          department: "Engineering",
          level: "Senior Manager"
        }
      ];
      
      setContacts(mockContacts);
      setIsSearching(false);
    }, 2000);
  };

  const handleVerifyEmails = async () => {
    const emailsToVerify = contacts
      .filter(c => selectedContacts.includes(c.id))
      .map(c => c.email);
    
    if (emailsToVerify.length === 0) return;
    
    setVerifyingEmails(emailsToVerify);
    setShowVerificationModal(true);
    
    // Simulate email verification
    setTimeout(() => {
      setContacts(prev => prev.map(contact => {
        if (selectedContacts.includes(contact.id)) {
          // Simulate verification results
          const isVerified = Math.random() > 0.3; // 70% chance of being valid
          return {
            ...contact,
            verification_status: isVerified ? 'valid' : 'risky',
            verification_score: isVerified ? Math.floor(Math.random() * 30) + 70 : Math.floor(Math.random() * 40) + 30
          };
        }
        return contact;
      }));
      
      setVerifyingEmails([]);
      setShowVerificationModal(false);
    }, 3000);
  };

  const handleContactSelect = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleContinue = () => {
    if (selectedContacts.length > 0) {
      const selectedContactData = contacts.filter(c => selectedContacts.includes(c.id));
      localStorage.setItem('selected_contacts', JSON.stringify(selectedContactData));
      router.push('/context-research');
    }
  };

  const getVerificationBadge = (status: string, score?: number): VerificationBadge => {
    if (status === 'valid' && (score || 0) >= 80) {
      return { label: 'Valid', color: 'green', icon: '✓' };
    } else if (status === 'risky' || (status === 'valid' && (score || 0) < 80)) {
      return { label: 'Risky', color: 'yellow', icon: '⚠' };
    } else if (status === 'invalid') {
      return { label: 'Invalid', color: 'red', icon: '✗' };
    } else {
      return { label: 'Unknown', color: 'gray', icon: '?' };
    }
  };

  const getBadgeColor = (color: string) => {
    switch (color) {
      case 'green': return 'bg-green-100 text-green-800';
      case 'yellow': return 'bg-yellow-100 text-yellow-800';
      case 'red': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen py-8 text-slate-100">
      <div className="max-w-6xl mx-auto px-4">
        <div className="rounded-lg border border-white/10 bg-white/5 backdrop-blur p-8 shadow-2xl shadow-black/20">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Decision Makers</h1>
            <p className="text-white/70">
              Select a contact and research their LinkedIn to personalize your outreach.
            </p>
          </div>

          {/* Search Section */}
          <div className="mb-8">
            <div className="flex space-x-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by company name, role, or LinkedIn URL..."
                className="flex-1 rounded-md border border-white/15 bg-black/30 px-4 py-2 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSearching ? "Searching..." : "Search"}
              </button>
            </div>
          </div>

          {/* Contacts List */}
          {contacts.length > 0 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold">Found Contacts</h2>
                {selectedContacts.length > 0 && (
                  <button
                    onClick={handleVerifyEmails}
                    className="bg-green-600 text-white px-4 py-2 rounded-md font-medium hover:bg-green-700 transition-colors"
                  >
                    Verify Selected Emails ({selectedContacts.length})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contacts.map((contact) => {
                  const badge = getVerificationBadge(contact.verification_status, contact.verification_score);
                  const isSelected = selectedContacts.includes(contact.id);
                  
                  return (
                    <div
                      key={contact.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-white/10 hover:border-white/20 bg-black/20'
                      }`}
                      onClick={() => handleContactSelect(contact.id)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-white">{contact.name}</h3>
                          <p className="text-gray-600 text-sm">{contact.title}</p>
                          <p className="text-gray-500 text-xs">{contact.company}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getBadgeColor(badge.color)}`}>
                            {badge.icon} {badge.label}
                          </span>
                          {isSelected && (
                            <span className="text-blue-600">✓</span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-500 text-sm">Email:</span>
                          <span className="text-sm font-mono">{contact.email}</span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-500 text-sm">Confidence:</span>
                          <div className="flex items-center space-x-1">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ width: `${contact.confidence * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-sm text-gray-600">
                              {Math.round(contact.confidence * 100)}%
                            </span>
                          </div>
                        </div>

                        {contact.verification_score && (
                          <div className="flex items-center space-x-2">
                            <span className="text-gray-500 text-sm">Verification:</span>
                            <span className="text-sm text-gray-600">
                              {contact.verification_score}%
                            </span>
                          </div>
                        )}

                        {contact.linkedin_url && (
                          <div>
                            <a
                              href={contact.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View LinkedIn Profile
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedContacts.length > 0 && (
                <div className="flex justify-end space-x-4">
                  <button
                    onClick={() => router.push('/pinpoint-match')}
                    className="bg-gray-100 text-gray-700 px-6 py-3 rounded-md font-medium hover:bg-gray-200 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleContinue}
                    className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                  >
                    Continue to Research ({selectedContacts.length} selected)
                  </button>
                </div>
              )}
            </div>
          )}

          {contacts.length === 0 && !isSearching && (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Contacts Found</h3>
              <p className="text-gray-600 mb-6">
                Search for contacts by company name, role, or LinkedIn URL to get started.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="rounded-lg border border-white/10 bg-slate-950/90 backdrop-blur max-w-md w-full p-6 text-slate-100 shadow-2xl shadow-black/30">
            <h2 className="text-xl font-semibold mb-4">Verifying Emails</h2>
            <p className="text-gray-600 mb-4">
              Verifying {verifyingEmails.length} email addresses...
            </p>
            <div className="space-y-2">
              {verifyingEmails.map((email, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-gray-600">{email}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
