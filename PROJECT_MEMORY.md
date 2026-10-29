# Project Memory
## 2026-10-29: Library editing and file replacement

- **Major changes:** Administrators can select a replacement PDF, Word, or PowerPoint file while editing a file resource. The file is uploaded before its existing record is updated, retaining the resource ID and preserving the old file on upload failure. The replacement updates its type, filename, URL, and cover together; an outdated cover is cleared when no new cover is available. Note content is now controlled so switching between resources restores it correctly, and the admin list updates after saves and uploads. A successful public cache refresh also clears the current tab's library cache; refresh failures are reported separately from successful saves.
- **Build error and fix:** TypeScript initially inferred the upload helper's document kind as a general string, incompatible with `LibraryDocument`. Explicitly typed the kind as `"pdf" | "doc" | null`; the subsequent type check passed.
- **Verification and limitations:** Focused ESLint and `git diff --check` passed. Live authenticated file replacement and browser interaction were not exercised. The previously documented R2 credentials and bucket permissions must be correct in the deployed environment; the former file remains in storage after replacement.

## 2026-10-29: Library PDF covers and large document reading

- **Major changes:** PDF uploads attempt to generate and save a small first-page JPEG through the existing authenticated image upload. Library cards use the saved image, or lazily render page one for existing PDFs and failed images. The PDF reader requests byte ranges through the existing validated download proxy and renders only the selected page, with previous, next, and page-number navigation. Rendering resolution is capped to reduce memory use.
- **Performance limits:** Range loading depends on the upstream host supporting byte ranges; otherwise PDF.js must fetch the full file. Existing documents without saved covers need browser-side rendering. PDF upload size remains limited to 25 MB. Cloudinary cover generation is best effort and falls back to browser rendering.
- **Build/runtime errors:** No application runtime errors encountered; browser and live storage/upload behavior were not exercised.
- **Verification:** TypeScript and `git diff --check` passed. Focused ESLint did not finish and was stopped; no lint result was obtained.

## 2026-10-24: Repair public playlist details and stale YouTube videos

- **Root cause and fix:** Playlist detail pages incorrectly tried to render their videos from the public catalog's intentionally bounded newest-100-video feed. Playlists containing only older videos therefore remained on the loading skeleton indefinitely. A cached, playlist-specific D1 endpoint now supplies the available videos for the selected playlist, while the homepage feed remains safely bounded.
- **YouTube sync fix:** A YouTube `playlistItems` response can retain deleted-video placeholders even when `videos.list` does not return a corresponding video. Sync now removes those IDs before saving playlists and updates the playlist count. It also marks a video unavailable when it has disappeared from its final connected channel, preventing a previously synchronized, deleted upload from continuing to appear in the public catalog.
- **Operational note:** Existing stale records update on the next **Sync now** for each affected channel (or the existing administrator-session automatic sync). The shared catalog cache is invalidated after that sync.
- **Build error and verified fix:** Vercel's production TypeScript check reported `TS18047` because the playlist detail state could be `null` while reading its `videos` field. The conditional now explicitly narrows both the playlist and detail state before reading it.
- **Deletion behavior:** Changed synchronization from marking YouTube-removed videos unavailable to deleting their D1 records when no connected channel references them. Each sync also clears old unavailable/orphaned D1 rows left by prior releases. A playlist detail with no matching videos now redirects to the playlist directory instead of rendering an empty-content placeholder; the normal sync deletes the stale Firestore playlist document itself.
- **Build/lint error and verified fix:** Focused ESLint identified a synchronous state update inside the playlist-video fetch effect. Loading is now derived from the requested playlist ID, and the effect updates state only when its asynchronous request resolves or fails.
- **Zero-video playlist cleanup:** A sync now excludes playlists with no available videos from its result, causing the existing admin reconciliation to delete their Firestore documents. The public catalog and playlist page also filter zero-video rows immediately, so an existing stale record cannot render as a playlist card while awaiting its cleanup sync.
- **Verification:** Focused TypeScript and ESLint checks, including the deletion, zero-playlist, and lint corrections, completed successfully; ESLint reports only six existing raw-`img` optimization warnings. `git diff --check` passed. Re-run the deployment after the fix. The local webpack production build was previously started but did not reach a completion result in this Windows workspace; it left Next's generated `.next/lock` in place, so no second local build was started against that active/stalled process. Browser and live YouTube/D1 synchronization were not exercised.

## 2026-10-22: Refine homepage section titles

- **Major change:** Restyled the shared homepage section headings with consistent typography, a red accent, subtle divider lines, and matching action links. The layout adapts to mobile and includes visible keyboard focus states.
- **Build/runtime errors:** None encountered; this was a CSS-only change.
- **Verification:** `git diff --check` passed. Browser rendering was not exercised.

## 2026-10-22: Expand the shared writing area

- **Major change:** Increased the minimum writing area across all shared rich-text editors to 65% of viewport height on desktop and 70% on mobile, using the full available width and reduced mobile padding. Long content grows with the page so the floating toolbar remains accessible while writing.
- **Build/runtime errors:** None encountered.
- **Verification:** `git diff --check` passed. Browser interaction was not exercised.

## 2026-10-22: Keep editor formatting controls accessible

- **Major change:** Wrapped the shared rich-text editor and toolbar in a common region so the toolbar remains sticky throughout the writing area in testimony, library, meeting, and mailing editors. On screens with the mobile admin menu, the toolbar sticks below that menu; on desktop it sticks near the top of the viewport.
- **Build/runtime errors:** None encountered.
- **Verification:** TypeScript and focused ESLint passed (one existing image optimization warning); `git diff --check` passed. Browser interaction was not exercised.

## 2026-10-22: Remove inline testimony images

- **Major change:** Added an opt-in inline-image preview and individual Remove buttons to the shared rich-text editor, enabled for testimony editing. The editor removes the selected image from its content and updates the form; the administrator saves the testimony to publish that change. Guidance appears below the editor.
- **Build/runtime errors:** None encountered.
- **Verification:** TypeScript, focused ESLint (zero errors; image optimization warnings), and `git diff --check` passed. Browser interaction and live publishing were not exercised.

## 2026-10-22: Move and share testimonies

- **Major change:** Moved the homepage testimony shelf immediately after Latest Videos, including on mobile, while keeping the About card beside videos on desktop. Added a Share action for each testimony on the homepage and public testimonies page, using the existing native-share and clipboard fallback with a link to the individual story.
- **Build/runtime errors:** None encountered.
- **Verification:** TypeScript, focused ESLint (zero errors; existing image and unused-import warnings), and `git diff --check` passed. Native sharing was not exercised in a browser.

## 2026-10-22: Repair testimony permissions

- **Reported error and diagnosis:** Publishing returned ?Missing or insufficient permissions.? A live anonymous Firestore list request to `testimonies` returned HTTP 403, although the local rules grant public reads; the local testimony rules have not been applied to the live database (or the live rules differ). The previous implementation explicitly recorded that deployment was still required.
- **Change:** Simplified testimony writes to the same shared `isAdmin()` authorization used by the other admin features, with public reads. The editor continues to validate the content and image count. Firebase CLI compiled and deployed the rules to the live `poof-40b24` database as ruleset `5497cad8-320d-4aaf-bab7-d94b2b7c2866`. An anonymous public testimony read changed from HTTP 403 to HTTP 200 after deployment. A live administrator write was not exercised.

## 2026-10-22: Add community testimonies

- **Major changes:** Added administrator create, edit, and delete for testimonies, using the shared rich-text editor and authenticated Cloudinary image upload. Each testimony has a title, author, optional separate profile image, and images before, inline in, or after the content. The save form limits story images to 15, excluding the profile image. Added public Firestore read/admin write rules, a newest-three homepage shelf, and a full testimonies page. Missing profile images use the author's initial; broken story images are hidden.
- **Build/runtime errors:** No application runtime errors encountered. Focused lint initially reported a synchronous state-update effect; loading now updates state in the asynchronous Firestore callback and focused lint passes with image optimization warnings only.
- **Verification and deployment:** TypeScript and focused ESLint passed; ESLint reported five image optimization warnings. The webpack build compiled and generated all 61 pages, but was stopped while collecting build traces, so it did not complete. Live uploads and Firestore writes were not exercised. Deploy the updated Firestore rules and application before using the feature in production.

## 2026-10-21: Polish donation payment badges

- **Major change:** Centered the donation form heading and added colored card, Apple, and Google icons to the payment method badges, with wrapping for narrow screens.
- **Build/runtime errors:** None encountered.
- **Verification:** Focused ESLint and `git diff --check` passed.

## 2026-10-21: Convert USD donation intent into KES-only Paystack charges

- **Major change:** The public donation form now accepts the donor's intended amount only in USD. A server-side quote converts USD cents to KES cents with exact six-decimal integer arithmetic and half-up rounding, then initializes Paystack with the literal KES charge currency. The quote uses Frankfurter's cached daily USD/KES reference rate by default or the optional server-only `DONATION_USD_KES_RATE` override. Converted charges below Paystack's KES 3.00 minimum are rejected before a donation attempt is created.
- **Records and verification:** New Firestore donation records preserve `originalAmountSubunit`, `originalCurrency`, `conversionRate`, rate source/date, and quote time, while `chargeAmountSubunit`/`chargeCurrency` and the compatibility `amountSubunit`/`currency` fields record the actual KES Paystack payment. Callback, webhook, reconciliation, statistics, admin totals, and mismatch protection verify and aggregate the KES charge fields. Legacy USD/KES records remain readable and reconcilable through compatibility fallbacks.
- **User/admin output:** The confirmation page, email receipt, and protected admin ledger show the original USD gift together with the actual KES charge and stored conversion rate. Deployment documentation no longer exposes a configurable Paystack transaction-currency list and documents the automatic/reference-rate and fixed-rate options.
- **Build/runtime errors and verified fixes:** The first TypeScript check inferred the admin totals map key as the literal `"KES"`, which rejected legacy currency keys. The map was explicitly widened to string keys without widening the KES-only checkout constant. No application runtime errors were encountered.
- **Verification:** The live Frankfurter `USD/KES` endpoint returned a valid dated response (`USD` base, `KES` quote). Focused ESLint, `npx.cmd --no-install tsc --noEmit`, `git diff --check`, a currency-flow static audit, and `npm.cmd run build -- --webpack` passed; the production build generated all 59 pages. No Paystack transaction, Firestore donation attempt, card charge, webhook, or receipt was triggered.

## 2026-10-18: Move administrator invitations to a dedicated sidebar page

- **Major change:** Added a protected `/poof/admin/administrators` route and an **Administrators** item to the shared desktop sidebar/mobile drawer. The page reuses the existing email invitation workflow that was removed from Channels, with dedicated responsive styling, clearer access guidance, expiry status, and success/error presentation.
- **Build/runtime errors:** None encountered.
- **Verification:** Focused ESLint, `npx.cmd --no-install tsc --noEmit`, `git diff --check`, and `npm.cmd run build -- --webpack` passed. The production build registered `/poof/admin/administrators` and generated all 53 pages.

## 2026-10-18: Polish the admin channels workspace and dashboard

- **Channels UX:** Removed the redundant cross-page action links and unrelated administrator-invite panel from `/poof/admin/channels`. Reorganized the screen into a responsive connect-source panel, catalogue health totals, connected-channel cards, and a cleaner public-presentation section. Phone layouts now use full-width channel actions and adapt catalogue rows for narrow screens.
- **Catalogue behavior:** Catalogue controls are collapsed by default and load their video/playlist lists only after the administrator opens the disclosure, reducing both initial visual clutter and unnecessary reads.
- **Dashboard and navigation:** Added a properly constrained, responsive dashboard canvas with refined cards, spacing, borders, and shortcuts. Sign out now lives in the shared sidebar footer beside the public-site action; duplicate sign-out buttons were removed from Channels, Meetings, Contacts, and Mailing. The action remains available inside the mobile drawer.
- **Build/runtime errors:** None encountered. Focused ESLint completed with zero errors and nine existing raw-`img` optimization warnings.
- **Verification:** `npx.cmd --no-install tsc --noEmit`, focused ESLint, `git diff --check`, and `npm.cmd run build -- --webpack` passed. The production build generated all 52 pages.

## 2026-10-18: Include subcategory documents in library category filters

- **Fix:** The public library's parent-category and “All in” filters previously matched only documents directly assigned to the parent, leaving out documents assigned to its subcategories. They now include documents in direct child categories while individual subcategory and global “All resources” filters continue to work with the search field.
- **Build/runtime errors:** None encountered for this change.
- **Verification:** TypeScript and `git diff --check` passed. Focused ESLint was stopped after it produced no output for over a minute; it did not complete.

## 2026-10-16: Fix library publishing, harden R2 uploads, and cut Firestore reads

- **Text article permission root cause and live fix:** `libraryDocuments` create/update rules accessed the optional `previewUrl` key without first checking whether it existed. In Firestore Rules, an absent map-key access can make the rule evaluation fail, so new notes and uploaded-file metadata (both omit `previewUrl`) were denied with “Missing or insufficient permissions.” Guarded the optional key with an `in` check. Firebase CLI 15.34.0 compiled the rules successfully and released ruleset `308a8abc-dd87-411e-9cfd-e1e6e69bc4de` to the live `poof-40b24` database.
- **Firestore read-spike root cause and fix:** The public catalog/library functions used runtime `use cache`, but every underlying Firestore REST request explicitly used `cache: "no-store"`. Next.js 16 documents that runtime `use cache` is process-local by default on serverless, so cold Vercel instances could repeatedly refill the nominal 24-hour snapshot. Changed the two public snapshots to `use cache: remote`, opted the Firestore GET/POST requests into the persistent Fetch Data Cache for 24 hours, and attached the existing cache tags so admin invalidation still works. A full Firestore-backed public refill is now hard-capped at 1,250 documents (50 channels, 300 playlists, 300 meetings, 100 library categories, and 500 library documents; videos/most-viewed come from D1). Public catalog polling changed from every minute to every 15 minutes, and the admin session activity heartbeat changed from every five minutes to every 30 minutes.
- **Scoped invalidation:** `/api/admin/catalog/revalidate` now accepts `scope=catalog|library|all`. Channel/video/meeting edits invalidate only the catalog, while library edits invalidate only the library, preventing unrelated Firestore collections from being reread after every admin mutation.
- **R2 upload diagnosis and app hardening:** A live production-origin preflight to the configured bucket returned HTTP 403 `CORS not configured for this bucket`, exactly explaining the browser’s generic “Failed to fetch.” Presigned upload URLs now sign a server-selected MIME type derived from the allowed extension, and the client uses the returned signed header. A failed browser preflight now reports a specific R2 CORS message. Added `npm run r2:cors`, which configures the canonical www/apex origins plus localhost through bucket-level S3 credentials or an optional `CLOUDFLARE_R2_ADMIN_TOKEN` with R2 bucket edit permission.
- **Remaining external R2 step:** The live CORS update attempt returned HTTP 403 `AccessDenied`; the stored S3 credentials are object-only. The existing `CLOUDFLARE_API_TOKEN` and `R2_API_TOKEN` also returned Cloudflare API authentication errors for bucket CORS. Set `CLOUDFLARE_R2_ADMIN_TOKEN` with R2 bucket edit permission (or use bucket-level S3 credentials), run `npm run r2:cors`, and deploy the app. Until that one-time bucket policy succeeds, production browser file uploads remain blocked even though the application code is fixed.
- **R2 follow-up correction:** The operator added the correct CORS policy in the Cloudflare dashboard. Live preflights from the www origin, apex origin, and localhost then returned HTTP 204 with `PUT` and `content-type` allowed, proving CORS is active. However, both the application-generated presigned PUT and an independently signed Authorization-header PUT returned HTTP 403 `AccessDenied`. The configured access key/secret have the correct R2 S3 credential lengths, so the remaining blocker is token scope: create new R2 S3 credentials with **Object Read & Write** access to the `poof` bucket, replace `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` locally and in Vercel, then redeploy/restart. R2 error responses omit CORS headers, which is why this permission failure surfaced in the browser as the CORS-style message. Presigned URLs now also include the current `X-Amz-Content-Sha256=UNSIGNED-PAYLOAD` query field.
- **Build/tool findings:** The first `npm run r2:cors` invocation failed with the verified permissions cause above. The temporary Firebase CLI install emitted Node 26 engine/deprecation warnings but completed and deployed successfully. `npx --no-install tsc --noEmit`, focused ESLint, the MIME-bound presign structure check, and `npm run build -- --webpack` all passed; the production build generated all 52 pages.

