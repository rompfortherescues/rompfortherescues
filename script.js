// ========== Data loading ==========
let siteData = null;

async function loadData() {
  try {
    const res = await fetch('data.xml');
    const text = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'application/xml');
    siteData = parseXML(xml);
    renderAll();
  } catch (err) {
    console.error('Failed to load data.xml', err);
    document.getElementById('events').innerHTML = '<p>Unable to load event data.</p>';
  }
}

function parseXML(xml) {
  const record = xml.querySelector('Record');
  const data = {
    name: record.getAttribute('name'),
    description: record.querySelector('Description')?.textContent.trim(),
    events: [],
    charities: [],
    paymentMethods: []
  };

  record.querySelectorAll('Events > Event').forEach(ev => {
    data.events.push({
      name: ev.getAttribute('name'),
      date: ev.getAttribute('date'),
      time: ev.getAttribute('time'),
      type: ev.getAttribute('type'),
      fee: ev.getAttribute('fee'),
      beneficiary: ev.getAttribute('beneficiary'),
      description: ev.querySelector('Description')?.textContent.trim()
    });
  });

  record.querySelectorAll('Charities > Charity').forEach(ch => {
    data.charities.push({
      name: ch.getAttribute('name'),
      description: ch.querySelector('Description')?.textContent.trim(),
      website: ch.querySelector('Website')?.textContent.trim(),
      payLink: ch.querySelector('PayLink')?.textContent.trim()
    });
  });

  record.querySelectorAll('PaymentMethods > Method').forEach(m => {
    data.paymentMethods.push(m.textContent.trim());
  });

  return data;
}

// ========== Rendering ==========
function renderAll() {
  document.getElementById('org-desc').textContent = siteData.description;

  // Events
  const eventsEl = document.getElementById('events-list');
  eventsEl.innerHTML = '';
  siteData.events.forEach((ev, idx) => {
    const card = document.createElement('div');
    card.className = 'card event-card';
    card.innerHTML = `
      <div>
        <h3>${ev.name} <span class="badge">${ev.type}</span></h3>
        <p><strong>${ev.date}</strong> · ${ev.time}</p>
        <p>${ev.description}</p>
        <p><strong>Supporting:</strong> ${ev.beneficiary}</p>
        <p><strong>Fee:</strong> ${ev.fee} per person</p>
      </div>
      <div>
        <button class="btn btn-accent" onclick="openEventModal(${idx})">Register &amp; Pay</button>
      </div>
    `;
    eventsEl.appendChild(card);
  });

  // Charities
  const charEl = document.getElementById('charities-list');
  charEl.innerHTML = '';
  siteData.charities.forEach(ch => {
    const card = document.createElement('div');
    card.className = 'card charity-card';
    card.innerHTML = `
      <h3>${ch.name}</h3>
      <p>${ch.description}</p>
      <p>
        <a href="${ch.website}" target="_blank" rel="noopener" class="btn btn-outline">Website</a>
        <a href="${ch.payLink}" target="_blank" rel="noopener" class="btn btn-accent" style="margin-left:0.5rem">Donate Directly</a>
      </p>
    `;
    charEl.appendChild(card);
  });

  // Payment methods
  const pmEl = document.getElementById('payment-methods');
  pmEl.innerHTML = siteData.paymentMethods.map(m => `<span>${m}</span>`).join('');
}

// ========== Event Registration Modal ==========
function openEventModal(idx) {
  const ev = siteData.events[idx];
  document.getElementById('modal-title').textContent = `Register – ${ev.name}`;
  document.getElementById('event-idx').value = idx;
  document.getElementById('reg-form').reset();
  document.getElementById('reg-result').style.display = 'none';
  document.getElementById('reg-form').style.display = 'grid';
  document.getElementById('event-modal').classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Demo Stripe payment + email
document.getElementById('reg-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Processing payment…';

  // Simulate Stripe processing delay
  await new Promise(r => setTimeout(r, 1500));

  const idx = +document.getElementById('event-idx').value;
  const ev = siteData.events[idx];
  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const qty = +form.quantity.value || 1;
  const total = (parseFloat(ev.fee.replace(/[^0-9.]/g, '')) * qty).toFixed(2);

  // Build the exact email that would be sent
  const emailBody = `Thank you for registering for ${ev.name}!

Event Details
-------------
Name: ${ev.name}
Date: ${ev.date}
Time: ${ev.time}
Type: ${ev.type}
Fee: ${ev.fee} per person
Supporting: ${ev.beneficiary}
Description: ${ev.description}

Your Registration
-----------------
Name: ${name}
Email: ${email}
Number of tickets: ${qty}
Total paid: $${total}

Please bring this email (printed or on your phone) to the event as your receipt.

This is an automated message. Do not reply.
`;

  // In production a Cloudflare Worker would send:
  // From: donotreply@rompfortherescues.org
  // To: email
  // Cc: RompfortheRescues@gmail.com
  // Subject: Registration Confirmation – Mrs. Roper Romp

  document.getElementById('reg-form').style.display = 'none';
  const result = document.getElementById('reg-result');
  result.style.display = 'block';
  result.innerHTML = `
    <div class="demo-note">
      <strong>DEMO MODE</strong> – Payment simulated successfully.<br>
      In production this would charge via Stripe and send the email below from
      <code>donotreply@rompfortherescues.org</code> (CC: RompfortheRescues@gmail.com).
      No data is stored.
    </div>
    <h4>Email that would be sent:</h4>
    <div class="email-preview">${emailBody}</div>
    <br>
    <button class="btn" onclick="closeModal('event-modal')">Close</button>
  `;
  btn.disabled = false;
  btn.textContent = 'Pay with Stripe (Demo)';
});

// ========== Volunteer form ==========
document.getElementById('vol-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Sending…';

  await new Promise(r => setTimeout(r, 800));

  const name = form.volName.value.trim();
  const email = form.volEmail.value.trim();
  const phone = form.volPhone.value.trim() || '(not provided)';
  const duty = form.duty.value;
  const notes = form.notes.value.trim() || '(none)';

  const emailBody = `Thank you for volunteering with Romp for the Rescues!

Volunteer Details
-----------------
Name: ${name}
Email: ${email}
Phone: ${phone}
Preferred duty: ${duty}
Additional notes: ${notes}

We will be in touch closer to the event with schedule details.

This is an automated message. Do not reply.
`;

  document.getElementById('vol-result').style.display = 'block';
  document.getElementById('vol-result').innerHTML = `
    <div class="demo-note">
      <strong>DEMO MODE</strong> – In production an email would be sent from
      <code>donotreply@rompfortherescues.org</code> (CC: rompfortherescues@gmail.com).
      No data is stored.
    </div>
    <h4>Email that would be sent:</h4>
    <div class="email-preview">${emailBody}</div>
  `;

  form.reset();
  btn.disabled = false;
  btn.textContent = 'Register as Volunteer';
});

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', (e) => {
    if (e.target === el) el.classList.remove('open');
  });
});

// Smooth nav highlighting
document.querySelectorAll('nav a').forEach(a => {
  a.addEventListener('click', () => {
    document.querySelectorAll('nav a').forEach(x => x.classList.remove('active'));
    a.classList.add('active');
  });
});

// Init
loadData();