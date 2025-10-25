"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Contact {
  id: string;
  name: string;
  title: string;
  email: string;
  company: string;
  department: string;
  level: string;
}

interface CompanySummary {
  name: string;
  description: string;
  industry: string;
  size: string;
  founded: string;
  headquarters: string;
  website: string;
  linkedin_url?: string;
}

interface ContactBio {
  name: string;
  title: string;
  company: string;
  bio: string;
  experience: string;
  education: string;
  skills: string[];
  linkedin_url?: string;
}

interface RecentNews {
  title: string;
  summary: string;
  date: string;
  source: string;
  url: string;
}

interface ResearchData {
  company_summary: CompanySummary;
  contact_bios: ContactBio[];
  recent_news: RecentNews[];
  shared_connections: string[];
}

export default function ContextResearchPage() {
  const router = useRouter();
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [researchData, setResearchData] = useState<ResearchData | null>(null);
  const [isResearching, setIsResearching] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    // Load selected contacts from localStorage
    const savedContacts = localStorage.getItem('selected_contacts');
    if (savedContacts) {
      setSelectedContacts(JSON.parse(savedContacts));
    }
  }, []);

  const handleResearch = async () => {
    if (selectedContacts.length === 0) return;
    
    setIsResearching(true);
    
    // Simulate AI research
    setTimeout(() => {
      const mockResearchData: ResearchData = {
        company_summary: {
          name: "TechCorp Inc.",
          description: "TechCorp is a leading enterprise software company specializing in cloud infrastructure solutions. Founded in 2015, the company has grown to serve over 10,000 enterprise customers worldwide.",
          industry: "Enterprise Software",
          size: "501-1,000 employees",
          founded: "2015",
          headquarters: "San Francisco, CA",
          website: "https://techcorp.com",
          linkedin_url: "https://linkedin.com/company/techcorp"
        },
        contact_bios: selectedContacts.map(contact => ({
          name: contact.name,
          title: contact.title,
          company: contact.company,
          bio: `${contact.name} is a ${contact.title} at ${contact.company} with extensive experience in ${contact.department.toLowerCase()}. They have a proven track record of leading high-performing teams and driving innovation in their field.`,
          experience: "10+ years in technology leadership roles",
          education: "MBA from Stanford University, BS Computer Science from UC Berkeley",
          skills: ["Leadership", "Strategic Planning", "Team Management", "Technology Innovation"],
          linkedin_url: `https://linkedin.com/in/${contact.name.toLowerCase().replace(' ', '')}`
        })),
        recent_news: [
          {
            title: "TechCorp Announces $50M Series C Funding Round",
            summary: "The company plans to use the funding to expand its engineering team and accelerate product development.",
            date: "2024-01-15",
            source: "TechCrunch",
            url: "https://techcrunch.com/techcorp-funding"
          },
          {
            title: "TechCorp Launches New AI-Powered Analytics Platform",
            summary: "The platform helps enterprises analyze their data more efficiently and make better business decisions.",
            date: "2024-01-10",
            source: "VentureBeat",
            url: "https://venturebeat.com/techcorp-ai-platform"
          }
        ],
        shared_connections: [
          "John Smith (Former colleague at StartupXYZ)",
          "Sarah Wilson (Mutual connection from Stanford)",
          "Mike Johnson (Industry contact from conference)"
        ]
      };
      
      setResearchData(mockResearchData);
      setIsResearching(false);
    }, 3000);
  };

  const handleEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditValue(currentValue);
  };

  const handleSaveEdit = () => {
    if (!researchData || !editingField) return;
    
    setResearchData(prev => {
      if (!prev) return prev;
      
      const newData = { ...prev };
      
      if (editingField === 'company_summary') {
        newData.company_summary = { ...newData.company_summary, description: editValue };
      } else if (editingField.startsWith('contact_')) {
        const contactIndex = parseInt(editingField.split('_')[1]);
        if (newData.contact_bios[contactIndex]) {
          newData.contact_bios[contactIndex] = { ...newData.contact_bios[contactIndex], bio: editValue };
        }
      }
      
      return newData;
    });
    
    setEditingField(null);
    setEditValue("");
  };

  const handleContinue = () => {
    if (researchData) {
      localStorage.setItem('research_data', JSON.stringify(researchData));
      router.push('/offer-creation');
    }
  };

  const getVariableText = (variable: string) => {
    if (!researchData) return `{{${variable}}}`;
    
    switch (variable) {
      case 'company_summary':
        return researchData.company_summary.description;
      case 'contact_bio':
        return researchData.contact_bios[0]?.bio || 'Contact bio not available';
      case 'recent_news':
        return researchData.recent_news[0]?.summary || 'No recent news available';
      default:
        return `{{${variable}}}`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Context (Research)</h1>
            <p className="text-gray-600">
              Research company and contact information to personalize your outreach.
            </p>
          </div>

          {selectedContacts.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Contacts Selected</h3>
              <p className="text-gray-600 mb-6">
                Please go back and select contacts to research.
              </p>
              <button
                onClick={() => router.push('/find-contact')}
                className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
              >
                Go to Find Contact
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Selected Contacts */}
              <div>
                <h2 className="text-xl font-semibold mb-4">Selected Contacts</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedContacts.map((contact) => (
                    <div key={contact.id} className="border border-gray-200 rounded-lg p-4">
                      <h3 className="font-semibold text-gray-900">{contact.name}</h3>
                      <p className="text-gray-600 text-sm">{contact.title}</p>
                      <p className="text-gray-500 text-xs">{contact.company}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Research Button */}
              <div className="text-center">
                <button
                  onClick={handleResearch}
                  disabled={isResearching}
                  className="bg-blue-600 text-white px-8 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isResearching ? "Researching..." : "Start Research"}
                </button>
              </div>

              {/* Research Results */}
              {researchData && (
                <div className="space-y-8">
                  {/* Company Summary */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-semibold">Company Summary</h2>
                      <button
                        onClick={() => handleEdit('company_summary', researchData.company_summary.description)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Edit
                      </button>
                    </div>
                    
                    {editingField === 'company_summary' ? (
                      <div className="space-y-3">
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 h-32"
                        />
                        <div className="flex space-x-2">
                          <button
                            onClick={handleSaveEdit}
                            className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingField(null)}
                            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <p className="text-gray-700">{researchData.company_summary.description}</p>
                        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Industry:</span> {researchData.company_summary.industry}
                          </div>
                          <div>
                            <span className="font-medium">Size:</span> {researchData.company_summary.size}
                          </div>
                          <div>
                            <span className="font-medium">Founded:</span> {researchData.company_summary.founded}
                          </div>
                          <div>
                            <span className="font-medium">Headquarters:</span> {researchData.company_summary.headquarters}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Contact Bios */}
                  <div>
                    <h2 className="text-xl font-semibold mb-4">Contact Bios</h2>
                    <div className="space-y-4">
                      {researchData.contact_bios.map((bio, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="font-semibold text-gray-900">{bio.name}</h3>
                            <button
                              onClick={() => handleEdit(`contact_${index}`, bio.bio)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Edit
                            </button>
                          </div>
                          
                          {editingField === `contact_${index}` ? (
                            <div className="space-y-3">
                              <textarea
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="w-full border border-gray-300 rounded-md px-3 py-2 h-24"
                              />
                              <div className="flex space-x-2">
                                <button
                                  onClick={handleSaveEdit}
                                  className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingField(null)}
                                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-200"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <p className="text-gray-700 mb-3">{bio.bio}</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="font-medium">Experience:</span> {bio.experience}
                                </div>
                                <div>
                                  <span className="font-medium">Education:</span> {bio.education}
                                </div>
                                <div className="md:col-span-2">
                                  <span className="font-medium">Skills:</span> {bio.skills.join(", ")}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recent News */}
                  <div>
                    <h2 className="text-xl font-semibold mb-4">Recent News</h2>
                    <div className="space-y-4">
                      {researchData.recent_news.map((news, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <h3 className="font-semibold text-gray-900 mb-2">{news.title}</h3>
                          <p className="text-gray-700 mb-2">{news.summary}</p>
                          <div className="flex justify-between items-center text-sm text-gray-500">
                            <span>{news.source} • {news.date}</span>
                            <a
                              href={news.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                            >
                              Read More
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Shared Connections */}
                  <div>
                    <h2 className="text-xl font-semibold mb-4">Shared Connections</h2>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <ul className="space-y-2">
                        {researchData.shared_connections.map((connection, index) => (
                          <li key={index} className="flex items-center space-x-2">
                            <span className="text-green-500">•</span>
                            <span className="text-gray-700">{connection}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Variables Preview */}
                  <div>
                    <h2 className="text-xl font-semibold mb-4">Available Variables</h2>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-800 mb-3">
                        These variables can be used in your email templates:
                      </p>
                      <div className="space-y-2 text-sm">
                        <div>
                          <code className="bg-blue-100 px-2 py-1 rounded">{"{{company_summary}}"}</code>
                          <span className="ml-2 text-gray-600">
                            {getVariableText('company_summary').substring(0, 100)}...
                          </span>
                        </div>
                        <div>
                          <code className="bg-blue-100 px-2 py-1 rounded">{"{{contact_bio}}"}</code>
                          <span className="ml-2 text-gray-600">
                            {getVariableText('contact_bio').substring(0, 100)}...
                          </span>
                        </div>
                        <div>
                          <code className="bg-blue-100 px-2 py-1 rounded">{"{{recent_news}}"}</code>
                          <span className="ml-2 text-gray-600">
                            {getVariableText('recent_news').substring(0, 100)}...
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4">
                    <button
                      onClick={() => router.push('/find-contact')}
                      className="bg-gray-100 text-gray-700 px-6 py-3 rounded-md font-medium hover:bg-gray-200 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleContinue}
                      className="bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                    >
                      Continue to Offer Creation
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
