# Admin Editor: Remaining Setup

The admin page and Pages Functions are implemented. Event, charity, duty, and Record Description edits are saved to `data.xml`; picture uploads and deletions operate on R2 immediately.

## Already configured in the repository

The updated `wrangler.toml` declares:

- `XML_DATA_BUCKET`: `prod-xmldata` in production and `dev-xmldata` in preview.
- `EVENT_PICTURES_BUCKET`: `prod-eventpictures` in production and `dev-eventpictures` in preview.

No further Wrangler binding changes are required. The existing `SLIDESHOW_BUCKET` is unrelated to event picture storage.

## Remaining Cloudflare setup

### 1. Confirm R2 resources and content

In **R2 Object Storage**, confirm that all four bucket names above exist. Confirm that `data.xml` is present and contains the correct data in both `prod-xmldata` and `dev-xmldata`. Keep production and preview content separate as intended.

Event images are stored at the root of the corresponding event-pictures bucket. The editor accepts JPEG, PNG, GIF, WebP, and AVIF files up to 12 MB. Uploading an existing filename overwrites that object. The public `/r2-images/*` route serves the object and revalidates its cache so an overwrite is visible.

### 2. Create Cloudflare Access applications

Use a custom hostname attached to the Pages project. In **Cloudflare Zero Trust > Access > Applications**, create Self-hosted applications for the hostname and these paths:

- `/admin/*` for the admin page.
- `/api/admin/*` for the XML and picture management API.

Add an Allow policy to each application for only the administrators' email addresses or identity groups. Leave other users denied. If users can visit `/admin` without the trailing slash, cover that exact path as well; the page is served at `/admin/`.

Record each application's **Application Audience (AUD) Tag**. The two tags are different. If preview uses a separate hostname, create and protect matching applications for it too, or disable public access to that preview. Do not expose an unprotected preview admin.

### 3. Set Pages environment variables

In **Workers & Pages > rompfortherescues > Settings > Variables and Secrets**, set these plain-text variables for each deployed environment that will use the editor:

- `CF_ACCESS_TEAM_DOMAIN`: the Access team domain, e.g. `your-team.cloudflareaccess.com` (no path).
- `CF_ACCESS_AUD`: both path-application audience tags, comma-separated, e.g. `admin-ui-aud,admin-api-aud`.

Use the audience tags for the hostname/environment being configured. The Pages Functions verify the Access JWT signature, issuer, expiry, and audience on every admin API request. Missing variables cause API requests to fail closed.

### 4. Deploy

Deploy the Pages project after setting the Access policies and variables. Confirm the deployed production and preview environments use the matching R2 bucket bindings from `wrangler.toml` and the matching Access audience tags.

## Production verification checklist

1. Open `https://<your-host>/admin/` as an allowed administrator; verify a disallowed account is blocked.
2. Confirm the page loads events, charities, duties, the Record Description, and the image library.
3. Edit an event, charity, duty, and Record Description; select **Save changes**, reload, and confirm the changes persisted.
4. Upload an image, assign it through an event's `<Picture>` detail, save, and confirm it renders on the public site.
5. Upload a replacement with the same filename; confirm it overwrites the object and the public site shows the replacement.
6. Attempt to delete an image referenced by saved XML; deletion should be refused. Change or remove the reference, save the XML, then delete the unused image.
7. Repeat checks on preview if it is enabled, confirming it changes only the `dev-*` buckets.

## Local development

Run the Pages dev server from the repository root so the Pages Functions and configured R2 bindings are available. A plain static file server cannot serve the XML or picture APIs. The admin API requires a valid Cloudflare Access JWT, so use the deployed Access-protected hostname for end-to-end admin verification.

## Saving behavior

- XML edits remain in the page until **Save changes**. A stale version is rejected instead of replacing a newer save; reload and reapply your edits.
- Picture uploads and deletions happen immediately. Uploading does not assign an image to an event; choose it in the event's `<Picture>` field and save the XML.
- Deletion is blocked while any saved `<Picture>` field references that filename.
- Charities use `<Charities><Charity name="...">` with editable child details such as `<Description>`, `<Website>`, and `<PayLink>`.
