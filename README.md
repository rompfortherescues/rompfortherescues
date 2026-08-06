# Romp for the Rescues

Static site + Cloudflare Pages Functions.

## Local development
1. Put your keys in `.dev.vars`
2. `npx wrangler pages dev .`
3. Open the URL shown (usually http://localhost:8788)

## Deploy to Cloudflare Pages
1. Push to GitHub (`.dev.vars` is ignored)
2. Cloudflare Dashboard → Pages → Create project → Connect repo
3. Build settings: Framework preset = None, Build output directory = `/`
4. After first deploy: Settings → Environment variables → add  
   `RESEND_API_KEY` and `STRIPE_SECRET_KEY` (Production + Preview)
5. Custom domains → Add `RompfortheRescues.org` (already on Cloudflare)

## Stripe & Resend
- Use Stripe **test** keys for the demo.
- Domain `RompfortheRescues.org` must be verified in Resend so `donotreply@…` works.
- All receipts are also CC’d to `rompfortherescues@gmail.com`.