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
          <a href="${payLink}" target="_blank" rel="noopener" class="btn btn-pink">Donate</a>
        </p>
      `;
      charitiesList.appendChild(card);
    });

    // Payment methods
    const paymentList = document.getElementById('payment-methods');
    if (paymentList) {
      paymentList.innerHTML = '';
      xml.querySelectorAll('PaymentMethods > Method').forEach(m => {
        const li = document.createElement('li');
        li.textContent = m.textContent.trim();
        paymentList.appendChild(li);
      });
    }
  } catch (err) {
    console.error('Failed to load data.xml', err);
  }
}

function openRegister(eventObj) {
  document.getElementById('reg-event-info').textContent =
    `${eventObj.name} – ${eventObj.date} ${eventObj.time} – Fee: ${eventObj.fee}`;
  document.getElementById('reg-event-data').value = JSON.stringify(eventObj);
  document.getElementById('register-modal').style.display = 'block';
}

function openSpecificVolunteer(eventObj) {
  document.getElementById('vol-event-info').textContent =
    `Event: ${eventObj.name} – ${eventObj.date} ${eventObj.time}`;
  document.getElementById('vol-spec-event-data').value = JSON.stringify(eventObj);
  document.getElementById('vol-modal').style.display = 'block';
}

// Close modals
document.querySelectorAll('.close').forEach(el => {
  el.addEventListener('click', () => {
    const id = el.getAttribute('data-modal');
    if (id) document.getElementById(id).style.display = 'none';
  });
});
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) e.target.style.display = 'none';
});

// General volunteer (on-page form)
document.getElementById('volunteer-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    name: document.getElementById('vol-name').value.trim(),
    email: document.getElementById('vol-email').value.trim(),
    phone: document.getElementById('vol-phone').value.trim(),
    duty: document.getElementById('vol-duty').value.trim(),
    notes: document.getElementById('vol-notes').value.trim(),
    event: null
  };
  await submitVolunteer(payload, e.target, 'vol-message');
});

// Specific volunteer modal
document.getElementById('vol-specific-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const eventObj = JSON.parse(document.getElementById('vol-spec-event-data').value || '{}');
  const payload = {
    name: document.getElementById('vol-spec-name').value.trim(),
    email: document.getElementById('vol-spec-email').value.trim(),
    phone: document.getElementById('vol-spec-phone').value.trim(),
    duty: document.getElementById('vol-spec-duty').value.trim(),
    notes: document.getElementById('vol-spec-notes').value.trim(),
    event: eventObj
  };
  await submitVolunteer(payload, e.target, 'vol-spec-message');
});

async function submitVolunteer(payload, form, msgId) {
  const btn = form.querySelector('button[type="submit"]');
  const msg = document.getElementById(msgId);
  btn.disabled = true;
  btn.textContent = 'Sending…';
  msg.className = 'message';
  msg.style.display = 'none';

  try {
    const res = await fetch('/api/volunteer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok) {
      msg.textContent = 'Thank you! A confirmation email has been sent.';
      msg.className = 'message success';
      msg.style.display = 'block';
      form.reset();
      setTimeout(() => {
        document.getElementById('vol-modal').style.display = 'none';
      }, 1500);
    } else {
      msg.textContent = data.error || 'Could not send registration.';
      msg.className = 'message error';
      msg.style.display = 'block';
    }
  } catch (err) {
    msg.textContent = 'Network error. Please try again.';
    msg.className = 'message error';
    msg.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Submit Volunteer Registration';
  }
}

// Register → Stripe
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const eventObj = JSON.parse(document.getElementById('reg-event-data').value);
  const payload = {
    name: document.getElementById('reg-name').value.trim(),
    email: document.getElementById('reg-email').value.trim(),
    phone: document.getElementById('reg-phone').value.trim(),
    quantity: parseInt(document.getElementById('reg-qty').value, 10) || 1,
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
      btn.textContent = 'Proceed to Payment (Stripe)';
    }
  } catch (err) {
    alert('Network error. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Proceed to Payment (Stripe)';
  }
});

// Admin donation
document.getElementById('admin-donate-btn').addEventListener('click', async () => {
  const name = prompt('Your full name (for receipt):');
  const email = prompt('Your email (for receipt):');
  if (!name || !email) return;

  try {
    const res = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        email,
        quantity: 1,
        event: {
          name: 'Donation – Romp for the Rescues Administration',
          date: new Date().toLocaleDateString(),
          time: '',
          fee: '$25.00',
          description: 'General support for event costs and outreach',
          locations: [],
          charity: 'Romp for the Rescues (Administration)'
        },
        type: 'donation'
      })
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else alert(data.error || 'Could not start donation');
  } catch (err) {
    alert('Network error');
  }
});

loadData();