## 2026-10-15: Move library originals to R2 and video records to D1

- **Major changes:** Library uploads now request a short-lived presigned R2 PUT URL and send the file directly from the browser, keeping file bytes out of Vercel function bodies. PDF, DOC/DOCX, and PPT/PPTX uploads up to 25 MB use the existing admin workflow; Cloudinary remains in place for images and image transformations. Existing Cloudinary document URLs remain supported by the download proxy. The R2 public base domain is allow-listed before proxy downloads to prevent arbitrary URL fetching.
- **Video catalog:** Added the D1 `videos` schema/indexes and server-only D1 client. YouTube channel sync stores records keyed by YouTube video ID, including the canonical `videoUrl`, in D1; first sync of each channel imports its existing Firestore records and website presentation settings. Public video feed, Most Viewed, admin video list/count, and feature/hide changes now use D1 when configured. Firestore remains the store for channels, playlists, meetings, library metadata, and other collections. Catalog cache invalidation follows video sync and editorial updates.
- **Configuration:** Added setup guidance for `migrations/0001_videos.sql`, a D1 API token, R2 S3 credentials/endpoint, an R2 public custom domain, and bucket CORS. New uploads are public by design because library resources are public. Cloudinary remains the image service.
- **Existing Cloudflare environment aliases:** D1 accepts `R2_ACCOUNT_ID` and `D1_DATABASE_ID` as aliases for the account/database ID variables. It deliberately does not treat `R2_API_TOKEN` or the R2 S3 credentials as a D1 API token; set a separate `CLOUDFLARE_API_TOKEN` with Cloudflare REST API D1 Read/Edit permissions. R2 upload signing accepts `R2_ENDPOINT` and the existing S3 key/secret/bucket variables; the app still needs a public URL (`R2_PUBLIC_BASE_URL`).
- **Build/type findings and fixes:** Initial TypeScript checks caught nullable auth-state references, a missing Firestore `where` import, and an overly narrow inferred video `availability` type; these were corrected. The first webpack build attempt left an unresponsive Next build process holding the lock. After verifying its command line and workspace, that process was stopped and a single clean `npm.cmd run build -- --webpack` completed successfully, including TypeScript and all 52 static pages. Focused ESLint had zero errors; existing raw-image warnings remain.
- **Security incident / required remediation:** A diagnostic command intended to print only `.env.local` variable names mishandled the multiline `FIREBASE_PRIVATE_KEY` and emitted its contents to tool output. Treat that service-account key as exposed: revoke/rotate it in Google Cloud IAM and update the replacement in local and Vercel environments. Never print or parse `.env.local` values for diagnostics; inspect key names only with a parser that safely handles multiline values.
- **Live provider verification:** D1 schema/API access and R2 upload/public delivery were not exercised against Cloudflare from this workspace. Apply the migration, configure the required credentials/public domain/CORS, deploy, and sync each connected channel before relying on the D1-backed video feed.

## 2026-10-15: Reduce Firestore reads and remove live listeners

- **Root cause:** Admin pages used continuous Firestore `onSnapshot` subscriptions for contacts, notifications, meetings, channels, videos, playlists, categories, and library documents. Each initial subscription and every matching update bills document reads. Separately, the shared public library feed refreshed every ten minutes, while individual library pages made an additional uncached Firestore document request.
- **Major changes:** Replaced all admin realtime Firestore subscriptions with bounded one-time `getDocs` reads. The UI updates its own toggles optimistically, while an admin reopening a page receives a fresh bounded snapshot. The public library now uses a 24-hour, tagged shared cache consistent with the catalog; its API response is request-time/no-store so tag invalidation remains immediate. Library detail metadata now comes from that same shared snapshot rather than a per-page Firestore read. The existing protected cache-refresh endpoint invalidates both public catalog and public-library tags after admin edits.
- **Verification:** `npx.cmd --no-install tsc --noEmit` and focused ESLint on all changed files passed. `rg` confirmed no executable `onSnapshot` use remains (only explanatory comments). `git diff --check` passed. A production build was attempted, but a prior `next build` process retained Next's build lock; a second build correctly reported that lock rather than a source error. Run `npm.cmd run build` after the existing build process exits to complete production-build verification.

## 2026-10-15: Secure admin navigation in the installed app

- **Major changes:** Added an admin install control directly below Mailing in the admin sidebar and removed the public meetings-page install action so the install prompt is offered from the authenticated admin area. The installed PWA displays an Admin dashboard shortcut between Library and Zoom on desktop and mobile only after the server confirms the existing administrator session. A previously verified local hint can restore shortcut visibility if the app shell is still available offline; it grants no access, because `/poof/admin` remains server-protected. The sign-in checkbox now explicitly chooses Firebase local versus session persistence and remembers the email when selected; passwords remain delegated to the browser password manager and are never stored by the app.
- **Offline/security boundary:** PWA installation cannot be securely attested as having started from the admin route. The shortcut is a UI convenience only, while every protected route continues to validate the administrator session. The current app has no service worker, so offline startup, admin pages, and admin actions are not guaranteed; no sensitive admin data is cached offline.
- **Verification:** Production build and a TypeScript recheck completed successfully after fixing a missed JSX provider closing-tag rename found by the final build. An initial TypeScript check ran while the production build regenerated `.next/types` and reported missing generated files; it passed when rerun after the build completed. Focused ESLint passed with one pre-existing `<img>` warning in `components/home/public-header.tsx`; `git diff --check` passed.

## Ongoing working preference
- Whenever project changes are made, record the major change and any build/runtime errors with their verified fixes in this file before finishing. When the user asks, provide the exact suggested Git commit message; do not create a commit unless explicitly requested.

## 2026-10-15: Make the meetings page installable as a PWA

- **Major changes:** Added a Next.js App Router manifest with the Faith of the Pioneers app name, standalone display settings, theme colors, and 192px/512px brand icons served from `public/`. Added an install action immediately after the Upcoming filter on the meetings page. Supported browsers use the native `beforeinstallprompt`; browsers without that API get installation instructions (including Safari/iOS Add to Home Screen steps). The action is hidden when the app is already installed.
- **Lint finding and fix:** Focused ESLint initially flagged setting iOS state synchronously in an effect. Moved platform detection to the install-instructions action; focused ESLint then passed.
- **Verification:** `npx.cmd --no-install tsc --noEmit`, focused ESLint, and `npm.cmd run build` passed. The build emitted `/manifest.webmanifest`; a runtime JSON check confirmed its standalone settings and both referenced public icons. `git diff --check` passed.

## 2026-10-15: Refresh public meetings after administrator edits

- **Root cause:** Public pages read meetings from the shared Firestore catalog snapshot, intentionally cached for 24 hours to protect the Firestore free tier. The admin manager wrote directly to Firestore without invalidating that snapshot, and already-open public pages fetched it only once.
- **Major changes:** Added a protected administrator endpoint to invalidate the shared catalog cache after meeting create, edit, and delete. The public catalog API response now uses `Cache-Control: no-store` and reads the request URL so Next.js keeps the route request-time while the catalog data remains shared-cached. Public catalog hooks refresh on a 60-second visible-tab interval and on focus/visibility changes, preserving the server cache and avoiding Firestore listeners. The recurring meeting day expansion remains unchanged.
- **Build finding and fix:** The first production build showed `/api/catalog` as a one-day static route, which could bypass the on-demand refresh. Reading `request.url` in its handler made it Dynamic while retaining the `getPublicCatalog` cache; the follow-up production build confirmed `/api/catalog` and `/api/admin/catalog/revalidate` are both Dynamic.
- **Verification:** `npx.cmd --no-install tsc --noEmit`, focused ESLint, both production builds, and `git diff --check` passed. ESLint reported 0 errors and the two existing `<img>` warnings in `components/admin/meetings-manager.tsx`. Live Firestore behavior was not exercised from this environment.

## 2026-10-14: Add 1889 Fundamental Principles edition alongside 1872

- **Major change:** The `/doctrine/fundamental-principles` page now presents both declarations, each clearly labeled with a year badge: the original **1872** "Declaration of the Fundamental Principles" and the **1889** "Revised Declaration of the Fundamental Principles Taught and Practiced by the Seventh-day Adventists" (as stated in the SDA Year Books of 1889–1931; Battle Creek Steam Press). The 1889 edition adds 28 numbered propositions plus the closing Jeremiah 6:16 quotation.
- **Data:** Added `lib/fundamental-principles-1889.ts` (preamble, lead-in "They believe,", 28 propositions, closing quote, source note) and a shared `FundamentalPrinciplesDoc` interface plus `FUNDAMENTAL_PRINCIPLES_DOC_1872` in `lib/fundamental-principles.ts`. Both editions are aggregated as `FUNDAMENTAL_PRINCIPLES_DOCS`.
- **PDF:** `lib/fundamental-principles-pdf.ts` now takes a `FundamentalPrinciplesDoc` (defaulting to 1872) and renders either edition; `getFundamentalPrinciplesDoc(year)` resolves an edition. `GET /api/doctrine/fundamental-principles/pdf?year=1889` returns the 1889 file, default (no `year`) returns 1872, and the filename is `fundamental-principles-<year>.pdf`. Reading `request.url` makes this route request-time (Dynamic) while remaining compatible with the enabled `cacheComponents` setting (no route segment config used).
- **UI:** `components/home/fundamental-principles-page.tsx` renders a reusable `DocSection` per edition, each with a year badge, its own "Download PDF" button, preamble, proposition list, optional closing quote, and source footnote.
- **Verification:** `npx.cmd --no-install tsc --noEmit` and focused ESLint on all changed/new files passed with zero errors. `npm.cmd run build` succeeded (route listed as Dynamic `ƒ`). A compiled CommonJS runtime test parsed both PDFs with `pdfjs-dist`: each `%PDF-1.4`, 5 pages, title and first proposition text present (1872 = 25 props, 1889 = 28 props).

## 2026-10-14: Fix footer Fundamental Principles link and add clean PDF download

- **Footer bug:** The footer linked to the misspelled `/doctrine/fundermentalprinciples`, which rendered a "being prepared" placeholder. Updated `components/home/site-footer.tsx` to `/doctrine/fundamental-principles` and pointed `app/sitemap.ts` at the correct path.
- **Legacy route:** Replaced the placeholder at `app/(public)/doctrine/fundermentalprinciples/page.tsx` with a `redirect("/doctrine/fundamental-principles")` so any old/bookmarked link still resolves.
- **Page content:** Created `components/home/fundamental-principles-page.tsx` for the existing `/doctrine/fundamental-principles` route (which previously imported a component that did not exist). It renders the public-domain 1872 "Declaration of the Fundamental Principles Taught and Practiced by the Seventh-day Adventists" (preamble + 25 propositions) from `lib/fundamental-principles.ts`, reusing the shared `.doctrine-*` classes for a consistent look.
- **Clean PDF download (not print/scan):** Added a dependency-free, text-based (vector) PDF writer at `lib/pdf.ts` using the standard Helvetica fonts with an AFM width table for word wrapping, page breaks, headers, and footers. `lib/fundamental-principles-pdf.ts` lays out the same content. `GET /api/doctrine/fundamental-principles/pdf` returns the file as `application/pdf` with `Content-Disposition: attachment; filename="fundamental-principles.pdf"`. The page's "Download PDF" button links to this route, so visitors download a real, styled PDF file — no browser print dialog and no scanned/raster image.
- **Verification:** `npx.cmd --no-install tsc --noEmit` and focused ESLint on all changed/new files passed with zero errors. Direct runtime test compiled the libs to CommonJS, generated the PDF, and parsed it with the installed `pdfjs-dist`: signature `%PDF-1.4`, 5 pages, correct page-1 text, and correct header/footer on the last page. `npm.cmd run build` succeeded and prerendered `/api/doctrine/fundamental-principles/pdf` and `/doctrine/fundamental-principles` as static.

## 2026-10-14: Branded homepage loading experience

- **Major changes:** Added a branded loading screen for the public site route fallback and while the homepage catalog feed is fetched. Styled it with the site's active blue-and-gold hero palette, Faith of the Pioneers logo, animated progress bar, and reduced-motion support. The loader exits when the feed succeeds or fails; on feed failure, visitors see an explicit notice and retry action while the rest of the site remains usable.
- **Verification:** `npx.cmd --no-install tsc --noEmit`, focused ESLint, `npm.cmd run build`, and `git diff --check` passed. ESLint reported zero errors and nine existing homepage warnings. No build/runtime errors were encountered.

## 2026-10-13: Clarify newsletter welcome and footer links

- **Major changes:** Updated the newsletter welcome email to explain what subscribers can expect, including health and wellness resources, Bible and prophecy studies, faith-building messages, featured videos, and ministry/meeting updates. Moved Unsubscribe from the message body into the footer alongside links to Prayer Requests (`/prayer-request`), Contact Us (`/contact`), and Next Meeting (`/meetings`). Added the same route links and footer unsubscribe to the plain-text email while preserving the existing campaign styling and button.
- **Verification:** Focused ESLint on `lib/mailing-server.ts`, `npx.cmd --no-install tsc --noEmit`, and `git diff --check` passed. Live email delivery was not exercised.

## 2026-10-13: Email-based administrator invitations

- **Invitation authorization and delivery:** Replaced the client-side Firestore write with `/api/admin/invites`, which verifies the caller using the shared active-admin check, creates the two-hour invitation with the server Firestore client, and emails the single-use signup link through the existing branded Resend campaign template. Failed sends are logged and the unused invitation is removed; cleanup failures are surfaced explicitly.
- **Invitation experience:** The admin panel now confirms delivery to the entered address and retains copy-link as a fallback. The email names the invited address, explains expiration and existing-account use, and provides the accept link.
- **Authentication options:** Removed Google sign-in and Google invitation acceptance from the auth pages, deleted the unused Google sign-in helper/provider, and simplified the invitation signup endpoint to email/password only. Updated setup documentation to require Email/Password.
- **Verification:** `npx.cmd --no-install tsc --noEmit`, focused ESLint, `git diff --check`, and `npm.cmd run build` passed. The build generated `/api/admin/invites` and all existing routes. Email delivery and production Firestore configuration were not exercised against external services.

## 2026-10-13: Fix administrator invitation authorization

- **Root cause:** The Firestore root-admin helper had been renamed to `isRootCAdmin` while its callers still referenced `isRootAdmin`. Invitation activation also sent Firestore REST PATCH requests whose update masks omitted `sessionMigrated`, a field required by the admin-record rules.
- **Changes:** Restored the `isRootAdmin` helper name, made invitation activation PATCH masks include `sessionMigrated`, and preserve an existing administrator's original invite/code identity when renewing their admin record. Every admin authorized through the shared `isAdmin` check retains the same invitation and management permissions.
- **Verification:** `npx.cmd --no-install tsc --noEmit`, focused ESLint on `app/api/auth/signup/route.ts`, and `git diff --check` passed. Firestore rules were not emulator-tested or deployed from this environment; deploy the rules and updated application before verifying in production.

