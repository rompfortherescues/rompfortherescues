document.getElementById('year').textContent = new Date().getFullYear();

function linkifyText(text) {
  const escapedText = text.replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[character]);

  return escapedText.replace(/https?:\/\/[^\s<]+/g, url => {
    const trailingPunctuation = url.match(/[.,;:!?)]*$/)?.[0] || '';
    const link = url.slice(0, url.length - trailingPunctuation.length);
    return `<a href="${link}" target="_blank" rel="noopener">${link}</a>${trailingPunctuation}`;
  });
}

function appendSafeInline(target, source) {
  if (source.nodeType === Node.TEXT_NODE) {
    const linkedText = new DOMParser().parseFromString(linkifyText(source.nodeValue), 'text/html');
    Array.from(linkedText.body.childNodes).forEach((child) => target.append(document.importNode(child, true)));
    return;
  }
  if (source.nodeType !== Node.ELEMENT_NODE) return;

  const tag = source.tagName.toLowerCase();
  if (['script', 'style', 'iframe', 'svg', 'object'].includes(tag)) return;
  const allowed = ['strong', 'em', 'b', 'i', 'u', 'a', 'br', 'span', 'code'];
  const container = allowed.includes(tag) ? document.createElement(tag) : target;
  if (tag === 'a' && container !== target) {
    const href = source.getAttribute('href');
    if (href && /^(https?:\/\/|mailto:)/i.test(href)) {
      container.href = href;
      container.rel = 'noopener noreferrer';
    }
  }
  Array.from(source.childNodes).forEach((child) => appendSafeInline(container, child));
  if (container !== target) target.append(container);
}

function renderDescriptionMarkup(target, element) {
  const markup = Array.from(element.childNodes).map((child) =>
    child.nodeType === Node.ELEMENT_NODE ? new XMLSerializer().serializeToString(child) : child.nodeValue || ''
  ).join('');
  const parsed = new DOMParser().parseFromString(markup, 'text/html');
  Array.from(parsed.body.childNodes).forEach((child) => appendSafeInline(target, child));
}

function renderRecordParagraphs(record, name, container) {
  container.replaceChildren();
  Array.from(record.children).filter((child) => child.tagName === name).forEach((element) => {
    const paragraph = document.createElement('p');
    renderDescriptionMarkup(paragraph, element);
    container.append(paragraph);
  });
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'block';
}

