# Project Memory

## 2026-10-04: Search results overlay

- **Major changes:** Homepage search now opens a scrollable results panel beneath the header with a blurred backdrop. Matching videos appear immediately over the hero, including an empty-query prompt and a no-results state. On mobile the panel leaves room for the fixed bottom navigation, and the search field takes priority in the header.
- **Errors and fixes:** No build/runtime errors encountered during this change.
- **Verification:** `git diff --check` completed without whitespace errors. Build and lint not run.

Record verified errors and fixes, plus major changes, here. Review this file before related work to avoid repeating known issues in future versions.

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
- **Design rule:** Keep homepage and meeting page branding black and white; do not introduce new brand colors. Always display meeting posters without cropping (`object-fit: contain`).
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
