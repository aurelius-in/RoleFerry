// API Utility for RoleFerry Wireframes
// Base API URL - adjust based on environment
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8000'
  : 'https://api.roleferry.com'; // Update with production URL

/**
 * Generic API call function
 */
async function apiCall(endpoint, method = 'GET', body = null) {
  const url = `${API_BASE}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API ${method} ${endpoint} failed: ${response.status} ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

/**
 * Job Preferences API
 */
const JobPreferencesAPI = {
  save: async (preferences) => {
    return apiCall('/job-preferences/save', 'POST', preferences);
  },
  get: async (userId) => {
    return apiCall(`/job-preferences/${userId}`, 'GET');
  },
  update: async (userId, preferences) => {
    return apiCall(`/job-preferences/${userId}`, 'PUT', preferences);
  },
  getOptions: {
    values: async () => apiCall('/job-preferences/options/values', 'GET'),
    roleCategories: async () => apiCall('/job-preferences/options/role-categories', 'GET'),
    industries: async () => apiCall('/job-preferences/options/industries', 'GET'),
    skills: async () => apiCall('/job-preferences/options/skills', 'GET'),
  }
};

/**
 * Resume API
 */
const ResumeAPI = {
  upload: async (formData) => {
    // For file uploads, use FormData directly
    const url = `${API_BASE}/resume/upload`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`Resume upload failed: ${response.status}`);
    }
    return await response.json();
  },
  get: async (userId) => {
    return apiCall(`/resume/${userId}`, 'GET');
  },
  save: async (resumeData) => {
    return apiCall('/resume/save', 'POST', resumeData);
  }
};

/**
 * Job Descriptions API
 */
const JobDescriptionsAPI = {
  import: async (url, text) => {
    return apiCall('/job-descriptions/import', 'POST', { url, text });
  },
  save: async (jobDescription) => {
    return apiCall('/job-descriptions/save', 'POST', jobDescription);
  },
  get: async (userId) => {
    return apiCall(`/job-descriptions/${userId}`, 'GET');
  },
  getById: async (userId, jdId) => {
    return apiCall(`/job-descriptions/${userId}/${jdId}`, 'GET');
  }
};

/**
 * Pain Point Match API
 */
const PainPointMatchAPI = {
  generate: async (matchData) => {
    return apiCall('/pinpoint-match/generate', 'POST', matchData);
  },
  save: async (matchData) => {
    return apiCall('/pinpoint-match/save', 'POST', matchData);
  },
  get: async (userId) => {
    return apiCall(`/pinpoint-match/${userId}`, 'GET');
  },
  getScore: async (userId) => {
    return apiCall(`/pinpoint-match/${userId}/score`, 'GET');
  }
};

/**
 * Context Research API
 */
const ContextResearchAPI = {
  research: async (researchData) => {
    return apiCall('/context-research/research', 'POST', researchData);
  },
  save: async (researchData) => {
    return apiCall('/context-research/save', 'POST', researchData);
  },
  get: async (userId) => {
    return apiCall(`/context-research/${userId}`, 'GET');
  },
  getVariables: async (userId) => {
    return apiCall(`/context-research/variables/${userId}`, 'GET');
  }
};

/**
 * Find Contact API
 */
const FindContactAPI = {
  search: async (searchParams) => {
    return apiCall('/find-contact/search', 'POST', searchParams);
  },
  verify: async (email) => {
    return apiCall('/find-contact/verify', 'POST', { email });
  },
  get: async (contactId) => {
    return apiCall(`/find-contact/${contactId}`, 'GET');
  }
};

/**
 * Offer Creation API
 */
const OfferCreationAPI = {
  create: async (offerData) => {
    return apiCall('/offer-creation/create', 'POST', offerData);
  },
  save: async (offerData) => {
    return apiCall('/offer-creation/save', 'POST', offerData);
  },
  get: async (userId) => {
    return apiCall(`/offer-creation/${userId}`, 'GET');
  },
  getById: async (userId, offerId) => {
    return apiCall(`/offer-creation/${userId}/${offerId}`, 'GET');
  },
  getTones: async () => {
    return apiCall('/offer-creation/tones/descriptions', 'GET');
  }
};

/**
 * Compose API
 */
const ComposeAPI = {
  generate: async (composeData) => {
    return apiCall('/compose/generate', 'POST', composeData);
  },
  save: async (composeData) => {
    return apiCall('/compose/save', 'POST', composeData);
  },
  get: async (userId) => {
    return apiCall(`/compose/${userId}`, 'GET');
  },
  detectJargon: async (text) => {
    return apiCall('/compose/detect-jargon', 'POST', { text });
  },
  getVariables: async () => {
    return apiCall('/compose/variables/available', 'GET');
  },
  getTones: async () => {
    return apiCall('/compose/tones/descriptions', 'GET');
  }
};

/**
 * Campaign API
 */
const CampaignAPI = {
  export: async (campaignData) => {
    return apiCall('/campaign/export', 'POST', campaignData);
  },
  get: async () => {
    return apiCall('/campaign', 'GET');
  },
  getRuns: async () => {
    return apiCall('/campaign/runs', 'GET');
  },
  getCampaigns: async () => {
    return apiCall('/campaign/campaigns', 'GET');
  },
  push: async (campaignData) => {
    return apiCall('/campaign/push', 'POST', campaignData);
  }
};

/**
 * Deliverability Launch API
 */
const DeliverabilityLaunchAPI = {
  preFlightChecks: async (checkData) => {
    return apiCall('/deliverability-launch/pre-flight-checks', 'POST', checkData);
  },
  launch: async (launchData) => {
    return apiCall('/deliverability-launch/launch', 'POST', launchData);
  },
  validateContent: async (content) => {
    return apiCall('/deliverability-launch/validate-content', 'POST', content);
  },
  getStats: async () => {
    return apiCall('/deliverability-launch/deliverability-stats', 'GET');
  }
};

/**
 * Analytics API
 */
const AnalyticsAPI = {
  getCampaign: async () => {
    return apiCall('/analytics/campaign', 'GET');
  },
  getCSV: async () => {
    return apiCall('/analytics/csv', 'GET');
  },
  getTimeSeries: async () => {
    return apiCall('/analytics/timeseries', 'GET');
  }
};

// Export all APIs
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    JobPreferencesAPI,
    ResumeAPI,
    JobDescriptionsAPI,
    PainPointMatchAPI,
    ContextResearchAPI,
    FindContactAPI,
    OfferCreationAPI,
    ComposeAPI,
    CampaignAPI,
    DeliverabilityLaunchAPI,
    AnalyticsAPI
  };
}

