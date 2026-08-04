# Romp for the Rescues (bondservant.org)

Static site + Cloudflare Pages Functions.

## Local development
1. Copy `.dev.vars.example` → `.dev.vars` and add your Resend API key.
2. `npx wrangler pages dev . --compatibility-date=2024-09-23`
3. Open the local URL. Forms hit `/api/*` Functions.

## Deploy to Cloudflare Pages
1. Push repo to GitHub.
2. Cloudflare Dashboard → Pages → Create project → Connect GitHub.
3. Build settings: Framework preset = None, Build output directory = `/` (or leave empty).
4. Settings → Environment variables → add `RESEND_API_KEY` (Production + Preview).
5. (Later) Add custom domain `bondservant.org`.

## Production Stripe (next step)
- Create Checkout Sessions inside `functions/api/register.js`.
- Use a success URL + webhook (or retrieve session on a success page) to send the real receipt only after payment succeeds.
- Never expose secret keys to the browser.

Emails are sent via your existing Resend account. Verify the from-domain (`RompfortheRescues.org`) in Resend.
No form data is stored anywhere.
