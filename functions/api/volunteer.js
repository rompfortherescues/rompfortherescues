import { sendEmail } from '../lib/email.js';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const data = await request.json();
    const { name, email, phone = '', duty = '', notes = '', event } = data;

    if (!name || !email) {
      return json({ error: 'Name and email are required' }, 400);
    }

    const isGeneral = !event || !event.name;
    if (isGeneral && !phone) {
      return json({ error: 'Telephone is required for general volunteering' }, 400);
    }

    let body = `Thank you for volunteering with Romp for the Rescues!\n\n`;
    body += `Name: ${name}\n`;
    body += `Email: ${email}\n`;
    body += `Phone: ${phone || 'N/A'}\n`;
    body += `Preferred Duty: ${duty || 'General'}\n`;

    if (event && event.name) {
      body += `Event: ${event.name}\n`;
      body += `Date: ${event.date || ''} ${event.time || ''}\n`;
    } else {
      body += `Event: General / Any event\n`;
    }

    if (notes) body += `Notes: ${notes}\n`;
    body += `\nWe look forward to your help!\n\nRomp for the Rescues`;

    await sendEmail(env, {
      from: 'donotreply@RompfortheRescues.org',
      to: [email],
      cc: ['rompfortherescues@gmail.com'],
      subject: 'Volunteer Registration Receipt',
      text: body
    });

    return json({ success: true });
  } catch (err) {
    return json({ error: err.message || 'Server error' }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}