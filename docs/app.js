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
      a.href = `#data/${encodeURIComponent(d.label)}`;
      a.textContent = d.label;
      a.addEventListener('click', ()=>{ closeModal(el); });
      list.appendChild(a);
    });
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
    const h = location.hash;
    if (h.startsWith('#data/')) {
      const label = decodeURIComponent(h.slice(6));
      hideDataPage(); showDataPage(label);
    } else {
      hideDataPage();
    }
  });
  // Initial route
  if (location.hash.startsWith('#data/')) {
    const label = decodeURIComponent(location.hash.slice(6));
    showDataPage(label);
  }

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
