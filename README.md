# Faith of the Pioneers

A responsive YouTube catalog. YouTube owns source video and playlist metadata; the website stores a synchronized presentation catalog and website-only editorial fields in Cloud Firestore.

## Local setup

1. Create a Firebase project and register a Web app. Set the existing `NEXT_PUBLIC_FIREBASE_*` variables in `.env.local` from that app's config.
2. Enable **Google** and **Email/Password** under Firebase Authentication → Sign-in method. Public signups are disabled; additional administrators must accept an invitation from an existing administrator using the invited email. Add the deployed hostname to Authentication → Settings → Authorized domains.
3. Create the default Cloud Firestore database and publish the rules and indexes in this repo:

   ```sh
   npx firebase-tools deploy --only firestore:rules,firestore:indexes
   ```

4. Create a Google Cloud API key with the YouTube Data API v3 enabled. Set it as `YOUTUBE_DATA_API_KEY` in `.env.local` and your deployment's server environment. Do not add a `NEXT_PUBLIC_` prefix. Restrict the key to the YouTube Data API and the server environments that need it.
5. Start the app with `npm run dev`.
6. Sign in at `/poof/admin` with the initial administrator account (Firebase UID `3H3BclyO2FePQ59KYIO2kKSirnx2`). On first sign-in, the app creates `admins/{uid}` automatically. Only this UID can bootstrap the first admin; additional administrators must accept an invitation. Existing enabled administrator records, including legacy `codeHash` records, remain active without re-invitation. Every active administrator receives the same website management permissions. The former `/admin` route is not available.
7. Add a channel by URL, handle, or channel ID. The initial sync discovers playlists, playlist order, and unique video records. The homepage reads the shared cached public catalog; its Most Viewed shelf uses the bounded per-channel view-count query described below.

8. Configure the email environment variables below, deploy to Vercel, and verify your sending domain in Resend. Open `/poof/admin/mailing` to verify meeting requests, add meeting members, and create or schedule emails.

Firebase Web API keys identify the Firebase project and are expected to be present in the browser. YouTube and email credentials remain server-side. Existing enabled admin records (including records using the earlier `codeHash` field) remain authorized without a new invitation. Only new admins need an invitation. Admin sessions persist in a secure, HTTP-only cookie and expire after four calendar months without activity; normal admin activity renews that deadline. Explicit sign-out clears the session immediately.

## Routes and data

- `app/(public)` contains the public experience; the route group does not add a URL segment.
- `app/(admin)/poof/admin` contains channel and catalog management.
- `app/api/youtube` validates a Firebase ID token against Firebase Authentication, checks the caller's Firestore admin record, and then calls YouTube. It never writes to Firestore.
- The browser writes synchronized data through the Firebase client SDK. `firestore.rules` permits public catalog reads and limits management writes to the root administrator and administrators activated through a valid invitation. Admin records cannot be granted by an ordinary signed-in account.
- `videos/{youtubeVideoId}` uses the YouTube video ID as its document ID. Playlist membership and order are stored on playlist documents. Editorial controls live in each record's `website` map and are kept separate from YouTube fields.
- The homepage's Most Viewed shelf queries the top 12 videos by view count for each enabled channel, then merges those small result sets. The query is covered by `firestore.indexes.json` and included in the shared 24-hour server-cached catalog feed; it does not download the full video collection for each visitor.
- Deploy the Firestore indexes and wait for the view-count index to finish building before building/deploying the app. The catalog snapshot can be generated during build; Firestore rejects the Most Viewed query until that index is ready.
- Channel deletion only removes the channel source record; it does not delete videos or playlists.
- `/poof/admin/mailing` manages meeting-member verification, newsletter subscribers, campaign schedules, and Resend delivery history. Public meeting-link requests are saved as pending members; newsletter addresses are normalized and deduplicated by a SHA-256 document ID.
- Meeting and newsletter sends use an inbox-friendly responsive HTML template. YouTube videos appear as clickable thumbnail previews because most email clients do not play embedded video. Newsletter emails include signed unsubscribe links.
- cron-job.org calls `/api/mailing/cron` every five minutes. The route sends due one-time/daily/weekly/monthly campaigns, observes each schedule's timezone and optional end date, retries temporary provider failures up to three times with Resend idempotency keys, and records delivery results. Repeating schedules without an end date continue until an admin cancels them.

### Mailing environment and deployment

- Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to a verified Resend sender address.
- Set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` from the Firebase project's service-account JSON. For this project, `FIREBASE_PROJECT_ID` is `poof-40b24`; use the JSON's `client_email` and complete `private_key` values for the other two variables. Keep the private key server-side and out of source control; it grants trusted access to meeting-member, subscriber, campaign, and history data. `FIREBASE_SERVICE_ACCOUNT_JSON` remains supported as an optional legacy alternative.
- Set `NEXT_PUBLIC_FIREBASE_API_KEY` in Vercel along with the other Firebase Web configuration. Mailing routes use Firebase's account lookup API to validate signed-in admin ID tokens, then continue to authorize access using the admin record in Firestore.
- Set `CRON_SECRET` to a long random value and `NEWSLETTER_UNSUBSCRIBE_SECRET` to a separate long random value. Keep the same `CRON_SECRET` in Vercel and `.env.local`; cron-job.org sends it as the cron request's bearer token. Set `CRONJOB_ORG_API_KEY` in `.env.local` to manage the cron job through its REST API.
- Run `npm run cron:sync` to create the scheduled mailing job or update the existing job with the stable title `Poof scheduled mailing delivery`. The script reads `.env.local`, uses `NEXT_PUBLIC_SITE_URL` (default `https://faithofthepioneers.org`) as the public site origin, and configures the job for every five minutes. Do not add this route back to Vercel's `crons` configuration.
- Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS site URL so newsletter unsubscribe links point to the production domain.
- Local development does not run the cron automatically; invoke `/api/mailing/cron` with the configured bearer token to test due schedules.
- Browser-side Firestore rules do not grant access to mailing collections. All mailing reads/writes are performed by server routes after admin checks, except public forms which validate and persist only their own submissions.

## Sync operation

The admin page checks enabled channels at a six-hour interval while an admin session is open and provides a manual **Sync now** action. A Firestore lease prevents concurrent browser sessions from syncing the same channel at once. Sync uses the YouTube API's paginated channel, playlist, playlist-item, and video resources, with a 2,500 item safety cap per paginated collection. Existing catalog content remains available while a sync runs or fails.

Catalog synchronization still runs from an administrator browser; it does not run when no administrator session is open. Do not make catalog writes public to simulate a scheduler. The separate mailing worker uses the Firebase Admin SDK only for its protected server-side mailing collections. The YouTube Data API quota and the 2,500 item guard also bound very large channels.

## Deployment

Set the six Firebase Web configuration variables, `YOUTUBE_DATA_API_KEY`, and the mailing environment variables in the hosting provider's environment settings. Deploy the Next.js application and publish the Firestore rules/indexes. The Firebase Authentication authorized domain must include the production hostname. Keep `.env.local` out of source control and rotate any key exposed outside its intended environment.
