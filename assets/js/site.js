(() => {
  "use strict";

  const config = window.NTA_CONFIG || {};
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
  try {
    sessionStorage.setItem('ntaCampaign', JSON.stringify({
      ...JSON.parse(sessionStorage.getItem('ntaCampaign') || '{}'),
      ...campaign
    }));
  } catch {}

  document.querySelectorAll('[data-multistep]').forEach(form => {
    const steps = [...form.querySelectorAll('.form-step')];
    const bars = [...form.querySelectorAll('.progress span')];
    let index = 0;

    const render = () => {
      steps.forEach((s, i) => s.classList.toggle('active', i === index));
      bars.forEach((b, i) => b.classList.toggle('active', i <= index));
      form.querySelector('.form-step.active input:not([type="hidden"]), .form-step.active select, .form-step.active textarea')?.focus({ preventScroll: true });
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    form.addEventListener('click', e => {
      const next = e.target.closest('[data-next]');
      const prev = e.target.closest('[data-prev]');
      if (next) {
        const current = steps[index];
        const invalid = [...current.querySelectorAll('input,select,textarea')].find(el => !el.checkValidity());
        if (invalid) { invalid.reportValidity(); return; }
        index = Math.min(steps.length - 1, index + 1);
        render();
      }
      if (prev) {
        index = Math.max(0, index - 1);
        render();
      }
    });
  });

  document.querySelectorAll('[data-toggle-target]').forEach(control => {
    const target = document.querySelector(control.dataset.toggleTarget);
    if (!target) return;
    const update = () => {
      let show = control.type === 'checkbox' ? control.checked : Boolean(control.value);
      if (control.dataset.toggleInvert === 'true') show = !show;
      target.hidden = !show;
      target.querySelectorAll('input,select,textarea').forEach(el => {
        if (el.dataset.conditionalRequired === 'true') el.required = show;
      });
    };
    control.addEventListener('change', update);
    update();
  });

  function formPayload(form) {
    const fd = new FormData(form);
    const payload = {};
    for (const [key, value] of fd.entries()) {
      if (value instanceof File) continue;
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        payload[key] = `${payload[key]}, ${value}`;
      } else {
        payload[key] = value;
      }
    }
    form.querySelectorAll('input[type="checkbox"]').forEach(input => {
      if (!Object.prototype.hasOwnProperty.call(payload, input.name)) payload[input.name] = false;
      else if (input.value === 'on' || input.value === 'true') payload[input.name] = input.checked;
    });
    payload.meta = {
      submitted_at: new Date().toISOString(),
      originating_page: location.pathname,
      referrer: document.referrer || null,
      campaign: (() => { try { return JSON.parse(sessionStorage.getItem('ntaCampaign') || '{}'); } catch { return {}; } })()
    };
    return payload;
  }

  async function invoke(body) {
    if (!config.functionUrl || !config.publishableKey) throw new Error('The NTA submission service is not configured.');
    const res = await fetch(config.functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.publishableKey,
        'Authorization': `Bearer ${config.publishableKey}`
      },
      body: JSON.stringify(body)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || 'Submission failed.');
    return json;
  }

  async function uploadCarrierDocument(file, applicationId, uploadToken, documentType) {
    if (!window.NTASupabase) throw new Error('Secure upload service is unavailable.');
    const auth = await invoke({
      action: 'carrier_upload_url',
      application_id: applicationId,
      upload_token: uploadToken,
      document_type: documentType,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size
    });

    const { error } = await window.NTASupabase.storage
      .from(config.carrierBucket)
      .uploadToSignedUrl(auth.path, auth.token, file, { contentType: file.type });
    if (error) throw error;

    await invoke({
      action: 'carrier_attach_document',
      application_id: applicationId,
      upload_token: uploadToken,
      document_type: documentType,
      file_name: file.name,
      storage_path: auth.path,
      mime_type: file.type,
      file_size: file.size
    });
  }

  document.querySelectorAll('form[data-nta-action]').forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const status = form.querySelector('.status');
      const submit = form.querySelector('[type="submit"]');
      const action = form.dataset.ntaAction;
      const payload = { action, ...formPayload(form) };

      try {
        if (status) {
          status.className = 'status show';
          status.textContent = action === 'carrier_apply' ? 'Creating carrier application…' : 'Submitting…';
        }
        if (submit) submit.disabled = true;

        const result = await invoke(payload);

        if (action === 'carrier_apply') {
          const fileInputs = [...form.querySelectorAll('input[type="file"]')];
          let uploaded = 0;
          for (const input of fileInputs) {
            const files = [...input.files];
            for (const file of files) {
              if (status) status.textContent = `Uploading secure document ${uploaded + 1}…`;
              await uploadCarrierDocument(file, result.id, result.upload_token, input.name);
              uploaded++;
            }
          }
        }

        if (status) {
          status.className = 'status show success';
          status.innerHTML = `<strong>Received successfully.</strong><br>Your NTA reference number is <span class="reference-number">${escapeHtml(result.reference_number || '')}</span>. Keep this number for your records.`;
        }
        form.reset();
        form.querySelectorAll('[data-toggle-target]').forEach(el => el.dispatchEvent(new Event('change')));
      } catch (err) {
        if (status) {
          status.className = 'status show error';
          status.textContent = err?.message || 'We could not submit your information. Please try again.';
        }
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  });

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  const postsRoot = document.querySelector('[data-blog-posts]');
  if (postsRoot) {
    fetch('content/posts.json').then(r => r.json()).then(posts => {
      postsRoot.innerHTML = posts.map(p => `
        <article class="post-card">
          <div class="thumb">${escapeHtml(p.category)}</div>
          <div class="body"><small>${escapeHtml(p.category)} · ${escapeHtml(p.publish_date)}</small><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.excerpt)}</p>${String(p.publish_date).toLowerCase() === 'draft' ? '<span class="draft-label">Article coming soon</span>' : `<a href="${encodeURI(p.slug)}.html">Read article →</a>`}</div>
        </article>`).join('');
    }).catch(() => {});
  }
})();
