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
        if (current.dataset.stepName === 'Payment') {
          const method = current.querySelector('[name="payment_method"]')?.value;
          if (method === 'ACH') {
            const account = current.querySelector('[name="account_number"]');
            const confirm = current.querySelector('[name="account_number_confirm"]');
            if (account && confirm && account.value !== confirm.value) {
              confirm.setCustomValidity('Account numbers do not match.');
              confirm.reportValidity();
              return;
            } else if (confirm) {
              confirm.setCustomValidity('');
            }
          }
        }
        if (current.hasAttribute('data-agreement-step') && next.disabled) return;
        const invalid = [...current.querySelectorAll('input,select,textarea')].find(el => !el.disabled && !el.checkValidity());
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




  // Link quote requests to a shipper credit application completed in this browser.
  document.querySelectorAll('[data-quote-form]').forEach(form => {
    const refInput = form.querySelector('[name="shipper_reference_number"]');
    const profileStatus = document.querySelector('[data-quote-profile-status]');
    let ref = '';
    try {
      if (sessionStorage.getItem('ntaShipperApplicationSubmitted') === 'true') {
        ref = sessionStorage.getItem('ntaShipperReference') || '';
      }
    } catch {}
    if (refInput && ref) refInput.value = ref;
    if (profileStatus && ref) {
      profileStatus.textContent = `Linked to ${ref}`;
      profileStatus.classList.add('linked');
    }

    const updateReview = () => {
      form.querySelectorAll('[data-review-field]').forEach(node => {
        const input = form.querySelector(`[name="${node.dataset.reviewField}"]`);
        let value = input?.value?.trim() || '—';
        if (input?.type === 'date' && input.value) {
          const d = new Date(`${input.value}T12:00:00`);
          if (!Number.isNaN(d.getTime())) value = d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
        }
        node.textContent = value;
      });
      const route = form.querySelector('[data-review-route]');
      if (route) {
        const pc = form.querySelector('[name="pickup_city"]')?.value.trim();
        const ps = form.querySelector('[name="pickup_state"]')?.value.trim();
        const dc = form.querySelector('[name="delivery_city"]')?.value.trim();
        const ds = form.querySelector('[name="delivery_state"]')?.value.trim();
        const origin = [pc,ps].filter(Boolean).join(', ');
        const destination = [dc,ds].filter(Boolean).join(', ');
        route.textContent = origin || destination ? `${origin || '—'} → ${destination || '—'}` : '—';
      }
    };
    form.addEventListener('input', updateReview);
    form.addEventListener('change', updateReview);
    updateReview();
  });

  document.querySelectorAll('.carrier-application-form').forEach(form => {
    const paymentMethod = form.querySelector('[name="payment_method"]');
    const panels = [...form.querySelectorAll('[data-payment-panel]')];
    const achNames = ['bank_name','bank_account_holder','bank_account_type','routing_number','account_number','account_number_confirm','ach_authorization'];
    const factoringNames = ['factoring_company'];
    const remittanceNames = ['remittance_address','remittance_city','remittance_state','remittance_postal_code'];

    const updatePaymentPanels = () => {
      const method = paymentMethod?.value || '';
      panels.forEach(panel => panel.hidden = panel.dataset.paymentPanel !== method);
      achNames.forEach(name => {
        const el = form.querySelector(`[name="${name}"]`);
        if (el) el.required = method === 'ACH';
      });
      factoringNames.forEach(name => {
        const el = form.querySelector(`[name="${name}"]`);
        if (el) el.required = method === 'Factoring';
      });
      remittanceNames.forEach(name => {
        const el = form.querySelector(`[name="${name}"]`);
        if (el) el.required = method === 'Check';
      });
      const confirm = form.querySelector('[name="account_number_confirm"]');
      if (confirm) confirm.setCustomValidity('');
    };
    paymentMethod?.addEventListener('change', updatePaymentPanels);
    updatePaymentPanels();

    const scrollBox = form.querySelector('[data-agreement-scroll]');
    const agreementStatus = form.querySelector('[data-agreement-status]');
    const agreementName = form.querySelector('[name="agreement_signature_name"]');
    const agreementTitle = form.querySelector('[name="agreement_signature_title"]');
    const agreementAccept = form.querySelector('[name="broker_agreement_accepted"]');
    const agreementNext = form.querySelector('[data-agreement-next]');
    let agreementRead = false;

    const updateAgreementGate = () => {
      if (!agreementNext) return;
      const signed = Boolean(agreementRead && agreementName?.value.trim() && agreementTitle?.value.trim() && agreementAccept?.checked);
      agreementNext.disabled = !signed;
    };

    if (scrollBox) {
      const checkScroll = () => {
        const atEnd = scrollBox.scrollTop + scrollBox.clientHeight >= scrollBox.scrollHeight - 12;
        if (atEnd && !agreementRead) {
          agreementRead = true;
          [agreementName, agreementTitle, agreementAccept].forEach(el => { if (el) el.disabled = false; });
          if (agreementStatus) {
            agreementStatus.classList.add('ready');
            agreementStatus.innerHTML = '<span class="lock-dot">●</span> Agreement reviewed. Complete the electronic signature to continue.';
          }
          updateAgreementGate();
        }
      };
      scrollBox.addEventListener('scroll', checkScroll, { passive: true });
      checkScroll();
    }
    [agreementName, agreementTitle].forEach(el => el?.addEventListener('input', updateAgreementGate));
    agreementAccept?.addEventListener('change', updateAgreementGate);
  });

  async function invokeCarrierSecure(body) {
    if (!config.carrierSecureFunctionUrl || !config.publishableKey) throw new Error('The secure carrier payment service is not configured.');
    const res = await fetch(config.carrierSecureFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.publishableKey,
        'Authorization': `Bearer ${config.publishableKey}`
      },
      body: JSON.stringify(body)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) throw new Error(json.error || 'Secure carrier details could not be saved.');
    return json;
  }

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
    const endpoint = body?.action === 'agent_apply' ? config.agentFunctionUrl : config.functionUrl;
    if (!endpoint || !config.publishableKey) throw new Error('The NTA submission service is not configured.');
    const res = await fetch(endpoint, {
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
      let carrierSecurePayload = null;
      if (action === 'carrier_apply') {
        const secureKeys = [
          'payment_method','payee_name','remittance_email','remittance_address','remittance_city','remittance_state','remittance_postal_code',
          'bank_name','bank_account_holder','bank_account_type','routing_number','account_number','account_number_confirm','ach_authorization',
          'factoring_company','factoring_contact_name','factoring_email','factoring_phone',
          'agreement_version','agreement_signature_name','agreement_signature_title'
        ];
        carrierSecurePayload = {};
        secureKeys.forEach(key => {
          if (Object.prototype.hasOwnProperty.call(payload, key)) carrierSecurePayload[key] = payload[key];
          delete payload[key];
        });
        carrierSecurePayload.broker_agreement_accepted = payload.broker_agreement_accepted === true;
      }

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


      // Preserve useful quote details that are not first-class columns in the
      // public quote table inside special_instructions so operations receives them.
      if (action === 'quote_request') {
        const quoteKeys = [
          ['Customer / project reference', 'customer_reference'],
          ['Quote type', 'quote_type'],
          ['Pickup contact', 'pickup_contact_name'],
          ['Pickup contact phone', 'pickup_contact_phone'],
          ['Pickup loading method', 'pickup_loading_type'],
          ['Pickup notes', 'pickup_notes'],
          ['Delivery contact', 'delivery_contact_name'],
          ['Delivery contact phone', 'delivery_contact_phone'],
          ['Delivery unloading method', 'delivery_unloading_type'],
          ['Delivery notes', 'delivery_notes']
        ];
        const quoteDetails = quoteKeys
          .map(([label, key]) => [label, String(payload[key] ?? '').trim()])
          .filter(([, value]) => value)
          .map(([label, value]) => `${label}: ${value}`);
        const existingInstructions = String(payload.special_instructions || '').trim();
        payload.special_instructions = [
          quoteDetails.length ? `QUOTE REQUEST DETAILS\n${quoteDetails.join('\n')}` : '',
          existingInstructions
        ].filter(Boolean).join('\n\n');
      }

      try {
        if (status) {
          status.className = 'status show';
          status.textContent = action === 'carrier_apply' ? 'Creating carrier application…' : 'Submitting…';
        }
        if (submit) submit.disabled = true;

        const result = await invoke(payload);

        if (action === 'carrier_apply') {
          if (status) status.textContent = 'Securing payment information and agreement signature…';
          await invokeCarrierSecure({
            application_id: result.id,
            upload_token: result.upload_token,
            ...carrierSecurePayload
          });

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

        if (action !== 'agent_apply') await notifySubmission(action, result.id);

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

    const lockCards = () => {
      cards.forEach(card => {
        const state = card.querySelector('[data-doc-state]');
        const view = card.querySelector('[data-doc-view]');
        const download = card.querySelector('[data-doc-download]');
        if (state) {
          state.textContent = 'Locked — complete shipper credit application';
          state.classList.add('pending');
        }
        if (view) {
          view.href = '#';
          view.removeAttribute('target');
          view.setAttribute('aria-disabled', 'true');
        }
        if (download) {
          download.href = '#';
          download.removeAttribute('download');
          download.setAttribute('aria-disabled', 'true');
        }
      });
    };

    if (!reference) {
      if (company) company.textContent = 'Shipper Package Locked';
      if (referenceEl) referenceEl.textContent = 'Complete application';
      status.className = 'package-alert warning';
      status.innerHTML = '<strong>Complete the Shipper Credit Application to unlock this package.</strong><br>After a successful submission, you will be redirected here and your NTA shipper reference will unlock the View and Download buttons.';
      lockCards();
    } else {
      if (referenceEl) referenceEl.textContent = reference;
      status.textContent = 'Verifying your shipper application and loading current NTA documents…';
      invokeStorage({ action: 'shipper_package', reference_number: reference })
        .then(result => {
          const docsByName = Object.fromEntries((result.documents || []).map(doc => [String(doc.name).toLowerCase(), doc]));
          if (company) company.textContent = result.shipper?.company_name || 'NTA Shipper Package';
          if (referenceEl) referenceEl.textContent = result.shipper?.reference_number || reference;
          cards.forEach(card => {
            const filename = String(card.dataset.packageDocument || '').toLowerCase();
            setCard(card, docsByName[filename] || null);
          });
          const count = (result.documents || []).length;
          status.className = count ? 'package-alert success' : 'package-alert info';
          if (count) {
            status.innerHTML = `<strong>Your shipper package is unlocked.</strong><br>${count} document${count === 1 ? '' : 's'} currently available to view or download.`;
          } else {
            status.innerHTML = '<strong>Your shipper account was verified, but no package documents are currently published.</strong>';
          }
        })
        .catch(err => {
          status.className = 'package-alert warning';
          status.textContent = err?.message || 'We could not verify your shipper application.';
          lockCards();
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
})();