## 2026-10-13: Secure admin access and four-month idle sessions

- **Root causes:** Admin records and the session cookie expired after 24 hours, which caused Firestore writes from the library editor to fail with “Missing or insufficient permissions.” The session endpoint and rules also let any signed-in account create its own admin record. The `adminInvites` UI had no matching Firestore rules, and the signup page did not pass invitation IDs through.
- **Access control:** Only the documented root UID (`3H3BclyO2FePQ59KYIO2kKSirnx2`) can bootstrap an admin. Other new accounts must accept an email-matched, single-use invitation created by an active admin. Existing enabled admin records, including prior `codeHash` records, remain authorized without re-invitation. All active admins have the same management rights throughout the website.
- **Session behavior:** The server now stores refresh/access tokens in HTTP-only cookies. Activity in protected admin pages renews the cookie and admin-record deadline to four calendar months from the latest activity. Stale Firebase ID tokens are silently renewed while the inactivity deadline remains valid. After four months without activity, both server and Firebase client sessions are cleared; users must sign in again. Sign-out only clears local Firebase auth after the server confirms cookie deletion.
- **Signup and UI:** Admin invitations support email/password and Google accounts, and the admin pages consistently link to the email/password-or-Google sign-in page. Removed the shared signup-code environment variable and setup path.
- **Documentation:** Updated `README.md` with the root UID, provider requirements, invitation/migration behavior, and session policy.
- **Lint/type issues and fixes:** A first lint pass flagged synchronous state updates while reading invite/local-storage data in effects; those reads now use refs and avoid cascading state updates. A first type check caught a missing `useRef` import in sign-in; added it. Final checks have no TypeScript or ESLint errors; seven existing `<img>` lint warnings remain in the channel, mailing, and meetings managers.
- **Verification:** `npx.cmd --no-install tsc --noEmit`, focused ESLint, `git diff --check`, and `npm.cmd run build` passed before the route migration. The production build generated all 46 routes, including the then-current `/admin/*` pages. Firestore rules were not run against an emulator or deployed from this environment.
- **Route-migration follow-up:** Admin pages are now under `/poof/admin/*`; `/admin` is intentionally not routed. Existing enabled admin records, including legacy `codeHash` records, remain recognized without invitation. A persisted Firebase login can renew once during migration; subsequent automatic restores still enforce the four-month inactivity deadline. Firestore stores `sessionMigrated` to distinguish migrated sessions.
- **Route verification and error fix:** The first standalone TypeScript check after moving routes found stale `.next/types/validator.ts` imports for the deleted `/admin/*` pages. `npm.cmd run build` regenerated Next's route types; the build then passed and listed all seven `/poof/admin/*` pages with no `/admin` route, and the subsequent `npx.cmd --no-install tsc --noEmit` passed. Focused ESLint passed with zero errors and nine existing `<img>` warnings; `git diff --check` passed. Firestore rules were not emulator-tested or deployed.
- **Deployment requirement:** Deploy the revised rules before expecting library writes or invitations to work in production: `npx firebase-tools deploy --only firestore:rules --project poof-40b24`. Then deploy the application.

## 2026-10-13: Tabbed admin inbox with request status tracking

- **Major changes:** Split the admin inbox into explicit tabs — Contact, Prayer Request, and Zoom Link Request — inside `components/admin/contacts-manager.tsx`, replacing the previous mixed `mode="all"` list. Each tab shows its own submission count.
- **Major changes:** Added status tracking. New `status` (`pending` | `handled`) and `handledAt` fields on the `contacts` documents, with Pending / Handled / All filter buttons carrying per-filter counts. Admins can toggle a submission between handled and pending from a new card footer action, and handled cards get a distinct status pill and muted treatment.
- **Data model and routing:** Submissions without a `status` are treated as `pending`, so existing documents need no migration. `/admin/contacts` opens on the Contact tab via the new `initialTab` prop; `/admin/link-requests` keeps `mode="meeting-link"`, which now opens directly on the Zoom tab. The admin dashboard card and shortcut labels were renamed to Contact & prayer requests / Zoom link requests to match the tabs.
- **Security:** `firestore.rules` now separates contact reads and deletes from updates. Admin updates may change only `status` and `handledAt`, must keep `status` within the allowed values, and require `handledAt` to be null when pending or equal to `request.time` when handled.
- **Styling:** Added `inbox-tabs`, `inbox-tab`, `inbox-filter`, `inbox-status`, and card footer/`is-handled` rules to `app/globals.css`, including a mobile layout for narrow screens.
- **Verification:** `npx.cmd tsc --noEmit` and focused ESLint on the changed files passed with zero errors. `npm.cmd run build` completed with all 46 routes, including `/admin/contacts` and `/admin/link-requests`. Firestore rules were not exercised locally (no emulator/CLI installed).

## 2026-10-13: Manage scheduled mailing with cron-job.org
- **Scheduler:** Removed the Vercel cron entry and added `npm run cron:sync`, which uses cron-job.org's REST API to create or update the single stable-title job for every-five-minute UTC delivery. Response saving is disabled. The job uses `CRON_SECRET`; the same value must be configured in Vercel and local `.env.local`. The initial sync created the job and a second sync updated it, verifying idempotent repeat behavior.
- **Cron route:** Preserved the Firestore claim/lock transaction. Authorization now fails closed and compares fixed-size SHA-256 digests with `timingSafeEqual`. Empty and successful runs return counts only; campaign-level errors are recorded in `lastError` and handled without exposing recipient addresses or secrets in logs or response bodies.
- **Documentation:** Updated the mailing setup and cron instructions in `README.md`.
- **Validation:** `npx.cmd --no-install tsc --noEmit`, focused ESLint, `node --check scripts/sync-mailing-cron.mjs`, `git diff --check`, the repeat cron sync, and `npm.cmd run build` passed. The build compiled and generated `/api/mailing/cron`.
- **Validation issue and fix:** A first check found malformed auth-header syntax after credential redaction affected a newly added literal bearer expression. Constructing the header with `"Bearer".concat(" ", token)` avoided the redaction; a subsequent type check and production build passed.
- **Runtime limit:** Each cron invocation processes up to 20 due campaigns sequentially. A run can exceed cron-job.org's 30-second timeout if enough campaigns or recipients are due at once; batching was intentionally left unchanged. Monitor run durations and move to a queue/shorter per-invocation workload if timeouts occur.

## 2026-10-13: Personalize mailing and confirm meeting-link requests
- **Major changes:** YouTube links in campaign messages now render as clickable thumbnails at the inline link position instead of only as a separate featured-video block; separate featured-video rendering remains when no inline link exists. Campaign email greetings use the recipient's first name and send-time greeting, with a generic fallback. Newsletter signup and administrator-added meeting members can now supply a first name.
- **Meeting requests:** Successful meeting-link requests now send a confirmation email using the same latest-three-video selection and thumbnail logic as the newsletter welcome email. The form confirms that the link will be sent soon and asks requesters to check email; email delivery failures are logged and shown without losing the saved request.
- **Recipients:** The mailing editor keeps its existing all/custom eligible-recipient delivery support and clarifies selection of custom members from the displayed address list.
- **Lint issue and fix:** The first focused ESLint pass flagged an unescaped apostrophe in new JSX text; changed it to `&apos;`. The follow-up lint pass completed with zero errors and three existing external-image warnings.
- **Verification:** Focused TypeScript diagnostics and `npx.cmd --no-install tsc --noEmit` passed. `npm.cmd run build` passed and generated the mailing routes. Rendered-email checks verified inline video position, no duplicate bottom preview, first-name greeting, and the standalone featured-video fallback. `git diff --check` passed. Live Firebase/Resend delivery was not exercised.

## 2026-10-12: Work around production Firebase Auth runtime crash
- **Bug:** The live Vercel `/api/mailing` and `/api/mailing/subscribe` endpoints still return empty HTTP 500 responses. A prior Node `22.x` engine pin did not resolve the live crash; prior Vercel logs traced the failure to Firebase Admin Auth loading `jwks-rsa`/ESM-only `jose` before route handlers could respond.
- **Fix:** Removed the Firebase Admin Auth dependency from the shared mailing server module. Admin ID tokens are now validated by Firebase's `accounts:lookup` API using the configured public Firebase API key; the admin Firestore record and enabled/expiry checks remain unchanged. Documented the required Vercel API-key setting.
- **Verification:** Confirm the mailing API module loads locally with an unauthenticated request returning JSON 401, and run the production build, TypeScript check, and focused lint. Production authenticated Firestore/mail sending requires deploying this change and then retesting `/admin/mailing` online.
- **Build note:** Explicit `runtime = "nodejs"` route exports are incompatible with this repository's Next.js 16 `cacheComponents` setting; no such exports remain.
- **Secret hygiene:** Cleared the populated `CRON_SECRET` from `.env.example`; keep actual values only in the hosting environment or an ignored local env file. The cron secret was present in the committed example file, so rotate it in Vercel and update the matching cron configuration.
- **Build note:** Explicit `runtime = "nodejs"` route exports are incompatible with this repository's Next.js 16 `cacheComponents` setting; no such exports remain.
- **Secret hygiene:** Cleared the populated `CRON_SECRET` from `.env.example`; keep actual values only in the hosting environment or an ignored local env file. The cron secret was present in the committed example file, so rotate it in Vercel and update the matching cron configuration.

## 2026-10-12: Lead homepage and share titles with ministry name
- **Major changes:** Updated homepage title, default title, Open Graph title, and Twitter title so "Faith of the Pioneers" appears first, followed by the Bible study and ministry keywords. Added an absolute-title option to the shared metadata helper so the homepage share preview does not receive a duplicated brand suffix from the title template.
- **Verification:** Production build, focused ESLint, and generated homepage HTML checks passed; the browser title, Open Graph title, and Twitter title all start with "Faith of the Pioneers".

## 2026-10-12: Improve public SEO and branded sharing
- **Major changes:** Added a reusable SEO metadata helper with canonical URLs based on `NEXT_PUBLIC_SITE_URL` (defaulting to the confirmed `https://faithofthepioneers.org` domain), descriptive page titles and summaries, and branded Open Graph/Twitter images using the site logo. Added page metadata for the homepage, About, meetings, library, playlists, doctrine, and dynamic meeting/study pages. Added `robots.txt` and a sitemap covering public pages; authenticated admin, sign-in, and sign-up routes use `noindex`/`nofollow`.
- **Build note and fix:** The initial build warned that social images resolved against localhost because no canonical URL was configured. Setting the confirmed production-domain fallback removed the warning; generated HTML now points the logo preview and canonical URLs at `faithofthepioneers.org`. A later build attempt briefly failed with Windows `EBUSY` while unlinking a generated `.next` map; rerunning the build after other checks completed succeeded.
- **Verification:** Production build and focused ESLint passed; built HTML verified the absolute logo image, homepage canonical URL, auth `noindex` tags, `robots.txt`, and sitemap. Including the doctrine page in ESLint also surfaced two existing `no-html-link-for-pages` errors in its unchanged anchor markup; that unrelated markup was left untouched.

## 2026-10-12: Stabilize mailing responses and share rich-text editing
- **Mailing/API fix:** Mailing and signup clients now read response text safely instead of blindly calling `response.json()`, so empty or non-JSON production responses show an HTTP-specific error rather than `Unexpected end of JSON input`. The mailing admin GET endpoint detects Firestore `RESOURCE_EXHAUSTED`/quota errors and returns an explicit 429 message. Prior project diagnostics showed Firestore reads can be exhausted while writes (such as subscriptions) still succeed; check Firebase usage/billing if this response occurs.
- **Editor and preview:** Extracted the Library's formatting controls into a shared rich-text editor used by Library notes, meeting descriptions, and mailing messages. Added a strict tag/attribute allowlist for stored/rendered rich text. Email preview text is generated from the message, updates live, and remains editable; the email template preview reflects both.
- **Meetings:** Removed only the separate time-zone search input while retaining the scheduling-zone selector and saved choice. Public meeting date/time formatters already convert instants to each visitor's device time zone; the displayed time now labels that explicitly.
- **Compatibility:** Existing plain-text campaigns still render as paragraphs, and existing plain-text meeting descriptions remain supported.
- **Verification:** Production build, final TypeScript check, focused ESLint, and rich-text sanitizer/preview/API-response assertions passed. ESLint reported 0 errors and 6 existing `<img>` optimization warnings in the mailing, meeting-admin, and meeting-display components. Production Firestore behavior cannot be verified without access to the deployed environment.

## 2026-10-12: Fix reversed hero media and archive card alignment
- **Major changes:** The hero now reverses its grid-column proportions along with its media/copy order, keeping right-aligned images fully inside the viewport while preserving the same media size as left-aligned slides. The meeting "See details" button now has a square-corner gold background. Most Viewed and year-based archive rows stretch their small video cards to match the featured card height; small thumbnails remain landscape and card corners are square.
- **Verification:** `npx.cmd --no-install tsc --noEmit`, focused ESLint, and `git diff --check` passed. Browser checks confirmed right-side media stays within the desktop viewport, reversed hero remains single-column on mobile without horizontal overflow, and Most Viewed row cards have equal heights. ESLint reports 0 errors and 10 warnings (existing unused import/image warnings plus the hero `<img>` warning). No build/runtime errors were encountered.

