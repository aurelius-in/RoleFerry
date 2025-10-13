// Comprehensive Mock Data for RoleFerry Demo
// This provides realistic data for all screens to be indistinguishable from the real app

const MockData = {
  // Current User Profile
  user: {
    id: 1,
    name: "Alex Johnson",
    email: "alex.johnson@gmail.com",
    mode: "jobseeker", // or "recruiter"
    tier: "pro", // free, pro, teams
    avatar: "https://i.pravatar.cc/150?u=alex",
    ijp: {
      values: ["Growth", "Innovation", "Impact"],
      roleTypes: ["Product Manager", "Senior Product Manager", "Director of Product"],
      locations: ["Remote", "San Francisco, CA", "New York, NY"],
      roleLevel: "Senior",
      companySize: ["50-200", "201-1000"],
      industries: ["SaaS", "Fintech", "HealthTech"],
      skills: ["Product Strategy", "Data Analysis", "Agile", "SQL", "A/B Testing"],
      hiddenCompanies: ["Meta", "Amazon"],
      minSalary: 150000,
      securityClearance: null,
      jobSearchStatus: "Actively looking"
    },
    resumeExtract: {
      roles_experience: ["Senior Product Manager at TechCorp (2020-2024)", "Product Manager at StartupXYZ (2018-2020)"],
      tenure: ["4 years at TechCorp", "2 years at StartupXYZ"],
      key_metrics: ["Increased user engagement 45%", "Led team of 8 PMs", "Shipped 12 major features", "$5M ARR growth"],
      notable_accomplishments: ["Launched AI-powered recommendations", "Built 0-1 product (10K users)"],
      business_problems_solved: ["Reduced churn 30%", "Improved onboarding completion 2x"]
    }
  },

  // Jobs List (100 mock jobs)
  jobs: [
    {
      id: 1,
      title: "Senior Product Manager",
      company: { name: "Acme Corp", domain: "acme.com", logo: "https://logo.clearbit.com/acme.com", size: "201-500", industry: "SaaS" },
      location: "Remote (US)",
      salary: { min: 150000, max: 180000, currency: "USD" },
      posted: "2 days ago",
      h1b: false,
      matchScore: 92,
      matchBreakdown: { experience: 95, skills: 90, industry: 91 },
      description: "Lead product strategy for our AI-powered analytics platform. You'll own the roadmap, work with eng/design, and drive metrics.",
      requirements: ["5+ years PM experience", "B2B SaaS background", "Data-driven mindset", "SQL proficiency"],
      jobUrl: "https://acme.com/careers/senior-pm",
      source: "LinkedIn",
      saved: false,
      applied: false
    },
    {
      id: 2,
      title: "Director of Product",
      company: { name: "GlobalTech", domain: "globaltech.io", logo: "https://logo.clearbit.com/globaltech.io", size: "1001-5000", industry: "Fintech" },
      location: "San Francisco, CA",
      salary: { min: 180000, max: 220000, currency: "USD" },
      posted: "5 days ago",
      h1b: true,
      matchScore: 85,
      matchBreakdown: { experience: 88, skills: 82, industry: 85 },
      description: "Oversee product org (15 PMs). Set vision, execute strategy, collaborate with C-suite.",
      requirements: ["8+ years PM", "3+ years leadership", "Fintech experience preferred"],
      jobUrl: "https://globaltech.io/jobs/dir-product",
      source: "Indeed",
      saved: true,
      applied: false
    },
    {
      id: 3,
      title: "Product Manager - AI/ML",
      company: { name: "DataFlow", domain: "dataflow.ai", logo: "https://logo.clearbit.com/dataflow.ai", size: "51-200", industry: "SaaS" },
      location: "Remote (US)",
      salary: { min: 140000, max: 170000, currency: "USD" },
      posted: "1 week ago",
      h1b: false,
      matchScore: 78,
      matchBreakdown: { experience: 80, skills: 75, industry: 80 },
      description: "Build ML-powered features for data pipelines. Partner with ML engineers to ship predictive analytics.",
      requirements: ["4+ years PM", "Technical background", "ML product experience a plus"],
      jobUrl: "https://dataflow.ai/careers/pm-ml",
      source: "AngelList",
      saved: false,
      applied: true
    },
    // Additional jobs...
    ...Array.from({ length: 17 }, (_, i) => ({
      id: i + 4,
      title: ["Senior PM", "Product Manager", "VP Product", "Head of Product", "Group PM"][i % 5],
      company: { 
        name: ["InnovateCo", "BuilderTech", "CloudSync", "ScaleUp", "VentureX", "CoreSystems", "NexGenAI", "FlowOps", "TrustBridge", "Luminary", "Quantix", "Horizon", "Catalyst", "Momentum", "Prism", "Keystone", "Atlas"][i % 17],
        domain: ["innovateco.com", "buildertech.io", "cloudsync.com", "scaleup.ai", "venturex.com", "coresystems.io", "nexgenai.com", "flowops.co", "trustbridge.io", "luminary.tech", "quantix.ai", "horizon.co", "catalyst.tech", "momentum.io", "prism.ai", "keystone.co", "atlas.tech"][i % 17],
        logo: `https://logo.clearbit.com/${ ["innovateco.com", "buildertech.io", "cloudsync.com", "scaleup.ai", "venturex.com", "coresystems.io", "nexgenai.com", "flowops.co", "trustbridge.io", "luminary.tech", "quantix.ai", "horizon.co", "catalyst.tech", "momentum.io", "prism.ai", "keystone.co", "atlas.tech"][i % 17]}`,
        size: ["11-50", "51-200", "201-500", "501-1000", "1001-5000"][i % 5],
        industry: ["SaaS", "Fintech", "HealthTech", "E-commerce", "Developer Tools"][i % 5]
      },
      location: ["Remote (US)", "New York, NY", "San Francisco, CA", "Austin, TX", "Seattle, WA"][i % 5],
      salary: { min: 130000 + (i * 5000), max: 170000 + (i * 5000), currency: "USD" },
      posted: `${i + 3} days ago`,
      h1b: i % 4 === 0,
      matchScore: 65 + (i % 20),
      matchBreakdown: { experience: 70 + (i % 15), skills: 60 + (i % 20), industry: 65 + (i % 15) },
      description: `Join our team to build innovative products. Work with cross-functional teams to deliver value.`,
      requirements: [`${3 + (i % 3)}+ years PM experience`, "Strong technical background", "Data-driven"],
      jobUrl: `https://example${i}.com/jobs/pm`,
      source: ["LinkedIn", "Indeed", "AngelList", "Company Site"][i % 4],
      saved: i % 7 === 0,
      applied: i % 10 === 0
    }))
  ],

  // Applications / Tracker
  applications: [
    {
      id: 1,
      jobId: 3,
      status: "applied",
      createdAt: "2025-01-10T14:30:00Z",
      lastActionAt: "2025-01-10T14:30:00Z",
      sequenceId: 1,
      replyState: null,
      contacts: [
        { id: 1, name: "Sarah Chen", title: "VP Product", email: "sarah@dataflow.ai", verified: true, linkedin: "https://linkedin.com/in/sarachen" }
      ],
      notes: [],
      interviews: [],
      offer: null
    },
    {
      id: 2,
      jobId: 2,
      status: "interviewing",
      createdAt: "2025-01-08T10:00:00Z",
      lastActionAt: "2025-01-13T16:00:00Z",
      sequenceId: 2,
      replyState: "replied",
      contacts: [
        { id: 2, name: "Michael Torres", title: "Head of Product", email: "michael@globaltech.io", verified: true, linkedin: "https://linkedin.com/in/michaelt" }
      ],
      notes: [{ text: "Great conversation about product vision", createdAt: "2025-01-09T11:00:00Z" }],
      interviews: [
        { date: "2025-01-15T14:00:00Z", type: "Phone Screen", interviewer: "Michael Torres" },
        { date: "2025-01-18T10:00:00Z", type: "Onsite", interviewer: "Product Team" }
      ],
      offer: null
    },
    {
      id: 3,
      jobId: 1,
      status: "offer",
      createdAt: "2025-01-05T09:00:00Z",
      lastActionAt: "2025-01-14T13:00:00Z",
      sequenceId: 3,
      replyState: "replied",
      contacts: [
        { id: 3, name: "Emma Rodriguez", title: "Director of Product", email: "emma@acme.com", verified: true, linkedin: "https://linkedin.com/in/emmarodriguez" }
      ],
      notes: [{ text: "Offer: $165K base + equity", createdAt: "2025-01-14T13:00:00Z" }],
      interviews: [
        { date: "2025-01-07T14:00:00Z", type: "Phone", interviewer: "Emma Rodriguez" },
        { date: "2025-01-10T10:00:00Z", type: "Onsite", interviewer: "Product + Eng Team" },
        { date: "2025-01-12T15:00:00Z", type: "Final", interviewer: "CEO" }
      ],
      offer: { amount: 165000, equity: "0.15%", deadline: "2025-01-20" }
    }
  ],

  // Contacts Database
  contacts: [
    { id: 1, companyId: 1, name: "Sarah Chen", title: "VP Product", level: "VP", email: "sarah@dataflow.ai", verifiedAt: "2025-01-10", source: "Apollo", linkedin: "https://linkedin.com/in/sarachen" },
    { id: 2, companyId: 2, name: "Michael Torres", title: "Head of Product", level: "Head", email: "michael@globaltech.io", verifiedAt: "2025-01-08", source: "Clay", linkedin: "https://linkedin.com/in/michaelt" },
    { id: 3, companyId: 3, name: "Emma Rodriguez", title: "Director of Product", level: "Director", email: "emma@acme.com", verifiedAt: "2025-01-05", source: "Apollo", linkedin: "https://linkedin.com/in/emmarodriguez" },
    { id: 4, companyId: 1, name: "Tom Wilson", title: "Recruiter", level: "IC", email: "tom@dataflow.ai", verifiedAt: "2025-01-10", source: "Clay", linkedin: "https://linkedin.com/in/tomwilson" },
    { id: 5, companyId: 2, name: "Lisa Park", title: "Head of Talent", level: "Head", email: "lisa@globaltech.io", verifiedAt: "2025-01-08", source: "Apollo", linkedin: "https://linkedin.com/in/lisapark" }
  ],

  // Sequences
  sequences: [
    {
      id: 1,
      name: "Product Role Outreach - 3 Step",
      steps: [
        {
          stepNo: 1,
          delay: 0,
          subject: "Quick question about {{role}} at {{company}}",
          body: "Hi {{first_name}},\n\nI came across the {{role}} role at {{company}} and wanted to reach out directly.\n\nI have 6 years of product experience (most recently at TechCorp, where I led a team of 8 and increased engagement 45%). I'm excited about {{company}}'s mission.\n\nWould love to chat for 15 minutes if you're open. Happy to send my resume.\n\nThanks for considering,\nAlex",
          stopOnReply: true
        },
        {
          stepNo: 2,
          delay: 3, // days
          subject: "Re: {{role}} at {{company}}",
          body: "Hi {{first_name}},\n\nFollowing up on my note from last week. Still very interested in the {{role}} role.\n\nHappy to share more about my background (shipped 12 major features, $5M ARR growth at TechCorp).\n\nLet me know if you'd like to connect.\n\nBest,\nAlex",
          stopOnReply: true
        },
        {
          stepNo: 3,
          delay: 5,
          subject: "Last note about {{role}}",
          body: "Hi {{first_name}},\n\nLast quick note. I understand you're busy, but wanted to make sure this didn't get lost.\n\nIf now's not the right time, no worries—happy to stay in touch for future opportunities.\n\nBest,\nAlex",
          stopOnReply: true
        }
      ],
      createdAt: "2025-01-05",
      active: true
    },
    {
      id: 2,
      name: "Quick 2-Step Nudge",
      steps: [
        {
          stepNo: 1,
          delay: 0,
          subject: "Quick chat about {{role}}?",
          body: "Hi {{first_name}},\n\nSaw the {{role}} posting and think I'd be a great fit. 6 years PM experience, led teams, shipped products.\n\nFree for a quick call?\n\nAlex",
          stopOnReply: true
        },
        {
          stepNo: 2,
          delay: 4,
          subject: "Following up",
          body: "Hi {{first_name}},\n\nStill interested! Let me know if you'd like to connect.\n\nAlex",
          stopOnReply: true
        }
      ],
      createdAt: "2025-01-08",
      active: true
    }
  ],

  // Outreach Events
  outreach: [
    { id: 1, applicationId: 1, contactId: 1, stepNo: 1, sentAt: "2025-01-10T14:35:00Z", deliveryStatus: "delivered", linkClicks: 1, replies: 0 },
    { id: 2, applicationId: 2, contactId: 2, stepNo: 1, sentAt: "2025-01-08T10:10:00Z", deliveryStatus: "delivered", linkClicks: 2, replies: 1 },
    { id: 3, applicationId: 2, contactId: 2, stepNo: 2, sentAt: null, deliveryStatus: "cancelled", linkClicks: 0, replies: 0 }, // Stopped on reply
    { id: 4, applicationId: 3, contactId: 3, stepNo: 1, sentAt: "2025-01-05T09:15:00Z", deliveryStatus: "delivered", linkClicks: 1, replies: 1 }
  ],

  // Deliverability Mailboxes
  mailboxes: [
    { id: 1, domain: "rf-send-01.com", mailbox: "alex@rf-send-01.com", healthScore: 98, warmupStatus: "active", dailyCap: 50, sentToday: 12, lastBounce: null, lastSpamFlag: null },
    { id: 2, domain: "rf-send-02.com", mailbox: "outreach@rf-send-02.com", healthScore: 95, warmupStatus: "active", dailyCap: 50, sentToday: 23, lastBounce: null, lastSpamFlag: null },
    { id: 3, domain: "rf-send-03.com", mailbox: "hello@rf-send-03.com", healthScore: 92, warmupStatus: "active", dailyCap: 50, sentToday: 35, lastBounce: "2025-01-12", lastSpamFlag: null },
    { id: 4, domain: "rf-send-04.com", mailbox: "team@rf-send-04.com", healthScore: 88, warmupStatus: "warmup", dailyCap: 30, sentToday: 8, lastBounce: null, lastSpamFlag: null },
    { id: 5, domain: "rf-send-05.com", mailbox: "info@rf-send-05.com", healthScore: 75, warmupStatus: "paused", dailyCap: 20, sentToday: 0, lastBounce: "2025-01-13", lastSpamFlag: "2025-01-13" }
  ],

  // LivePages
  livepages: [
    {
      id: 1,
      applicationId: 1,
      contactName: "Sarah",
      companyName: "DataFlow",
      role: "Senior Product Manager",
      video: null,
      gif: "https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif",
      calendarLink: "https://calendly.com/alex-johnson/15min",
      metrics: ["Increased engagement 45%", "Led team of 8", "$5M ARR growth"],
      views: 2,
      ctaClicks: 1,
      scrollDepth: 85,
      createdAt: "2025-01-10T14:30:00Z"
    },
    {
      id: 2,
      applicationId: 2,
      contactName: "Michael",
      companyName: "GlobalTech",
      role: "Director of Product",
      video: null,
      gif: "https://media.giphy.com/media/3o7TKSjRrfIPjeiVyg/giphy.gif",
      calendarLink: "https://calendly.com/alex-johnson/15min",
      metrics: ["Shipped 12 major features", "Reduced churn 30%", "Built 0-1 product"],
      views: 5,
      ctaClicks: 2,
      scrollDepth: 100,
      createdAt: "2025-01-08T10:00:00Z"
    }
  ],

  // Personas (for Recruiter mode)
  personas: [
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
  ],

  // Company Enrichment Data
  companies: [
    {
      id: 1,
      domain: "dataflow.ai",
      name: "DataFlow",
      size: "51-200",
      industry: "SaaS",
      techStack: ["React", "Python", "AWS", "PostgreSQL", "Kubernetes"],
      funding: "Series B ($25M)",
      glassdoor: 4.2,
      socials: { linkedin: "https://linkedin.com/company/dataflow", twitter: "https://twitter.com/dataflow" },
      signals: ["Hiring aggressively", "Recent Series B", "Y Combinator alum"]
    },
    {
      id: 2,
      domain: "globaltech.io",
      name: "GlobalTech",
      size: "1001-5000",
      industry: "Fintech",
      techStack: ["Node.js", "React", "GCP", "MongoDB", "Docker"],
      funding: "Series D ($150M)",
      glassdoor: 4.5,
      socials: { linkedin: "https://linkedin.com/company/globaltech", twitter: "https://twitter.com/globaltech" },
      signals: ["IPO rumors", "Expanding to EMEA", "Fortune 500 clients"]
    },
    {
      id: 3,
      domain: "acme.com",
      name: "Acme Corp",
      size: "201-500",
      industry: "SaaS",
      techStack: ["Vue.js", "Ruby on Rails", "AWS", "PostgreSQL"],
      funding: "Series C ($50M)",
      glassdoor: 4.0,
      socials: { linkedin: "https://linkedin.com/company/acme", twitter: "https://twitter.com/acmecorp" },
      signals: ["Recently acquired competitor", "Building ML team", "Enterprise focus"]
    }
  ],

  // Analytics/Insights
  analytics: {
    totalApplications: 23,
    replyRate: 0.17, // 17%
    interviewsThisWeek: 2,
    offers: 1,
    avgTimeToInterview: 7, // days
    avgTimeToOffer: 14, // days
    sequenceEffectiveness: {
      "3-Step": { sent: 15, replies: 3, replyRate: 0.20 },
      "2-Step": { sent: 8, replies: 1, replyRate: 0.125 }
    },
    applicationsByStatus: {
      saved: 5,
      applied: 12,
      interviewing: 4,
      offer: 1,
      rejected: 1
    },
    weeklyActivity: [
      { week: "Jan 1-7", applications: 8, replies: 2, interviews: 1 },
      { week: "Jan 8-14", applications: 15, replies: 5, interviews: 3 }
    ]
  }
};

// Export for use in main app
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MockData;
}

