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
      `;
      charitiesList.appendChild(card);
    });
          <a href="${payLink}" target="_blank" rel="noopener" class="btn btn-pink