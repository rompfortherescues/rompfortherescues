let eventsData = [];
let charitiesData = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadXML();
  document.getElementById('general-volunteer-btn').addEventListener('click', () => openVolunteer(null));
  document.getElementById('nav-volunteer').addEventListener('click', (e) => {
    e.preventDefault();
    openVolunteer(null);
  });

  // Close modals
  document.querySelectorAll('.close').forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById(el.dataset.close).hidden = true;
    });
  });
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) e.target.hidden = true;
  });

  document.getElementById('register-form').addEventListener('submit', handleRegister);
  document.getElementById('volunteer-form').addEventListener('submit', handleVolunteer);
});

async function loadXML() {
  const res = await fetch('data.xml');
  const text = await res.text();
  const xml = new DOMParser().parseFromString(text, 'application/xml');

  // Description
  document.getElementById('site-description').textContent =
    xml.querySelector('Record > Description')?.textContent || '';

  // Events
  const eventNodes = xml.querySelectorAll('Events > Event');
  const list = document.getElementById('events-list');
  const volSelect = document.getElementById('vol-event-select');

  eventNodes.forEach(node => {
    const name = node.getAttribute('name');
    const date = node.getAttribute('date');
    const time = node.getAttribute('time');
    const type = node.getAttribute('type');
    const fee = node.getAttribute('fee');
    const locations = Array.from(node.querySelectorAll('Location')).map(l => l.textContent);
    const desc = node.querySelector('Description')?.textContent || '';
    const charity = node.querySelector('Charity')?.textContent || '';

    const eventObj = { name, date, time, type, fee, locations, desc, charity };
    eventsData.push(eventObj);

    // Card
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${name}</h3>
      <p><strong>${date}</strong> · ${time} · ${type}</p>
      <p>${locations.join('<br>')}</p>
      <p>${desc}</p>
      <p><em>Supporting: ${charity}</em></p>
      <p><strong>Fee: ${fee}</strong></p>
      <button class="btn btn-pink" onclick='openRegister(${JSON.stringify(eventObj)})'>Register</button>
      <button class="btn btn-turquoise" onclick='openVolunteer("${name}")'>Volunteer</button>
    `;
    list.appendChild(card);

    // Volunteer dropdown
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    volSelect.appendChild(opt);
  });

  // Charities
  const charityNodes = xml.querySelectorAll('Charities > Charity');
  const cList = document.getElementById('charities-list');
  charityNodes.forEach(node => {
    const name = node.getAttribute('name');
    const desc = node.querySelector('Description')?.textContent || '';
    const website = node.querySelector('Website')?.textContent || '#';
    const payLink = node.querySelector('PayLink')?.textContent || website;

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${name}</h3>
      <p>${desc}</p>
      <p><a href="${website}" target="_blank" rel="noopener">Website</a></p>
      <a href="${payLink}" target="_blank" rel="noopener" class="btn btn-pink">Donate</a>
    `;
    cList.appendChild(card);
  });

  // Payment methods
  const methods = xml.querySelectorAll('PaymentMethods > Method');
  const pList = document.getElementById('payment-list');
  methods.forEach(m => {
    const li = document.createElement('li');
    li.textContent = m.textContent;
    pList.appendChild(li);
  });
}

function openRegister(eventObj) {
  document.getElementById('reg-event-name').textContent = eventObj.name;
  document.getElementById('reg-event-data').value = JSON.stringify(eventObj);
  document.getElementById('register-modal').hidden = false;
}

function openVolunteer(eventName) {
  const isGeneral = !eventName;
  document.getElementById('vol-title').textContent = isGeneral
    ? 'General Volunteer Sign-up'
    : `Volunteer for ${eventName}`;
  document.getElementById('vol-event-name').value = eventName || '';
  document.getElementById('vol-event-select').value = eventName || '';

  const phoneLabel = document.getElementById('vol-phone-label');
  const phoneInput = document.getElementById('vol-phone');
  if (isGeneral) {
    phoneLabel.innerHTML = 'Phone *';
    phoneInput.required = true;
  } else {
    phoneLabel.innerHTML = 'Phone (optional)';
    phoneInput.required = false;
  }

  document.getElementById('volunteer-modal').hidden = false;
}

async function handleRegister(e) {
  e.preventDefault();
  const eventObj = JSON.parse(document.getElementById('reg-event-data').value);
  const payload = {
    name: document.getElementById('reg-name').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    phone: document.getElementById('reg-phone').value.trim(),
    qty: parseInt(document.getElementById('reg-qty').value, 10) || 1,
    notes: document.getElementById('reg-notes').value.trim(),
    event: eventObj
  };

  const btn = e.target.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Redirecting to Stripe…';

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
      alert(data.error || 'Could not create payment session');
      btn.disabled = false;
      btn.textContent = 'Proceed to Payment';
    }
  } catch (err) {
    alert('Network error. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Proceed to Payment';
  }
}

async function handleVolunteer(e) {
  e.preventDefault();
  const eventName = document.getElementById('vol-event-select').value || document.getElementById('vol-event-name').value;
  const isGeneral = !eventName;

  const payload = {
    name: document.getElementById('vol-name').value.trim(),
    email: document.getElementById('vol-email').value.trim(),
    phone: document.getElementById('vol-phone').value.trim(),
    event: eventName || null,
    duty: document.getElementById('vol-duty').value.trim(),
    notes: document.getElementById('vol-notes').value.trim(),
    isGeneral
  };

  if (isGeneral && !payload.phone) {
    alert('Phone number is required for general volunteering.');
    return;
  }

  const btn = e.target.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  try {
    const res = await fetch('/api/volunteer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok) {
      alert('Thank you! A confirmation email has been sent.');
      document.getElementById('volunteer-modal').hidden = true;
      e.target.reset();
    } else {
      alert(data.error || 'Could not send registration.');
    }
  } catch (err) {
    alert('Network error. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Volunteer Registration';
  }
}