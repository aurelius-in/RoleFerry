// RoleFerry Enterprise Demo Application
// Complete functionality for all screens with realistic interactions

(function() {
  'use strict';
  
  // Utility Functions
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => document.querySelectorAll(selector);
  
  // State Management
  const state = {
    currentView: 'jobs',
    currentMode: 'jobseeker',
    currentJob: null,
    filters: {
      role: [],
      location: [],
      salary: 150000,
      companySize: [],
      industry: []
    },
    copilotMessages: [],
    trackerView: 'board'
  };
  
  // Initialize App
  function init() {
    setupNavigation();
    setupTheme();
    setupModeToggle();
    setupCopilot();
    setupJobsView();
    setupTrackerView();
    setupDeliverabilityView();
    setupLivePagesView();
    setupSequencesView();
    setupEnrichmentView();
    setupDashboard();
    setupSettings();
    
    // Load initial view
    navigateTo('jobs');
    
    showToast('Welcome to RoleFerry! 👋');
  }
  
  // Navigation
  function setupNavigation() {
    $$('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        if (view) {
          navigateTo(view);
        }
      });
    });
    
    // Dashboard quick actions
    $$('.action-card').forEach(card => {
      card.addEventListener('click', () => {
        const action = card.dataset.action;
        switch(action) {
          case 'apply':
            navigateTo('jobs');
            break;
          case 'tracker':
            navigateTo('tracker');
            break;
          case 'sequences':
            navigateTo('sequences');
            break;
          case 'ijp':
            openIJPModal();
            break;
        }
      });
    });
  }
  
  function navigateTo(viewName) {
    // Update active nav link
    $$('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.view === viewName) {
        link.classList.add('active');
      }
    });
    
    // Hide all views
    $$('.view').forEach(view => view.classList.remove('active'));
    
    // Show target view
    const targetView = $(`#${viewName}View`);
    if (targetView) {
      targetView.classList.add('active');
      state.currentView = viewName;
    }
  }
  
  // Theme Toggle
  function setupTheme() {
    const themeBtn = $('#themeBtn');
    themeBtn.addEventListener('click', () => {
      const isLight = document.body.classList.toggle('light');
      themeBtn.textContent = isLight ? '☀️' : '🌙';
      localStorage.setItem('theme', isLight ? 'light' : 'dark');
    });
    
    // Load saved theme
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      document.body.classList.add('light');
      themeBtn.textContent = '☀️';
    }
  }
  
  // Mode Toggle (Job Seeker / Recruiter)
  function setupModeToggle() {
    const seekerBtn = $('#modeSeekerBtn');
    const recruiterBtn = $('#modeRecruiterBtn');
    
    seekerBtn.addEventListener('click', () => {
      state.currentMode = 'jobseeker';
      seekerBtn.classList.add('active');
      recruiterBtn.classList.remove('active');
      updateModeLabels();
      showToast('Switched to Job Seeker mode');
    });
    
    recruiterBtn.addEventListener('click', () => {
      state.currentMode = 'recruiter';
      recruiterBtn.classList.add('active');
      seekerBtn.classList.remove('active');
      updateModeLabels();
      showToast('Switched to Recruiter mode');
    });
  }
  
  function updateModeLabels() {
    // Update tracker columns, etc. based on mode
    if (state.currentView === 'tracker') {
      renderTrackerBoard();
    }
  }
  
  // Copilot Panel
  function setupCopilot() {
    const sendBtn = $('#copilotSend');
    const input = $('#copilotInput');
    const messagesContainer = $('#copilotMessages');
    
    sendBtn.addEventListener('click', () => {
      const message = input.value.trim();
      if (message) {
        addCopilotMessage('user', message);
        input.value = '';
        
        // Simulate AI response
        setTimeout(() => {
          const response = generateCopilotResponse(message);
          addCopilotMessage('assistant', response);
        }, 1000);
      }
    });
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });
    
    // Suggestion buttons
    $$('.copilot-suggestion').forEach(btn => {
      btn.addEventListener('click', () => {
        const query = btn.dataset.query;
        input.value = query;
        sendBtn.click();
      });
    });
  }
  
  function addCopilotMessage(role, content) {
    const messagesContainer = $('#copilotMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `copilot-message ${role}`;
    messageDiv.innerHTML = `<div class="message-content">${content}</div>`;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    state.copilotMessages.push({ role, content });
  }
  
  function generateCopilotResponse(message) {
    const lower = message.toLowerCase();
    
    if (lower.includes('fit') || lower.includes('match')) {
      return 'This job is a great fit for you! Your 6 years of PM experience aligns perfectly with the Senior PM role. Your track record of increasing engagement by 45% at TechCorp shows you can deliver results. The company is in SaaS (your target industry) and offers the remote flexibility you want.';
    } else if (lower.includes('email') || lower.includes('write')) {
      return 'Here\'s a draft email:\n\nSubject: Quick question about Senior PM role\n\nHi [First Name],\n\nI came across the Senior PM role at [Company] and wanted to reach out directly. I have 6 years of PM experience, most recently at TechCorp where I increased engagement 45% and led a team of 8.\n\nWould love to chat for 15 minutes if you\'re open.\n\nBest,\nAlex';
    } else if (lower.includes('insider') || lower.includes('contact')) {
      return 'I can help you find insider contacts! Click "Find Insiders" on the job detail page and I\'ll discover hiring managers and recruiters at the company. We\'ll verify their emails and help you reach out directly.';
    } else if (lower.includes('improve') || lower.includes('better')) {
      return 'To improve your job search:\n\n1. Apply to 5-10 jobs per week (consistency is key)\n2. Personalize each email (mention specific projects)\n3. Follow up after 3-5 days (persistence pays off)\n4. Keep your tracker organized (track every touchpoint)\n\nYour current reply rate is 17%, which is above the platform average of 15%!';
    } else {
      return 'I\'m here to help with your job search! I can:\n\n• Explain why jobs are good matches\n• Write personalized outreach emails\n• Find insider contacts at companies\n• Give job search strategy advice\n\nWhat would you like to know?';
    }
  }
  
  // Jobs View
  function setupJobsView() {
    renderJobsList();
    setupJobsFilters();
    
    $('#refineBtn')?.addEventListener('click', openIJPModal);
    $('#backToJobs')?.addEventListener('click', () => {
      $('#jobsView').classList.add('active');
      $('#jobDetailView').classList.remove('active');
    });
  }
  
  function renderJobsList() {
    const jobsList = $('#jobsList');
    if (!jobsList) return;
    
    jobsList.innerHTML = '';
    
    // Apply filters
    const filteredJobs = MockData.jobs.filter(job => {
      if (state.filters.salary && job.salary.min < state.filters.salary) return false;
      // Add more filter logic as needed
      return true;
    });
    
    filteredJobs.slice(0, 20).forEach(job => {
      const card = createJobCard(job);
      jobsList.appendChild(card);
    });
  }
  
  function createJobCard(job) {
    const card = document.createElement('div');
    card.className = 'job-card';
    
    const matchClass = job.matchScore >= 90 ? 'excellent' :
                       job.matchScore >= 75 ? 'strong' :
                       job.matchScore >= 50 ? 'fair' : 'low';
    
    const matchLabel = job.matchScore >= 90 ? 'Excellent Match' :
                       job.matchScore >= 75 ? 'Strong Match' :
                       job.matchScore >= 50 ? 'Fair Match' : 'Low Match';
    
    card.innerHTML = `
      <div class="job-card-header">
        <img src="${job.company.logo}" alt="${job.company.name}" class="job-company-logo" onerror="this.src='assets/roleferry_trans.png'" />
        <div class="job-card-info">
          <div class="job-title">${job.title}</div>
          <div class="job-company">${job.company.name}</div>
          <div class="job-meta">
            <span class="job-meta-item">📍 ${job.location}</span>
            <span class="job-meta-item">💰 $${(job.salary.min/1000).toFixed(0)}K-$${(job.salary.max/1000).toFixed(0)}K</span>
            <span class="job-meta-item">🕒 ${job.posted}</span>
            ${job.h1b ? '<span class="job-meta-item">🛂 H1B</span>' : ''}
          </div>
        </div>
        <div class="match-score ${matchClass}">
          ${job.matchScore}% ${matchLabel}
        </div>
      </div>
      <div class="job-card-footer">
        <div class="job-actions">
          <button class="job-action-btn primary" data-job-id="${job.id}" data-action="apply">Apply</button>
          <button class="job-action-btn" data-job-id="${job.id}" data-action="insider">Find Insiders</button>
          <button class="job-action-btn" data-job-id="${job.id}" data-action="copilot">Ask Copilot</button>
        </div>
        ${job.saved ? '<span style="color: var(--warning);">★ Saved</span>' : ''}
        ${job.applied ? '<span style="color: var(--success);">✓ Applied</span>' : ''}
      </div>
    `;
    
    // Card click to view details
    card.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {
        showJobDetail(job);
      }
    });
    
    // Action buttons
    card.querySelectorAll('.job-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const jobId = parseInt(btn.dataset.jobId);
        handleJobAction(action, jobId);
      });
    });
    
    return card;
  }
  
  function showJobDetail(job) {
    state.currentJob = job;
    const detailView = $('#jobDetailView');
    const content = $('#jobDetailContent');
    
    content.innerHTML = `
      <div class="job-detail-main">
        <div class="job-detail-header-info">
          <img src="${job.company.logo}" alt="${job.company.name}" style="width: 64px; height: 64px; border-radius: var(--radius-md); background: white; padding: 8px;" onerror="this.src='assets/roleferry_trans.png'" />
          <div>
            <h1 style="font-size: 24px; margin-bottom: 8px;">${job.title}</h1>
            <div style="font-size: 16px; color: var(--fg-secondary); margin-bottom: 8px;">${job.company.name}</div>
            <div style="font-size: 14px; color: var(--fg-tertiary);">
              📍 ${job.location} • 💰 $${(job.salary.min/1000).toFixed(0)}K-$${(job.salary.max/1000).toFixed(0)}K • 🕒 ${job.posted}
            </div>
          </div>
        </div>
        
        <div class="job-detail-actions" style="margin: 24px 0; display: flex; gap: 12px;">
          <button class="btn-primary" onclick="handleJobAction('apply', ${job.id})">Apply Now</button>
          <button class="btn-secondary" onclick="handleJobAction('insider', ${job.id})">Find Insiders</button>
          <button class="btn-secondary" onclick="handleJobAction('copilot', ${job.id})">Ask Copilot</button>
        </div>
        
        <div class="job-detail-tabs" style="border-bottom: 1px solid var(--border); margin-bottom: 24px;">
          <button class="tab-btn active" data-tab="overview" style="padding: 12px 16px; background: none; border: none; color: var(--fg-primary); font-weight: 600; border-bottom: 2px solid var(--brand-orange); cursor: pointer;">Overview</button>
          <button class="tab-btn" data-tab="company" style="padding: 12px 16px; background: none; border: none; color: var(--fg-secondary); font-weight: 600; cursor: pointer;">Company</button>
        </div>
        
        <div class="tab-content active" data-tab-content="overview">
          <h2 style="font-size: 18px; margin-bottom: 16px;">Job Description</h2>
          <p style="line-height: 1.6; margin-bottom: 16px;">${job.description}</p>
          
          <h3 style="font-size: 16px; margin-bottom: 12px;">Requirements</h3>
          <ul style="list-style: disc; margin-left: 24px; line-height: 1.8;">
            ${job.requirements.map(req => `<li>${req}</li>`).join('')}
          </ul>
          
          <div style="margin-top: 24px; padding: 16px; background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius-md);">
            <h3 style="font-size: 16px; margin-bottom: 12px;">Match Breakdown</h3>
            <div style="margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Experience</span>
                <span style="font-weight: 700;">${job.matchBreakdown.experience}%</span>
              </div>
              <div style="height: 8px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden;">
                <div style="height: 100%; width: ${job.matchBreakdown.experience}%; background: linear-gradient(90deg, #22c55e, #84cc16);"></div>
              </div>
            </div>
            <div style="margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Skills</span>
                <span style="font-weight: 700;">${job.matchBreakdown.skills}%</span>
              </div>
              <div style="height: 8px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden;">
                <div style="height: 100%; width: ${job.matchBreakdown.skills}%; background: linear-gradient(90deg, #22c55e, #84cc16);"></div>
              </div>
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>Industry</span>
                <span style="font-weight: 700;">${job.matchBreakdown.industry}%</span>
              </div>
              <div style="height: 8px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden;">
                <div style="height: 100%; width: ${job.matchBreakdown.industry}%; background: linear-gradient(90deg, #22c55e, #84cc16);"></div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="tab-content" data-tab-content="company" style="display: none;">
          <h2 style="font-size: 18px; margin-bottom: 16px;">About ${job.company.name}</h2>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
            <div>
              <div style="font-size: 12px; color: var(--fg-tertiary); margin-bottom: 4px;">Company Size</div>
              <div style="font-weight: 600;">${job.company.size} employees</div>
            </div>
            <div>
              <div style="font-size: 12px; color: var(--fg-tertiary); margin-bottom: 4px;">Industry</div>
              <div style="font-weight: 600;">${job.company.industry}</div>
            </div>
          </div>
          <p style="color: var(--fg-secondary); line-height: 1.6;">
            Detailed company information would be enriched via Clay/Clearbit integration. This would include tech stack, funding rounds, Glassdoor ratings, recent news, and social media profiles.
          </p>
        </div>
      </div>
    `;
    
    // Tab switching
    content.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        content.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.remove('active');
          b.style.borderBottom = 'none';
          b.style.color = 'var(--fg-secondary)';
        });
        btn.classList.add('active');
        btn.style.borderBottom = '2px solid var(--brand-orange)';
        btn.style.color = 'var(--fg-primary)';
        
        content.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        content.querySelector(`[data-tab-content="${tab}"]`).style.display = 'block';
      });
    });
    
    $('#jobsView').classList.remove('active');
    detailView.classList.add('active');
  }
  
  function handleJobAction(action, jobId) {
    const job = MockData.jobs.find(j => j.id === jobId);
    if (!job) return;
    
    switch(action) {
      case 'apply':
        applyToJob(job);
        break;
      case 'insider':
        showInsiderModal(job);
        break;
      case 'copilot':
        $('#copilotInput').value = `Tell me about the ${job.title} role at ${job.company.name}`;
        $('#copilotSend').click();
        break;
    }
  }
  
  function applyToJob(job) {
    // Simulate application process
    showToast('Finding contacts at ' + job.company.name + '...');
    
    setTimeout(() => {
      showToast('✓ Contact found! Drafting email...');
      
      setTimeout(() => {
        showToast('✓ Email sent! Added to your Tracker.');
        job.applied = true;
        
        // Add to applications
        MockData.applications.push({
          id: MockData.applications.length + 1,
          jobId: job.id,
          status: 'applied',
          createdAt: new Date().toISOString(),
          lastActionAt: new Date().toISOString(),
          sequenceId: 1,
          replyState: null,
          contacts: [],
          notes: [],
          interviews: [],
          offer: null
        });
        
        renderJobsList();
      }, 2000);
    }, 2000);
  }
  
  function showInsiderModal(job) {
    // Simulate finding contacts
    const modal = $('#insiderModal');
    const results = $('#insiderResults');
    
    results.innerHTML = '<div style="text-align: center; padding: 24px;">Finding contacts at ' + job.company.name + '...</div>';
    
    openModal('insiderModal');
    
    setTimeout(() => {
      // Get mock contacts
      const contacts = MockData.contacts.filter((c, i) => i < 3);
      
      results.innerHTML = `
        <h3 style="font-size: 16px; margin-bottom: 16px;">Found ${contacts.length} contacts:</h3>
        ${contacts.map(contact => `
          <div style="padding: 16px; background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius-md); margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <img src="https://i.pravatar.cc/48?u=${contact.email}" style="width: 48px; height: 48px; border-radius: 50%;" />
              <div>
                <div style="font-weight: 700;">${contact.name}</div>
                <div style="font-size: 14px; color: var(--fg-secondary);">${contact.title}</div>
              </div>
            </div>
            <div style="font-size: 13px; color: var(--fg-tertiary); margin-bottom: 8px;">
              ✓ ${contact.email} (verified)
            </div>
            <button class="btn-primary btn-full" style="margin-top: 8px;" onclick="connectViaEmail('${contact.name}', '${contact.email}', '${job.title}', '${job.company.name}')">
              Contact ${contact.name.split(' ')[0]}
            </button>
          </div>
        `).join('')}
      `;
    }, 2000);
  }
  
  window.connectViaEmail = function(name, email, role, company) {
    showToast(`Drafting email to ${name}...`);
    setTimeout(() => {
      showToast(`✓ Email sent to ${name}!`);
      closeModal('insiderModal');
    }, 1500);
  };
  
  function setupJobsFilters() {
    const salarySlider = $('#salarySlider');
    const salaryValue = $('#salaryValue');
    
    if (salarySlider) {
      salarySlider.addEventListener('input', () => {
        const value = parseInt(salarySlider.value);
        salaryValue.textContent = (value / 1000).toFixed(0);
        state.filters.salary = value;
      });
    }
  }
  
  // Tracker View
  function setupTrackerView() {
    renderTrackerBoard();
    setupTrackerControls();
  }
  
  function renderTrackerBoard() {
    const board = $('#trackerBoard');
    if (!board) return;
    
    const columns = state.currentMode === 'jobseeker'
      ? ['Saved', 'Applied', 'Interviewing', 'Offer', 'Rejected']
      : ['Leads', 'Contacted', 'Appointments', 'Offers', 'Won/Lost'];
    
    const statusMap = state.currentMode === 'jobseeker'
      ? { saved: 'Saved', applied: 'Applied', interviewing: 'Interviewing', offer: 'Offer', rejected: 'Rejected' }
      : { saved: 'Leads', applied: 'Contacted', interviewing: 'Appointments', offer: 'Offers', rejected: 'Won/Lost' };
    
    board.innerHTML = '';
    
    columns.forEach(columnName => {
      const statusKey = Object.keys(statusMap).find(k => statusMap[k] === columnName);
      const apps = MockData.applications.filter(app => app.status === statusKey);
      
      const column = document.createElement('div');
      column.className = 'tracker-column';
      column.innerHTML = `
        <div class="column-header">
          <div class="column-title">${columnName}</div>
          <div class="column-count">${apps.length}</div>
        </div>
        <div class="tracker-cards">
          ${apps.map(app => {
            const job = MockData.jobs.find(j => j.id === app.jobId);
            if (!job) return '';
            
            return `
              <div class="tracker-card" data-app-id="${app.id}">
                <div class="tracker-card-header">
                  <img src="${job.company.logo}" class="tracker-card-logo" onerror="this.src='assets/roleferry_trans.png'" />
                  <div class="tracker-card-info">
                    <div class="tracker-card-title">${job.title}</div>
                    <div class="tracker-card-company">${job.company.name}</div>
                  </div>
                </div>
                <div class="tracker-card-meta">
                  <div>Applied: ${new Date(app.createdAt).toLocaleDateString()}</div>
                  ${app.replyState ? `<div><span class="status-badge replied">✓ Replied</span></div>` : ''}
                  ${app.interviews.length > 0 ? `<div>📅 ${app.interviews.length} interview(s)</div>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      
      board.appendChild(column);
    });
  }
  
  function setupTrackerControls() {
    $$('[data-tracker-view]').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.trackerView;
        state.trackerView = view;
        
        $$('[data-tracker-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        if (view === 'board') {
          $('#trackerBoard').classList.remove('hidden');
          $('#trackerTable').classList.add('hidden');
        } else {
          $('#trackerBoard').classList.add('hidden');
          $('#trackerTable').classList.remove('hidden');
          renderTrackerTable();
        }
      });
    });
    
    $('#exportCsvBtn')?.addEventListener('click', exportTrackerCSV);
    $('#importCsvBtn')?.addEventListener('click', () => showToast('CSV import coming soon!'));
  }
  
  function renderTrackerTable() {
    const tbody = $('#trackerTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = MockData.applications.map(app => {
      const job = MockData.jobs.find(j => j.id === app.jobId);
      if (!job) return '';
      
      return `
        <tr>
          <td>${job.company.name}</td>
          <td>${job.title}</td>
          <td><span class="status-badge ${app.status}">${app.status}</span></td>
          <td>${new Date(app.createdAt).toLocaleDateString()}</td>
          <td>${new Date(app.lastActionAt).toLocaleDateString()}</td>
          <td>${app.replyState ? '<span class="status-badge replied">Replied</span>' : '—'}</td>
          <td><button class="btn-secondary" style="padding: 4px 8px; font-size: 12px;">View</button></td>
        </tr>
      `;
    }).join('');
  }
  
  function exportTrackerCSV() {
    const headers = ['Company', 'Role', 'Status', 'Applied Date', 'Last Contact', 'Reply Status'];
    const rows = MockData.applications.map(app => {
      const job = MockData.jobs.find(j => j.id === app.jobId);
      if (!job) return null;
      return [
        job.company.name,
        job.title,
        app.status,
        new Date(app.createdAt).toLocaleDateString(),
        new Date(app.lastActionAt).toLocaleDateString(),
        app.replyState || 'No reply'
      ];
    }).filter(Boolean);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'roleferry-tracker-export.csv';
    a.click();
    
    showToast('✓ CSV exported!');
  }
  
  // Deliverability View
  function setupDeliverabilityView() {
    const grid = $('#mailboxesGrid');
    if (!grid) {
      return;
    }
    
    grid.innerHTML = MockData.mailboxes.map(mb => `
      <div style="background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-lg);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <div style="font-weight: 700; font-size: 14px;">${mb.mailbox}</div>
          <div style="font-size: 24px; font-weight: 700; color: ${mb.healthScore >= 90 ? 'var(--success)' : mb.healthScore >= 75 ? 'var(--warning)' : 'var(--error)'};">
            ${mb.healthScore}
          </div>
        </div>
        <div style="font-size: 12px; color: var(--fg-tertiary); margin-bottom: 8px;">Domain: ${mb.domain}</div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
          <span>Status:</span>
          <span style="font-weight: 600; color: ${mb.warmupStatus === 'active' ? 'var(--success)' : 'var(--warning)'};">${mb.warmupStatus}</span>
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 13px; margin-bottom: 4px;">
          <span>Sent Today:</span>
          <span style="font-weight: 600;">${mb.sentToday} / ${mb.dailyCap}</span>
        </div>
        <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 999px; margin: 8px 0; overflow: hidden;">
          <div style="height: 100%; width: ${(mb.sentToday / mb.dailyCap) * 100}%; background: var(--brand-blue);"></div>
        </div>
        ${mb.lastBounce ? `<div style="font-size: 11px; color: var(--error); margin-top: 8px;">⚠️ Last bounce: ${mb.lastBounce}</div>` : ''}
        ${mb.lastSpamFlag ? `<div style="font-size: 11px; color: var(--error); margin-top: 4px;">⚠️ Spam flag: ${mb.lastSpamFlag}</div>` : ''}
      </div>
    `).join('');
  }
  
  // LivePages View
  function setupLivePagesView() {
    const grid = $('#livepagesGrid');
    if (!grid) return;
    
    grid.innerHTML = MockData.livepages.map(lp => `
      <div style="background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-lg);">
        <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">${lp.role} - ${lp.companyName}</h3>
        <div style="font-size: 14px; color: var(--fg-secondary); margin-bottom: 12px;">For: ${lp.contactName}</div>
        
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 16px 0;">
          <div>
            <div style="font-size: 12px; color: var(--fg-tertiary);">Views</div>
            <div style="font-size: 20px; font-weight: 700;">${lp.views}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: var(--fg-tertiary);">Clicks</div>
            <div style="font-size: 20px; font-weight: 700;">${lp.ctaClicks}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: var(--fg-tertiary);">Scroll</div>
            <div style="font-size: 20px; font-weight: 700;">${lp.scrollDepth}%</div>
          </div>
        </div>
        
        <div style="font-size: 12px; color: var(--fg-tertiary); margin-top: 12px;">
          Created: ${new Date(lp.createdAt).toLocaleDateString()}
        </div>
        
        <button class="btn-secondary btn-full" style="margin-top: 12px;">View LivePage</button>
      </div>
    `).join('');
  }
  
  // Sequences View
  function setupSequencesView() {
    const list = $('#sequencesList');
    if (!list) return;
    
    list.innerHTML = MockData.sequences.map(seq => `
      <div style="background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-lg); margin-bottom: 16px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
          <h3 style="font-size: 18px; font-weight: 700;">${seq.name}</h3>
          <span style="padding: 4px 12px; background: ${seq.active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${seq.active ? 'var(--success)' : 'var(--error)'}; border-radius: 999px; font-size: 12px; font-weight: 600;">
            ${seq.active ? 'Active' : 'Inactive'}
          </span>
        </div>
        
        <div style="font-size: 14px; color: var(--fg-secondary); margin-bottom: 16px;">
          ${seq.steps.length} steps • Created ${new Date(seq.createdAt).toLocaleDateString()}
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${seq.steps.map((step, idx) => `
            <div style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: var(--radius-md);">
              <div style="font-weight: 700; font-size: 13px; margin-bottom: 4px;">Step ${step.stepNo} ${step.delay > 0 ? `(+${step.delay} days)` : '(Immediate)'}</div>
              <div style="font-size: 13px; color: var(--fg-tertiary);">Subject: ${step.subject}</div>
            </div>
          `).join('')}
        </div>
        
        <div style="display: flex; gap: 8px; margin-top: 16px;">
          <button class="btn-secondary">Edit</button>
          <button class="btn-secondary">Duplicate</button>
          <button class="btn-tertiary" style="color: var(--error);">Delete</button>
        </div>
      </div>
    `).join('');
  }
  
  // Enrichment View
  function setupEnrichmentView() {
    const results = $('#enrichmentResults');
    if (!results) return;
    
    results.innerHTML = `
      <div style="margin-top: 24px; background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px;">
        <h3 style="font-size: 16px; margin-bottom: 16px;">Recent Enrichments</h3>
        ${MockData.companies.slice(0, 3).map(company => `
          <div style="padding: 16px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: var(--radius-md); margin-bottom: 12px;">
            <div style="font-weight: 700; margin-bottom: 8px;">${company.name}</div>
            <div style="font-size: 13px; color: var(--fg-secondary); margin-bottom: 8px;">
              ${company.domain} • ${company.industry} • ${company.size} employees
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${company.techStack.slice(0, 5).map(tech => `
                <span style="padding: 2px 8px; background: rgba(96,165,250,0.15); border: 1px solid rgba(96,165,250,0.4); border-radius: 4px; font-size: 11px;">${tech}</span>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
  
  // Dashboard
  function setupDashboard() {
    // Already rendered in HTML, stats are static for demo
  }
  
  // Settings
  function setupSettings() {
    $('#editIjpBtn')?.addEventListener('click', openIJPModal);
  }
  
  // IJP Modal
  function openIJPModal() {
    openModal('ijpModal');
    // Would render wizard steps here
    showToast('IJP Wizard coming soon!');
  }
  
  // Modal Management
  function openModal(modalId) {
    const modal = $(`#${modalId}`);
    const backdrop = $('#modalBackdrop');
    if (modal && backdrop) {
      backdrop.classList.remove('hidden');
      modal.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  }
  
  function closeModal(modalId) {
    const modal = $(`#${modalId}`);
    const backdrop = $('#modalBackdrop');
    if (modal && backdrop) {
      modal.classList.add('hidden');
      backdrop.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }
  
  // Modal close handlers
  $$('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.dataset.modal;
      if (modalId) {
        closeModal(modalId);
      }
    });
  });
  
  $('#modalBackdrop').addEventListener('click', () => {
    $$('.modal').forEach(modal => modal.classList.add('hidden'));
    $('#modalBackdrop').classList.add('hidden');
    document.body.style.overflow = '';
  });
  
  // Toast
  function showToast(message, duration = 3000) {
    const toast = $('#toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  }
  
  window.handleJobAction = handleJobAction;
  
  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
