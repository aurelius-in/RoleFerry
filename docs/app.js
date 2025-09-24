(function(){
  const $ = (s) => document.querySelector(s);
  const backdrop = $('#modalBackdrop');
  const spinner = $('#spinner');
  const openModal = (node) => { backdrop.classList.remove('hidden'); node.classList.remove('hidden'); document.body.style.overflow='hidden'; };
  const closeModal = (node) => { node.classList.add('hidden'); backdrop.classList.add('hidden'); document.body.style.overflow=''; };

  // Spinner with minimum 1s
  let spinTimer = null; let spinStart = 0;
  function showSpinner(){
    if (spinTimer) clearTimeout(spinTimer);
    spinStart = Date.now();
    spinner.classList.remove('hidden');
  }
  function hideSpinner(){
    const elapsed = Date.now() - spinStart;
    const remaining = Math.max(0, 1000 - elapsed);
    spinTimer = setTimeout(()=>{ spinner.classList.add('hidden'); }, remaining);
    // absolute watchdog to avoid stuck state
    setTimeout(()=>{ spinner.classList.add('hidden'); }, Math.max(remaining, 1200));
  }

  // Theme toggle
  $('#themeBtn').addEventListener('click', () => {
    document.body.classList.toggle('dark');
  });

  // Ask
  $('#askBtn').addEventListener('click', () => {
    const val = $('#askInput').value.trim();
    $('#askOut').textContent = val ? `Answer: (demo) “${val}” received. Try Data → Campaigns.` : 'Please type something to ask.';
  });

  // Extensive mock datasets
  const MOCK = {
    Messages: {
      columns: ['id','contact','variant','subject','opened','replied'],
      rows: Array.from({length: 30}).map((_,i)=>({ id: `m_${100+i}`, contact: `user${i}@example.com`, variant: i%2?'B':'A', subject: `Subject ${i}`, opened: i%3===0, replied: i%5===0 }))
    },
    'Sequence Rows': {
      columns: ['email','first_name','last_name','company','title','match_score','verification_status'],
      rows: Array.from({length: 40}).map((_,i)=>({ email:`p${i}@corp.com`, first_name:`First${i}`, last_name:`Last${i}`, company:`Corp${i%7}`, title:i%2?"Recruiter":"Director of Product", match_score: 60+(i%41), verification_status: ['valid','accept_all','invalid'][i%3] }))
    },
    Campaigns: {
      columns: ['name','delivered','open_rate','reply_rate','positive'],
      rows: Array.from({length: 12}).map((_,i)=>({ name:`Campaign ${i+1}`, delivered: 500+i*50, open_rate: 35+(i%20), reply_rate: 5+(i%10), positive: (3+(i%7)).toFixed(1) }))
    },
    'One‑pagers': {
      columns: ['id','owner','type','title','url'],
      rows: Array.from({length: 10}).map((_,i)=>({ id:`op_${i+1}`, owner:`Candidate#${10+i}`, type: ['deck','pdf'][i%2], title:`Proof Sheet ${i+1}`, url:`https://example.com/op/${i+1}` }))
    },
    'Warm Angles': {
      columns: ['contact','type','note'],
      rows: Array.from({length: 20}).map((_,i)=>({ contact:`warm${i}@example.com`, type:['mutual','alma_mater','recent_post','podcast_mention','product_news'][i%5], note:`Angle note ${i}` }))
    },
    'Audit Log': {
      columns: ['id','action','timestamp'],
      rows: Array.from({length: 25}).map((_,i)=>({ id: i+1, action: ['verify_batch','export_csv','generate_copy'][i%3], timestamp: new Date(Date.now()-i*60000).toISOString() }))
    },
    Onboarding: {
      columns: ['step','status'],
      rows: [
        { step:'Connect Instantly', status:'done' },
        { step:'Add Calendly', status:'pending' },
        { step:'Create First Profile (IJP)', status:'done' },
        { step:'Verify Sample Contacts', status:'pending' },
      ]
    },
    Deliverability: {
      columns: ['mailbox','spf','dkim','dmarc'],
      rows: [
        { mailbox:'outreach@roleferry.com', spf:true, dkim:true, dmarc:'p=none' },
        { mailbox:'hello@roleferry.com', spf:true, dkim:true, dmarc:'p=quarantine' },
      ]
    },
    Compliance: {
      columns: ['region','opt_outs','dnc'],
      rows: [
        { region:'US', opt_outs:3, dnc:1 },
        { region:'EU', opt_outs:1, dnc:0 },
      ]
    },
    'IJPs': {
      columns: ['id','titles','levels','locations','skills_must'],
      rows: Array.from({length: 15}).map((_,i)=>({ id:`ijp_${i+1}`, titles:'PM, Sr PM', levels:i%2?'Senior':'Mid', locations: i%3? 'Remote':'SF', skills_must: 'PLG, SQL'}))
    },
    Jobs: {
      columns: ['id','title','company','location','jd_url'],
      rows: Array.from({length: 25}).map((_,i)=>({ id:`job_${i+1}`, title: i%2?'Senior PM':'Growth PM', company:`Acme ${i%6}`, location: i%3?'Remote':'NYC', jd_url: `https://indeed.example.com/${i+1}` }))
    },
    Candidates: {
      columns: ['id','name','email','seniority','domains'],
      rows: Array.from({length: 20}).map((_,i)=>({ id:`cand_${i+1}`, name:`Alex ${i}`, email:`alex${i}@example.com`, seniority: i%2?'Senior':'Mid', domains: 'PLG, SaaS' }))
    },
    Contacts: {
      columns: ['id','company','name','title','email','verification_status'],
      rows: Array.from({length: 40}).map((_,i)=>({ id:`ct_${i+1}`, company:`Globex ${i%5}`, name:`Jordan ${i}`, title: i%2?'VP Product':'Recruiter', email:`j${i}@globex.com`, verification_status: ['valid','accept_all','invalid'][i%3] }))
    },
    Matches: {
      columns: ['candidate','job','score','reasons'],
      rows: Array.from({length: 18}).map((_,i)=>({ candidate:`Alex ${i}`, job:`PM @ Acme ${i%6}`, score: 70+(i%30), reasons:'PLG experience; rollout velocity' }))
    },
    Offers: {
      columns: ['id','candidate','portfolio_url','deck_url'],
      rows: Array.from({length: 10}).map((_,i)=>({ id:`off_${i+1}`, candidate:`Alex ${i}`, portfolio_url:`https://portfolio.example.com/${i+1}`, deck_url:`https://docs.example.com/deck/${i+1}` }))
    }
  };

  const dataItems = Object.keys(MOCK).map(label => ({ label }));

  // Render table helper
  function renderTable({columns, rows}){
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    columns.forEach(c=>{ const th=document.createElement('th'); th.textContent=c; trh.appendChild(th); });
    thead.appendChild(trh); table.appendChild(thead);
    const tbody = document.createElement('tbody');
    rows.forEach(r=>{
      const tr=document.createElement('tr');
      columns.forEach(c=>{ const td=document.createElement('td'); td.textContent = String(r[c] ?? ''); tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  // Data modal with preview
  function renderDataModal(){
    const el = $('#dataModal');
    el.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="head">
        <div class="title">Data</div>
        <div class="actions">
          <a id="viewFull" class="link-btn" href="#" target="_self">View full page</a>
          <button class="icon-btn" id="dataClose">✕</button>
        </div>
      </div>
      <div class="body">
        <div class="layout">
          <aside class="menu" id="dataMenu"></aside>
          <section class="content"><div id="previewWrap" class="table-wrap"></div></section>
        </div>
      </div>
    `;
    el.appendChild(panel);
    const menu = panel.querySelector('#dataMenu');
    const preview = panel.querySelector('#previewWrap');
    const viewFull = panel.querySelector('#viewFull');

    function select(label){
      menu.querySelectorAll('.item').forEach(n=>n.classList.remove('active'));
      const btn = menu.querySelector(`[data-label="${label}"]`);
      if (btn) btn.classList.add('active');
      preview.innerHTML='';
      const ds = MOCK[label];
      const subset = { columns: ds.columns, rows: ds.rows.slice(0, 8) };
      preview.appendChild(renderTable(subset));
      viewFull.setAttribute('href', `#data/${encodeURIComponent(label)}`);
    }

    dataItems.forEach(d => {
      const b = document.createElement('button');
      b.className = 'item';
      b.textContent = d.label;
      b.dataset.label = d.label;
      b.addEventListener('click', ()=> select(d.label));
      menu.appendChild(b);
    });
    // default select first
    if (dataItems[0]) select(dataItems[0].label);
    panel.querySelector('#dataClose').addEventListener('click', ()=>closeModal(el));
  }
  $('#dataBtn').addEventListener('click', ()=>{ renderDataModal(); openModal($('#dataModal')); });

  // Full-page data view (hash routing)
  function showDataPage(label){
    const page = $('#dataPage');
    const wrap = $('#dataTableWrap');
    const title = $('#dataTitle');
    title.textContent = label;
    wrap.innerHTML='';
    const dataset = MOCK[label];
    if (!dataset) { wrap.textContent = 'No data'; return; }
    showSpinner();
    setTimeout(()=>{
      wrap.appendChild(renderTable(dataset));
      hideSpinner();
    }, 200);
    page.classList.remove('hidden');
    window.scrollTo(0,0);
  }
  function hideDataPage(){ $('#dataPage').classList.add('hidden'); }
  $('#dataBack').addEventListener('click', ()=>{ history.pushState({}, '', '#'); hideDataPage(); });

  window.addEventListener('hashchange', ()=>{
    applyRoute();
  });
  // Initial route
  function applyRoute(){
    const h = location.hash || '#home';
    ['#home','#dashboard','#analytics','#crm'].forEach(tag=>{
      const id = tag.slice(1)+'View';
      const node = document.getElementById(id); if (node) node.classList.remove('active');
    });
    if (h.startsWith('#data/')) {
      const label = decodeURIComponent(h.slice(6));
      showDataPage(label);
      return;
    }
    hideDataPage();
    const viewId = (h.replace('#','')+'View');
    const viewEl = document.getElementById(viewId);
    if (viewEl) {
      showSpinner(); setTimeout(()=>{ viewEl.classList.add('active'); hideSpinner(); }, 150);
    }
  }
  applyRoute();

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
          <a href="#" target="_blank">Health</a>
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
