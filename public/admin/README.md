# Admin editor setup

The admin page manages the `data.xml` object in the `xmldata` R2 bucket and event images in the `eventpictures` R2 bucket. XML changes are staged in the page until **Save changes** is selected. Picture uploads and deletions affect R2 immediately.

## Cloudflare setup

### 1. Check the R2 buckets and Pages bindings

The repository's `wrangler.toml` already declares these bindings:

- `XML_DATA_BUCKET` -> `xmldata`
- `EVENT_PICTURES_BUCKET` -> `eventpictures`

In Cloudflare, confirm that both R2 buckets exist and that the Pages project has these bindings in its production and preview environments. `data.xml` must exist in `xmldata`. Event image files are stored at the root of `eventpictures`; uploading a filename already in use overwrites that object.

No extra binding is needed for these admin features. The existing `/r2-images/*` Pages Function serves image objects from `EVENT_PICTURES_BUCKET` and now requires image revalidation so overwrites appear on the public site.

### 2. Protect the admin page and API with Access

Use a custom domain attached to the Pages project. In **Cloudflare Zero Trust > Access > Applications**, create two **Self-hosted** applications using that hostname:

- Path `/admin/*` to protect the admin interface.
- Path `/api/admin/*` to protect its data and picture APIs.

Add an Allow policy to both applications for only the email addresses or identity groups that may administer the site. Leave unmatched users denied. If administrators use `/admin` without the trailing slash, make sure that exact path is also covered by the UI application's path configuration; the page itself is served at `/admin/`.

Record the **Application Audience (AUD) Tag** shown for each application. The application tags are different, so configure both as a comma-separated list. Access must proxy requests to the Pages hostname so it supplies the `CF-Access-Jwt-Assertion` header; the API independently verifies the token signature, issuer, expiry, and audience.

### 3. Configure Pages environment variables

In **Workers & Pages > rompfortherescues > Settings > Variables and Secrets**, add these plain-text variables for every environment that will run the admin editor:

- `CF_ACCESS_TEAM_DOMAIN`: your Access team domain, such as `your-team.cloudflareaccess.com` (without a path).
- `CF_ACCESS_AUD`: the UI and API audience tags separated by a comma, for example `ui-audience-tag,api-audience-tag`.

Use the appropriate audience tags for each environment. If preview deployments are accessible to administrators, create matching Access applications and policies for the preview hostname and set that environment's audience tags too. Do not leave an unprotected preview admin available publicly.

Redeploy the Pages project after changing bindings or environment variables so its Functions receive the new configuration.

### 4. Verify deployment and permissions

1. Visit `https://<your-host>/admin/` while signed in as an allowed administrator. An unauthorized identity should be blocked by Access.
2. Confirm the page loads events, charities, duties, the Record Description, and the picture library.
3. Upload a small JPEG, PNG, GIF, WebP, or AVIF image (maximum 12 MB). Uploading a filename that already exists asks for confirmation and overwrites the object.
4. Edit an event and select the image from its `Picture` detail, then save XML changes. The event XML stores a `/r2-images/<filename>` URL.
5. Try deleting a picture that is still referenced by saved XML. The API refuses; first change or remove that reference and save the XML, then delete the unused file.
6. Edit a charity or the Record Description, save, and verify the public page reflects the XML update.

## Editor behavior

- Event, charity, duty, and Record Description changes are held in the browser until **Save changes**. A stale XML version is rejected rather than overwriting someone else's newer save; reload and reapply the change.
- Picture uploads overwrite by filename and are stored immediately. Uploading a file does not automatically assign it to an event; choose it from that event's `Picture` detail and save the XML.
- Picture deletion is immediate and is blocked while any saved `<Picture>` field references the filename.
- Event pictures may use repeated `<Picture>` fields. Charities use the `<Charities><Charity name="...">` structure, with editable child details such as `<Description>`, `<Website>`, and `<PayLink>`.

## Local development

Run the Pages development server from the repository root so the Pages Functions and R2 bindings are available. Provide the two Access variables in the local Wrangler environment only when testing authenticated API requests. A plain static file server does not implement the XML or picture APIs.
