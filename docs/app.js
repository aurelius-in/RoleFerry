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
    if (spinner) spinner.classList.remove('hidden');
  }
  function hideSpinner(){
    const elapsed = Date.now() - spinStart;
    const remaining = Math.max(0, 1000 - elapsed);
    spinTimer = setTimeout(()=>{ if (spinner) spinner.classList.add('hidden'); }, remaining);
    // absolute watchdog to avoid stuck state
    setTimeout(()=>{ if (spinner) spinner.classList.add('hidden'); }, Math.max(remaining, 1200));
  }

  // Theme toggle (dark <-> light with icon swap)
  $('#themeBtn').addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light');
    // swap icon
    $('#themeBtn').textContent = isLight ? '☀️' : '🌙';
  });

  // Ask
  $('#askBtn').addEventListener('click', () => {
    const val = $('#askInput').value.trim();
    $('#askOut').textContent = val ? `Answer: (demo) “${val}” received. Try Data → Campaigns.` : 'Please type something to ask.';
  });

  // Leads mock data and UI wiring
  const LEADS = {
    prospects: [],
    run(payload){
      const domains = payload.domains.slice(0, 10);
      const results = domains.map((d,i)=>{
        const yes = i % 2 === 0;
        const decision = yes ? 'yes' : (i % 3 === 0 ? 'maybe' : 'no');
        const score = yes ? 92 - (i%5) : (decision==='maybe'? 70: '')
        return {
          domain: d,
          name: yes? 'Jordan Example' : 'Alex Example',
          title: yes? 'CEO' : 'Head of Talent',
          linkedin_url: `https://www.linkedin.com/in/${d.replace(/\./g, '-')}-${yes?'ceo':'talent'}`,
          decision,
          reason: yes? `Likely decision maker for ${payload.role_query}` : 'Needs review',
          email: yes? `jordan@${d}` : '',
          verification_status: yes? 'valid' : (decision==='maybe' ? 'unknown' : 'invalid'),
          verification_score: score,
          cost_usd: (0.05 + (i%3)*0.01).toFixed(2)
        };
      });
      this.prospects = results;
      return {
        ok: true,
        summary: { avg_cost_per_qualified: 0.06, steps: { serper:{count:domains.length}, gpt:{count:domains.length}, findymail:{count:Math.ceil(domains.length/2)}, neverbounce:{count:Math.ceil(domains.length/2)} } },
        results
      };
    },
    compare(){ return { per_lead: { roleferry: 0.0625, clay: 0.25 } } }
  };

  function renderLeadsTable(rows){
    const columns = ['domain','name','title','decision','email','verification_status','verification_score','cost_usd'];
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ['Domain','Prospect','Title','Decision','Email','Verification','Score','Cost $'].forEach(h=>{ const th=document.createElement('th'); th.textContent=h; trh.appendChild(th); });
    thead.appendChild(trh); table.appendChild(thead);
    const tbody = document.createElement('tbody');
    rows.forEach(r=>{
      const tr = document.createElement('tr');
      const cells = [r.domain, r.name, r.title, r.decision, r.email || '—', r.verification_status || '', r.verification_score || '', `$${Number(r.cost_usd||0).toFixed(2)}`];
      cells.forEach((c,idx)=>{ const td=document.createElement('td');
        if (idx===3){ const span=document.createElement('span'); span.textContent = (r.decision==='yes'?'✅ yes':(r.decision==='no'?'❌ no':'❔ maybe')); span.title = r.reason || ''; td.appendChild(span); }
        else if (idx===5){ const span=document.createElement('span'); span.textContent = String(c||''); span.title = r.verification_status ? `Status: ${r.verification_status}${r.verification_score ? ', Score ' + r.verification_score : ''}` : ''; td.appendChild(span); }
        else { td.textContent = String(c||''); }
        tr.appendChild(td); });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
  }

  function setupLeads(){
    const csv = $('#csvInput');
    const role = $('#roleInput');
    const temp = $('#tempSlider');
    const tempVal = $('#tempVal');
    const runBtn = $('#runBtn');
    const compareBtn = $('#compareBtn');
    const sheetsBtn = $('#sheetsBtn');
    const avgCostCard = $('#avgCostCard');
    const compareCard = $('#compareCard');
    const tableWrap = $('#leadsTableWrap');
    temp.addEventListener('input', ()=>{ tempVal.textContent = Number(temp.value).toFixed(2); });
    sheetsBtn.addEventListener('click', ()=>{
      csv.value = ['domain','acme.com','globex.com','initech.com','umbrella.com','soylent.com'].join('\n');
    });
    runBtn.addEventListener('click', ()=>{
      const domains = csv.value.split(/\r?\n/).map(l=>l.trim()).filter(Boolean).filter(l=>!l.toLowerCase().includes('domain'));
      const res = LEADS.run({ domains, role_query: role.value, temperature: Number(temp.value)});
      showToast(`Imported ${Math.max(1, domains.length)} leads`);
      avgCostCard.style.display='block';
      avgCostCard.textContent = `Avg cost per qualified prospect (last run): $${Number(res.summary.avg_cost_per_qualified).toFixed(4)}`;
      tableWrap.innerHTML='';
      tableWrap.appendChild(renderLeadsTable(res.results.map(r=>({
        domain:r.domain,
        name:r.name,
        title:r.title,
        decision:r.decision,
        email:r.email,
        verification_status:r.verification_status,
        verification_score:r.verification_score,
        cost_usd:r.cost_usd,
      })));
    });
    compareBtn.addEventListener('click', ()=>{
      const c = LEADS.compare();
      compareCard.style.display='block';
      compareCard.textContent = `Cost per qualified lead (est): RoleFerry $${c.per_lead.roleferry.toFixed(4)} vs Benchmark $${c.per_lead.clay.toFixed(2)}`;
    });
    // Exports
    $('#exportInstantly').addEventListener('click', ()=>{
      const headers = ['email','first_name','last_name','company','title','linkedin_url','domain','decision','reason','verification_status','verification_score'];
      const rows = LEADS.prospects.filter(p=>p.email).map(p=>[
        p.email, p.name.split(' ')[0]||'', p.name.split(' ').slice(-1)[0]||'', p.domain.split('.')[0], p.title, p.linkedin_url, p.domain, p.decision, p.reason||'', p.verification_status||'', p.verification_score||''
      ]);
      const csv = [headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
      const blob = new Blob([csv], {type:'text/csv'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'instantly.csv'; a.click();
    });
    $('#exportFull').addEventListener('click', ()=>{
      const headers = ['domain','name','title','linkedin_url','decision','email','verification_status','verification_score','cost_usd'];
      const rows = LEADS.prospects.map(p=>[p.domain,p.name,p.title,p.linkedin_url,p.decision,p.email||'',p.verification_status||'',p.verification_score||'',p.cost_usd||'']);
      const csv = [headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
      const blob = new Blob([csv], {type:'text/csv'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'prospects.csv'; a.click();
    });
  }
  // Enrichment mock
  const ENRICH = {
    data: [
      { domain: 'scramjet.ai', company:'Scramjet AI', tech: ['React','Node','Vercel','HubSpot','PostHog'], signals:['Hiring AE','Launched AI feature Aug 2025','Uses HubSpot'], contacts:[{name:'Maya Chen', title:'Head of Growth', email:'maya@scramjet.ai', verified:true},{name:'Tom Álvarez', title:'RevOps Manager', email:'tom@scramjet.ai', verified:false}], freshness:'2d ago', cost: 0.08 },
      { domain: 'lumenlytics.io', company:'LumenLytics', tech: ['Next.js','Node','Snowflake','HubSpot'], signals:['Hiring Data AE','Outbound activity'], contacts:[{name:'Samir Patel', title:'Head of Sales', email:'samir@lumenlytics.io', verified:true}], freshness:'4d ago', cost: 0.07 },
      { domain: 'northforge.co', company:'NorthForge', tech: ['.NET','Azure','Salesforce'], signals:['Manufacturing'], contacts:[{name:'Chris Nolan', title:'Plant Ops', email:'', verified:false}], freshness:'7d ago', cost: 0.05 }
    ]
  };

  function renderEnrichment(){
    const wrap = $('#enrichTableWrap'); wrap.innerHTML='';
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ['Domain','Company','Tech Stack','Signals','Contacts (F/V)','Freshness','Cost'].forEach(h=>{ const th=document.createElement('th'); th.textContent=h; trh.appendChild(th); });
    thead.appendChild(trh); table.appendChild(thead);
    const tbody = document.createElement('tbody');
    ENRICH.data.forEach(row => {
      const tr = document.createElement('tr');
      tr.className = 'fade-in';
      const contactsFound = row.contacts.length;
      const verified = row.contacts.filter(c=>c.verified).length;
      const cells = [row.domain, row.company, '', '', `${contactsFound}/${verified}`, row.freshness, `$${row.cost.toFixed(2)}`];
      cells.forEach((c, idx) => {
        const td = document.createElement('td');
        if (idx === 2) { row.tech.forEach(t=>{ const s=document.createElement('span'); s.className='chip'; s.textContent=t; td.appendChild(s); }); }
        else if (idx === 3) { row.signals.forEach(sg=>{ const s=document.createElement('span'); s.className='chip'; s.textContent=sg; td.appendChild(s); }); }
        else { td.textContent = String(c||''); }
        tr.appendChild(td);
      });
      tr.style.cursor='pointer';
      tr.addEventListener('click', ()=>{
        const profile = $('#enrichProfile');
        profile.innerHTML = `
          <div class="small"><strong>${row.company}</strong> — ${row.domain}</div>
          <div class="small">Tech: ${row.tech.join(', ')}</div>
          <div class="small">Signals: ${row.signals.join(', ')}</div>
          <div class="small">Contacts:</div>
          ${row.contacts.map(c=>`<div class="small">• ${c.name} — ${c.title} — ${c.email||'no email'} ${c.verified?'(verified)':''}</div>`).join('')}
          <div class="small">Enrichment Cost (mock): $${row.cost.toFixed(2)}</div>
        `;
        openModal($('#enrichDrawer'));
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
  }

  // Qualification mock
  const QUAL = {
    rows: [
      { company:'Scramjet AI', score:86, why:['SaaS','HubSpot present','Hiring AE','Recent AI launch'], priority:'High' },
      { company:'LumenLytics', score:73, why:['Analytics','Outbound tooling','Recent growth postings'], priority:'Medium' },
      { company:'NorthForge', score:41, why:['Manufacturing','Weak outbound signals'], priority:'Low' },
    ]
  };
  function renderQualification(){
    const wrap = $('#qualTableWrap'); wrap.innerHTML='';
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    ['Company','Fit Score','Why It Fits','Priority','Action'].forEach(h=>{ const th=document.createElement('th'); th.textContent=h; trh.appendChild(th); });
    thead.appendChild(trh); table.appendChild(thead);
    const tbody = document.createElement('tbody');
    QUAL.rows.forEach(r=>{
      const tr = document.createElement('tr'); tr.className='fade-in';
      const tdCompany = document.createElement('td'); tdCompany.textContent = r.company; tr.appendChild(tdCompany);
      const tdScore = document.createElement('td'); tdScore.innerHTML = `<div class="progress" title="${r.score}"><div style="width:${r.score}%"></div></div>`; tr.appendChild(tdScore);
      const tdWhy = document.createElement('td'); tdWhy.textContent = r.why.join(', '); tr.appendChild(tdWhy);
      const tdPri = document.createElement('td'); tdPri.textContent = r.priority; tr.appendChild(tdPri);
      const tdAct = document.createElement('td'); const btn=document.createElement('button'); btn.className='btn'; btn.textContent='Generate Copy'; btn.onclick=()=>showToast('Generated 3 variants'); tdAct.appendChild(btn); tr.appendChild(tdAct);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody); wrap.appendChild(table);
  }

  // Toast
  function showToast(msg){ const t=$('#toast'); t.textContent=msg; t.style.display='block'; setTimeout(()=>{ t.style.display='none'; }, 1500); }

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

  // Mock CRM board data
  const CRM = {
    lanes: [
      { key: 'people', title: 'People', items: Array.from({length: 6}).map((_,i)=>({ name:`Alex ${i}`, title:i%2?'Recruiter':'Director of Product', company:`Acme ${i%3}`, last:'2d', next:'Intro email' })) },
      { key: 'conversation', title: 'Conversation', items: Array.from({length: 5}).map((_,i)=>({ name:`Jordan ${i}`, title:'VP Product', company:`Globex ${i%2}`, last:'1d', next:'Send recap' })) },
      { key: 'meeting', title: 'Meeting', items: Array.from({length: 3}).map((_,i)=>({ name:`Taylor ${i}`, title:'Hiring Manager', company:`Initech`, last:'3h', next:'Book follow-up' })) },
      { key: 'deal', title: 'Deal', items: Array.from({length: 2}).map((_,i)=>({ name:`Morgan ${i}`, title:'CTO', company:`Umbrella`, last:'5d', next:'Send offer bundle' })) },
    ]
  };

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
    ['#home','#dashboard','#analytics','#crm','#leads','#enrichment','#qualification'].forEach(tag=>{
      const id = tag.slice(1)+'View';
      const node = document.getElementById(id); if (node) node.classList.remove('active');
    });
    if (h === '#about') {
      renderAboutModal(); openModal($('#aboutModal'));
      return;
    }
    if (h.startsWith('#data/')) {
      const label = decodeURIComponent(h.slice(6));
      showDataPage(label);
      return;
    }
    hideDataPage();
    const viewId = (h.replace('#','')+'View');
    const viewEl = document.getElementById(viewId);
    if (viewEl) {
      showSpinner(); setTimeout(()=>{
        viewEl.classList.add('active');
        // Render per-view extras
        if (viewId === 'crmView') {
          renderCRMBoard();
        } else if (viewId === 'analyticsView') {
          renderAnalytics();
        } else if (viewId === 'leadsView') {
          setupLeads();
        } else if (viewId === 'enrichmentView') {
          renderEnrichment();
          $('#enrichRun').onclick = ()=>{ showToast('Enrichment complete'); renderEnrichment(); };
          $('#enrichRecipes').onclick = ()=>{ showToast('Recipes: Company Basics, Tech Stack, Signals, Contacts'); };
          $('#enrichClose').onclick = ()=> closeModal($('#enrichDrawer'));
        } else if (viewId === 'qualificationView') {
          renderQualification();
        }
        hideSpinner();
      }, 150);
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
        <div class="list" id="toolsList"></div>
      </div>
    `;
    el.appendChild(panel);
    panel.querySelector('#toolsClose').addEventListener('click', ()=>closeModal(el));

    const list = panel.querySelector('#toolsList');
    const items = [
      { label: 'Reply Classifier', target: '#analytics' },
      { label: 'Warm Angles', target: '#data/Warm%20Angles' },
      { label: 'One‑pager Generator', target: '#data/One%E2%80%91pagers' },
      { label: 'Deliverability', target: '#data/Deliverability' },
      { label: 'Compliance', target: '#data/Compliance' },
      { label: 'Audit Log', target: '#data/Audit%20Log' },
      { label: 'Messages', target: '#data/Messages' },
      { label: 'Onboarding', target: '#data/Onboarding' },
      { label: 'Lead‑Qual (Demo)', target: '#data/Contacts' },
    ];
    items.forEach(it => {
      const btn = document.createElement('button');
      btn.className = 'px-3 py-2 rounded bg-white/10 hover:bg-white/15';
      btn.textContent = it.label;
      btn.addEventListener('click', () => {
        closeModal(el);
        location.hash = it.target;
      });
      list.appendChild(btn);
    });
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

  // About modal (matches app About page)
  function renderAboutModal(){
    const el = $('#aboutModal');
    el.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <div class="head">
        <div class="title">About</div>
        <button class="icon-btn" id="aboutClose">✕</button>
      </div>
      <div class="body">
        <div class="about-content">
          <div class="about-cards">
            <h1 class="about-h1">About <span class="brand-r">Role</span><span class="brand-f">Ferry</span></h1>
            <p class="about-lead">
              RoleFerry is the result of a creative partnership between two business owners—<strong>Dave March</strong> and <strong>Oliver Ellison</strong>—working together across their companies to bring a modern, relationship‑first outreach experience to life.
            </p>
            <div class="about-grid">
              <div class="about-card">
                <h2 class="about-h2">Dave March · Innovative Marketing Solutions</h2>
                <p class="about-text">Dave focuses on career coaching and end‑to‑end talent sourcing—helping candidates and teams align on the work that matters. His perspective shapes the practical workflows, from sourcing through outreach and interviews.</p>
              </div>
              <div class="about-card">
                <h2 class="about-h2">Oliver Ellison · Reliable AI Network, LLC</h2>
                <p class="about-text">Oliver leads innovation in AI‑driven solutions for diverse business use cases. His product and engineering work powers RoleFerry’s generation, verification, and analytics capabilities.</p>
              </div>
            </div>
          </div>
          <div>
            <img class="about-img" src="assets/about.png" alt="Dave and Oliver skydiving" />
            <div class="small" style="margin-top:8px;"><a class="link" href="https://github.com/aurelius-in/RoleFerry/blob/develop/README.md" target="_blank" rel="noopener noreferrer">License & Notices</a></div>
          </div>
        </div>

      </div>
    `;
    el.appendChild(panel);
    panel.querySelector('#aboutClose').addEventListener('click', ()=>{ closeModal(el); if (location.hash === '#about') location.hash = '#'; });
  }
  document.getElementById('aboutFooterBtn').addEventListener('click', ()=>{ location.hash = '#about'; });
  document.getElementById('aboutBtn').addEventListener('click', ()=>{ location.hash = '#about'; });

  // Close on backdrop click
  backdrop.addEventListener('click', ()=>{
    ['#dataModal','#toolsModal','#settingsModal'].forEach(sel=>{
      const node = $(sel); if (!node.classList.contains('hidden')) closeModal(node);
    });
  });

  // Dashboard tile clicks → navigate to target views (no accidental #)
  document.addEventListener('click', (e)=>{
    const t = e.target;
    if (!(t instanceof Element)) return;
    const tile = t.closest('.tile');
    if (!tile) return;
    const label = tile.querySelector('.label')?.textContent || '';
    if (label.includes('Sequence')) location.hash = '#data/Sequence%20Rows';
    else if (label.includes('Outreach')) location.hash = '#data/Messages';
    else if (label.includes('Verify')) location.hash = '#data/Deliverability';
    else if (label.includes('Contacts')) location.hash = '#data/Contacts';
    else if (label.includes('Offers')) location.hash = '#data/Offers';
    else if (label.includes('Jobs')) location.hash = '#data/Jobs';
    else if (label.includes('Candidate')) location.hash = '#data/Candidates';
    else if (label.includes('Match')) location.hash = '#data/Matches';
    else location.hash = '#data/IJPs';
  });

  // Analytics render (bar chart + table)
  function renderAnalytics(){
    const wrap = $('#analyticsTableWrap');
    wrap.innerHTML = '';
    const data = MOCK['Campaigns'];
    // Table (limit rows for readability)
    wrap.appendChild(renderTable({ columns: data.columns, rows: data.rows.slice(0, 10) }));

    // Bar chart in #analyticsChart
    const chart = $('#analyticsChart');
    chart.innerHTML = '';
    const w = chart.clientWidth || 900;
    const h = chart.clientHeight || 180;
    const padding = { l: 40, r: 10, t: 10, b: 24 };
    const innerW = Math.max(100, w - padding.l - padding.r);
    const innerH = Math.max(60, h - padding.t - padding.b);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');

    const values = data.rows.slice(0, 10).map(r => Number(r.open_rate) || 0);
    const maxV = Math.max(10, Math.max(...values));
    const barW = innerW / values.length;

    // y axis ticks (0, max)
    const y0 = document.createElementNS(svg.namespaceURI, 'text');
    y0.setAttribute('x', String(4));
    y0.setAttribute('y', String(h - padding.b));
    y0.setAttribute('fill', 'rgba(230,237,247,0.7)');
    y0.setAttribute('font-size', '10');
    y0.textContent = '0%';
    svg.appendChild(y0);
    const yMax = document.createElementNS(svg.namespaceURI, 'text');
    yMax.setAttribute('x', String(4));
    yMax.setAttribute('y', String(padding.t + 10));
    yMax.setAttribute('fill', 'rgba(230,237,247,0.7)');
    yMax.setAttribute('font-size', '10');
    yMax.textContent = `${maxV}%`;
    svg.appendChild(yMax);

    // gradient (declare BEFORE bars for widest browser support)
    const defs = document.createElementNS(svg.namespaceURI, 'defs');
    const lg = document.createElementNS(svg.namespaceURI, 'linearGradient');
    lg.setAttribute('id', 'grad');
    lg.setAttribute('x1', '0'); lg.setAttribute('y1', '0'); lg.setAttribute('x2', '0'); lg.setAttribute('y2', '1');
    const stop1 = document.createElementNS(svg.namespaceURI, 'stop'); stop1.setAttribute('offset', '0%'); stop1.setAttribute('stop-color', '#ff7a18');
    const stop2 = document.createElementNS(svg.namespaceURI, 'stop'); stop2.setAttribute('offset', '100%'); stop2.setAttribute('stop-color', '#ffd25a');
    lg.appendChild(stop1); lg.appendChild(stop2);
    defs.appendChild(lg); svg.appendChild(defs);

    values.forEach((v, i) => {
      const barH = (v / maxV) * innerH;
      const x = padding.l + i * barW + 4;
      const y = padding.t + (innerH - barH);
      const rect = document.createElementNS(svg.namespaceURI, 'rect');
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', String(y));
      rect.setAttribute('width', String(Math.max(6, barW - 8)));
      rect.setAttribute('height', String(Math.max(2, barH)));
      rect.setAttribute('fill', 'url(#grad)');
      rect.setAttribute('rx', '3');
      rect.setAttribute('ry', '3');
      svg.appendChild(rect);

      // label every 2 bars
      if (i % 2 === 0) {
        const t = document.createElementNS(svg.namespaceURI, 'text');
        t.setAttribute('x', String(x + Math.max(6, barW - 8) / 2));
        t.setAttribute('y', String(h - 6));
        t.setAttribute('fill', 'rgba(230,237,247,0.7)');
        t.setAttribute('font-size', '10');
        t.setAttribute('text-anchor', 'middle');
        t.textContent = `${v}%`;
        svg.appendChild(t);
      }
    });
    // baseline
    const base = document.createElementNS(svg.namespaceURI, 'line');
    base.setAttribute('x1', String(padding.l));
    base.setAttribute('y1', String(padding.t + innerH + 0.5));
    base.setAttribute('x2', String(padding.l + innerW));
    base.setAttribute('y2', String(padding.t + innerH + 0.5));
    base.setAttribute('stroke', 'rgba(230,237,247,0.25)');
    base.setAttribute('stroke-width', '1');
    svg.appendChild(base);

    chart.appendChild(svg);
  }

  // CRM board render
  function renderCRMBoard(){
    const board = $('#crmBoard');
    board.innerHTML = '';
    CRM.lanes.forEach(l => {
      const lane = document.createElement('div');
      lane.className = 'lane';
      lane.innerHTML = `<div class="lane-head">${l.title}</div><div class="lane-body"></div>`;
      const body = lane.querySelector('.lane-body');
      l.items.forEach(it => {
        const c = document.createElement('div');
        c.className = 'card-sm';
        c.innerHTML = `<div><strong>${it.name}</strong> — ${it.title}</div><div class="small">${it.company}</div><div class="small">Last: ${it.last} · Next: ${it.next}</div>`;
        body.appendChild(c);
      });
      board.appendChild(lane);
    });
  }
})();
