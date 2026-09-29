# Admin Editor: Remaining Setup

The admin page and Pages Functions are implemented. Event, charity, duty, and Record Description edits are saved to `data.xml`; picture uploads and deletions operate on R2 immediately.

## Already configured in the repository

The updated `wrangler.toml` declares the production buckets at the top level and explicitly overrides the preview environment:

- Production `XML_DATA_BUCKET` -> `prod-xmldata`; preview -> `dev-xmldata`.
- Production `EVENT_PICTURES_BUCKET` -> `prod-eventpictures`; preview -> `dev-eventpictures`.
- `SLIDESHOW_BUCKET` remains `slideshowpictures` in both environments.

The top-level `preview_bucket_name` values select local development buckets; deployed Pages previews use the explicit `[env.preview.r2_buckets]` bindings. No further Wrangler binding changes are required.

## Remaining Cloudflare setup

### 1. Confirm R2 resources and content

In **R2 Object Storage**, confirm that all four bucket names above exist. Confirm that `data.xml` is present and contains the correct data in both `prod-xmldata` and `dev-xmldata`. Keep production and preview content separate as intended.

Event images are stored at the root of the corresponding event-pictures bucket. The editor accepts JPG, JPEG, PNG, WebP, and GIF images, converts each upload to WebP, rejects converted files larger than 1 MB, and stores accepted files under a generated filename. Uploading for an event with an existing picture first stores the new file, then updates all matching `<Picture>` references in `data.xml` and removes the old object. The public `/r2-images/*` route serves the files and revalidates its cache.

### 2. Create Cloudflare Access applications

Use a custom hostname attached to the Pages project. In **Cloudflare Zero Trust > Access > Applications**, create Self-hosted applications for the hostname and these paths:

- `/admin/*` for the admin page.
- `/api/admin/*` for the XML and picture management API.

Add an Allow policy to each production application for only the administrators' email addresses or identity groups. Leave other users denied. If users can visit `/admin` without the trailing slash, cover that exact path as well; the page is served at `/admin/`.

Record each production application's **Application Audience (AUD) Tag**. The admin UI and API apps have different tags. The preview environment is intentionally unauthenticated for focus-group testing and uses the `dev-*` R2 buckets. Anyone with the preview URL can edit or delete preview data and images; do not store production data there. Keep the preview branch name different from the configured production branch.

### 3. Set Pages environment variables

In **Workers & Pages > rompfortherescues > Settings > Variables and Secrets**, set these plain-text variables for production:

- `CF_ACCESS_TEAM_DOMAIN`: the Access team domain, e.g. `your-team.cloudflareaccess.com` (no path).
- `CF_ACCESS_AUD`: both path-application audience tags, comma-separated, e.g. `admin-ui-aud,admin-api-aud`.

Use the audience tags for the production hostname. The Pages Functions verify the Access JWT signature, issuer, expiry, and audience on every production admin API request. Missing variables cause production API requests to fail closed. Preview bypass is enabled only when `ADMIN_ACCESS_PREVIEW_BYPASS` is `true` and `CF_PAGES_BRANCH` differs from `PRODUCTION_BRANCH` (`main` by default).

### 4. Deploy

Deploy the Pages project after setting the production Access policies and variables. Confirm the deployed production and preview environments use the matching R2 bucket bindings from `wrangler.toml`. Do not attach a Cloudflare Access application to the focus-group preview hostname if participants should reach it without login.

## Production verification checklist

1. Open `https://<your-host>/admin/` as an allowed administrator; verify a disallowed account is blocked.
2. Confirm the page loads events, charities, duties, the Record Description, and the image library.
3. Edit an event, charity, duty, and Record Description; select **Save changes**, reload, and confirm the changes persisted.
4. Upload an image, assign it through an event's `<Picture>` detail, save, and confirm it renders on the public site.
5. Choose an event with a picture and upload a replacement; confirm a new WebP file is added, the old file is removed, and the public site shows the replacement.
6. Attempt to delete an image referenced by saved XML; deletion should be refused. Change or remove the reference, save the XML, then delete the unused image.
7. Repeat checks on preview if it is enabled, confirming it changes only the `dev-*` buckets.

## Local development

Run the Pages dev server from the repository root so the Pages Functions and configured R2 bindings are available. A plain static file server cannot serve the XML or picture APIs. The admin API requires a valid Cloudflare Access JWT, so use the deployed Access-protected hostname for end-to-end admin verification.

## Saving behavior

- XML edits remain in the page until **Save changes**. A stale version is rejected instead of replacing a newer save; reload and reapply your edits.
- Picture uploads and deletions happen immediately. Uploading does not assign an image to an event; choose it in the event's `<Picture>` field and save the XML.
- Deletion is blocked while any saved `<Picture>` field references that filename.
- Charities use `<Charities><Charity name="...">` with editable child details such as `<Description>`, `<Website>`, and `<PayLink>`.
