# Project Memory

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
