
(() => {
  const menuBtn = document.querySelector('.menu-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  menuBtn?.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.textContent = open ? '×' : '☰';
  });

  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

  const params = new URLSearchParams(location.search);
  const campaign = {};
  ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid'].forEach(k => {
    if (params.get(k)) campaign[k] = params.get(k);
  });
  sessionStorage.setItem('ntaCampaign', JSON.stringify({...JSON.parse(sessionStorage.getItem('ntaCampaign')||'{}'), ...campaign}));

  document.querySelectorAll('[data-multistep]').forEach(form => {
    const steps = [...form.querySelectorAll('.form-step')];
    const bars = [...form.querySelectorAll('.progress span')];
    let index = 0;
    const render = () => {
      steps.forEach((s,i)=>s.classList.toggle('active', i===index));
      bars.forEach((b,i)=>b.classList.toggle('active', i<=index));
      form.querySelector('.form-step.active input, .form-step.active select, .form-step.active textarea')?.focus({preventScroll:true});
      form.scrollIntoView({behavior:'smooth',block:'start'});
    };
    form.addEventListener('click', e => {
      const next = e.target.closest('[data-next]');
      const prev = e.target.closest('[data-prev]');
      if(next){
        const current = steps[index];
        const required = [...current.querySelectorAll('[required]')];
        const invalid = required.find(el => !el.checkValidity());
        if(invalid){ invalid.reportValidity(); return; }
        index = Math.min(steps.length-1,index+1); render();
      }
      if(prev){ index = Math.max(0,index-1); render(); }
    });
  });

  async function secureUpload(file, leadId, docType){
    const r = await fetch('/api/carriers/upload-url', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({leadId, docType, fileName:file.name, contentType:file.type, size:file.size})
    });
    if(!r.ok) throw new Error('Secure upload authorization failed');
    const {uploadUrl, storageKey} = await r.json();
    const put = await fetch(uploadUrl, {method:'PUT', body:file, headers:{'Content-Type':file.type}});
    if(!put.ok) throw new Error('Secure document upload failed');
    return storageKey;
  }

  document.querySelectorAll('form[data-lead-form]').forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const status = form.querySelector('.status');
      const fd = new FormData(form);
      const endpoint = form.dataset.endpoint;
      const type = form.dataset.leadForm;
      const payload = Object.fromEntries([...fd.entries()].filter(([k,v]) => !(v instanceof File)));
      payload.meta = {
        submitted_at:new Date().toISOString(),
        lead_type:type,
        originating_page:location.pathname,
        referrer:document.referrer || null,
        campaign:JSON.parse(sessionStorage.getItem('ntaCampaign')||'{}')
      };
      try{
        status.className='status show'; status.textContent='Submitting…';
        const create = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        if(!create.ok) throw new Error('Submission failed');
        const result = await create.json().catch(()=>({}));
        if(type==='carrier'){
          const leadId = result.leadId;
          if(!leadId) throw new Error('Carrier record was created without a secure upload identifier');
          const uploads = {};
          for(const input of form.querySelectorAll('input[type="file"]')){
            if(input.files[0]) uploads[input.name] = await secureUpload(input.files[0],leadId,input.name);
          }
          if(Object.keys(uploads).length){
            const attach = await fetch('/api/carriers/attach-documents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({leadId,uploads})});
            if(!attach.ok) throw new Error('Documents uploaded but could not be attached to the application');
          }
        }
        status.className='status show success';
        status.textContent='Thank you. Your information has been received and NTA Logistics can follow up using your preferred contact method.';
        form.reset();
      }catch(err){
        status.className='status show error';
        status.textContent='This demo package is ready for backend integration, but the production API endpoint is not connected yet. Your information was not sent.';
      }
    });
  });

  const postsRoot=document.querySelector('[data-blog-posts]');
  if(postsRoot){
    fetch('content/posts.json').then(r=>r.json()).then(posts=>{
      postsRoot.innerHTML=posts.map(p=>`
      <article class="post-card">
        <div class="thumb">${p.category}</div>
        <div class="body"><small>${p.category} · ${p.publish_date}</small><h3>${p.title}</h3><p>${p.excerpt}</p><a href="${p.slug}.html">Read article →</a></div>
      </article>`).join('');
    }).catch(()=>{});
  }
})();
