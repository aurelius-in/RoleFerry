// Comprehensive Mock Data for RoleFerry Demo
// This file provides realistic data for both Job Seeker and Recruiter modes

const MockData = {
  // Job Seeker Mode Data
  jobSeeker: {
    preferences: {
      industries: ["Software & Technology", "AI & Machine Learning", "FinTech"],
      roles: ["Senior Software Engineer", "ML Engineer", "Full Stack Developer"],
      salaryRange: "$120,000 - $180,000",
      location: "Remote",
      workType: ["Remote", "Hybrid"],
      companySize: "Medium (201-1000 employees)",
      experienceLevel: "Senior Level (6-10 years)",
      skills: "Python, React, AWS, Machine Learning, Docker, Kubernetes, PostgreSQL, JavaScript, TypeScript, Node.js"
    },
    
    resume: {
      positions: [
        { title: "Senior Software Engineer", company: "TechCorp", tenure: "3 years" },
        { title: "Software Developer", company: "InnovateX", tenure: "2 years" },
        { title: "Junior Developer", company: "StartupCo", tenure: "1 year" }
      ],
      metrics: [
        "Increased system efficiency by 20%",
        "Led team of 5 engineers",
        "Reduced deployment time by 50%",
        "Improved customer satisfaction by 30%"
      ],
      skills: ["Python", "React", "AWS", "Machine Learning", "Docker", "Kubernetes", "PostgreSQL", "JavaScript", "TypeScript", "Node.js"],
      accomplishments: [
        "Developed new feature resulting in 15% revenue increase",
        "Mentored 3 junior developers",
        "Led migration to cloud infrastructure",
        "Implemented automated testing reducing bugs by 70%"
      ],
      problemsSolved: [
        "Optimized database queries reducing response time by 40%",
        "Reduced cloud infrastructure costs by 25%",
        "Implemented CI/CD pipeline reducing deployment errors by 60%",
        "Built scalable microservices architecture"
      ]
    },
    
    jobDescription: {
      painPoints: [
        "Scaling backend infrastructure to handle 10x traffic growth",
        "Improving data processing efficiency for real-time analytics",
        "Building robust and secure APIs for external partners"
      ],
      requiredSkills: ["Python", "Distributed Systems", "Cloud Architecture (AWS)", "SQL/NoSQL", "API Design", "Microservices", "Docker", "Kubernetes", "CI/CD"],
      successMetrics: [
        "Reduce system latency by 30%",
        "Increase system uptime to 99.99%",
        "Deliver 3 new API endpoints per quarter",
        "Improve data processing speed by 50%"
      ],
      companyContext: {
        size: "Mid-market (500-1000 employees)",
        industry: "Technology/SaaS",
        stage: "Series B",
        techStack: "Python, AWS, PostgreSQL, React"
      }
    },
    
    pinpointMatch: {
      alignmentScore: 85,
      matches: [
        {
          challenge: "Scaling Infrastructure",
          painPoint: "Need to scale backend infrastructure to handle 10x traffic growth",
          solution: "My experience scaling microservices on AWS, handling peak loads with auto-scaling groups and load balancers",
          metric: "Achieved 99.9% uptime and 20% cost reduction through optimized infrastructure"
        },
        {
          challenge: "Data Processing",
          painPoint: "Improving data processing efficiency for real-time analytics",
          solution: "Implemented Kafka streams and Spark for real-time data ingestion and processing",
          metric: "Reduced data processing latency by 50% and enabled instant dashboards"
        },
        {
          challenge: "API Development",
          painPoint: "Building robust and secure APIs for external partners",
          solution: "Designed and developed RESTful APIs with OAuth2 authentication and comprehensive input validation",
          metric: "Successfully launched 3 partner integrations in Q3 with zero security incidents"
        }
      ]
    },
    
    contacts: [
      {
        id: 1,
        name: "Jane Doe",
        title: "Hiring Manager",
        email: "jane.doe@techcorp.com",
        company: "TechCorp",
        department: "Engineering",
        linkedin: "linkedin.com/in/janedoe",
        verificationStatus: "valid",
        confidence: 95,
        verificationMethod: "NeverBounce"
      },
      {
        id: 2,
        name: "John Smith",
        title: "VP of Engineering",
        email: "john.smith@techcorp.com",
        company: "TechCorp",
        department: "Engineering",
        linkedin: "linkedin.com/in/johnsmith",
        verificationStatus: "risky",
        confidence: 88,
        verificationMethod: "MillionVerifier"
      }
    ],
    
    research: {
      companySummary: "TechCorp is a leading technology company specializing in AI-driven solutions for enterprise clients. Founded in 2010, they have grown rapidly to become a key player in the SaaS market, known for their innovative approach to data analytics and cloud computing.",
      recentNews: "TechCorp recently secured $50M in Series B funding and announced plans to expand their engineering team by 100+ people. They also launched a new AI-powered analytics platform that has seen 300% growth in user adoption since its release.",
      contactBio: "Jane Doe is the Senior Hiring Manager for the AI Solutions division at TechCorp. With over 12 years of experience in tech recruitment, she specializes in identifying and attracting top-tier engineering talent. She is known for her data-driven approach to hiring and her commitment to building diverse, high-performing teams.",
      companyCulture: "TechCorp values innovation, collaboration, and continuous learning. They have a flat organizational structure that encourages open communication and idea sharing. The company is known for its flexible work policies, strong emphasis on work-life balance, and commitment to employee development through regular training and mentorship programs.",
      techStack: "TechCorp's technology stack includes Python, AWS, PostgreSQL, React, Docker, Kubernetes, and various AI/ML frameworks. They are migrating to microservices architecture and implementing CI/CD pipelines. The company is also investing heavily in machine learning and data science capabilities.",
      marketPosition: "TechCorp competes with companies like DataCorp, AnalyticsPro, and CloudTech in the enterprise AI solutions market. They differentiate themselves through their proprietary algorithms and customer-centric approach. The company has a strong market position in the mid-market segment and is expanding into enterprise clients."
    },
    
    offer: {
      tone: "manager",
      format: "text",
      content: "I understand you're facing the challenge of scaling your backend infrastructure to handle 10x traffic growth. Based on my deep experience with microservices architecture and cloud scaling, I can offer you a comprehensive technical analysis and implementation strategy.\n\nHere's what I can provide:\n• Detailed infrastructure audit and bottleneck identification\n• Scalability recommendations with technical specifications\n• Implementation timeline with risk assessment\n• Performance monitoring and optimization strategies\n• Team training and knowledge transfer\n\nI've successfully led similar scaling projects that resulted in 25% cost reduction and 40% performance improvement. Would you be interested in a technical discussion about how these strategies could address your specific challenges?"
    },
    
    email: {
      tone: "manager",
      subject: "Regarding Senior Software Engineer position - TechCorp",
      body: "Hi {{first_name}},\n\nRegarding the {{job_title}} position, I understand the team is tackling {{pinpoint_1}}. My approach, leveraging {{solution_1}}, has previously achieved {{metric_1}}. I'm keen to explore how I can contribute to your team's objectives.\n\nI've also kept up with {{company_name}}'s recent news, specifically {{recent_news}}, and see a clear alignment with my career goals.\n\nBest,\n[Your Name]",
      jargonEnabled: false
    },
    
    campaign: {
      name: "Job Application Campaign",
      status: "draft",
      emails: [
        {
          step: 1,
          subject: "Quick advice on Senior Software Engineer at TechCorp?",
          body: "Hi Jane,\n\nI noticed the Senior Software Engineer role at TechCorp and was particularly interested in your focus on scaling backend infrastructure. My background in microservices architecture has consistently led to results like 99.9% uptime and 20% cost reduction. I believe my skills are a strong fit for your team's needs.\n\nWould you be open to a brief chat to discuss how my experience can help with your current challenges?\n\nBest,\n[Your Name]",
          timing: "immediate",
          status: "draft"
        },
        {
          step: 2,
          subject: "Following up: Senior Software Engineer at TechCorp",
          body: "Hi Jane,\n\nJust wanted to follow up on my previous email regarding the Senior Software Engineer role. I'm still very interested in how my experience in scaling backend infrastructure could benefit TechCorp.\n\nI've attached a brief case study of a similar project I led that resulted in 40% performance improvement and 25% cost reduction.\n\nWould love to connect if the timing is better now.\n\nBest,\n[Your Name]",
          timing: "2 days",
          status: "draft"
        },
        {
          step: 3,
          subject: "Final follow-up: Senior Software Engineer at TechCorp",
          body: "Hi Jane,\n\nOne more thought on the Senior Software Engineer position. I saw TechCorp recently partnered with GlobalData and believe my background in microservices architecture could be particularly useful for your current initiatives.\n\nI understand you're busy, so I'll keep this brief. If you're interested in learning more about how I can help with your scaling challenges, I'd be happy to share some specific examples.\n\nBest,\n[Your Name]",
          timing: "4 days",
          status: "draft"
        }
      ]
    }
  },
  
  // Recruiter Mode Data
  recruiter: {
    icp: {
      industries: ["Software & Technology", "AI & Machine Learning", "FinTech"],
      roles: ["Senior Software Engineer", "ML Engineer", "Full Stack Developer"],
      salaryRange: "$120,000 - $180,000",
      location: "Remote",
      workType: ["Remote", "Hybrid"],
      companySize: "Medium (201-1000 employees)",
      experienceLevel: "Senior Level (6-10 years)",
      skills: "Python, React, AWS, Machine Learning, Docker, Kubernetes, PostgreSQL, JavaScript, TypeScript, Node.js"
    },
    
    candidate: {
      name: "Alex Johnson",
      title: "Senior Software Engineer",
      experience: "8 years",
      skills: ["Python", "React", "AWS", "Machine Learning", "Docker", "Kubernetes", "PostgreSQL", "JavaScript", "TypeScript", "Node.js"],
      accomplishments: [
        "Led migration to microservices architecture at TechCorp",
        "Reduced system latency by 40% through optimization",
        "Mentored 5 junior developers",
        "Implemented CI/CD pipeline reducing deployment errors by 60%"
      ],
      metrics: [
        "Increased system efficiency by 25%",
        "Reduced cloud infrastructure costs by 30%",
        "Improved team productivity by 35%",
        "Achieved 99.9% uptime for critical systems"
      ],
      problemsSolved: [
        "Scaled backend infrastructure to handle 10x traffic growth",
        "Optimized database queries reducing response time by 40%",
        "Implemented automated testing reducing bugs by 70%",
        "Built robust and secure APIs for external partners"
      ]
    },
    
    jobDescription: {
      painPoints: [
        "Scaling backend infrastructure to handle 10x traffic growth",
        "Improving data processing efficiency for real-time analytics",
        "Building robust and secure APIs for external partners"
      ],
      requiredSkills: ["Python", "Distributed Systems", "Cloud Architecture (AWS)", "SQL/NoSQL", "API Design", "Microservices", "Docker", "Kubernetes", "CI/CD"],
      successMetrics: [
        "Reduce system latency by 30%",
        "Increase system uptime to 99.99%",
        "Deliver 3 new API endpoints per quarter",
        "Improve data processing speed by 50%"
      ]
    },
    
    pinpointMatch: {
      alignmentScore: 92,
      matches: [
        {
          challenge: "Scaling Infrastructure",
          painPoint: "Need to scale backend infrastructure to handle 10x traffic growth",
          solution: "Alex's experience scaling microservices on AWS, handling peak loads with auto-scaling groups and load balancers",
          metric: "Achieved 99.9% uptime and 20% cost reduction through optimized infrastructure"
        },
        {
          challenge: "Data Processing",
          painPoint: "Improving data processing efficiency for real-time analytics",
          solution: "Implemented Kafka streams and Spark for real-time data ingestion and processing",
          metric: "Reduced data processing latency by 50% and enabled instant dashboards"
        },
        {
          challenge: "API Development",
          painPoint: "Building robust and secure APIs for external partners",
          solution: "Designed and developed RESTful APIs with OAuth2 authentication and comprehensive input validation",
          metric: "Successfully launched 3 partner integrations in Q3 with zero security incidents"
        }
      ]
    },
    
    contacts: [
      {
        id: 1,
        name: "Sarah Chen",
        title: "VP of Engineering",
        email: "sarah.chen@techcorp.com",
        company: "TechCorp",
        department: "Engineering",
        linkedin: "linkedin.com/in/sarahchen",
        verificationStatus: "valid",
        confidence: 98,
        verificationMethod: "NeverBounce"
      },
      {
        id: 2,
        name: "Mike Rodriguez",
        title: "CTO",
        email: "mike.rodriguez@techcorp.com",
        company: "TechCorp",
        department: "Engineering",
        linkedin: "linkedin.com/in/mikerodriguez",
        verificationStatus: "valid",
        confidence: 95,
        verificationMethod: "MillionVerifier"
      }
    ],
    
    research: {
      companySummary: "TechCorp is a rapidly growing technology company that specializes in AI-driven solutions for enterprise clients. Since their founding in 2010, they have established themselves as a key player in the SaaS market, known for their innovative approach to data analytics and cloud computing.",
      recentNews: "TechCorp recently secured $50M in Series B funding and announced plans to expand their engineering team by 100+ people. They also launched a new AI-powered analytics platform that has seen 300% growth in user adoption since its release.",
      contactBio: "Sarah Chen is the VP of Engineering at TechCorp, leading a team of 50+ engineers across multiple product lines. With over 15 years of experience in scaling engineering organizations, she is known for her strategic approach to technology leadership and her commitment to building high-performing teams.",
      companyCulture: "TechCorp values innovation, collaboration, and continuous learning. They have a flat organizational structure that encourages open communication and idea sharing. The company is known for its flexible work policies, strong emphasis on work-life balance, and commitment to employee development through regular training and mentorship programs.",
      techStack: "TechCorp's technology stack includes Python, AWS, PostgreSQL, React, Docker, Kubernetes, and various AI/ML frameworks. They are migrating to microservices architecture and implementing CI/CD pipelines. The company is also investing heavily in machine learning and data science capabilities.",
      marketPosition: "TechCorp competes with companies like DataCorp, AnalyticsPro, and CloudTech in the enterprise AI solutions market. They differentiate themselves through their proprietary algorithms and customer-centric approach. The company has a strong market position in the mid-market segment and is expanding into enterprise clients."
    },
    
    offer: {
      tone: "exec",
      format: "text",
      content: "I understand you're facing the challenge of scaling your backend infrastructure to handle 10x traffic growth. Based on my experience leading similar transformations, I can offer you a strategic analysis and ROI-focused implementation plan.\n\nHere's what I can provide:\n• Strategic infrastructure audit with business impact analysis\n• Scalability recommendations with ROI projections\n• Implementation timeline with risk mitigation strategies\n• Performance monitoring and optimization strategies\n• Competitive advantage analysis and market positioning\n\nI've successfully led similar transformations that resulted in 25% cost reduction, 40% performance improvement, and 15% revenue increase. Would you be interested in a strategic discussion about how these initiatives could drive your business growth?"
    },
    
    email: {
      tone: "exec",
      subject: "Strategic discussion: Senior Software Engineer at TechCorp",
      body: "Hi {{first_name}},\n\nGiven {{company_name}}'s strategic focus on {{company_summary}} and recent developments like {{recent_news}}, I believe my expertise in addressing {{pinpoint_1}} with solutions like {{solution_1}} could be highly valuable. I've consistently delivered {{metric_1}} in similar contexts.\n\nI'd appreciate the opportunity for a brief discussion on how my strategic contributions can support your overarching goals.\n\nBest,\n[Your Name]",
      jargonEnabled: false
    },
    
    campaign: {
      name: "Candidate Placement Campaign",
      status: "draft",
      emails: [
        {
          step: 1,
          subject: "Strategic discussion: Senior Software Engineer at TechCorp",
          body: "Hi Sarah,\n\nGiven TechCorp's strategic focus on AI-driven solutions and recent developments like the $50M Series B funding, I believe Alex Johnson's expertise in addressing scaling challenges could be highly valuable. He's consistently delivered 25% cost reduction and 40% performance improvement in similar contexts.\n\nI'd appreciate the opportunity for a brief discussion on how Alex's strategic contributions can support your overarching goals.\n\nBest,\n[Your Name]",
          timing: "immediate",
          status: "draft"
        },
        {
          step: 2,
          subject: "Following up: Alex Johnson for Senior Software Engineer",
          body: "Hi Sarah,\n\nJust wanted to follow up on my previous email regarding Alex Johnson for the Senior Software Engineer role. I'm still very interested in how his experience in scaling backend infrastructure could benefit TechCorp.\n\nI've attached Alex's detailed case study that shows how he led similar projects resulting in 40% performance improvement and 25% cost reduction.\n\nWould love to connect if the timing is better now.\n\nBest,\n[Your Name]",
          timing: "2 days",
          status: "draft"
        },
        {
          step: 3,
          subject: "Final follow-up: Alex Johnson for Senior Software Engineer",
          body: "Hi Sarah,\n\nOne more thought on Alex Johnson for the Senior Software Engineer position. I saw TechCorp recently partnered with GlobalData and believe Alex's background in microservices architecture could be particularly useful for your current initiatives.\n\nI understand you're busy, so I'll keep this brief. If you're interested in learning more about how Alex can help with your scaling challenges, I'd be happy to share some specific examples.\n\nBest,\n[Your Name]",
          timing: "4 days",
          status: "draft"
        }
      ]
    }
  },
  
  // Common data
  common: {
    jargon: {
      "API": "Application Programming Interface",
      "KPI": "Key Performance Indicator",
      "ROI": "Return On Investment",
      "SaaS": "Software as a Service",
      "B2B": "Business to Business",
      "CRM": "Customer Relationship Management",
      "SEO": "Search Engine Optimization",
      "UX": "User Experience",
      "UI": "User Interface",
      "MVP": "Minimum Viable Product",
      "EOD": "End Of Day",
      "ASAP": "As Soon As Possible",
      "FYI": "For Your Information",
      "ETA": "Estimated Time of Arrival",
      "P&L": "Profit and Loss",
      "COB": "Close Of Business",
      "TBD": "To Be Determined",
      "WIP": "Work In Progress"
    },
    
    deliverability: {
      emailVerification: "pass",
      spfRecord: "pass",
      dkimRecord: "pass",
      spamScore: "warning",
      domainWarmup: "pass",
      bounceRate: "pass",
      customTrackingDomain: "pass",
      openTracking: "pass"
    },
    
    analytics: {
      delivered: 150,
      open: 120,
      reply: 45,
      positive: 30,
      meetings: 15,
      alignmentCorrelation: 0.85,
      costPerQualifiedLead: 25.50,
      totalCampaigns: 12,
      averageAlignmentScore: 78,
      conversionRate: 0.20
    }
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MockData;
} else {
  window.MockData = MockData;
}
