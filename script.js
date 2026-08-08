const STRIPE_PK = window.STRIPE_PUBLISHABLE_KEY || ''; // injected or set via env in production if needed
let stripe = null;
let data = null;

document.getElementById('year').textContent = new Date().getFullYear();

async function loadData() {
  const res = await fetch('/data.xml');
  const text = await res.text();
  const parser = new DOMParser();
  data = parser.parseFromString(text, 'application/xml');
  renderEvents();
  renderCharities();
}

function renderEvents() {
  const container = document.getElementById('events-list');
  const events = [...data.querySelectorAll('event')];
  if (!events.length) {
    container.innerHTML = '<p>No upcoming events yet.</p>';
    return;
  }
  container.innerHTML = events.map(ev => {
    const id = ev.getAttribute('id') || '';
    const name = ev.querySelector('name')?.textContent || '';
    const date = ev.querySelector('date')?.textContent || '';
    const time = ev.querySelector('time')?.textContent || '';
    const loc = ev.querySelector('location')?.textContent || '';
    const desc = ev.querySelector('description')?.textContent || '';
    const price = ev.querySelector('price')?.textContent || '0';
    const charities = ev.querySelector('charities')?.textContent || '';
    return `
      <div class="card" data-id="${id}">
        <h3>${name}</h3>
        <p><strong>${date}</strong> ${time ? '· ' + time : ''}</p>
        <p>${loc}</p>
        <p>${desc}</p>
        <p><em>Supports: ${charities}</em></p>
        <p><strong>$${price}</strong> per person</p>
        <button class="btn btn-register" data-action="register"
          data-id="${id}" data-name="${name}" data-price="${price}">Register</button>
        <button class="btn btn-volunteer" data-action="volunteer"
          data-id="${id}" data-name="${name}"
          data-duties="${ev.querySelector('duties')?.textContent || ''}">Volunteer</button>
      </div>`;
  }).join('');
}

function renderCharities() {
  const container = document.getElementById('charities-list');
  const charities = [...data.querySelectorAll('charity')];
  container.innerHTML = charities.map(c => {
    const name = c.querySelector('name')?.textContent || '';
    const desc = c.querySelector('description')?.textContent || '';
    const web = c.querySelector('website')?.textContent || '';
    const pay = c.querySelector('PayLink')?.textContent || '';
    return `
      <div class="card">
        <h3>${name}</h3>
        <p>${desc}</p>
        ${web ? `<p><a href="${web}" target="_blank" rel="noopener">Website</a></p>` : ''}
        ${pay ? `<a class="btn btn-donate" href="${pay}" target="_blank" rel="noopener">Donate</a>` : ''}
      </div>`;
  }).join('');

  const adminPay = data.querySelector('admin PayLink')?.textContent;
  const adminEl = document.getElementById('admin-donate');
  if (adminPay) {
    adminEl.innerHTML = `<a class="btn btn-donate" href="${adminPay}" target="_blank">Donate for Administration</a>`;
  } else {
    adminEl.innerHTML = `<p><em>Administration donations can be made via event registration surplus or contact us.</em></p>`;
  }
}

// Modal helpers
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('[data-close]').forEach(el => {
  el.addEventListener('click', () => closeModal(el.dataset.close));
});

// Event delegation for Register / Volunteer buttons
document.getElementById('events-list').addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  const name = btn.dataset.name;

  if (action === 'register') {
    document.getElementById('reg-title').textContent = `Register – ${name}`;
    document.getElementById('reg-event-id').value = id;
    document.getElementById('reg-event-name').value = name;
    document.getElementById('reg-price').value = btn.dataset.price;
    openModal('register-modal');
  } else if (action === 'volunteer') {
    openVolunteerForm({ id, name, duties: btn.dataset.duties, requiredPhone: false });
  }
});

document.getElementById('btn-general-volunteer').addEventListener('click', () => {
  openVolunteerForm({ id: '', name: '', duties: '', requiredPhone: true });
});

function openVolunteerForm({ id, name, duties, requiredPhone }) {
  document.getElementById('vol-title').textContent = name
    ? `Volunteer – ${name}`
    : 'General Volunteer Sign-up';
  document.getElementById('vol-event-id').value = id;
  document.getElementById('vol-event-name').value = name;
  const field = document.getElementById('vol-event-field');
  const display = document.getElementById('vol-event-display');
  if (name) {
    field.style.display = 'block';
    display.value = name;
  } else {
    field.style.display = 'none';
  }
  const phone = document.getElementById('vol-phone');
  const label = document.getElementById('vol-phone-label');
  if (requiredPhone) {
    phone.required = true;
    label.textContent = 'Phone *';
  } else {
    phone.required = false;
    label.textContent = 'Phone (optional)';
  }
  // populate duties
  const sel = document.getElementById('vol-duty');
  sel.innerHTML = '<option value="">— Any / General —</option>';
  (duties || '').split(',').map(d => d.trim()).filter(Boolean).forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    sel.appendChild(opt);
  });
  openModal('volunteer-modal');
}

// Register form → create Stripe Checkout Session
document.getElementById('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const body = {
    eventId: document.getElementById('reg-event-id').value,
    eventName: document.getElementById('reg-event-name').value,
    price: document.getElementById('reg-price').value,
    name: fd.get('name'),
    email: fd.get('email'),
    phone: fd.get('phone') || '',
    attendees: fd.get('attendees'),
    notes: fd.get('notes') || ''
  };

  const res = await fetch('/api/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (data.url) {
    window.location = data.url; // Stripe Checkout
  } else {
    alert(data.error || 'Could not start payment');
  }
});

// Volunteer form → email only
document.getElementById('volunteer-form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const body = {
    eventId: document.getElementById('vol-event-id').value,
    eventName: document.getElementById('vol-event-name').value,
    name: fd.get('name'),
    email: fd.get('email'),
    phone: fd.get('phone') || '',
    duty: fd.get('duty') || '',
    notes: fd.get('notes') || ''
  };

  const res = await fetch('/api/volunteer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (data.ok) {
    alert('Thank you! A confirmation email has been sent.');
    closeModal('volunteer-modal');
    form.reset();
  } else {
    alert(data.error || 'Submission failed');
  }
});

loadData().catch(console.error);