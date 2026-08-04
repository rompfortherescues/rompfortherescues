document.addEventListener('DOMContentLoaded', async () => {
  const xml = await fetch('data.xml').then(r => r.text());
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const record = doc.querySelector('Record');

  // About
  document.getElementById('org-description').textContent =
    record.querySelector('Description')?.textContent.trim() || '';

  // Events
  const eventsList = document.getElementById('events-list');
  const volSelect = document.getElementById('vol-event');
  const events = [...record.querySelectorAll('Event')];

  events.forEach((ev, idx) => {
    const name = ev.getAttribute('name');
    const date = ev.getAttribute('date');
    const time = ev.getAttribute('time');
    const type = ev.getAttribute('type');
    const fee = ev.getAttribute('fee');
    const location = ev.querySelector('Location')?.textContent.trim() || '';
    const desc = ev.querySelector('Description')?.textContent.trim() || '';
    const charity = ev.querySelector('Charity')?.textContent.trim() || 'Various';

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${name}</h3>
      <div class="meta">
        <strong>${type}</strong> · ${date} · ${time}<br>
        ${location}<br>
        Supporting: ${charity}
      </div>
      <p>${desc}</p>
      <p><strong>Fee: ${fee}</strong></p>
      <button class="btn register-btn" data-idx="${idx}">Register & Pay</button>
    `;
    eventsList.appendChild(card);

    // Volunteer dropdown
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = `${name} (${date})`;
    volSelect.appendChild(opt);
  });

  // Charities
  const charitiesList = document.getElementById('charities-list');
  record.querySelectorAll('Charity').forEach(ch => {
    // Skip the empty ones that might appear from old XML
    const name = ch.childNodes[0]?.nodeValue?.trim() || ch.getAttribute('name') || '';
    if (!name || name.length < 3) return;

    const desc = ch.querySelector('Description')?.textContent.trim() || '';
    const website = ch.querySelector('Website')?.textContent.trim() || '#';
    const payLink = ch.querySelector('PayLink')?.textContent.trim() || website;

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${name}</h3>
      <p>${desc}</p>
      <a href="${website}" target="_blank" rel="noopener" class="btn btn-secondary">Website</a>
      <a href="${payLink}" target="_blank" rel="noopener" class="btn" style="margin-top:0.5rem">Donate Directly</a>
    `;
    charitiesList.appendChild(card);
  });

  // Payment methods
  const pmDiv = document.getElementById('payment-methods');
  const methods = [...record.querySelectorAll('Payment')].map(p => p.textContent.trim());
  if (methods.length) {
    pmDiv.innerHTML = '<h3>Accepted Payment Methods</h3><ul>' +
      methods.map(m => `<li>• ${m}</li>`).join('') + '</ul>';
  }

  // Modal helpers
  const openModal = id => document.getElementById(id).classList.remove('hidden');
  const closeModal = id => document.getElementById(id).classList.add('hidden');

  document.querySelectorAll('.close').forEach(el => {
    el.addEventListener('click', () => closeModal(el.dataset.modal));
  });
  window.addEventListener('click', e => {
    if (e.target.classList.contains('modal')) closeModal(e.target.id);
  });

  // Event registration buttons
  document.querySelectorAll('.register-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = btn.dataset.idx;
      const ev = events[idx];
      document.getElementById('event-id').value = idx;
      document.getElementById('modal-event-name').textContent = ev.getAttribute('name');
      document.getElementById('modal-event-fee').textContent = ev.getAttribute('fee');
      document.getElementById('event-result').classList.add('hidden');
      openModal('event-modal');
    });
  });

  // Volunteer button
  document.getElementById('open-volunteer-btn').addEventListener('click', () => {
    document.getElementById('vol-result').classList.add('hidden');
    openModal('volunteer-modal');
  });

  // Event form submit (demo payment + email)
  document.getElementById('event-form').addEventListener('submit', async e => {
    e.preventDefault();
    const idx = document.getElementById('event-id').value;
    const ev = events[idx];
    const payload = {
      email: document.getElementById('event-email').value.trim(),
      name: document.getElementById('event-name').value.trim(),
      eventName: ev.getAttribute('name'),
      date: ev.getAttribute('date'),
      time: ev.getAttribute('time'),
      type: ev.getAttribute('type'),
      fee: ev.getAttribute('fee'),
      location: ev.querySelector('Location')?.textContent.trim(),
      description: ev.querySelector('Description')?.textContent.trim(),
      charity: ev.querySelector('Charity')?.textContent.trim()
    };

    const resultEl = document.getElementById('event-result');
    resultEl.classList.remove('hidden', 'success', 'error');
    resultEl.textContent = 'Processing demo payment & sending receipt…';

    try {
      const res = await fetch('/api/register-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        resultEl.classList.add('success');
        resultEl.textContent = data.message || 'Registration successful! Check your email for the receipt.';
        document.getElementById('event-form').reset();
      } else {
        throw new Error(data.error || 'Failed');
      }
    } catch (err) {
      resultEl.classList.add('error');
      resultEl.textContent = 'Error: ' + err.message;
    }
  });

  // Volunteer form submit
  document.getElementById('volunteer-form').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = {
      event: document.getElementById('vol-event').value,
      duty: document.getElementById('vol-duty').value.trim(),
      name: document.getElementById('vol-name').value.trim(),
      email: document.getElementById('vol-email').value.trim(),
      phone: document.getElementById('vol-phone').value.trim()
    };

    const resultEl = document.getElementById('vol-result');
    resultEl.classList.remove('hidden', 'success', 'error');
    resultEl.textContent = 'Sending confirmation…';

    try {
      const res = await fetch('/api/register-volunteer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        resultEl.classList.add('success');
        resultEl.textContent = data.message || 'Thank you! Confirmation email sent.';
        document.getElementById('volunteer-form').reset();
      } else {
        throw new Error(data.error || 'Failed');
      }
    } catch (err) {
      resultEl.classList.add('error');
      resultEl.textContent = 'Error: ' + err.message;
    }
  });
});