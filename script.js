document.getElementById('year').textContent = new Date().getFullYear();

let eventsData = [];
let charitiesData = [];

async function loadData() {
  try {
    const res = await fetch('data.xml');
    const text = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'application/xml');

    const desc = xml.querySelector('Description')?.textContent || '';
    document.getElementById('tagline').textContent = desc;

    // Events
    const events = xml.querySelectorAll('Events > Event');
    const eventsList = document.getElementById('events-list');
    eventsList.innerHTML = '';
    eventsData = [];

    events.forEach((ev, idx) => {
      const name = ev.getAttribute('name') || '';
      const date = ev.getAttribute('date') || '';
      const time = ev.getAttribute('time') || '';
      const type = ev.getAttribute('type') || '';
      const fee = ev.getAttribute('fee') || '';
      const forAttr = ev.getAttribute('for') || '';
      const locations = Array.from(ev.querySelectorAll('Location')).map(l => l.textContent.trim());
      const description = ev.querySelector('Description')?.textContent || '';
      const charity = ev.querySelector('Charity')?.textContent || '';

      const eventObj = { name, date, time, type, fee, for: forAttr, locations, description, charity };
      eventsData.push(eventObj);

      const card = document.createElement('div');
      card.className = 'event-card';
      card.innerHTML = `
        <h3>${name}</h3>
        <p><strong>Date:</strong> ${date} ${time}</p>
        <p><strong>Type:</strong> ${type}</p>
        <p><strong>Fee:</strong> ${fee}</p>
        ${forAttr ? `<p><strong>For:</strong> ${forAttr}</p>` : ''}
        <p><strong>Location(s):</strong> ${locations.join(' · ')}</p>
        <p>${description}</p>
        <p><strong>Supporting:</strong> ${charity}</p>
        <button class="btn btn-pink register-btn" data-idx="${idx}">Register</button>
        <button class="btn btn-turquoise volunteer-btn" data-idx="${idx}">Volunteer</button>
      `;
      eventsList.appendChild(card);
    });

    // Charities
    const charities = xml.querySelectorAll('Charities > Charity');
    const charitiesList = document.getElementById('charities-list');
    charitiesList.innerHTML = '';
    charitiesData = [];

    charities.forEach(ch => {
      const name = ch.getAttribute('name') || '';
      const description = ch.querySelector('Description')?.textContent || '';
      const website = ch.querySelector('Website')?.textContent || '';
      const payLink = ch.querySelector('PayLink')?.textContent || '';
      charitiesData.push({ name, description, website, payLink });

      const card = document.createElement('div');
      card.className = 'charity-card';
      card.innerHTML = `
        <h3>${name}</h3>
        <p>${description}</p>
        <p><a href="${website}" target="_blank" rel="noopener">Website</a></p>
        <a href="${payLink}" target="_blank" rel="noopener" class="btn btn-pink">Donate Directly</a>
      `;
      charitiesList.appendChild(card);
    });

    // Payment methods
    const methods = xml.querySelectorAll('PaymentMethods > Method');
    const pmList = document.getElementById('payment-methods');
    pmList.innerHTML = '';
    methods.forEach(m => {
      const li = document.createElement('li');
      li.textContent = m.textContent;
      pmList.appendChild(li);
    });

    // Button listeners
    document.querySelectorAll('.register-btn').forEach(btn => {
      btn.addEventListener('click', () => openRegister(parseInt(btn.dataset.idx)));
    });
    document.querySelectorAll('.volunteer-btn').forEach(btn => {
      btn.addEventListener('click', () => openVolunteer(parseInt(btn.dataset.idx)));
    });

  } catch (err) {
    console.error('Failed to load data.xml', err);
  }
}

function openRegister(idx) {
  const ev = eventsData[idx];
  document.getElementById('reg-event-data').value = JSON.stringify(ev);
  document.getElementById('reg-event-info').innerHTML = `
    <strong>${ev.name}</strong><br>
    ${ev.date} ${ev.time}<br>
    Fee: ${ev.fee}
  `;
  document.getElementById('register-form').reset();
  document.getElementById('reg-qty').value = 1;
  document.getElementById('reg-message').className = 'message';
  document.getElementById('register-modal').classList.add('active');
}

function openVolunteer(idx) {
  const ev = eventsData[idx];
  document.getElementById('vol-spec-event-data').value = JSON.stringify(ev);
  document.getElementById('vol-event-info').innerHTML = `
    <strong>${ev.name}</strong><br>
    ${ev.date} ${ev.time}
  `;
  document.getElementById('vol-specific-form').reset();
  document.getElementById('vol-spec-message').className = 'message';
  document.getElementById('vol-modal').classList.add('active');
}

// Close modals
document.querySelectorAll('.close').forEach(el => {
  el.addEventListener('click', () => {
    document.getElementById(el.dataset.modal).classList.remove('active');
  });
});
window.addEventListener('click', e => {
  if (e.target.classList.contains('modal')) e.target.classList.remove('active');
});

// Register form → Stripe Checkout
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('reg-message');
  msg.className = 'message';
  const event = JSON.parse(document.getElementById('reg-event-data').value);
  const payload = {
    name: document.getElementById('reg-name').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    phone: document.getElementById('reg-phone').value.trim(),
    quantity: parseInt(document.getElementById('reg-qty').value, 10) || 1,
    event
  };

  try {
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Checkout failed');
    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error('No checkout URL returned');
    }
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'message error';
  }
});

// General volunteer
document.getElementById('volunteer-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await submitVolunteer({
    name: document.getElementById('vol-name').value.trim(),
    email: document.getElementById('vol-email').value.trim(),
    phone: document.getElementById('vol-phone').value.trim(),
    duty: document.getElementById('vol-duty').value.trim(),
    notes: document.getElementById('vol-notes').value.trim(),
    event: null
  }, 'vol-message', 'volunteer-form');
});

// Specific volunteer
document.getElementById('vol-specific-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const event = JSON.parse(document.getElementById('vol-spec-event-data').value);
  await submitVolunteer({
    name: document.getElementById('vol-spec-name').value.trim(),
    email: document.getElementById('vol-spec-email').value.trim(),
    phone: document.getElementById('vol-spec-phone').value.trim(),
    duty: document.getElementById('vol-spec-duty').value.trim(),
    notes: document.getElementById('vol-spec-notes').value.trim(),
    event
  }, 'vol-spec-message', 'vol-specific-form');
});

async function submitVolunteer(payload, msgId, formId) {
  const msg = document.getElementById(msgId);
  msg.className = 'message';
  try {
    const res = await fetch('/api/volunteer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Submission failed');
    msg.textContent = 'Thank you! A confirmation email has been sent. Check your inbox.';
    msg.className = 'message success';
    document.getElementById(formId).reset();
    if (formId === 'vol-specific-form') {
      setTimeout(() => document.getElementById('vol-modal').classList.remove('active'), 2000);
    }
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'message error';
  }
}

// Handle Stripe success / cancel redirect
window.addEventListener('DOMContentLoaded', () => {
  loadData();
  const params = new URLSearchParams(window.location.search);
  if (params.get('success') === 'true') {
    alert('Payment successful! Please check your email for the receipt (subject: receipt). Bring it to the event.');
    history.replaceState({}, '', window.location.pathname);
  } else if (params.get('canceled') === 'true') {
    alert('Payment canceled. You can try again anytime.');
    history.replaceState({}, '', window.location.pathname);
  }
});