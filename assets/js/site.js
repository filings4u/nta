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

  async function notifySubmission(action, recordId) {
    if (!config.notifyFunctionUrl || !recordId) return;
    try {
      await fetch(config.notifyFunctionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': config.publishableKey },
        body: JSON.stringify({ action, record_id: recordId })
      });
    } catch (error) {
      console.warn('NTA notification delivery could not be confirmed.', error);
    }
  }

  async function invokeStorage(body) {
    if (!config.storageFunctionUrl || !config.publishableKey) throw new Error('The NTA document service is not configured.');
    const res = await fetch(config.storageFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.publishableKey,
        'Authorization': `Bearer ${config.publishableKey}`
      },
      body: JSON.stringify(body)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || 'Document service request failed.');
    return json;
  }

  async function uploadCarrierDocument(file, applicationId, uploadToken, documentType) {
    if (!window.NTASupabase) throw new Error('Secure upload service is unavailable.');
    const auth = await invokeStorage({
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

    await invokeStorage({
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

      // Preserve credit-application fields that are more detailed than the
      // base shipper profile schema inside the existing notes field.
      if (action === 'shipper_setup') {
        const creditKeys = [
          ['Years in business', 'years_in_business'],
          ['State organized/incorporated', 'state_organized'],
          ['Requested credit limit', 'requested_credit_limit'],
          ['Estimated monthly freight spend', 'estimated_monthly_spend'],
          ['Purchase order process', 'purchase_order_policy'],
          ['Reference 1 company', 'trade_reference_1_company'],
          ['Reference 1 contact', 'trade_reference_1_contact'],
          ['Reference 1 email', 'trade_reference_1_email'],
          ['Reference 1 phone', 'trade_reference_1_phone'],
          ['Reference 2 company', 'trade_reference_2_company'],
          ['Reference 2 contact', 'trade_reference_2_contact'],
          ['Reference 2 email', 'trade_reference_2_email'],
          ['Reference 2 phone', 'trade_reference_2_phone'],
          ['Reference 3 company', 'trade_reference_3_company'],
          ['Reference 3 contact', 'trade_reference_3_contact'],
          ['Reference 3 email', 'trade_reference_3_email'],
          ['Reference 3 phone', 'trade_reference_3_phone'],
          ['Signer email', 'signature_email'],
          ['Application date', 'application_date']
        ];
        const creditDetails = creditKeys
          .map(([label, key]) => [label, String(payload[key] ?? '').trim()])
          .filter(([, value]) => value)
          .map(([label, value]) => `${label}: ${value}`);
        const existingNotes = String(payload.notes || '').trim();
        payload.notes = [existingNotes, creditDetails.length ? `CREDIT APPLICATION DETAILS\n${creditDetails.join('\n')}` : '']
          .filter(Boolean).join('\n\n');
      }

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

        await notifySubmission(action, result.id);

        if (status) {
          status.className = 'status show success';
          status.innerHTML = `<strong>Received successfully.</strong><br>Your NTA reference number is <span class="reference-number">${escapeHtml(result.reference_number || '')}</span>. Keep this number for your records.`;
        }

        const successRedirect = form.dataset.successRedirect;
        if (successRedirect) {
          try {
            sessionStorage.setItem('ntaShipperReference', result.reference_number || '');
            sessionStorage.setItem('ntaShipperApplicationSubmitted', 'true');
          } catch {}
          if (status) status.innerHTML += '<br>Opening your NTA shipper package…';
          window.setTimeout(() => { location.href = successRedirect; }, 1100);
          return;
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

  const packageRoot = document.querySelector('[data-shipper-package]');
  if (packageRoot) {
    const status = packageRoot.querySelector('[data-package-status]');
    const company = packageRoot.querySelector('[data-package-company]');
    const referenceEl = packageRoot.querySelector('[data-package-reference]');
    const cards = [...packageRoot.querySelectorAll('[data-package-document]')];
    let reference = '';
    try { reference = sessionStorage.getItem('ntaShipperReference') || ''; } catch {}

    const prettyNames = {
      'broker-shipper-agreement.pdf': 'Broker-Shipper Agreement',
      'nta-w9.pdf': 'NTA Logistics W-9',
      'broker-authority.pdf': 'Broker Authority',
      'certificate-of-insurance.pdf': 'Certificate of Insurance',
      'terms-accessorials.pdf': 'Terms & Accessorial Schedule',
      'operations-contact-sheet.pdf': 'Operations & Claims Contact Sheet'
    };

    const setCard = (card, doc) => {
      const state = card.querySelector('[data-doc-state]');
      const view = card.querySelector('[data-doc-view]');
      const download = card.querySelector('[data-doc-download]');
      if (!doc) {
        state.textContent = 'Pending document upload';
        state.classList.add('pending');
        view.setAttribute('aria-disabled', 'true');
        download.setAttribute('aria-disabled', 'true');
        return;
      }
      state.textContent = 'Available';
      state.classList.add('available');
      view.href = doc.url;
      view.target = '_blank';
      view.rel = 'noopener';
      download.href = doc.url;
      download.setAttribute('download', doc.name);
      view.removeAttribute('aria-disabled');
      download.removeAttribute('aria-disabled');
    };

    if (!reference) {
      status.className = 'package-alert warning';
      status.innerHTML = '<strong>Complete the Shipper Credit Application first.</strong><br>Your shipper package is unlocked after a successful application submission.';
      cards.forEach(card => setCard(card, null));
    } else {
      if (referenceEl) referenceEl.textContent = reference;
      status.textContent = 'Loading your NTA shipper package…';
      invokeStorage({ action: 'shipper_package', reference_number: reference })
        .then(result => {
          const docsByName = Object.fromEntries((result.documents || []).map(doc => [String(doc.name).toLowerCase(), doc]));
          if (company) company.textContent = result.shipper?.company_name || 'Approved shipper applicant';
          if (referenceEl) referenceEl.textContent = result.shipper?.reference_number || reference;
          cards.forEach(card => {
            const filename = String(card.dataset.packageDocument || '').toLowerCase();
            setCard(card, docsByName[filename] || null);
          });
          const count = (result.documents || []).length;
          status.className = count ? 'package-alert success' : 'package-alert info';
          status.innerHTML = count
            ? `<strong>Your shipper package is ready.</strong><br>${count} document${count === 1 ? '' : 's'} currently available to view or download.`
            : '<strong>Your application was received.</strong><br>NTA has not published package documents to the portal yet. The document cards below will activate automatically when the files are added.';
        })
        .catch(err => {
          status.className = 'package-alert warning';
          status.textContent = err?.message || 'We could not load the shipper package.';
          cards.forEach(card => setCard(card, null));
        });
    }
  }

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
      const postImages = {
        'Shippers': 'assets/images/shippers-hero.webp',
        'Carriers': 'assets/images/carriers-hero.webp',
        'Construction Logistics': 'assets/images/index-hero.webp'
      };
      postsRoot.innerHTML = posts.map(p => `
        <article class="post-card">
          <div class="thumb" style="background-image:url('${postImages[p.category] || 'assets/images/blog-hero.webp'}')"><span>${escapeHtml(p.category)}</span></div>
          <div class="body"><small>${escapeHtml(p.category)} · ${escapeHtml(p.publish_date)}</small><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.excerpt)}</p>${String(p.publish_date).toLowerCase() === 'draft' ? '<span class="draft-label">Article coming soon</span>' : `<a href="${encodeURI(p.slug)}.html">Read article →</a>`}</div>
        </article>`).join('');
    }).catch(() => {});
  }
})();