async function loadData() {
  try {
    const res = await fetch(`/xml-data/data.xml?v=${Date.now()}`, { cache: 'no-store' });
    const text = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'application/xml');
    if (xml.querySelector('parsererror')) {
      console.error('XML parse error');
      return;
    }

    const record = xml.querySelector('Record');
    const tagEl = document.getElementById('tagline');
    if (tagEl) renderRecordParagraphs(record, 'Description', tagEl);
    const missionEl = document.getElementById('mission');
    if (missionEl) renderRecordParagraphs(record, 'Mission', missionEl);

    // General volunteer duties
    const recordDuties = Array.from(record.querySelector('Duties')?.querySelectorAll('Duty') || [])
      .map(d => d.textContent.trim());
    populateDutyOptions('vol-duty', recordDuties, 'General help');

    // Events
    const eventsList = document.getElementById('events-list');
    eventsList.innerHTML = '';
    xml.querySelectorAll('Events > Event').forEach(ev => {
      const name = ev.getAttribute('name') || '';
      const date = ev.getAttribute('date') || '';
      const time = ev.getAttribute('time') || '';
      const type = ev.getAttribute('type') || '';
      const fee = ev.getAttribute('fee') || '';
      const forWhom = ev.getAttribute('for') || '';
      const locations = Array.from(ev.querySelectorAll('Location')).map(l => l.textContent.trim());
      const description = ev.querySelector('Description')?.textContent?.trim() || '';
      const picture = ev.querySelector('Picture')?.textContent?.trim() || '';
      const charities = Array.from(ev.querySelectorAll('Charity'))
        .map(charity => charity.textContent.trim())
        .filter(Boolean);
      const included = Array.from(ev.querySelectorAll('Included')).map(i => i.textContent.trim());
      const duties = Array.from(ev.querySelectorAll('Duty')).map(d => d.textContent.trim());

      const eventObj = {
        name, date, time, type, fee, for: forWhom,
        locations, description, picture, charities, included, duties
      };

      const locHtml = locations.map(l => `<p>${l}</p>`).join('');
      const inclHtml = included.length
        ? `<div class="included"><strong>Included with registration:</strong><ul>${included.map(i => `<li>${i}</li>`).join('')}</ul></div>`
        : '';
      const detailsHtml = [
        charities.length ? `Supports: <em>${charities.join(', ')}</em>` : '',
        fee ? `Fee: ${fee}${forWhom ? ` (${forWhom})` : ''}` : ''
      ].filter(Boolean).join(' · ');
      const registerHtml = fee
        ? '<button class="btn btn-pink register-btn">Register</button>'
        : '';
      const pictureHtml = picture
        ? `<div class="event-picture"><img src="${picture}" alt="${name}"></div>`
        : '';

      const card = document.createElement('details');
      card.className = 'event-card';
      card.innerHTML = `
        <summary>
          <h3>${name}</h3>
          <span class="event-summary-meta">${[date, time].filter(Boolean).join(' · ')}</span>
        </summary>
        <div class="event-card-content">
          <div class="event-details">
            ${type ? `<p>${type}</p>` : ''}
            <div class="locations">${locHtml}</div>
            <div class="event-descriptions"></div>
            ${inclHtml}
            ${detailsHtml ? `<p>${detailsHtml}</p>` : ''}
            ${registerHtml}
            <button class="btn btn-turquoise volunteer-btn">Volunteer for this Event</button>
          </div>
          ${pictureHtml}
        </div>
      `;
      renderRecordParagraphs(ev, 'Description', card.querySelector('.event-descriptions'));
      card.querySelector('.register-btn')?.addEventListener('click', () => openRegister(eventObj));
      card.querySelector('.volunteer-btn').addEventListener('click', () => openSpecificVolunteer(eventObj));
      eventsList.appendChild(card);
    });

    // Charities
    const charitiesList = document.getElementById('charities-list');
    charitiesList.innerHTML = '';
    xml.querySelectorAll('Charities > Charity').forEach(ch => {
      const name = ch.getAttribute('name') || '';
      const website = ch.querySelector('Website')?.textContent?.trim() || '#';
      const payLink = ch.querySelector('PayLink')?.textContent?.trim() || '#';

      const card = document.createElement('details');
      card.className = 'charity-card';
      card.innerHTML = `
        <summary><h3>${name}</h3></summary>
        <div class="charity-content">
          <div class="charity-descriptions"></div>
          <p>
            <a href="${website}" target="_blank" rel="noopener">Website</a> ·
            <a href="${payLink}" target="_blank" rel="noopener" class="btn btn-pink" style="padding:0.3rem 0.8rem;font-size:0.9rem;">Donate</a>
          </p>
        </div>
      `;
      renderRecordParagraphs(ch, 'Description', card.querySelector('.charity-descriptions'));
      charitiesList.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load XML data from R2', err);
  }
}

function openRegister(eventData) {
  document.getElementById('reg-event-info').textContent =
    `${eventData.name} – ${eventData.date} ${eventData.time} · Fee ${eventData.fee}`;
  document.getElementById('reg-event-data').value = JSON.stringify(eventData);
  openModal('register-modal');
  document.getElementById('reg-message').textContent = '';
  document.getElementById('reg-message').className = 'message';
}

function populateDutyOptions(selectId, duties, defaultValue) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = duties.length
    ? '<option value="">-- Select a duty (optional) --</option>'
    : '<option value="">No specific duties listed</option>';
  duties.forEach(duty => {
    const option = document.createElement('option');
    option.value = duty;
    option.textContent = duty;
    select.appendChild(option);
  });
  if (defaultValue && duties.includes(defaultValue)) select.value = defaultValue;
}

function openSpecificVolunteer(eventData) {
  document.getElementById('vol-event-info').textContent =
    `${eventData.name} – ${eventData.date} ${eventData.time}`;
  document.getElementById('vol-spec-event-data').value = JSON.stringify(eventData);
  const duties = eventData.duties || [];
  document.getElementById('vol-spec-duty-group').style.display = duties.length ? '' : 'none';
  populateDutyOptions('vol-spec-duty', duties);
  openModal('vol-modal');
  document.getElementById('vol-spec-message').textContent = '';
  document.getElementById('vol-spec-message').className = 'message';
}

function openSupportForm() {
  const form = document.getElementById('support-form');
  if (form) form.reset();
  const msg = document.getElementById('support-message');
  if (msg) {
    msg.textContent = '';
    msg.className = 'message';
  }
  openModal('support-modal');
}

