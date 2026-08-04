document.addEventListener('DOMContentLoaded', () => {
  loadData();
  setupModals();
  document.getElementById('nav-volunteer').addEventListener('click', (e) => {
    e.preventDefault();
    openVolunteerForm(null); // general
  });
});

async function loadData() {
  try {
    const res = await fetch('data.xml');
    const text = await res.text();
    const xml = new DOMParser().parseFromString(text, 'application/xml');
    const record = xml.querySelector('Record');

    document.getElementById('org-name').textContent = record.getAttribute('name') || 'Romp for the Rescues';
    document.getElementById('org-desc').textContent = record.querySelector('Description')?.textContent || '';

    // Events
    const eventsList = document.getElementById('events-list');
    record.querySelectorAll('Event').forEach(ev => {
      const name = ev.getAttribute('name');
      const date = ev.getAttribute('date');
      const time = ev.getAttribute('time');
      const type = ev.getAttribute('type');
      const fee = ev.getAttribute('fee');
      const location = ev.querySelector('Location')?.textContent || '';
      const desc = ev.querySelector('Description')?.textContent || '';
      const charity = ev.querySelector('Charity')?.textContent?.trim() || '';

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h3>${name}</h3>
        <div class="meta"><strong>${type}</strong> · ${date} · ${time}</div>
        <div class="meta">${location}</div>
        <p>${desc}</p>
        <div class="meta">Supports: <strong>${charity}</strong> · Fee: ${fee}</div>
        <div class="buttons">
          <button class="btn-register" data-name="${name}" data-fee="${fee}" data-date="${date}" data-time="${time}" data-location="${location}">Registration</button>
          <button class="btn-volunteer secondary" data-event="${name}">Volunteer</button>
        </div>
      `;
      eventsList.appendChild(card);
    });

    // Event button listeners
    document.querySelectorAll('.btn-register').forEach(btn => {
      btn.addEventListener('click', () => openRegisterForm(btn.dataset));
    });
    document.querySelectorAll('.btn-volunteer').forEach(btn => {
      btn.addEventListener('click', () => openVolunteerForm(btn.dataset.event));
    });

    // Charities
    const charitiesList = document.getElementById('charities-list');
    record.querySelectorAll('Charity').forEach(ch => {
      const name = ch.getAttribute('name') || ch.textContent.trim().split('\n')[0];
      const desc = ch.querySelector('Description')?.textContent || '';
      const website = ch.querySelector('Website')?.textContent || '';
      const payLink = ch.querySelector('PayLink')?.textContent || website;

      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <h3>${name}</h3>
        <p>${desc}</p>
        <p><a href="${website}" target="_blank" rel="noopener">Website</a> ·
           <a href="${payLink}" target="_blank" rel="noopener" class="btn">Donate</a></p>
      `;
      charitiesList.appendChild(card);
    });

    // Payment methods
    const pmList = document.getElementById('payment-methods');
    record.querySelectorAll('PaymentMethod').forEach(pm => {
      const li = document.createElement('li');
      li.textContent = pm.textContent;
      pmList.appendChild(li);
    });
  } catch (err) {
    console.error('Failed to load data.xml', err);
  }
}

function setupModals() {
  document.querySelectorAll('.close').forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById(el.dataset.close).classList.add('hidden');
    });
  });
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) e.target.classList.add('hidden');
  });

  document.getElementById('volunteer-form').addEventListener('submit', submitVolunteer);
  document.getElementById('register-form').addEventListener('submit', submitRegister);
}

function openVolunteerForm(eventName) {
  const modal = document.getElementById('volunteer-modal');
  const form = document.getElementById('volunteer-form');
  form.reset();
  document.getElementById('vol-message').textContent = '';
  document.getElementById('vol-event').value = eventName || '';

  const isGeneral = !eventName;
  document.getElementById('volunteer-title').textContent = isGeneral
    ? 'General Volunteer Sign-up'
    : `Volunteer for ${eventName}`;

  const phoneInput = document.getElementById('vol-phone');
  const phoneMark = document.getElementById('phone-required-mark');
  if (isGeneral) {
    phoneInput.required = true;
    phoneMark.textContent = '*';
  } else {
    phoneInput.required = false;
    phoneMark.textContent = '(optional)';
  }

  const display = document.getElementById('vol-event-display');
  if (eventName) {
    display.textContent = `Event: ${eventName}`;
    display.classList.remove('hidden');
  } else {
    display.classList.add('hidden');
  }

  modal.classList.remove('hidden');
}

function openRegisterForm(data) {
  const modal = document.getElementById('register-modal');
  document.getElementById('register-form').reset();
  document.getElementById('reg-message').textContent = '';

  document.getElementById('reg-event-name').value = data.name;
  document.getElementById('reg-event-fee').value = data.fee;
  document.getElementById('reg-event-date').value = data.date;
  document.getElementById('reg-event-time').value = data.time;
  document.getElementById('reg-event-location').value = data.location;

  document.getElementById('reg-title').textContent = `Register: ${data.name}`;
  document.getElementById('reg-event-summary').innerHTML = `
    <strong>${data.name}</strong><br>
    ${data.date} · ${data.time}<br>
    ${data.location}<br>
    Fee: ${data.fee} per person
  `;
  modal.classList.remove('hidden');
}

async function submitVolunteer(e) {
  e.preventDefault();
  const msg = document.getElementById('vol-message');
  msg.textContent = 'Sending…';
  msg.className = 'message';

  const payload = {
    name: document.getElementById('vol-name').value.trim(),
    email: document.getElementById('vol-email').value.trim(),
    phone: document.getElementById('vol-phone').value.trim(),
    duty: document.getElementById('vol-duty').value.trim(),
    event: document.getElementById('vol-event').value || null
  };

  try {
    const res = await fetch('/api/volunteer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      msg.textContent = 'Thank you! A confirmation email has been sent.';
      msg.classList.add('success');
      setTimeout(() => document.getElementById('volunteer-modal').classList.add('hidden'), 2500);
    } else {
      throw new Error(data.error || 'Failed');
    }
  } catch (err) {
    msg.textContent = 'Error: ' + err.message;
    msg.classList.add('error');
  }
}

async function submitRegister(e) {
  e.preventDefault();
  const msg = document.getElementById('reg-message');
  msg.textContent = 'Processing demo registration…';
  msg.className = 'message';

  const payload = {
    name: document.getElementById('reg-name').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    phone: document.getElementById('reg-phone').value.trim(),
    qty: document.getElementById('reg-qty').value,
    eventName: document.getElementById('reg-event-name').value,
    fee: document.getElementById('reg-event-fee').value,
    date: document.getElementById('reg-event-date').value,
    time: document.getElementById('reg-event-time').value,
    location: document.getElementById('reg-event-location').value
  };

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      msg.textContent = 'Demo success! Receipt email sent. (Production would redirect to Stripe.)';
      msg.classList.add('success');
      // In production you would do: window.location = data.checkoutUrl;
      setTimeout(() => document.getElementById('register-modal').classList.add('hidden'), 3000);
    } else {
      throw new Error(data.error || 'Failed');
    }
  } catch (err) {
    msg.textContent = 'Error: ' + err.message;
    msg.classList.add('error');
  }
}