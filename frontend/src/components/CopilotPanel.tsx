'use client';

import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function CopilotPanel() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your RoleFerry Copilot. Ask me anything about roles, applications, or your search strategy."
    }
  ]);
  const [input, setInput] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);

  const generateResponse = (query: string): string => {
    const lower = query.toLowerCase();
    
    if (lower.includes('fit') || lower.includes('match')) {
      return 'This role is a great fit for you! Your 6 years of PM experience aligns perfectly with the Senior PM role. Your track record of increasing engagement by 45% at TechCorp shows you can deliver results. The company is in SaaS (your target industry) and offers the remote flexibility you want.';
    } else if (lower.includes('email') || lower.includes('write')) {
      return 'Here\'s a draft email:\n\nSubject: Quick question about Senior PM role\n\nHi [First Name],\n\nI came across the Senior PM role at [Company] and wanted to reach out directly. I have 6 years of PM experience, most recently at TechCorp where I increased engagement 45% and led a team of 8.\n\nWould love to chat for 15 minutes if you\'re open.\n\nBest,\nAlex';
    } else if (lower.includes('insider') || lower.includes('contact')) {
      return 'I can help you find insider contacts! Click "Find Insiders" on the role detail page and I\'ll discover hiring managers and recruiters at the company. We\'ll verify their emails and help you reach out directly.';
    } else if (lower.includes('improve') || lower.includes('better')) {
      return 'To improve your role search:\n\n1. Apply to 5-10 roles per week (consistency is key)\n2. Personalize each email (mention specific projects)\n3. Follow up after 3-5 days (persistence pays off)\n4. Keep your tracker organized (track every touchpoint)\n\nYour current reply rate is 17%, which is above the platform average of 15%!';
    } else {
      return 'I\'m here to help with your role search! I can:\n\n• Explain why roles are good matches\n• Write personalized outreach emails\n• Find insider contacts at companies\n• Give role search strategy advice\n\nWhat would you like to know?';
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;

    // Add user message
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    
    const query = input;
    setInput('');

    // Simulate AI response
    setTimeout(() => {
      const response = generateResponse(query);
      const assistantMessage: Message = { role: 'assistant', content: response };
      setMessages(prev => [...prev, assistantMessage]);
    }, 1000);
  };

  const suggestions = [
    "Tell me why this role is a good fit",
    "Write an email to the hiring manager",
    "Show potential insider contacts"
  ];

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-400 text-black font-bold rounded-full shadow-lg hover:shadow-xl transition-all"
        >
          🤖 Open Copilot
        </button>
      </div>
    );
  }

  return (
    <aside className="w-full lg:w-96 bg-slate-900 border-l border-white/10 flex flex-col h-screen sticky top-0">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <span className="font-bold text-lg">Copilot</span>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className="w-8 h-8 flex items-center justify-center bg-white/5 border border-white/10 rounded-md hover:bg-white/10 transition-colors"
        >
          −
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-lg ${
              msg.role === 'user' 
                ? 'bg-blue-500 text-white' 
                : 'bg-white/5 border border-white/10'
            }`}>
              <div className="text-sm whitespace-pre-line">{msg.content}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-white/10">
        <div className="flex flex-col gap-2 mb-3">
          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => { setInput(suggestion); handleSend(); }}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-left text-sm text-slate-400 hover:bg-white/10 hover:text-white transition-all"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask anything..."
            className="flex-1 p-3 bg-white/5 border border-white/10 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
          <button
            onClick={handleSend}
            className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </aside>
  );
}