## 2026-10-12: Correct homepage hero styling, media alignment, and About panel
- **Bug:** Hero child styles were scoped to the hero root by `styled-jsx`, but the media/layout/control markup is returned from a helper function and did not receive the generated scope class. As a result, global legacy hero rules left the grid and media unstyled, allowing long titles and carousel controls to overlap.
- **Fix:** Switched the hero's styles to `style jsx global` so its helper-rendered descendants receive the intended grid, typography, image-frame, and control positioning. Moved carousel controls into the media frame, bounded long headlines, and aligned contained meeting posters/video thumbnails in a stable 16:9 frame. Kept hero, About card, poster carousel, and related controls square; made meeting "See details" red. The homepage About copy now sits on a white panel below its meeting poster.
- **Verification:** `npx.cmd --no-install tsc --noEmit`, focused ESLint, and `git diff --check` passed (ESLint: 0 errors; warnings are existing homepage warnings plus the hero's existing `<img>` warning). Browser checks at desktop and 375px mobile confirmed the poster loads, media controls stay within the media, meeting details are red, and the page has no horizontal overflow. No build/runtime errors were encountered.

## 2026-10-12: Recover public routes after stale development server
- **Runtime issue:** The active Next.js dev server returned 404 for `/about` and API routes even though their route files and generated manifests existed; `/` still returned 200. A production build had run while the older development server was still running, leaving its router state stale.
- **Verified fix:** Restarted the existing `next dev` process and started a fresh development server. Verified `/`, `/about`, `/api/catalog`, and `/api/library` all return HTTP 200. No route source changes were needed.

## 2026-10-12: Put rotating meeting posters in homepage About card
- **Correction and major change:** Meeting posters belong in the homepage About card, not the standalone About page. The card now rotates through every catalog meeting with a poster (upcoming, ongoing, and past), with previous/next controls, date/title/status, and an animated image transition. Poster artwork uses `object-fit:contain` in a height-limited frame to avoid cropping or taking over the desktop layout. Replaced the card's lingering gradient background shorthand with solid `#0b3d91`, matching the newsletter.
- **Verification:** `npx.cmd tsc --noEmit`, focused ESLint (zero errors; nine existing homepage warnings), `npm.cmd run build`, and `git diff --check` passed. No build/runtime errors were encountered.

## 2026-10-12: Independent homepage hero, matching About colors, and meeting poster
- **Major changes:** Extracted the homepage hero carousel, slide timing, and meeting/video actions into `components/home/home-hero.tsx`. The featured About card now uses the newsletter form's exact blue palette. The About page now displays the nearest upcoming meeting's poster above its About heading when that meeting has a poster, falling back to an ongoing meeting only when no upcoming one exists; the poster reads the shared public catalog cache.
- **Verification:** `npx.cmd tsc --noEmit`, focused ESLint, and `git diff --check` passed. ESLint reported zero errors and nine existing homepage warnings. No build or runtime errors were encountered.

## 2026-10-11: Homepage most-viewed shelf covers full channel catalogs
- **Major change:** The homepage now builds its Most Viewed shelf from the top 12 `viewCount` results per enabled channel rather than sorting only the 100 most recent catalog videos. Results are deduplicated and merged to the homepage's top 12.
- **Read-efficiency:** Each per-channel Firestore query runs only while creating the shared server catalog snapshot, which remains cached for 24 hours. The recent-video feed remains capped at 100 documents; no per-visitor full-catalog read or listener was added. Added the required array-membership/view-count composite index and documented the approach.
- **Build/runtime note:** Production build succeeded, but static generation logged Firestore HTTP 400 for the new ranked query. The new composite index has not been deployed from this workspace; deploy `firestore.indexes.json` and wait for the index to finish building before rebuilding/deploying, since the catalog snapshot may be generated during build. This remote-index fix was not verified here.
- **Verification:** `npx.cmd tsc --noEmit`, focused ESLint (0 errors; existing homepage warnings), production build, Firestore index JSON parsing, and `git diff --check` passed.

## 2026-10-11: Admin mobile view — hamburger drawer instead of bottom nav
- **Problem:** On `max-width:760px` the admin sidebar was repurposed into a fixed bottom navigation bar, which left the mobile admin UI cramped and caused bottom-space overlap with page content.
- **Fix:** Removed the bottom-nav media block and replaced it with a slide-in drawer. `components/admin/admin-sidebar.tsx` now renders a mobile top bar (`.admin-mobile-bar`) with a hamburger button, an overlay backdrop, and a off-canvas `.admin-sidebar` that opens via `.open`. The drawer closes on nav click, backdrop click, Escape, and route change; all three close paths were verified reachable. CSS localized to `app/globals.css` (`@media(max-width:900px)` block).
- **Runtime error:** ESLint rule `react-hooks/set-state-in-effect` rejected `useEffect(() => setOpen(false), [pathname])`. **Verified fix:** close-on-navigation is derived during render by comparing a stored `openPath` with the current `pathname` instead of a state-setting effect.
- **Verification:** `npx eslint components/admin/admin-sidebar.tsx` passes with zero errors/warnings. (Full-repo `npm run lint` still reports pre-existing unrelated errors in public policy pages and generated bundles.)

## 2026-10-11: Avoid false unavailable state while meeting catalog loads
- **Bug:** Opening a meeting from the homepage could show “Meeting unavailable” before the detail page's client-side catalog request had finished. The detail page treated its intentionally empty initial feed as a confirmed missing meeting.
- **Fix:** Meeting details now show a loading state until the catalog request completes, an explicit load-failure state if the request fails, and the unavailable state only after a successful load confirms the meeting is absent.
- **Verification:** `npx.cmd eslint components/home/meeting-detail.tsx` passed with zero errors and one existing `<img>` warning. `npx.cmd tsc --noEmit` passed. No build/runtime errors were encountered.

## 2026-10-11: Support separate Firebase Admin credential variables
- **Major changes:** Firebase Admin initialization now accepts `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` directly, normalizes escaped private-key newlines, and reports incomplete credential configuration explicitly. Existing `FIREBASE_SERVICE_ACCOUNT_JSON` and application-default credential support remain available. Updated `.env.example` and setup documentation with project ID `poof-40b24`.
- **Verification:** `npx.cmd eslint lib/mailing-server.ts`, `npx.cmd tsc --noEmit`, `npm.cmd run build`, and `git diff --check` pass.

## 2026-10-11: Parse service-account JSON safely during mailing API initialization
- **Build errors:** Initializing Firebase Admin during route module import made page-data collection parse credentials during build. Replacing `\\n` over the whole JSON also made a valid private key invalid JSON. A follow-up typecheck showed Firebase Admin's `ServiceAccount` uses camelCase properties rather than JSON's snake_case names. A separate lazy-initialization refactor initially put `mailDb` in the unsubscribe GET rather than POST handler.
- **Fixes:** Firebase Admin initialization is now lazy, so builds do not parse deployment credentials while collecting route configuration. When a route needs Firebase, the JSON is parsed first, required snake_case/camelCase fields are validated and mapped to Firebase Admin's type, and escaped newlines are normalized only within `privateKey`. Invalid credentials produce explicit configuration errors without exposing credential contents. The unsubscribe database connection is scoped to its POST handler.
- **Configuration note:** For local `.env.local`, set `FIREBASE_SERVICE_ACCOUNT_JSON` to one valid JSON value (minified on one line is simplest); unquoted pretty-printed JSON after `=` is not parsed as one dotenv value.
- **Verification:** Final `npx.cmd tsc --noEmit`, `npm.cmd run build`, targeted ESLint on `lib/mailing-server.ts` and mailing routes, and `git diff --check` pass. The successful build generated all mailing API routes without evaluating the local credential value.

## 2026-10-11: Resend mailing, newsletter, and scheduled delivery
- **Major changes:** Added a responsive homepage newsletter signup backed by normalized, idempotent subscriptions; online meeting requests now create pending `onlineMeetingMembers` records alongside the contact inbox entry. Added `/admin/mailing` to verify or manually add meeting emails, compose/send or edit/cancel scheduled meeting and newsletter campaigns, preview responsive branded templates and video cards, and review delivery history. YouTube URLs render as linked thumbnail previews; other HTTPS video URLs render as linked play cards because email clients do not support dependable embedded playback.
- **Automation and safeguards:** Added Firebase Admin-backed server APIs with Firebase ID-token/admin-record checks, Resend delivery, signed newsletter unsubscribe links, Vercel's every-minute cron, local-timezone daily/weekly/monthly recurrence with optional end dates, 10-minute send leases, per-recipient Resend idempotency keys, and up to three retries for transient delivery failures. Mailing collections remain inaccessible through browser Firestore rules. Added Firebase service-account, Resend, cron, unsubscribe-secret, and site-URL setup documentation in `.env.example` and `README.md`; updated the privacy policy.
- **Errors and fixes:** The first TypeScript pass identified a nullable next-occurrence date in the scheduler; made the completion test explicit and only construct a timestamp when the next date exists. An initial cron try/catch refactor had a misplaced brace; fixed it and confirmed the route type-checks and lints cleanly. Smoke-test payloads sent as valid JSON confirmed bad email/request inputs return 400, missing cron auth returns 401, malformed unsubscribe links return 400, and the homepage returns 200.
- **Dependency note:** `npm audit --omit=dev` reports four high advisories through the existing Firebase Web SDK's `@grpc/grpc-js@1.9.16`; that exact dependency version is also in the pre-change lockfile. Firebase Admin uses `@grpc/grpc-js@1.14.6`. The suggested `npm audit fix --force` would downgrade Firebase across a breaking boundary, so it was not run.
- **Verification:** Final `npx.cmd tsc --noEmit` and `npm.cmd run build` passed; the build generated `/admin/mailing` and all `/api/mailing/*` routes. Targeted ESLint passed with zero errors and 11 warnings (the new external-thumbnail `<img>` elements plus existing homepage warnings). `git diff --check` passed. Sending against live Firebase/Resend and deployed Vercel Cron was not exercised; configure the documented server environment variables before use.
- **Vercel Hobby adjustment:** Changed `vercel.json` to run daily at 09:00 UTC (the Hobby plan rejects more frequent cron schedules). Documented the plan's ±59-minute precision and the possibility of next-day delivery in the admin scheduler and setup guide; exact-time and same-day delivery are not guaranteed on Hobby.

## 2026-10-11: Library note editor formatting and floating toolbar
- **Major changes:** Added a sticky, horizontally scrollable rich-text toolbar for mobile and desktop with a text color picker and font-family choices. Color changes restore the editor selection so applying a color retains the intended text range. Times New Roman is now the default in the note editor and public note reader.
- **Errors and fixes:** No build/runtime errors. TypeScript and editor/reader diagnostics passed; targeted ESLint reported only two existing `<img>` warnings in the library reader.
- **Verification:** `npx.cmd tsc --noEmit` passed; targeted ESLint on `components/admin/library-manager.tsx` and `components/home/library-page.tsx` passed with 0 errors and 2 existing image warnings. `git diff --check` passed.

## 2026-10-10: Admin dashboard overview and channel route
- **Major changes:** Expanded the admin overview with channel and playlist totals, refreshed responsive dashboard cards, and distinct loading/sign-in/unauthorized states. Added `/admin/channels`, mounted the existing channel manager there, and corrected the sidebar Channels link so it no longer routes back to the dashboard.
- **Meeting counts:** Dashboard meeting totals now come from the same cached `/api/catalog` snapshot and `meetingGroups` recurrence expansion used by `/meetings`, so counts include the public schedule's visible weekly occurrences instead of counting only up to 200 raw Firestore documents.
- **Errors and fixes:** Targeted ESLint initially flagged a synchronous loading-state reset inside an effect; removed the redundant reset and rely on the initial loading state while the asynchronous catalog request resolves. No build/runtime errors.
- **Verification:** `npx.cmd tsc --noEmit` and `npm.cmd run build` passed, including generation of `/admin/channels`. Targeted ESLint passed with 0 errors and 2 existing `<img>` warnings in the channel manager.

## 2026-10-09: Desktop header typography
- **Major changes:** Loaded Oswald through `next/font/google` and applied it to the desktop public masthead. Desktop branding is uppercase at 24px and navigation is uppercase at 22px; the existing mobile font and sizes remain unchanged.
- **Verification:** `npx.cmd tsc --noEmit` and `npm.cmd run build` passed. Targeted ESLint passed with 0 errors and one pre-existing `<img>` warning in `components/home/public-header.tsx`.

## 2026-10-08: Searchable meeting scheduling time zone
- **Major changes:** Meeting admins can search/select an IANA scheduling timezone; the chosen zone is persisted with each meeting and reused from browser local storage for the next meeting. Form date/start/end wall-clock values are converted using the selected zone (including DST offset calculation), and editing an older or existing meeting displays its values in the meeting's own scheduling zone. Public displays continue converting the stored instant into each viewer's device timezone.
- **Safety:** If browser storage is blocked, meeting publishing still succeeds; the browser zone is used as the default. The saved selection is device-local and can be changed before any meeting is scheduled.
- **Errors and fixes:** Initial targeted ESLint caught a synchronous state update used to initialize the preferred zone in an effect; moved initialization into the existing Firebase auth listener callback. A PowerShell verification command initially used unsupported `&&`; reran with PowerShell-compatible command sequencing. No TypeScript errors.
- **Verification:** Targeted `npx.cmd eslint components/admin/meetings-manager.tsx` passed with 0 errors and 2 existing image warnings; `npx.cmd tsc --noEmit` passed. Required `npm.cmd run lint` remains failing repository-wide with 37 errors and 1,597 warnings, including unrelated existing policy-page errors and generated PDF worker warnings. The touched meeting file has no lint errors.

## 2026-10-08: Admin library note editing and reusable editability
- **Major changes:** Added an Edit action for published library notes in `/admin/library`. It loads the note's current title, description, category, and rich-text HTML into the existing editor; saving updates that Firestore document without changing its original creation timestamp. Cancel edit exits editing and clears the form. Uploaded PDF/Word files are explicitly not editable in-place; the UI tells administrators to replace them by deleting and uploading again.
- **Design rule:** When adding or maintaining admin-managed activities/content that administrators may need to correct after publishing, provide an edit path that prepopulates existing values and updates the existing record, plus a clear cancel action. Do not assume delete-and-recreate is the only correction workflow; where a resource type cannot be edited safely (such as stored uploads), clearly explain the replacement path.
- **Errors and fixes:** First targeted ESLint check flagged an existing internal `<a>` link in the library manager; changed the library navigation and preview links to `next/link`. No TypeScript errors. No runtime/build errors encountered during this change.
- **Verification:** `npx.cmd tsc --noEmit` passed and targeted `npx.cmd eslint components/admin/library-manager.tsx` passed. Required `npm.cmd run lint` remains failing repository-wide with 36 errors and 1,597 warnings (existing policy-page violations and generated PDF worker warnings among them); no library-manager findings remain.

## 2026-10-07: Mobile public-header search and complete cached-feed results
- **Major changes:** The public masthead search input now uses mobile search keyboard hints (`inputMode="search"`, `enterKeyHint="search"`), disables distracting auto-correction/autocomplete, has a 16px mobile font to avoid iOS zoom, and has corrected flexible sizing so the input and close button fit the full available header width. The placeholder now clarifies searchable fields.
- **Search experience:** Homepage search now searches the full video set already included in the shared cached public catalog, not merely the six videos in the homepage shelf. It matches display title, source title, description, channel, and category, and renders at most 30 results while stating when more matches exist.
- **Cost:** Search is entirely client-side against the existing 24-hour shared feed. It does not make a request per keystroke, open a Firestore listener, or call YouTube; the result cap also bounds rendered cards and thumbnail requests.
- **Errors and fixes:** The initial editor path for the homepage component omitted its `home/` directory and failed without applying changes; resumed using the confirmed full path. PowerShell exact-block matching failed due to line-ending differences; located and replaced the exact block boundaries instead. No runtime or TypeScript errors remain.
- **Verification:** `npx.cmd tsc --noEmit` passed. Targeted ESLint on both changed components had 0 errors and 10 warnings (existing unused import/image warnings). Required `npm.cmd run lint` still fails repository-wide with 37 errors and 1,597 warnings, including generated PDF worker output and unrelated public/admin files. `git diff --check` reports one trailing-whitespace line in the already-modified `components/home/site-footer.tsx`, outside this search change. No live-device/browser test was run.

## 2026-10-07: Cache public library data and bound admin snapshots

- **Major changes:** Added a shared server-cached `/api/library` snapshot for public categories and documents, refreshed every 10 minutes and capped at 900 records per collection. Homepage and Library screens now share a client in-memory request and no longer open full collection listeners; opening a library reader uses the cached document list rather than adding a separate Firestore `getDoc` read.
- **Major changes:** Bounded the admin meeting and published-resource live snapshots to 200 records and the inbox snapshot to 100. The notification bell keeps its 20-row ordered listener and no longer opens a second fallback listener after errors.
- **Time handling:** Meeting creation already converts the administrator browser's local date/time to UTC and stores its IANA timezone; meeting displays format the stored instant in each visitor's detected browser timezone. Kept that behavior unchanged.
- **Errors and fixes:** The first TypeScript check found a missing type-only `LibraryDocument` import in the homepage helper annotations. Restored the import; the next check passed. No runtime/build errors encountered.
- **Verification:** `npx.cmd tsc --noEmit` and `git diff --check` passed. Not measured against live Firestore traffic, so the exact percentage of read reduction is not verified. Public library updates can take up to 10 minutes to appear in the shared feed.

## 2026-10-07: Mobile meeting actions and share-ready study links

- **Major changes:** Meeting-card actions retain their labels on narrow screens and arrange into a two-column action grid, eliminating the empty mobile outlines caused by hiding both text labels. The homepage masthead and footer are now reusable `PublicHeader` and `SiteFooter` components. Desktop navigation links no longer use pill/text backgrounds; the active route uses a small red underline.
- **Sharing:** Library readers now pass title and description to the native share sheet. Dynamic Library metadata and a generated Open Graph image give shared study URLs a preview with title, description, link, and a document thumbnail (the saved PDF first-page preview when available; a branded fallback for notes and other files).
- **Verification:** `npx.cmd tsc --noEmit`, `npm.cmd run build`, and `git diff --check` passed. Targeted ESLint found no new errors; it retains the pre-existing `react-hooks/set-state-in-effect` error in `components/home/library-page.tsx:329` and existing `no-img-element` warnings.

## 2026-10-07: Homepage Latest Studies mirrors the Library listing

- **Major changes:** The homepage Latest Studies shelf now renders the same visual material as `/library`: a first-page preview for PDFs (including the existing Cloudinary fallback), an Office preview for Word files, and a clipped note preview for authored notes. Each card retains the Library type badge, title, two-line description, and hover affordance, and links directly to its reader.
- **Limit:** The shelf intentionally remains capped at six newest studies (`HOME_STUDY_LIMIT`), with Health material retaining its existing priority ordering.
- **Verification:** `npx.cmd tsc --noEmit`, targeted `npx.cmd eslint components/home/home-screen.tsx`, and `git diff --check` passed.

## 2026-10-07: Homepage section visibility and ministry-card height

- **Major changes:** The homepage ministry feature now uses content height on desktop rather than stretching to match the adjacent Latest Videos column. Empty loaded Meetings, 2-years-ago, and 4-years-ago sections are omitted instead of showing placeholder space.
- **Build safeguard:** Restored archive-year calculation to the client `now` state. Rendering `new Date()` directly in this Cache Components Client Component causes Next.js prerender failures; keep the year archive sections hidden until the client clock is available.
- **Verification:** `npx.cmd tsc --noEmit` and `git diff --check` passed. Targeted ESLint had 0 errors and the same 9 existing `@next/next/no-img-element` warnings.

## 2026-10-07: Homepage ministry feature and compact meeting grid

- **Major changes:** Restored the homepage “About the Ministry” feature beside Latest Videos, now with a finished editorial treatment: layered dark-green surface, subtle grid and light detail, clear hierarchy, and direct paths to the About page and meeting-link request. The section collapses beneath the video list on small screens.
- **Major changes:** Homepage meeting cards now display in a three-column grid on desktop and a single column on mobile, with up to three meetings surfaced per active status. Cards retain their full poster, event metadata, countdown, and actions while no longer expanding into oversized list rows.
- **Verification:** `npx.cmd tsc --noEmit` passed. Targeted `npx.cmd eslint components/home/home-screen.tsx` had 0 errors and 9 pre-existing `@next/next/no-img-element` warnings.

## 2026-10-07: Mobile recurring meetings and bottom-navigation overlap

- **Bug:** Weekly meetings were expanded only through the end of the current calendar week. Once that week's occurrence completed, the mobile schedule could show only the completed card and no future recurring instance, even though the meeting repeats. Completed online cards also still exposed the obsolete "Request link" action. The final portion of meeting lists/details could sit behind the fixed mobile tab bar.
- **Fix:** `expandRecurringMeetings` now includes the current and following calendar weeks, so upcoming weekly occurrences remain in the schedule after the current one ends. The request-link action is now omitted whenever a meeting is completed in both list cards and the meeting detail page. Added safe-area-aware mobile bottom padding to the meetings schedule and meeting detail content so the final controls remain scrollable above the fixed tab bar.
- **Verification:** `npx.cmd tsc --noEmit`, targeted ESLint on the changed meeting files, `npm.cmd run build`, and `git diff --check` passed.

## 2026-10-06: Fix `/meetings` prerender failure — `Date.now()` in Client Components

- **Error:** `npm run build` (Next.js 16.3.8, Turbopack, Cache Components) compiled and type-checked cleanly, then failed at page data collection with `Error occurred prerendering page "/meetings"` followed by `Export encountered an error on /(public)/meetings/page: /meetings, exiting the build.`
- **Root cause:** The page's helpers in `lib/meetings.ts` defaulted their clock argument to `Date.now()` (and `expandRecurringMeetings` additionally fell back with `now || Date.now()`). These helpers run during render of a Client Component, and Next.js 16's Cache Components rejects an unstable current-time read in that position — the internal bailout `blocking-prerender-current-time-client`, which surfaced as the misleading `BAILOUT_TO_CLIENT_SIDE_RENDERING` symptom.
- **Fix:** Removed every render-time clock default: `expandRecurringMeetings`, `collapseMeetingOccurrences`, `meetingStatus`, and `meetingJoinVisible` now all take a required `now: number`, so `Date.now()` is never called while prerendering. Callers already hold clock state (`const [now, setNow] = useState(0)` filled from a `useEffect`), so time is only read on the client. In `components/home/home-screen.tsx` the archive-year derivation now reads that same `now` state (`currentYear` derived from `now`, with the two archive sections gated while `currentYear` is `0`) instead of calling `new Date()` during render.
- **Trap / lesson:** Do NOT default a helper's time argument to `Date.now()` when that helper is called during render of a Client Component under Cache Components — pass the caller's clock state instead. Also, `BAILOUT_TO_CLIENT_SIDE_RENDERING` at prerender time is a masked symptom; the real cause is reported as `blocking-prerender-current-time-client`.
- **Reverted:** Earlier speculative workarounds (adding `instant = false`, making `app/(public)/meetings/page.tsx`/`app/(public)/page.tsx` `async`) were unnecessary and were removed; both route files match their committed versions.
- **Verification:** `npx.cmd tsc --noEmit` exit 0. `npm.cmd run build` compiled successfully, finished TypeScript, and generated all 33/33 static pages with `/meetings` listed as static (`○`) — no prerender error, no worker exit. `git status` shows no stray `.build*.log`/`.prerender.log`/`tailwindcss-*.log` artifacts.

## 2026-10-06: Library listing previews follow the upload-time thumbnail pattern

- **Major changes:** Applied the "store a first-page image when uploading, render that image in every listing" pattern to library PDFs, without touching the reader or the download route. `/api/library/upload` now sends PDFs to Cloudinary's `image/upload` endpoint (Word and other files stay on `raw/upload`) and returns `previewUrl`, the upload's `secure_url` with `.pdf` swapped for `.jpg`. `libraryDocuments` gained an optional `previewUrl` field, the admin uploader persists it, and the resource grid renders `item.previewUrl` with `loading="lazy"`.
- **Compatibility fallback:** The listing helper falls back to the previous `image/fetch/pg_1,f_jpg,w_1000/...` transform when a document has no stored preview, so PDFs uploaded before this change keep their tiles until re-uploaded. Nothing changed in `fileUrl`, `PdfDocument`, or `/api/library/download`.
- **Cause / finding:** PDFs uploaded with `resource_type: raw` cannot be transformed or delivered as a page image. Cloudinary stores PDFs as the `image` resource type by default specifically so page-level transformations work, and delivery converts a page to an image by changing the file extension; password-protected PDFs are the documented exception and must be uploaded as `raw`. See [How to Upload, Manage, and Deliver PDF Files](https://cloudinary.com/documentation/ts_how_to_upload_manage_and_deliver_pdf_files).
- **Firestore rules:** `libraryDocuments` create/update allow-lists now include `previewUrl` with a `== null || is string` guard. Without this the file publish would have been rejected by rules.
- **Errors and fixes:** No build or runtime errors. Pre-existing lint findings only: `react-hooks/set-state-in-effect` in `library-page.tsx` line 26 and `no-html-link-for-pages` on the existing raw anchors (this is the debt noted on 2026-10-06 above and in `PROJECT_MEMORY.md` line 5); two `no-img-element` warnings.
- **Verification:** `npx.cmd tsc --noEmit` exit 0. `npm.cmd run build` completed and listed all routes including `/library` and `/api/library/upload`. `git diff --check` clean. Not verified: an actual PDF upload against live Cloudinary, and Firestore rules are unexercised locally (no emulator installed).

## 2026-10-06: Edit meetings and show only this week's recurring instances
- **Major changes:** Admin scheduled-meeting rows now have an Edit action that populates the creation form with the existing title, description, poster, local date/time, format, link/venue, and weekly recurrence; Save changes updates the existing Firestore document, including removing recurrence when turned off. Cancel edit resets the form. New meeting publishing still uses `addDoc`.
- **Major changes:** `expandRecurringMeetings` now generates only instances overlapping the current Sunday-to-Sunday calendar week in the public viewer's timezone, accounting for scheduler/viewer timezone boundaries. Annual or never-ending repeat rules remain stored on the meeting document, so the next week's occurrences appear as the week rolls over. Non-recurring meetings remain unchanged.
- **Verification:** `npx.cmd tsc --noEmit`, targeted ESLint (0 errors, 2 existing image warnings), and `git diff --check` passed. `npm.cmd run lint` remains failing on pre-existing errors in unrelated policy/library pages and generated PDF worker output (42 errors, 1586 warnings).

## 2026-10-06: Homepage meeting duplication from recurring occurrences

- **Bug:** A single weekly-recurring meeting appeared many times on the homepage Meetings section. `expandRecurringMeetings` intentionally expands a weekly rule across a ~13-month window (~57 occurrences), which is correct for the `/meetings` schedule page but wrong for the homepage, which should present each meeting once.
- **Fix:** Added `collapseMeetingOccurrences(meetings, now)` to `lib/meetings.ts`. It expands as before, then keeps only the soonest occurrence per `sourceId` (falling back to `id` for non-recurring meetings). The homepage now calls `meetingGroups(collapseMeetingOccurrences(meetings, now), now)` for both the hero rotation (`priorityMeetings`) and the Meetings section (`meetingGroupsShown`). The `/meetings` page and the mobile nav count were left unchanged, since a schedule listing every occurrence and a raw non-completed count are both correct there.
- **Tooling note (important):** The `read` and `edit` tools operated on a stale, double-spaced buffer of `components/home/home-screen.tsx` that did not match disk, so `edit` kept reporting "old_string not found". The on-disk file was the source of truth. Applied the change with a .NET UTF-8 exact `String.Replace` (`[IO.File]::ReadAllText`/`WriteAllText` with `UTF8Encoding($false)`) after confirming each target substring was unique. Verified afterward: no BOM, non-ASCII count unchanged (10), CRLF/LF counts unchanged (165/207), no mojibake.
- **Verification:** `npx.cmd tsc --noEmit` passes clean. Targeted `eslint lib/meetings.ts components/home/home-screen.tsx` reports 0 errors and only the pre-existing `no-img-element` warnings.

## 2026-10-05: Library document previews, download routing, and flatter listing

- **Major changes:** Library resource listings now show a first-page PDF/Word preview or the beginning of a note, followed by the title and a description clamped to two lines. The search field sticks while scrolling. Playlist rows and resource listings no longer use extra enclosing card backgrounds; keep library content on the original page background in future UI work unless a card treatment is specifically requested.
- **Major changes:** File downloads now go through `/api/library/download`, which streams only HTTPS Cloudinary resource URLs back with an attachment filename, keeping download actions on the site. The existing legacy `bible-studies` root is renamed to `Other Studies` when an administrator opens the library manager; new child topics can be selected by their own names, without a parent prefix. New topics are added under one of the two seeded parent categories, Health or Other Studies.
- **Errors and fixes:** No build or runtime errors encountered during this change. A first CSS patch did not match the minified stylesheet line; the intended styles were added as a focused override instead.
- **Verification:** Not run per instruction.

## 2026-10-05: Consistent library document preview on mobile

- **Major changes:** Resource-list PDF previews now use a Cloudinary-generated JPEG of page one, avoiding browser-specific PDF iframe rendering. Word documents retain their embedded Office viewer. The mobile resource list uses one column and portrait page proportions so the first page is legible at phone width; desktop keeps the multi-column grid with the same page proportions.
- **Cause:** The native PDF iframe depends on browser PDF support. Mobile Chrome fell back to its PDF open/download surface rather than painting the page inside the listing. Cloudinary supports generating images from remotely fetched PDF pages; see [PDF delivery documentation](https://cloudinary.com/documentation/ts_how_to_upload_manage_and_deliver_pdf_files) and [remote PDF fetch previews](https://cloudinary.com/documentation/fetch_remote_images).
- **Errors and fixes:** No build/runtime errors encountered during this change.
- **Verification:** Not run per instruction.

## 2026-10-05: In-site PDF reader and meeting-style share action

- **Major changes:** Replaced the reader's native PDF iframe with PDF.js canvas rendering for every page, using the same-origin download proxy to retrieve the file. The PDF worker and its Apache 2.0 license are served from `public/`. Reader zoom now scales the rendered pages and the page stack adapts to the available screen width. The document Share button uses the same `sharePublicUrl` helper and meeting share icon/button styling as meeting cards.
- **Cause:** The previous fix only changed listing thumbnails. The full reader still embedded the original PDF, so mobile browsers continued to show the browser's “Open” fallback.
- **Errors and fixes:** The initial sandboxed `npm install` could not reach the package registry; reran with approved network access and installed `pdfjs-dist` successfully. The first TypeScript check found PDF.js `RenderParameters` requires both `canvas` and `canvasContext`, its render result is a `RenderTask`, and `PDFDocumentProxy` has no `destroy()` method. Passed the canvas and context, used the render task's type, and clean up with `PDFDocumentLoadingTask.destroy()`.
- **Verification:** `npx.cmd tsc --noEmit`, `npm.cmd run build`, and `git diff --check` passed. The production build generated all 28 routes.

## 2026-10-05: Library navigation, categorized resources, and online reader

- **Major changes:** Replaced the Playlists destination with Library in desktop and mobile navigation. Added `/library` as one directory for the existing synced video playlists plus published study resources, with text search and category selection. Added `/library/[id]` to read authored rich-text notes, preview PDFs and Word files in-page, adjust note zoom, and download uploads.
- **Major changes:** Added `/admin/library` for admins to create persistent categories, publish rich-text notes, and upload PDF/DOC/DOCX documents. Health and Bible Studies seed the category collection the first time an authenticated admin opens the manager; admins can add persistent child topics, which become selectable for later resources. Pasted formatting is retained in the contenteditable note editor.
- **Security and storage:** Added public-read/admin-write Firestore rules for library category and resource metadata. Added `/api/library/upload`, which validates the Firebase bearer token against Firestore admin status and uploads up to 25 MB to the existing signed Cloudinary setup. Cloudinary credentials must be configured as documented in `.env.example`.
- **Build issue and fix:** The first TypeScript check found that the not-yet-generated `/library/[id]` route was absent from the current generated `PageProps` route union. Typed its promised `params` directly as `{ id: string }`; TypeScript and the production build then passed.
- **Verification:** `npx.cmd tsc --noEmit` passed. `npm.cmd run build` passed and generated 27 routes, including `/library`, `/library/[id]`, `/admin/library`, and `/api/library/upload`. Firestore rules were updated but not exercised against an emulator.

## 2026-10-05: Device-local meeting timezones

- **Major changes:** Meeting scheduling now records the administrator device's IANA timezone alongside the ISO start/end instants. Public and admin meeting dates/times explicitly format in each viewer's detected device timezone and include the local timezone abbreviation, so the same meeting is not presented as the scheduler's wall-clock time to people in another region. The scheduling form identifies the detected timezone and explains that visitors receive their local conversion.
- **Errors and fixes:** `apply_patch` initially did not match lines containing an en dash from the source encoding. Retried with the exact Unicode source text; no source content was lost.
- **Verification:** `npx.cmd tsc --noEmit`, `npm.cmd run build`, and `git diff --check` pass. The production build generated all 24 routes.

## 2026-10-05: Desktop navigation parity with mobile

- **Major changes:** Updated the homepage desktop navigation from a plain text row to a compact, icon-led pill navigation. It now uses the same destination language as the mobile tab bar (Home, Playlists, Channels, Zoom, and Contact), clearly marks the current page, has keyboard-visible focus treatment, and keeps route transitions on internal destinations using `next/link`.
- **Design guideline:** Keep desktop and mobile navigation behavior, destinations, active states, and accessibility practices in parity. As mobile navigation best practices improve, review and apply the relevant improvements to the desktop navigation as well (and vice versa) so both views stay current.
- **Errors and fixes:** No build or runtime errors encountered during this change.
- **Verification:** `npx.cmd tsc --noEmit`, `npm.cmd run build`, and `git diff --check` pass.

## 2026-10-05: Professional footer layout (white background, typing animation kept)

- **Major changes:** Rebuilt the homepage footer markup in `components/home/home-screen.tsx` as `.site-footer > .footer-inner`, holding a real `<nav className="footer-links" aria-label="Footer navigation">`, the existing `.powered-by` typing-animation span, then the copyright `<p className="footer-copyright">`. Rendered order is links → typing animation → copyright, so the copyright sits below the "Powered by Advent Nurutech" line. Copyright text is now "© Faith of the Pioneers. All rights reserved."
- **Styling (`app/globals.css`):** `.site-footer` gained an explicit `background:#fff`, more vertical padding, and its own font size. `.footer-inner` is a new centered flex column (`max-width:1180px`) so the footer is no longer a single `justify-content:space-between` row. `.powered-by` is now centered instead of right-aligned with a `min-height:18px` so the line does not jump vertically while `max-width` animates. The `powered-type` / `powered-caret` keyframes and the `prefers-reduced-motion` override are unchanged, so the typing effect still behaves exactly as before. A stale `.site-footer{padding-bottom:4px}` mobile override was removed so it could not squash the taller footer.
- **Errors and fixes:**
  - **UTF-8 corruption (important, recurring).** Editing these files through PowerShell 5.1 (`Get-Content` → `Set-Content`) or through `py` scripts that read with `errors='replace'` and rewrite mojibake every non-ASCII character (`…` → `â€¦`, `“ ”` → `â€œ â€`, `‹ ›` → `â€¹ â€º`, `—` → `â€`, `©` → `Ac`). Only the `edit` tool round-trips these files safely. **Rule: never rewrite `components/home/*.tsx` or `app/globals.css` with shell string replacement; use the `edit` tool.** If a rewrite already happened, `git checkout --` the file and redo the change with `edit`.
  - **`"use client"` lost from `components/home/contact-page.tsx`.** The same mangling dropped the directive, leaving a blank first line. `npx tsc --noEmit` then reported `TS1192: ... has no default export` and `TS2304: Cannot find name 'Link' / 'isPrayer'`, and `next build` failed with *"You're importing a module that depends on `useState` into a React Server Component module."* Fixed by restoring `"use client";` on line 1.
  - **`git checkout --` clobbered uncommitted work.** The 2026-10-04 "Faith of the Pioneers" rename had never been committed, so reverting `home-screen.tsx` to fix the mojibake also discarded the brand wordmark, brand `aria-label`, and hero kicker rename. Those were manually re-applied; the rename is now split across two separate commits' worth of uncommitted work, so avoid blanket reverts of these files.
- **Verification:** `npx tsc --noEmit` clean. `npm run lint` unchanged at the pre-existing 36 errors / 22 warnings. `npm run build` succeeds, 21 routes prerendered.

## 2026-10-04: Site renamed to Faith of the Pioneers

- **Major changes:** Renamed the website from "Pioneers of Our Faith" to "Faith of the Pioneers" in every user-facing string: `metadata.title`/`metadata.description` in `app/layout.tsx`, the header brand wordmark and its `aria-label`, the hero kicker fallback text, the footer copyright, the Terms of Use and Privacy Policy definitions of the site, the Fundamental Principles placeholder copy, and the `README.md` title.
- **Note:** `PROJECT.md` still uses "Pioneers of Our Faith" as an example *YouTube channel* name in its sample channel lists and channel-page mockups; those were intentionally left unchanged because they describe channel data, not the site name.
- **Errors and fixes:** No build or runtime errors. Only string literals changed, so no behavior or styling was affected.
- **Verification:** `npx tsc --noEmit` reported no errors. `npm run lint` reports the same 36 pre-existing errors and 22 warnings as before the change (raw `<a>` internal links, `no-img-element`, `react-hooks/set-state-in-effect`); no new findings were introduced.

## 2026-10-04: Homepage meetings section, live countdowns, and Zoom search/filter

- **Major changes:** The homepage "Past Meetings" block was driven by a playlist-title regex (`/meeting|rally|workshop|camp|conference|retreat/i`) instead of real meeting records, so it showed nothing useful. It is now a "Meetings" section fed by the `meetings` collection, ordered Ongoing → Upcoming → Completed, and placed above the playlist sections, which are unchanged. The playlist page component and `/playlists` routes were not touched.
- **Major changes:** Extracted the Zoom meeting card into `components/home/meeting-card.tsx` so the homepage and `/meetings` render the identical card: poster, status badge, title, description, date/time metadata, countdown, format line, and actions. On mobile the existing `.zoom-meeting-card` single-column rule already stacks the poster above the copy, so the description, metadata, and buttons fall below the image. Added a "Details" link to `/meetings/{id}`, which the card previously lacked.
- **Major changes:** Added live countdowns to ongoing meetings ("Ends in") and upcoming meetings ("Starts in") on the homepage, the Zoom page, and the event detail page. `MeetingCountdown` owns its own one-second interval so page trees do not re-render every second; grouping still uses the existing 30-second clock.
- **Major changes:** Added search and status filtering to the Zoom page. Search matches title, description, venue, and format; status pills show live per-status counts and default to All. The prior empty-state behavior is preserved: Ongoing is hidden when empty, while Upcoming and Completed keep their messages.
- **Naming:** Replaced user-facing "event" wording with "meetings" throughout, including the homepage heading, search placeholder and labels, result counts, empty states, the share button title, and the admin "Event format" field. Internal `EventStatus`/`eventGroups` were renamed to `MeetingStatus`/`meetingGroups`.
- **Design rule:** Countdown pills use the site red accent background with white text and a tabular monospace clock.
- **Errors and fixes:** No build or runtime errors. An early version derived the Zoom page's per-status counts by index (`matched[0]`, `matched[1]`, `matched[2]`), which was fragile; counts are now accumulated into a keyed record. The first compact homepage row was replaced by the shared card so both pages stay in sync.
- **Pre-existing lint debt (not introduced here):** `react-hooks/set-state-in-effect` in the `channelsLoaded`/`ids.length` guards in `home-screen.tsx` and in `playlists-page.tsx`, plus `@next/next/no-html-link-for-pages` on the homepage header links. Targeted ESLint on every touched file reports zero new errors.
- **Verification:** `npm.cmd run build` completed successfully with all 21 routes. A production server smoke test returned 200 for `/`, `/meetings`, `/playlists`, and `/contact`. Server-rendered HTML confirmed the Meetings section sits above both playlist sections and that the old Past Meetings markup is gone. The built stylesheet contains the new countdown, details-button, and filter rules and no longer contains the removed event-row rules.

## 2026-10-04: Prayer request inbox and admin notifications


- **Major changes:** Reused the public contact form component for a new `/prayer-request` page with prayer-specific copy and submission labeling. Contact and prayer submissions share the `contacts` Firestore collection through a bounded `category` field, and the admin inbox now displays both types.
- **Major changes:** Added a real-time admin notification bell to the channel dashboard and contact inbox. It watches new inbox records, shows contact/prayer labels and a count, links to the inbox, and stores the per-admin read timestamp in local storage.
- **Security:** Updated Firestore contact creation rules to require `category` to be either `contact` or `prayer`, while retaining bounded name, email, phone, message, and server timestamp validation.
- **Errors and fixes:** Targeted ESLint initially flagged synchronous read-state initialization inside an effect and an internal home anchor. The notification bell now uses lazy state initialization, and the contact header uses `next/link`.
- **Verification:** `npm.cmd run build` completed successfully, including the new `/prayer-request` route. Targeted ESLint completed with zero errors and two existing `no-img-element` warnings in `channel-manager.tsx`. `git diff --check` passed.

## 2026-10-04: Footer animation and link alignment

- **Major changes:** Updated the Advent Nurutech credit to type in blue on a continuous loop. Footer links now stay aligned in a centered side-by-side row on larger screens and wrap cleanly on narrow screens.
- **Errors and fixes:** No build/runtime errors encountered during this change.
- **Verification:** `npx.cmd tsc --noEmit` and `git diff --check` passed.

## 2026-10-04: Playlist archive order and footer credit

- **Major changes:** Kept the original Featured Playlists section and added a second playlist listing after Most Viewed. Older-video archive cards now show the description below the title, falling back to the channel name when the description is empty. Added a Fundamental Principles footer link and a restrained typing animation for the “Powered by Advent Nurutech” credit, with reduced-motion support.
- **Errors and fixes:** No build/runtime errors encountered during this change.
- **Verification:** Not run.

## 2026-10-04: Most-viewed homepage archive

- **Major changes:** Added a “Most Viewed” homepage section after the four-year archive, selecting up to 12 loaded videos by YouTube view count and using the same alternating wide/small layout. “Faith of the Pioneers” remains a description fallback only when a video has no description.
- **Errors and fixes:** No build/runtime errors encountered during this change.
- **Verification:** Not run.

## 2026-10-04: Mobile video archive layout

- **Major changes:** On mobile, each older-video group now stacks the wide video across the content width, followed by two smaller portrait cards side by side, matching the supplied YouTube mobile reference.
- **Errors and fixes:** No build/runtime errors encountered during this change.
- **Verification:** Not run.

## 2026-10-04: Archive row alternation

- **Major changes:** Alternated older-video archive rows so every other wide video appears on the right, removed the archive video-count labels, and hide the four-year section when its videos have loaded and none are available.
- **Errors and fixes:** No build/runtime errors encountered during this change.
- **Verification:** Not run.

## 2026-10-04: Featured playlists heading accent

- **Major changes:** Changed the icon before “Featured Playlists” from black to the site’s red accent so the heading stands out.
- **Errors and fixes:** No build/runtime errors encountered during this change.
- **Verification:** Not run.

## 2026-10-04: Homepage older-video archives

- **Major changes:** Added two homepage video archives directly below Past Meetings for videos published in the calendar years two and four years before the current year. Each archive shows up to 15 videos in repeating groups of one wide video and two smaller videos. The first embeddable video in the two-year archive autoplays muted inline; other videos open the existing player when selected. Raised the homepage Firestore video query cap from 300 to 1,000 so older archive items are more likely to be in the loaded catalog.
- **Errors and fixes:** No build/runtime errors encountered during this change.
- **Verification:** Not run.

## 2026-10-04: Public mobile breadcrumb text encoding

- **Major changes:** Replaced mojibake punctuation on the contact and playlist pages with valid Unicode, including the Home back arrow, contact label separator, playlist controls, and contact status messages. This fixes the garbled breadcrumb visible on mobile and cleans up adjacent labels in the same views.
- **Errors and fixes:** No build/runtime errors encountered during this change.
- **Verification:** `rg` confirmed the affected public page components no longer contain mojibake. Build and lint not run.

## 2026-10-04: Public search, empty states, and shared loading UI

- **Major changes:** Search mode now uses the full public header row on desktop and mobile. Removed public links to administrator tools and removed the YouTube channel connection prompt from the public video empty state. Added reusable skeleton loading components and used them for homepage videos, playlists, and channels, playlist data, and Zoom meetings. Updated the Zoom page header to use a plain meeting schedule label and corrected its broken arrows and apostrophe; added visible calendar, clock, and join icons to meeting details and actions.
- **Errors and fixes:** No build/runtime errors encountered during this change.
- **Verification:** `git diff --check` completed without whitespace errors. Build and lint not run.

## 2026-10-04: Search results overlay

- **Major changes:** Homepage search now opens a scrollable results panel beneath the header with a blurred backdrop. Matching videos appear immediately over the hero, including an empty-query prompt and a no-results state. On mobile the panel leaves room for the fixed bottom navigation, and the search field takes priority in the header.
- **Errors and fixes:** No build/runtime errors encountered during this change.
- **Verification:** `git diff --check` completed without whitespace errors. Build and lint not run.

Record verified errors and fixes, plus major changes, here. Review this file before related work to avoid repeating known issues in future versions.

## 2026-10-05: Homepage ministry card and Zoom link requests

- **Major changes:** Added a responsive About the Ministry card beside Latest Videos on desktop and directly below Latest Videos on mobile. The card links to the full About page and to a new Zoom meeting link request form.
- **Major changes:** Added `/meeting-link-request`, stored submissions as `contacts.category = "meeting-link"`, expanded Firestore validation, and added `/admin/link-requests` plus dashboard and notification links for administrators.
- **Repair:** `components/home/contact-page.tsx` was an empty file in the working tree even though the public contact and prayer routes imported it. Restored the existing contact/prayer form behavior and added the meeting-link mode.
- **Errors and fixes:** `npx tsc --noEmit` was blocked by the Windows PowerShell execution policy for `npx.ps1`; reran the same check with `npx.cmd tsc --noEmit`, which passed. `npm.cmd run build` passed with 24 routes, including the new public and admin routes.

## 2026-10-05: Homepage readability, channel fallbacks, and About library

- **Major changes:** Increased homepage and About-page typography, removed the About-card forced full-height behavior that created a long empty desktop panel, and added a YouTube play-mark fallback when a connected channel has no usable profile image.
- **Major changes:** Converted homepage internal navigation and footer navigation to `next/link`. The Advent Nurutech credit is now a mailto link with a prefilled request message for website and YouTube-channel services.
- **Major changes:** Added a live Most Viewed Videos section to `/about`, ranking available Firestore videos by `statistics.viewCount`.
- **Errors and fixes:** Fixed the homepage hook lint errors by removing synchronous loading-state writes from effects and letting Firestore callbacks/empty-state callbacks update them asynchronously. Targeted ESLint now reports zero errors; remaining findings are image optimization warnings only. TypeScript, production build, and `git diff --check` pass.

## 2026-10-05: Flat About library, WhatsApp CTA, and Zoom email handoff

- **Major changes:** Removed the boxed-card treatment from About-page Most Viewed videos so the rows sit directly on the page with the same quiet background treatment as homepage latest-video rows.
- **Major changes:** Changed the Powered by Advent Nurutech CTA to WhatsApp number `254142225233` with a prefilled service message.
- **Major changes:** Zoom-link requests now label the phone field as WhatsApp number and require it. After the request is saved to Firestore, the browser opens a prefilled email to `birdmanjo@gmail.com` containing the requester details and Zoom-link request.
- **Verification:** `npx.cmd tsc --noEmit` and `npm.cmd run build` pass with 24 routes. Targeted ESLint has zero errors and only existing `no-img-element` warnings. `git diff --check` passes.

## 2026-10-04: Signup code and protected admin routes

- **Major changes:** Added `/signup` with server-side `SIGN_UP_CODE` validation before creating Firebase email/password accounts, and added `/signin` with email/password and Google options. The shared admin layout withholds all admin page children until Firebase auth and the enabled admin record are verified. Added an owner-scoped `userProfiles` Firestore rule and documented `SIGN_UP_CODE` in `.env.example`.
- **Security note:** Firestore rules cannot securely read a server `.env` value. The signup code is checked by `/api/auth/signup` and must not be copied into rules. Rules continue to restrict administrator data to enabled admins.
- **Lint issue and fix:** The first lint pass flagged a synchronous `setState` in the admin layout effect. Initial readiness is now set from the Firebase auth listener callback, and the auth routes use `Link` and router navigation for internal routes.
- **Verification:** `npm.cmd run build` completed successfully. ESLint passed for the admin layout, signup/signin pages, and signup API route. The full repo lint still reports 40 errors and 23 warnings in other existing/modified pages; those findings are outside the auth files changed here. `git diff --check` reported no whitespace errors.

## 2026-10-04: Admin auth navigation follow-up

- **Major changes:** Removed the Channel administration link from the homepage footer. Successful email/password signup and sign-in now navigate to `/admin`.
- **Access issue identified at the time:** New Firebase accounts were not administrators because the deployed rules permitted only one hard-coded UID to create an `admins/{uid}` record. This was superseded by the dynamic one-time bootstrap and invite rules below, which require no hard-coded account identity or service-account credential.
- **Verification:** Pending after navigation change.

## 2026-10-04: Dynamic admin bootstrap, invites, and expiring sessions

- **Major changes:** Removed hard-coded initial administrator UIDs. The first account can atomically claim bootstrap admin access using the server-validated signup code; Firestore rules permit exactly one bootstrap claim. Existing admins can create email-bound, single-use invitation links that expire after two hours. Invite acceptance and admin creation are committed atomically. Admin roles expire after one hour, and `/admin` server-rendering requires a Firebase-verified `HttpOnly`, `SameSite=Lax` session cookie with a matching expiry. Sign-out clears the cookie. Signup invites can replace the general signup code.
- **Access model:** After bootstrap, new administrator accounts must present an unexpired invite. A normal signup code alone does not grant an admin role. No account UID or email is hard-coded.
- **Errors and fixes:** Targeted lint initially reported render-time ref writes and synchronous effect state updates in admin managers; refs now update in effects and auth state resets from the Firebase listener. No build errors after the fixes.
- **Verification:** Production build passed. Targeted ESLint passed with four existing `no-img-element` warnings. Firestore rules were reviewed against the official `existsAfter`/`getAfter` and duration APIs; no Firebase emulator/CLI is installed to compile or exercise rules locally. `git diff --check` passed.

## 2026-10-04: Shared homepage branding and doctrine build fix

- **Major changes:** Recorded the homepage typography and color palette as the shared site branding. Public meeting and contact pages now use shared theme colors for their page surfaces, dividers, and secondary text. Added a branded placeholder page for the empty `/doctrine/fundermentalprinciples` route.
- **Build error and fix:** Next.js TypeScript validation reported `app/(public)/doctrine/fundermentalprinciples/page.tsx` was not a module. The file was zero bytes; adding a default exported React page makes it a valid App Router page.
- **Verification:** `npm.cmd run build` completed successfully, including TypeScript validation and static generation of `/doctrine/fundermentalprinciples`.

## 2026-10-04: Reuse homepage mobile navigation

- **Major changes:** Extracted the homepage mobile bottom navigation into a shared component and reused it on playlist, meetings, and contact pages. These pages now share the same tabs, icons, layout, styling, and current-page state. Removed the page-specific bottom navigation styles.
- **Errors and fixes:** No build/runtime errors encountered during this change.
- **Verification:** Not run.

## 2026-10-04: Playlist navigation and contact messages

- **Major changes:** The mobile Categories tab now opens `/playlists` and is labeled Playlists. Contact navigation opens `/contact`, which provides required name, email, and message fields plus an optional phone number. Successful submissions are stored in Firestore `contacts` with a server timestamp.
- **Major changes:** Added `/admin/contacts` for authorized admins to review, contact, and delete submissions, with an entry link on the admin channel dashboard. Firestore rules permit public creation only with the expected bounded fields and restrict listing, reading, updating, and deleting messages to admins.
- **Errors and fixes:** No build/runtime errors encountered during this change.
- **Verification:** Not run.

## 2026-10-04: Zoom meetings page

- **Major changes:** Added a public `/meetings` page connected to admin-managed Firestore meeting records. The homepage Zoom navigation opens this page. Meetings have a title, optional description and poster, local date and start/end times, and a join link; the public page groups meetings into live, upcoming, and history, with a live Join now action. Added `/admin/meetings` for authorized admins to publish and delete meetings and restricted Firestore writes to admins. Poster uploads use a server-side signed Cloudinary upload, with admin access checked through Firestore before upload; only the returned secure image URL is stored in the meeting document.
- **Design rule:** Use the homepage typography (Arial/Helvetica sans-serif) and shared black, white, gray, and red accent palette across all pages. Always display meeting posters without cropping (`object-fit: contain`).
- **Build issue:** `npm.cmd run build` fails when Next.js type-checks the pre-existing zero-byte `app/(public)/doctrine/28fundermental/page.tsx`, because it is not a module. The file was restored byte-for-byte after verification. A temporary default page export let the production build complete and verified the meeting routes and upload handler; the placeholder was removed afterward, so the original build issue remains.
- **Verification:** Production build completed with the temporary doctrine-page placeholder. Build without that placeholder remains blocked by the zero-byte page described above.

## 2026-10-04: Production build type check

- **Error:** `app/(admin)/layout.tsx` typed its props as `LayoutProps<"/admin">`, but Next.js 16.3.8 generates `LayoutProps` route types for layouts only. `/admin` is a page route in this app, and its parent admin layout lives in the `(admin)` route group, so the generated `LayoutRoutes` union contains `/` but not `/admin`.
- **Fix:** Type the route-group layout's only prop directly as `{ children: React.ReactNode }`. Keep route-aware `LayoutProps` for layouts whose URL route is represented in the generated layout route types.
- **Prevention:** When using Next.js route-aware helpers, check the generated `.next/types/routes.d.ts` and the installed Next.js documentation for this version. Route groups do not add URL segments and may not produce an independently typed route path.
- **Verification:** `npm.cmd run build` completed successfully after the fix, including compilation, TypeScript checking, static page generation, and optimization.

## 2026-10-04: Playlist pages and latest videos

- **Major changes:** Added `/playlists` as a directory of visible playlists and `/playlists/[id]` as a shareable playlist detail page. Playlist detail loads each referenced video document so the full ordered playlist is shown even when those videos are outside the latest-videos list; unavailable records still link to YouTube. Home playlist and past-meeting cards now open the detail route.
- **Major changes:** Removed Firestore `orderBy("publishedAt")` from the latest videos listener. Ordering is already performed client-side, so the server-side ordering was redundant and could make the listener require an unconfigured composite index. Raised the listener cap from 40 to 300 before client sorting.
- **Errors and fixes:** No build/runtime errors encountered during this change.
- **Verification:** `npm.cmd run build` completed successfully, including TypeScript checks and generation of `/playlists` and `/playlists/[id]`.

## 2026-10-04: Featured playlist sizing and hero rotation

- **Major changes:** Featured playlist cards now use larger fixed-width cards in a horizontally scrollable, snap-aligned mobile row, showing at most a few cards at once while keeping the rest accessible by scrolling.
- **Major changes:** Hero content rotates every five seconds when multiple videos are available. Hero height is now content-driven with a responsive minimum, so long titles or descriptions can expand the section rather than being clipped by a fixed maximum height.
- **Errors and fixes:** No build/runtime errors encountered.
- **Verification:** `npm.cmd run build` completed successfully, including TypeScript checks and page generation.

## 2026-10-04: Video descriptions, sharing, and playlist detail layout

- **Major changes:** Latest video cards and playlist detail video cards now show the video description, falling back to the channel name when the description is empty. Descriptions are clamped to two lines in the card layout.
- **Major changes:** Video overflow buttons open the native share sheet with only the YouTube URL, allowing messaging apps such as WhatsApp to render YouTube's standard rich link preview. Browsers without native sharing copy the link instead.
- **Major changes:** Removed the white card treatment from playlist detail, restyled playlist entries like featured video cards, added suggested playlists, and added fixed mobile navigation.
- **Errors and fixes:** No build/runtime errors encountered.
- **Verification:** `npm.cmd run build` completed successfully, including TypeScript checks and page generation.

## 2026-10-04: Meeting event types, status, and navigation indicator

- **Major changes:** Admin meeting creation now supports online and onsite events. Online links are optional and appear on the public meeting schedule only during the hour before start and while the event is ongoing; onsite events require a venue. Public meeting cards show Upcoming, Ongoing, or Completed status, and the mobile Zoom tab shows a red count for upcoming and ongoing events.
- **Errors and fixes:** Targeted ESLint initially flagged impure Date.now() state initialization and synchronous state updates inside effects. Clock state now starts at a stable value and updates from scheduled callbacks. The initial page lint also found a raw internal home link, changed to Next Link.
- **Verification:** Targeted ESLint completed with zero errors and existing image element warnings; git diff --check passed. No build/runtime errors encountered.

## 2026-10-04: Shareable event links and previews

- **Major changes:** Added a Share action to each public event card using the native share sheet or copying the direct /meetings/{eventId} URL. Added a direct event page and server-generated Open Graph/Twitter metadata from the public Firestore record, including its description and poster image when available; the share payload includes only the URL.
- **Errors and fixes:** No build/runtime errors encountered.
- **Verification:** Targeted ESLint completed with zero errors and two existing image element warnings; git diff --check passed. Build not run.

## 2026-10-05: Prioritized event hero, study sharing, and admin workspace navigation

- **Major changes:** The homepage hero now puts ongoing and upcoming meetings first in its five-second rotation, with event-specific CTAs (join when available, otherwise request an online meeting link). The homepage meeting section now intentionally omits completed events; history remains available on the dedicated schedule page.
- **Major changes:** Extracted the meeting native-share/clipboard fallback into `lib/share.ts` and reused it for public library study readers. Online meeting cards and detail pages now expose a clear “Request meeting link” action alongside the existing join and share actions.
- **Major changes:** Authenticated admin routes now share a persistent responsive sidebar for Channels, Meetings, Library, Contact & prayer, and Link requests, with a direct public-site link. Desktop uses a true workspace sidebar; smaller screens turn it into a compact horizontal navigation.
- **Errors and fixes:** No build or runtime errors encountered during this change.
- **Verification:** `npx.cmd tsc --noEmit`, `npm.cmd run build`, and `git diff --check` passed.

## 2026-10-05: Longer meeting hero slides and event details

- **Major changes:** Meeting slides in the homepage hero now remain visible for 15 seconds, while video slides retain their five-second rotation. Meeting slides include a secondary “See details” action that always opens the public event page.
- **Errors and fixes:** No build or runtime errors encountered during this change.
- **Verification:** Not run.

## 2026-10-06: Simple signup/sign-in; signup code grants admin access

- **Major changes:** `/signup` is now a plain email + password form plus the required signup code; the invite-link flow (`?invite=`), the `adminInvites` lookup, and the invitation-acceptance branch were removed from the page and from `/api/auth/signup`. `/signin` is email + password only: the "First admin setup code" field was removed, `bootstrapCode`/`invite`/sessionStorage machinery deleted, and the "Continue with Google" button plus the `getRedirectResult` effect are commented out (imports `signInWithGoogle` and `getRedirectResult` are commented out too, so nothing unused is compiled).
- **Access model:** Anyone who can reach `/signup` and knows the code can create an account. `POST /api/auth/session` now accepts `{ idToken, code }`: when the code matches `SIGN_UP_CODE` it writes `admins/{uid}` with `enabled: true`, `expiresAt` (+24h), and `codeHash`. `codeHash` is the SHA-256 hex of the code (Web Crypto `crypto.subtle`, Node runtime). Once a hash is stored it must keep matching, so the code cannot later be swapped to take over an existing admin record. Sessions last 24 hours (was 1 hour); an already-valid session keeps its original deadline.
- **Firestore rules:** Removed `validAdminInvite`, `isBootstrapAdmin`, the `adminInvites` match block, and the `adminBootstrap` match block. `isAdmin()` is unchanged in shape (enabled + unexpired `admins/{uid}`), so every admin page/collection works as before. `admins/{uid}` create/update now allow-lists `['enabled', 'expiresAt', 'codeHash']`, requires a non-empty `codeHash` string, and allows up to 24h expiry. **Deploying these rules deletes the invite/bootstrap and `adminInvites`/`adminBootstrap` access paths** — anything still relying on them must be migrated. Requires `firebase deploy --only firestore:rules`.
- **Dead code left in place (not part of this change):** `lib/sign-in.ts` (Google helper) is now only referenced by some `components/admin/*` managers; `components/admin/admin-invites.tsx` still writes to `adminInvites` and will now fail under the new rules. Both should be cleaned up or updated before they are used again.
- **Errors and fixes:** `write` refuses to overwrite an existing file, so `app/(public)/signin/page.tsx` and `app/api/auth/session/route.ts` were changed with targeted `edit` calls instead. Keep that in mind for future rewrites of existing files.
- **Verification:** `npx tsc --noEmit` exit 0. Targeted `npx eslint` on the four changed TS files reported no output (0 problems). Full `npm run lint` still fails on pre-existing debt in unrelated files only (`cookies-policy`, `privacy-policy`, `terms-of-use`, `library-manager`, plus generated PDF worker output): 42 errors / 1586 warnings, same as before this change. Not verified: live signup/sign-in against Firebase and rule compilation (no emulator installed here).

## 2026-10-06: "Could not check administrator access" on signup and signin

- **Symptom:** Signup and signin both failed with "Could not check administrator access.", even though the account already existed in Firebase Auth (and an `admins/{uid}` document appeared in the database).
- **Cause (primary):** `app/api/auth/session/route.ts` read `admins/{uid}` with the user's ID token and treated **any** non-OK response other than `404` as "could not check administrator access". Firestore returns **`403 PERMISSION_DENIED`** — not `404` — when rules deny a `get` on a document that does not exist yet, and the old invite/bootstrap rules were still deployed, so the fresh read was denied. The request never reached the code that writes the admin document, which is why the user existed but no working admin record was created.
- **Cause (secondary):** Even if the read had been tolerated, the **old rules were still live in Firebase**. The previous rules only permitted `admins/{uid}` create via `isBootstrapAdmin(uid) || validAdminInvite(...)`, so the new `codeHash`-based write would have been rejected too. `firestore.rules` changes have no effect until they are deployed.
- **Fixes:** (1) The prior-read now tolerates `403` as well as `404`, treating both as "no admin record yet" and letting the write decide. (2) A rejected write now surfaces the real Firestore status: on `PERMISSION_DENIED` it tells the operator to deploy the rules instead of the generic "Could not activate this admin session.", and logs the upstream message server-side. `app/(admin)/layout.tsx` needed no change — it correctly passes once the document has `enabled: true` and a future `expiresAt`.
- **Required operator step:** `firebase deploy --only firestore:rules`. There is no `.firebaserc` in the repo, so choose the project explicitly (`firebase deploy --only firestore:rules --project poof-40b24`) or run `firebase use --add` first. Until the rules are deployed, the same-run code will now say exactly that instead of the misleading message.
- **Note:** No `.firebaserc` means the CLI has no default project, and `npx firebase-tools --version` timed out (>120s) in this environment, so the deploy could not be run or verified from here.
- **Verification:** `npx tsc --noEmit` exit 0; targeted `npx eslint app/api/auth/session/route.ts` reported no output (0 problems). Not verified: a live signup/signin after deploying the rules.

## 2026-10-06: CORRECTION — "Could not check administrator access" was a Firestore 429, not rules

- **Supersedes the entry directly above.** The previous diagnosis (undeployed rules / `403 PERMISSION_DENIED`) was **wrong**. Do not re-apply that fix on this symptom.
- **Real cause:** Project `poof-40b24` has **exhausted its Firestore daily read quota**. Every Firestore *read* returns `429 RESOURCE_EXHAUSTED` / `"Quota exceeded."` — including anonymous public reads of `channels` and `meetings`, which have nothing to do with auth. The session route's prior-read hit the 429 and the old check `status !== 404 && status !== 403` let 429 fall through to the generic `"Could not check administrator access."` message.
- **Evidence (live, throwaway test accounts against the real project):**
  - `accounts:signUp` → **200** (Auth API unaffected)
  - `accounts:signInWithPassword` → **200**
  - `accounts:lookup` → **200**
  - `GET admins/{uid}` (with user ID token) → **429 Quota exceeded**
  - `PATCH admins/{uid}` → **200** — **the admin record write succeeds**, and stored `enabled: true`, `expiresAt`, `codeHash` correctly
  - `runQuery` on `channels` → **429 Quota exceeded**
  - `GET meetings` / `GET channels` with no auth at all → **429 Quota exceeded**
  - Re-read immediately after a successful write → still **429**
- **Consequences worth knowing:** `runQuery` being 429 means the browser `onSnapshot` listeners powering the whole admin UI and the public catalog fail too, so the app is broadly broken while the quota is exhausted, not just the login step. Writes still work, which is why `admins/{uid}` documents kept appearing.
- **Fix applied:** the admin prior-read is now wrapped in `readAdminDocument()`, which retries up to 3 times with backoff (0/400/1200 ms) on `429`. A 429 that survives the retries returns HTTP **429** with `"Firestore is temporarily rate-limited (quota exceeded). Please try again in a moment."` instead of the misleading access error. 403/404 are still handled as "no admin record yet".
- **Action needed by the operator:** this is a billing/quota issue, not a code issue. Check Firebase Console → Firestore → Usage. The free Spark tier's daily read allowance resets at midnight Pacific; either wait for the reset (then sign in again — the code flow itself is fine) or attach a billing account / Blaze plan. Reducing the listener fan-out (the app opens many `onSnapshot` listeners on large collections with high `pageSize` caps) is the durable mitigation.
- **Verification:** `npx tsc --noEmit` exit 0; targeted `npx eslint app/api/auth/session/route.ts` 0 problems. Test scripts were temporary and have been deleted.
- **Prevention:** when diagnosing Firestore REST failures from route handlers, **always print the actual status and body** rather than branching on "not 404". Branching on a single expected status hid a 429 behind an auth-sounding message for two debugging rounds. Treat 429/503 as retryable and distinct from 401/403.

## 2026-10-11: Bound and sort public video feed
- **Major change:** The cached public catalog now requests at most 100 video documents (down from 900) and asks Firestore for them in `publishedAt desc` order so recent uploads appear in the homepage feed. Other collection caps and the shared 24-hour cache are unchanged. The feed's `truncated` flag now reflects the 100-video ceiling.
- **Errors and fixes:** No build or runtime errors encountered.
- **Verification:** `npx.cmd tsc --noEmit`, `npx.cmd eslint lib/catalog-feed.ts`, and `npm.cmd run build` passed.

## 2026-10-12: Refresh responsive mailing templates and campaign controls
- **Major changes:** Reworked the email template into a wider, mobile-edge-to-edge navy-and-gold branded letter with readable desktop/mobile typography and an editable, campaign-specific banner line. Expanded the admin workspace and compose controls, added recipient selection (all, selected contacts, or members added since a previous send), saved full campaign content for newly created history entries, and added resend-to-all, send-to-new, edit/reuse, schedule-for-new, and history deletion actions. Added inline HTTPS image insertion and automatic YouTube-link thumbnail detection. Admin metrics now show eligible recipients, total contacts, durable cumulative successful-send counts, and active schedules.
- **Compatibility:** Existing schedules without the new banner/audience fields default to the matching meeting/newsletter banner and the full eligible audience. Older history entries remain visible and deletable; because their original bodies were never saved, edit/resend controls are available only for new history entries. The cumulative delivery count is stored separately so deleting a history record does not reduce it.
- **Build errors and fixes:** The default Turbopack build encountered Windows `ENOTEMPTY` errors while cleaning `.next/server/app`; the supported `next build --webpack` path completed successfully. TypeScript initially found duplicate generated declarations in four ignored `.next/dev/types/* - Copy.ts` files; their SHA-256 hashes matched the corresponding canonical generated files, so only those duplicate generated copies were removed. Standard `tsc --noEmit` then passed.
- **Verification:** Production webpack build, standard TypeScript check, focused ESLint (0 errors; 3 `<img>` optimization warnings), `git diff --check`, and targeted assertions for image sanitization, inline YouTube extraction, responsive email markup, and generated thumbnail markup passed. The protected admin route redirected to sign-in during browser verification because no admin session was available.

## 2026-10-13: Welcome new newsletter subscribers and support self-service unsubscribe
- **Major changes:** Newly created or reactivated newsletter subscriptions now trigger a welcome email after the subscription is persisted; already-active subscriptions do not receive duplicate welcomes. The welcome message uses up to the three newest available public YouTube videos as linked thumbnail cards and includes their links in the plain-text alternative. Shared branded email footers identify the ministry, link to its website, and provide a clear newsletter unsubscribe link. Added a branded `/unsubscribe` page using the existing signed-token validation flow; one-click provider headers continue to use the direct API endpoint.
- **Build/runtime errors and fixes:** The first page build rejected `styled-jsx` in a Server Component; moved the page styling into `app/globals.css`. The next build rejected awaiting dynamic `searchParams` without a Suspense boundary with Cache Components enabled; moved query handling into an async child wrapped in `<Suspense>`.
- **Verification:** Production webpack build and focused newsletter lint passed; mocked delivery/catalog assertions covered newest-three selection, video thumbnails and text links, footer and unsubscribe links. A local request to `/unsubscribe` returned HTTP 200. Live Firestore/Resend delivery was not exercised because no live authenticated account/provider credentials were used.


## 2026-10-14: Library public filter "All resources" UX fix
- **Reported UX problem:** On the public `/library` page, users filter studies by category chips ("All resources", top categories, and a sub-category rail with "All in {Category}"). Clicking a category or sub-category sets a **sticky** `filter` value (stored in component state and persisted in `localStorage`), and the sub-category rail for the active parent remains visible. When a filter/sub-filter yielded zero results, the empty state only said "No resources match this search yet." with no way back to "All resources" — users who landed in an empty sub-filter had no clear, discoverable action to reset, so the page looked broken.
- **Diagnosed cause:** The empty-state paragraph at the end of the resource grid was static and unaware of the active `filter`/`search`; the "All resources" chip sits in the top rail and can be scrolled out of view on mobile, so the only reset control was not reliably reachable from the empty state.
- **Verified fix:** Made the empty-state message context-aware (mentions the search term and/or category) and, when a category filter is active, added an inline "Show all resources" button that calls `setFilter("all")` — a one-tap reset directly inside the empty state. No data/API/route changes; only the empty-state JSX in `components/home/library-page.tsx` was edited.
- **Verification:** `npx.cmd eslint components/home/library-page.tsx` passed with **0 errors** and only the 2 pre-existing `<img>` warnings. Repository-wide `npm run lint` still fails with 36 errors / ~1,600 warnings, all in unrelated files (cookies/privacy/terms policy pages, generated worker blobs); no library-page findings were introduced. Not verified in a live browser in this change.

## 2026-10-19: Production Paystack donation system

- **Major changes:** Replaced the public donation placeholder with a responsive, amount-empty donation form that collects full name and receipt email, initializes hosted Paystack checkout exclusively from a server route, and verifies the reference/amount/currency/email before recording success. Added HMAC-SHA512 webhook validation, a high-entropy internal reference, same-origin and payload checks, a Firestore-backed hourly abuse limit, server-only donation collections, and an explicit no-card-data boundary. The callback page independently verifies each transaction and handles success, failed, pending, and delayed-verification states.
- **Receipts and recovery:** Successful payments send an idempotent Resend email receipt. Firestore transactions prevent duplicate successful totals and use a short receipt-delivery lease to prevent concurrent sends. The webhook verifies and persists the payment before acknowledging it, then uses Next.js 16's supported `after()` API for receipt delivery so email latency does not hold Paystack's response open. Failed receipt delivery remains visible without downgrading the payment; the admin refresh action retries failed receipts. Pending transactions can be reconciled against Paystack so failed and abandoned attempts are recorded even though Paystack only emits success webhooks.
- **Admin and compliance:** Added `/poof/admin/donations` to the protected admin sidebar with an all-history successful aggregate, success/failed/pending counts, donor name/email, exact local date/time, amount, Paystack/channel status, failure reason, reference, search/filter controls, and receipt state. Updated the privacy policy, environment example, Firestore-deny rules, and deployment documentation. The existing local key was checked by prefix only and is a live Paystack secret; its value was never printed.
- **Build/runtime errors and verified fixes:** The first focused lint found an internal raw anchor plus synchronous state changes inside two effects; internal navigation now uses `next/link`, donation loading starts from the Firebase auth callback, and callback retry/reset state is event-driven. Focused lint then passed. The first production build failed because the sandbox blocked Next.js from downloading the configured Google Oswald font (`connect EACCES ...:443`); rerunning the same webpack build with approved network access succeeded. No application runtime error was encountered.
- **Verification:** `npx.cmd --no-install tsc --noEmit`, focused ESLint for all donation/payment/admin/privacy files, `git diff --check`, and `npm.cmd run build -- --webpack` passed. The build generated 59 pages and registered `/donate`, `/donate/complete`, `/poof/admin/donations`, `/api/paystack/initialize`, `/api/paystack/verify`, `/api/paystack/webhook`, and `/api/admin/donations`. A real charge, live webhook, Firestore write, and Resend delivery were intentionally not triggered from this workspace.
- **Required operator steps:** Deploy `firestore.rules`; set the Paystack live webhook to `${NEXT_PUBLIC_SITE_URL}/api/paystack/webhook`; confirm `PAYSTACK_SECRET_KEY`, `PAYSTACK_CURRENCIES`, Firebase Admin, and Resend variables are configured in production; and enable Firestore TTL on `donationRateLimits.expireAt`.

## 2026-10-19: Verify live Paystack account and switch donations to KES/card-first

- **Live key and capability test:** The configured secret authenticated successfully against `GET /balance` (HTTP 200) and is a live key. The integration exposes a KES balance only. Live initialization accepted KES 3.00 and KES 0.01 and returned matching references plus `checkout.paystack.com` authorization URLs. Both USD 2.00 and USD 0.01 were rejected with HTTP 403 `Currency not supported by merchant`. No key value, balance amount, or checkout access code was printed.
- **End-to-end application test:** Started the production build locally and submitted `Codex Donation Test` for KES 0.01 through `/api/paystack/initialize`. The actual route returned HTTP 201, created a high-entropy `DON-...` reference, persisted the attempt through Firebase Admin, and returned the expected Paystack checkout host. Calling the real verification route returned HTTP 200 with `status: failed`, `currency: KES`, and `amountSubunit: 1`; this is expected because the hosted checkout was intentionally not opened or paid. The failed test attempt remains visible in the admin ledger. No card was charged and receipt/webhook success delivery was not triggered.
- **Currency and card changes:** KES is now the default. `PAYSTACK_CURRENCIES` provides comma-separated, code-free expansion to additional merchant-enabled currencies; add USD after Paystack activates it for the account. Donation validation accepts every representable amount greater than zero and no longer imposes application minimum/maximum values. Initialization explicitly requests only the `card` channel. Admin successful totals are separated by currency rather than incorrectly adding unlike currencies.
- **Provider limitation:** Application code cannot activate USD settlement or international-card eligibility. The merchant must enable international payments in Paystack Dashboard and obtain USD activation before adding USD to `PAYSTACK_CURRENCIES`. Scandinavian Visa/Mastercard cardholders can pay a KES-denominated charge when international payments are enabled; their issuing bank performs conversion.
- **Build/runtime errors:** None encountered. The intentionally unpaid end-to-end attempt verified as failed/abandoned, which confirms failure tracking rather than an application error.
- **Verification:** Live Paystack authentication and initialization tests, end-to-end production-server initialization/verification, `npx.cmd --no-install tsc --noEmit`, focused ESLint, and `npm.cmd run build -- --webpack` passed. The local production server was stopped after testing.

## 2026-10-19: USD-first Paystack checkout, wallets, and Donations admin repair

- **Live account verification:** `GET /balance` authenticated with the configured live secret and now reports both `KES` and `USD`. Live transaction initialization succeeded for both currencies with the restricted channel list `card`, `apple_pay`, and `google_pay`, returning matching references and `checkout.paystack.com` URLs. This proves that Paystack accepts the currency/channel configuration; each wallet is still displayed only when its Dashboard setting and the donor's device, browser, wallet, and card are eligible. No secret, access code, balance amount, or full authorization URL was logged.
- **Currency and checkout changes:** The application default is now `USD,KES`, making USD the first choice for the Scandinavian audience while preserving KES. Checkout exposes only card, Apple Pay, and Google Pay, removing M-PESA, Airtel Money, and bank-transfer clutter from this flow. The form remains amount-empty and accepts every two-decimal amount greater than zero at the application layer. Copy explains that EUR-, SEK-, NOK-, and DKK-denominated cards can fund the USD charge through issuer conversion; EUR was not added because this Kenya Paystack account supports only USD and KES transaction currencies.
- **Admin error cause and fix:** The exact `Could not load donations.` cause was Firestore `FAILED_PRECONDITION` code 9: the prior per-currency `AggregateField.sum()` query required a missing composite index over `currency`, `successfulAmountSubunit`, and `successfulCount`. Exact per-currency totals are now incremented atomically in server-only `donationStats/{currency}` documents during the first verified-success transition, so normal admin loads stay constant-cost and need no composite index. The route compares the stored total count with Firestore's authoritative success count and uses a status-only, single-field-index history scan as an exact legacy fallback if they ever diverge. Existing status counts and the latest-250 ledger remain unchanged. The replacement index-free query pattern succeeded against live Firestore (10 recent attempts at test time: 0 successful, 6 failed, 4 pending), so no index deployment is required for this repair.
- **End-to-end verification:** The production build served `/donate` with USD before KES, wallet copy present, and no prefilled amount. A real application-route submission for USD 0.01 returned HTTP 201, a valid internal reference, and a `checkout.paystack.com` URL. It created an intentionally unpaid pending test attempt named `Codex USD Wallet Test`; no card was charged and no success receipt/webhook could be exercised without completing checkout. TypeScript, focused ESLint, `git diff --check`, and `npm.cmd run build -- --webpack` all passed, and both temporary local servers were stopped.
- **Test/build errors and verified fixes:** The first inline Node smoke command was parsed by PowerShell instead of Node; replaced it with a temporary `.mjs` harness and deleted that file after testing. The initial harness used `localhost` and hung in this Windows environment; `127.0.0.1` responded normally. The first local production server lacked outbound sandbox access and Firebase Admin failed with gRPC `14 UNAVAILABLE` / `connect EACCES`; restarting the server with approved network access fixed it. A restart briefly hit `EADDRINUSE` on port 3011 while the earlier server was exiting; the test ran on port 3012 and both ports were verified stopped afterward. An origin-bearing synthetic request correctly returned HTTP 403 because the supplied origin did not match Next's request origin; omitting that synthetic header (as a same-origin browser request naturally does) allowed the route test to pass.

## 2026-10-22: Consistent homepage section headings
- **Major changes:** Moved home testimonies out of the video/ministry grid into the main homepage section flow. Unified the testimony and archive headings with the shared homepage section heading style and centered section titles and actions responsively.
- **Build/runtime errors and fixes:** None encountered during this change.
