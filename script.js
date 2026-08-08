document.addEventListener('DOMContentLoaded', async () => {
  const res = await fetch('/data.xml');
  const text = await res.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'text/xml');

  // Org name & description
  const record = xml.querySelector('Record');
  document.getElementById('org-name').textContent = record.getAttribute('name') || 'Romp for the Rescues';
  document.getElementById('description').textContent = record.querySelector('Description')?.textContent || '';

  // Events
  const eventsList = document.getElementById('events-list');
  const volEventSelect = document.getElementById('vol-event');
  const events = xml.querySelectorAll('Event');

  events.forEach((ev, idx) => {
    const name = ev.getAttribute('name') || 'Event';
    const date = ev.getAttribute('date') || '';
    const time = ev.getAttribute('time') || '';
    const type = ev.getAttribute('type') || '';
    const fee = ev.getAttribute('fee') || '$0';
    const locations = Array.from(ev.querySelectorAll('Location')).map(l => l.textContent).join(' · ');
    const desc = ev.querySelector('Description')?.textContent || '';
    const charity = ev.querySelector('Charity')?.textContent || '';

    // Card
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${name}</h3>
      <p class="meta"><strong>${date}</strong> · ${time} · ${type}</p>
      <p class="meta">📍 ${locations}</p>
      <p>${desc}</p>
      <p class="meta">Supporting: <em>${charity}</em></p>
      <p class="meta"><strong>Fee:</strong> ${fee} per person</p>
      <button class="btn pink register-btn" data-idx="${idx}">Register</button>
      <button class="btn turquoise volunteer-btn" data-idx="${idx}">Volunteer</button>
    `;
    eventsList.appendChild(card);

    // Volunteer select option
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = `${name} (${date})`;
    volEventSelect.appendChild(opt);

    // Store data for buttons
    card.querySelector('.register-btn').addEventListener('click', () => openRegisterModal({
      name, date, time, locations, fee, type, desc, charity
    }));
    card.querySelector('.volunteer-btn').addEventListener('click', () => {
      volEventSelect.value = name;
      updatePhoneRequired();
      document.getElementById('volunteer').scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Charities
  const charitiesList = document.getElementById('charities-list');
  xml.querySelectorAll('Charity').forEach(ch => {
    const name = ch.getAttribute('name') || '';
    const desc = ch.querySelector('Description')?.textContent || '';
    const website = ch.querySelector('Website')?.textContent || '#';
    const payLink = ch.querySelector('PayLink')?.textContent || '#';

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h3>${name}</h3>
      <p>${desc}</p>
      <a href="${website}" target="_blank" rel="noopener" class="btn outline">Website</a>
      <a href="${payLink}" target="_blank" rel="noopener" class="btn pink">Donate</a>
    `;
    charitiesList.appendChild(card);
  });

  // Payment methods
  const pmList = document.getElementById('payment-methods');
  xml.querySelectorAll('PaymentMethods Method').forEach(m => {
    const li = document.createElement('li');
    li.textContent = m.textContent;
    pmList.appendChild(li);
  });

  // Volunteer form phone required logic
  const phoneInput = document.getElementById('vol-phone');
  const phoneLabel = document.getElementById('phone-req-label');
  function updatePhoneRequired() {
    const isGeneral = !volEventSelect.value;
    phoneInput.required = isGeneral;
    phoneLabel.textContent = isGeneral ? '(required for general volunteering)' : '(optional for specific events)';
  }
  volEventSelect.addEventListener('change', updatePhoneRequired);
  updatePhoneRequired();

  // Volunteer submit
  document.getElementById('volunteer-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const msg = document.getElementById('volunteer-message');
    msg.className = 'message';
    msg.style.display = 'none';

    const data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      event: form.event.value || 'General (no specific event)',
      duty: form.duty.value.trim() || 'None specified'
    };

    try {
      const r = await fetch('/api/volunteer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await r.json();
      if (r.ok) {
        msg.textContent = 'Thank you! A confirmation email has been sent.';
        msg.className = 'message success';
        form.reset();
        updatePhoneRequired();
      } else {
        throw new Error(result.error || 'Failed');
      }
    } catch (err) {
      msg.textContent = 'Error: ' + err.message;
      msg.className = 'message error';
    }
  });

  // Register modal
  const modal = document.getElementById('register-modal');
  const regForm = document.getElementById('register-form');
  document.querySelector('.close').addEventListener('click', () => modal.hidden = true);
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });

  function openRegisterModal(ev) {
    document.getElementById('reg-event-name').textContent = ev.name;
    document.getElementById('reg-event-details').textContent =
      `${ev.date} · ${ev.time} · ${ev.locations} · Fee ${ev.fee}`;
    regForm.eventName.value = ev.name;
    regForm.eventDate.value = ev.date;
    regForm.eventTime.value = ev.time;
    regForm.eventLocation.value = ev.locations;
    regForm.eventFee.value = ev.fee;
    regForm.eventType.value = ev.type;
    modal.hidden = false;
  }

  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('register-message');
    msg.className = 'message';
    msg.style.display = 'none';

    const data = {
      name: regForm.name.value.trim(),
      email: regForm.email.value.trim(),
      quantity: parseInt(regForm.quantity.value, 10) || 1,
      eventName: regForm.eventName.value,
      eventDate: regForm.eventDate.value,
      eventTime: regForm.eventTime.value,
      eventLocation: regForm.eventLocation.value,
      eventFee: regForm.eventFee.value,
      eventType: regForm.eventType.value
    };

    try {
      const r = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await r.json();
      if (r.ok && result.url) {
        window.location.href = result.url;
      } else {
        throw new Error(result.error || 'Could not start payment');
      }
    } catch (err) {
      msg.textContent = 'Error: ' + err.message;
      msg.className = 'message error';
    }
  });
});