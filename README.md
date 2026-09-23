# Romp for the Rescues – Cloudflare Pages Site

Static site + Cloudflare Pages Functions. Domain: RompfortheRescues.org

## Setup

1. Create a GitHub repo and push this project (do **not** commit `.dev.vars`).
2. In Cloudflare Dashboard → Pages → Create project → Connect to Git → select the repo.
   - Framework preset: None
   - Build command: (leave empty)
   - Build output directory: `/`
3. After first deploy, go to Settings → Variables and Secrets and add:
   - `RESEND_API_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
4. Add custom domain `RompfortheRescues.org` (already reserved).
5. **Resend**: Verify the domain `RompfortheRescues.org` and ensure `donotreply@RompfortheRescues.org` can send.
6. **Stripe**:
   - Enable desired payment methods (Card, PayPal, Venmo if available in your region).
   - Create a webhook endpoint: `https://rompfortherescues.org/api/stripe-webhook`
   - Events to send: `checkout.session.completed`
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
7. Local testing:
   ```bash
   npx wrangler pages dev . 