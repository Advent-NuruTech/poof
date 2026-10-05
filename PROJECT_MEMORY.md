# Project Memory

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
