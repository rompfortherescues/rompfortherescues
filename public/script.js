let orgData = null;

async function loadData() {
  const res = await fetch('/data.xml');
  const text = await res.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror')) {
    console.error('XML parse error');
    return;
  }

  const record = xml.querySelector('Record');
  document.getElementById('org-name').textContent = record.getAttribute('name') || 'Romp for the Rescues';
  document.getElementById('org-desc').textContent = record.querySelector('Description')?.textContent || '';

  // Events
  const eventsList = document.getElementById('events-list');
  eventsList.innerHTML = '';
  xml.querySelectorAll('Event').forEach(ev => {
    const name = ev.getAttribute('name');
    const date = ev.getAttribute('date');
    const time = ev.getAttribute('time');
    const type = ev.getAttribute('type');
    const fee = ev.getAttribute('fee');
    const forWhom = ev.getAttribute('for');
    const locs = Array.from(ev.querySelectorAll('Location')).map(l => l.textContent).join(' · ');
    const desc = ev.querySelector('Description')?.textContent || '';
    const charity = ev.querySelector('Charity')?.textContent || '';

    const card = document.createElement('div');
    card.className = 'event-card';
    card.innerHTML = `
      <h3>${name}</h3>
      <p><strong>${date}</strong> · ${time} · ${type}</p>
      <p>${locs}</p>
      <p>${desc}</p>
      <p>Supports: <em>${charity}</em> · Fee: ${fee} (${forWhom})</p>
      <button class="btn pink register-btn" data-event='${JSON.stringify({
        name, date, time, type, fee, for: forWhom, location: locs, description: desc, charity
      })}'>Register</button>
      <button class="btn turquoise volunteer-btn" data-event="${name}">Volunteer for this Event</button>
    `;
    eventsList.appendChild(card);
  });

  // Charities
  const charitiesList = document.getElementById('charities-list');
  charitiesList.innerHTML = '';
  xml.querySelectorAll('Charity').forEach(ch => {
    const name = ch.getAttribute('name');
    const desc = ch.querySelector('Description')?.textContent || '';
    const website = ch.querySelector('Website')?.textContent || '';
    const payLink = ch.querySelector('PayLink')?.textContent || '';
    const card = document.createElement('div');
    card.className = 'charity-card';
    card.innerHTML = `
      <h3>${name}</h3>
      <p>${desc}</p>
      <p><a href="${website}" target="_blank" rel="noopener">Website</a> · 
         <a href="${payLink}" target="_blank" rel="noopener" class="btn pink" style="padding:0.3rem 0.8rem;font-size:0.9rem;">Donate</a></p>
    `;
    charitiesList.appendChild(card);
  });

  // Payment methods
  const methods = document.getElementById('methods-list');
  methods.innerHTML = '';
  xml.querySelectorAll('Method').forEach(m => {
    const li = document.createElement('li');
    li.textContent = m.textContent;
    methods.appendChild(li);
  });

  // Wire buttons
  document.querySelectorAll('.register-btn').forEach(btn => {
    btn.addEventListener('click', () => openRegister(JSON.parse(btn.dataset.event)));
  });
  document.querySelectorAll('.volunteer-btn').forEach(btn => {
    btn.addEventListener('click', () => openVolunteer(btn.dataset.event));
  });
  document.getElementById('general-volunteer-btn').addEventListener('click', () => openVolunteer(null));
}

function openRegister(eventData) {
  document.getElementById('reg-event-name').textContent = eventData.name;
  document.getElementById('reg-event-data').value = JSON.stringify(eventData);
  document.getElementById('register-modal').style.display = 'block';
}

function openVolunteer(eventName) {
  const isGeneral = !eventName;
  document.getElementById('vol-title').textContent = isGeneral ? 'General Volunteer Registration' : `Volunteer for ${eventName}`;
  document.getElementById('vol-event-name').value = eventName || '';
  document.getElementById('vol-event-label').style.display = isGeneral ? 'none' : 'block';
  document.getElementById('vol-event-display').value = eventName || '';
  const phoneInput = document.getElementById('vol-phone');
  const phoneLabel = document.getElementById('vol-phone-label');
  if (isGeneral) {
    phoneInput.required = true;
    phoneLabel.innerHTML = 'Phone <span style="color:red">*</span> <input type="tel" id="vol-phone" required>';
  } else {
    phoneInput.required = false;
    phoneLabel.innerHTML = 'Phone (optional) <input type="tel" id="vol-phone">';
  }
  // re-bind because we replaced the input
  document.getElementById('vol-phone').required = isGeneral;
  document.getElementById('volunteer-modal').style.display = 'block';
}

document.querySelectorAll('.close').forEach(c => {
  c.addEventListener('click', () => {
    document.getElementById('register-modal').style.display = 'none';
    document.getElementById('volunteer-modal').style.display = 'none';
  });
});

window.onclick = (e) => {
  if (e.target.classList.contains('modal')) {
    e.target.style.display = 'none';
  }
};

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const eventData = JSON.parse(document.getElementById('reg-event-data').value);
  const payload = {
    event: eventData,
    name: document.getElementById('reg-name').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    quantity: parseInt(document.getElementById('reg-qty').value, 10) || 1,
    phone: document.getElementById('reg-phone').value.trim() || null
  };

  showMessage('Creating checkout…');
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
      showMessage(data.error || 'Checkout failed');
    }
  } catch (err) {
    showMessage('Network error');
  }
});

document.getElementById('volunteer-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    name: document.getElementById('vol-name').value.trim(),
    email: document.getElementById('vol-email').value.trim(),
    phone: document.getElementById('vol-phone')?.value.trim() || null,
    duty: document.getElementById('vol-duty').value.trim() || null,
    event: document.getElementById('vol-event-name').value || null
  };

  showMessage('Sending registration…');
  try {
    const res = await fetch('/api/volunteer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok) {
      showMessage('Thank you! Confirmation email sent.');
      document.getElementById('volunteer-modal').style.display = 'none';
      e.target.reset();
    } else {
      showMessage(data.error || 'Failed');
    }
  } catch (err) {
    showMessage('Network error');
  }
});

function showMessage(msg) {
  const el = document.getElementById('message');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 4000);
}

// Handle success redirect from Stripe
if (new URLSearchParams(location.search).get('payment') === 'success') {
  showMessage('Payment successful! Check your email for the receipt.');
  history.replaceState({}, '', location.pathname);
}

loadData();