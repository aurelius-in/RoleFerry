(function(){
  const $ = (s) => document.querySelector(s);
  const backdrop = $('#modalBackdrop');
  const openModal = (node) => { backdrop.classList.remove('hidden'); node.classList.remove('hidden'); document.body.style.overflow='hidden'; };
  const closeModal = (node) => { node.classList.add('hidden'); backdrop.classList.add('hidden'); document.body.style.overflow=''; };

  // Theme toggle
  $('#themeBtn').addEventListener('click', () => {
    document.body.classList.toggle('dark');
  });

  // Ask
  $('#askBtn').addEventListener('click', () => {
    const val = $('#askInput').value.trim();
    $('#askOut').textContent = val ? `Answer: (demo) “${val}” received. Try Data → Campaigns.` : 'Please type something to ask.';
  });

  // Data modal (mock tables)
  const dataItems = [
    { label: 'Messages' },
    { label: 'Sequence Rows' },
    { label: 'Campaigns' },
    { label: 'One‑pagers' },
    { label: 'Warm Angles' },
    { label: 'Audit Log' },
    { label: 'Onboarding' },
    { label: 'Deliverability' },
    { label: 'Compliance' }
  ];
  function renderDataModal(){
    const el = $('#dataModal');
    el.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="head">
        <div class="title">Data</div>
        <button class="icon-btn" id="dataClose">✕</button>
      </div>
      <div class="body">
        <div class="list" id="dataList"></div>
      </div>
    `;
    el.appendChild(panel);
    const list = panel.querySelector('#dataList');
    dataItems.forEach(d => {
      const a = document.createElement('a');
      a.href = '#';
      a.textContent = d.label;
      a.addEventListener('click', (e)=>{
        e.preventDefault();
        alert(`Showing mock ${d.label}`);
      });
      list.appendChild(a);
    });
    panel.querySelector('#dataClose').addEventListener('click', ()=>closeModal(el));
  }
  $('#dataBtn').addEventListener('click', ()=>{ renderDataModal(); openModal($('#dataModal')); });

  // Tools modal
  function renderToolsModal(){
    const el = $('#toolsModal');
    el.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="head">
        <div class="title">Tools</div>
        <button class="icon-btn" id="toolsClose">✕</button>
      </div>
      <div class="body">
        <div class="list">
          <a href="#">Reply Classifier</a>
          <a href="#">Warm Angles</a>
          <a href="#">One‑pager Generator</a>
          <a href="#">Deliverability</a>
          <a href="#">Compliance</a>
          <a href="#">Audit Log</a>
          <a href="#">Messages</a>
          <a href="#">Onboarding</a>
          <a href="/api/health" target="_blank">Health</a>
        </div>
      </div>
    `;
    el.appendChild(panel);
    panel.querySelector('#toolsClose').addEventListener('click', ()=>closeModal(el));
  }
  $('#toolsBtn').addEventListener('click', ()=>{ renderToolsModal(); openModal($('#toolsModal')); });

  // Settings modal (placeholder)
  function renderSettingsModal(){
    const el = $('#settingsModal');
    el.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="head">
        <div class="title">Settings</div>
        <button class="icon-btn" id="settingsClose">✕</button>
      </div>
      <div class="body">Demo settings panel.</div>
    `;
    el.appendChild(panel);
    panel.querySelector('#settingsClose').addEventListener('click', ()=>closeModal(el));
  }
  $('#settingsBtn').addEventListener('click', ()=>{ renderSettingsModal(); openModal($('#settingsModal')); });

  // Close on backdrop click
  backdrop.addEventListener('click', ()=>{
    ['#dataModal','#toolsModal','#settingsModal'].forEach(sel=>{
      const node = $(sel); if (!node.classList.contains('hidden')) closeModal(node);
    });
  });
})();