document.querySelectorAll('.close').forEach(el => {
  el.addEventListener('click', () => {
    document.getElementById(el.dataset.modal).style.display = 'none';
  });
});
window.addEventListener('click', e => {
  if (e.target.classList.contains('modal')) e.target.style.display = 'none';
});

document.getElementById('nav-support').addEventListener('click', openSupportForm);

document.getElementById('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const eventData = JSON.parse(document.getElementById('reg-event-data').value);
  const payload = {
    type: 'registration',
    event: eventData,
    name: document.getElementById('reg-name').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    phone: document.getElementById('reg-phone').value.trim() || '',
    quantity: parseInt(document.getElementById('reg-qty').value, 10) || 1
  };

  const msg = document.getElementById('reg-message');
  msg.textContent = 'Creating secure checkout…';
  msg.className = 'message';

  try {
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      msg.textContent = data.error || 'Checkout failed';
      msg.className = 'message error';
    }
  } catch (err) {
    msg.textContent = 'Network error – please try again';
    msg.className = 'message error';
  }
});

document.getElementById('support-form').addEventListener('submit', async e => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('support-amount').value);
  const payload = {
    type: 'donation',
    name: document.getElementById('support-name').value.trim(),
    email: document.getElementById('support-email').value.trim(),
    amount
  };

  const msg = document.getElementById('support-message');
  msg.textContent = 'Creating secure checkout…';
  msg.className = 'message';

  try {
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.url) {
      closeModal('support-modal');
      window.location.href = data.url;
    } else {
      msg.textContent = data.error || 'Checkout failed';
      msg.className = 'message error';
    }
  } catch (err) {
    msg.textContent = 'Network error – please try again';
    msg.className = 'message error';
  }
});

document.getElementById('volunteer-form').addEventListener('submit', async e => {
  e.preventDefault();
  await submitVolunteer({
    name: document.getElementById('vol-name').value.trim(),
    email: document.getElementById('vol-email').value.trim(),
    phone: document.getElementById('vol-phone').value.trim(),
    duty: document.getElementById('vol-duty').value.trim(),
    notes: document.getElementById('vol-notes').value.trim(),
    event: null
  }, 'vol-message', e.target);
});

document.querySelector('nav a[href="#volunteer"]').addEventListener('click', () => {
  const volunteerSection = document.getElementById('volunteer');
  const volunteerForm = document.getElementById('volunteer-form');
  const message = document.getElementById('vol-message');
  volunteerSection.hidden = false;
  volunteerForm.hidden = false;
  message.textContent = '';
  message.className = 'message';
});

document.getElementById('cancel-volunteer').addEventListener('click', () => {
  document.getElementById('volunteer').hidden = true;
});

document.getElementById('vol-specific-form').addEventListener('submit', async e => {
  e.preventDefault();
  const eventData = JSON.parse(document.getElementById('vol-spec-event-data').value || '{}');
  await submitVolunteer({
    name: document.getElementById('vol-spec-name').value.trim(),
    email: document.getElementById('vol-spec-email').value.trim(),
    phone: document.getElementById('vol-spec-phone').value.trim() || '',
    duty: document.getElementById('vol-spec-duty').value.trim(),
    notes: document.getElementById('vol-spec-notes').value.trim(),
    event: eventData
  }, 'vol-spec-message', e.target);
});

async function submitVolunteer(payload, msgId, form) {
  const msg = document.getElementById(msgId);
  msg.textContent = 'Sending registration…';
  msg.className = 'message';

  try {
    const res = await fetch('/api/volunteer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok || data.success) {
      msg.textContent = 'Thank you! Confirmation email sent.';
      msg.className = 'message success';
      form.reset();
      if (form.id === 'volunteer-form') form.hidden = true;
      setTimeout(() => {
        const modal = document.getElementById('vol-modal');
        if (modal) modal.style.display = 'none';
      }, 1500);
    } else {
      msg.textContent = data.error || 'Failed – please try again';
      msg.className = 'message error';
    }
  } catch (err) {
    msg.textContent = 'Network error';
    msg.className = 'message error';
  }
}

if (new URLSearchParams(location.search).get('payment') === 'success') {
  alert('Payment successful! Check your email for the receipt.');
  history.replaceState({}, '', location.pathname);
  closeModal('support-modal');
  closeModal('register-modal');
}

loadData();