# Project Memory

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
- **Verification:** Not run.

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
