document.getElementById('year').textContent = new Date().getFullYear();

async function loadData() {
  try {
    const res = await fetch('/data.xml');
    const text = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'application/xml');
    if (xml.querySelector('parsererror')) {
      console.error('XML parse error');
      return;
    }

    const record = xml.querySelector('Record');
    const tagline = record.querySelector('Description')?.textContent || '';
    const tagEl = document.getElementById('tagline');
    if (tagEl) tagEl.textContent = tagline;

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
      const charity = ev.querySelector('Charity')?.textContent?.trim() || '';
      const included = Array.from(ev.querySelectorAll('Included')).map(i => i.textContent.trim());

      const eventObj = {
        name, date, time, type, fee, for: forWhom,
        locations, description, charity, included
      };

      const locHtml = locations.map(l => `<p>${l}</p>`).join('');
      const inclHtml = included.length
        ? `<div class="included"><strong>Included with registration:</strong><ul>${included.map(i => `<li>${i}</li>`).join('')}</ul></div>`
        : '';

      const card = document.createElement('div');
      card.className = 'event-card';
      card.innerHTML = `
        <h3>${name}</h3>
        <p><strong>${date}</strong> · ${time} · ${type}</p>
        <div class="locations">${locHtml}</div>
        <p>${description}</p>
        ${inclHtml}
        <p>Supports: <em>${charity}</em> · Fee: ${fee}${forWhom ? ` (${forWhom})` : ''}</p>
        <button class="btn btn-pink register-btn">Register</button>
        <button class="btn btn-turquoise volunteer-btn">Volunteer for this Event</button>
      `;
      card.querySelector('.register-btn').addEventListener('click', () => openRegister(eventObj));
      card.querySelector('.volunteer-btn').addEventListener('click', () => openSpecificVolunteer(eventObj));
      eventsList.appendChild(card);
    });

    // Charities
    const charitiesList = document.getElementById('charities-list');
    charitiesList.innerHTML = '';
    xml.querySelectorAll('Charities > Charity').forEach(ch => {
      const name = ch.getAttribute('name') || '';
      const desc = ch.querySelector('Description')?.textContent?.trim() || '';
      const website = ch.querySelector('Website')?.textContent?.trim() || '#';
      const payLink = ch.querySelector('PayLink')?.textContent?.trim() || '#';

      const card = document.createElement('div');
      card.className = 'charity-card';
      card.innerHTML = `
        <h3>${name}</h3>
        <p>${desc}</p>
        <p>
          <a href="${website}" target="_blank" rel="noopener">Website</a> ·
          <a href="${payLink}" target="_blank" rel="noopener" class="btn btn-pink" style="padding:0.3rem 0.8rem;font-size:0.9rem;">Donate</a>
        </p>
      `;
      charitiesList.appendChild(card);
    });

    // Payment methods
    const methods = document.getElementById('payment-methods');
    methods.innerHTML = '';
    xml.querySelectorAll('PaymentMethods > Method').forEach(m => {
      const li = document.createElement('li');
      li.textContent = m.textContent.trim();
      methods.appendChild(li);
    });
  } catch (err) {
    console.error('Failed to load data.xml', err);
  }
}

function openRegister(eventData) {
  document.getElementById('reg-event-info').textContent =
    `${eventData.name} – ${eventData.date} ${eventData.time} · Fee ${eventData.fee}`;
  document.getElementById('reg-event-data').value = JSON.stringify(eventData);
  document.getElementById('register-modal').style.display = 'block';
  document.getElementById('reg-message').textContent = '';
  document.getElementById('reg-message').className = 'message';
}

function openSpecificVolunteer(eventData) {
  document.getElementById('vol-event-info').textContent =
    `${eventData.name} – ${eventData.date} ${eventData.time}`;
  document.getElementById('vol-spec-event-data').value = JSON.stringify(eventData);
  document.getElementById('vol-modal').style.display = 'block';
  document.getElementById('vol-spec-message').textContent = '';
  document.getElementById('vol-spec-message').className = 'message';
}

document.querySelectorAll('.close').forEach(el => {
  el.addEventListener('click', () => {
    document.getElementById(el.dataset.modal).style.display = 'none';
  });
});
window.addEventListener('click', e => {
  if (e.target.classList.contains('modal')) e.target.style.display = 'none';
});

document.getElementById('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const eventData = JSON.parse(document.getElementById('reg-event-data').value);
  const payload = {
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
}

loadData();