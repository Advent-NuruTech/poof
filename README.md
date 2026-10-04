# Pioneers of Our Faith

A responsive YouTube catalog. YouTube owns source video and playlist metadata; the website stores a synchronized presentation catalog and website-only editorial fields in Cloud Firestore.

## Local setup

1. Create a Firebase project and register a Web app. Set the existing `NEXT_PUBLIC_FIREBASE_*` variables in `.env.local` from that app's config.
2. Enable **Google** under Firebase Authentication → Sign-in method and keep **Email/Password** disabled. Add the deployed hostname to Authentication → Settings → Authorized domains.
3. Create the default Cloud Firestore database and publish the rules and indexes in this repo:

   ```sh
   npx firebase-tools deploy --only firestore:rules,firestore:indexes
   ```

4. Create a Google Cloud API key with the YouTube Data API v3 enabled. Set it as `YOUTUBE_DATA_API_KEY` in `.env.local` and your deployment's server environment. Do not add a `NEXT_PUBLIC_` prefix. Restrict the key to the YouTube Data API and the server environments that need it.
5. Start the app with `npm run dev`.
6. Sign in at `/admin` with the initial administrator Google account (Firebase UID `3H3BclyO2FePQ59KYIO2kKSirnx2`). On first sign-in, the app creates `admins/{uid}` automatically. The Firestore rules allow this creation only for that UID and only with `enabled: true`.
7. Add a channel by URL, handle, or channel ID. The initial sync discovers playlists, playlist order, and unique video records. The homepage listens to the public catalog.

Firebase Web API keys identify the Firebase project and are expected to be present in the browser. The YouTube Data API key remains server-side. This app intentionally uses Google sign-in only and does not include the Firebase Admin SDK. The initial admin UID is allowlisted in both the admin page and Firestore rules; publish the rules in this repo for automatic provisioning to work.

## Routes and data

- `app/(public)` contains the public experience; the route group does not add a URL segment.
- `app/(admin)/admin` contains channel and catalog management.
- `app/api/youtube` validates a Firebase ID token against Firebase Authentication, checks the caller's Firestore admin record, and then calls YouTube. It never writes to Firestore.
- The browser writes synchronized data through the Firebase client SDK. `firestore.rules` permits public catalog reads and limits writes to provisioned admin UIDs. Admin records cannot be edited from the app.
- `videos/{youtubeVideoId}` uses the YouTube video ID as its document ID. Playlist membership and order are stored on playlist documents. Editorial controls live in each record's `website` map and are kept separate from YouTube fields.
- Channel deletion only removes the channel source record; it does not delete videos or playlists.

## Sync operation

The admin page checks enabled channels at a six-hour interval while an admin session is open and provides a manual **Sync now** action. A Firestore lease prevents concurrent browser sessions from syncing the same channel at once. Sync uses the YouTube API's paginated channel, playlist, playlist-item, and video resources, with a 2,500 item safety cap per paginated collection. Existing catalog content remains available while a sync runs or fails.

This no-Admin-SDK design does not run a background worker when no administrator browser is open. Fully unattended scheduled synchronization requires a trusted scheduled identity and a separate deployment choice; do not make catalog writes public to simulate a scheduler. The YouTube Data API quota and the 2,500 item guard also bound very large channels. For larger catalogs, move synchronization to a trusted queue/worker that still uses Firebase client-authenticated writes or a separately approved server data-access mechanism.

## Deployment

Set the six Firebase Web configuration variables and `YOUTUBE_DATA_API_KEY` in the hosting provider's environment settings. Deploy the Next.js application and publish the Firestore rules/indexes. The Firebase Authentication authorized domain must include the production hostname. Keep `.env.local` out of source control and rotate any key exposed outside its intended environment.
