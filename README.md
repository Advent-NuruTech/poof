# Faith of the Pioneers

A responsive YouTube catalog. YouTube owns source video and playlist metadata; synchronized video records and website-only video presentation fields are stored in Cloudflare D1. Other catalog metadata remains in Cloud Firestore. Public library originals are stored in Cloudflare R2; Cloudinary remains responsible for images and image transformations.

## Local setup

1. Create a Firebase project and register a Web app. Set the existing `NEXT_PUBLIC_FIREBASE_*` variables in `.env.local` from that app's config.
2. Enable **Email/Password** under Firebase Authentication → Sign-in method. Public signups are disabled; additional administrators must accept an invitation sent by an existing administrator to the invited email. Add the deployed hostname to Authentication → Settings → Authorized domains.
3. Create the default Cloud Firestore database and publish the rules and indexes in this repo:

   ```sh
   npx firebase-tools deploy --only firestore:rules,firestore:indexes
   ```

4. Create a Google Cloud API key with the YouTube Data API v3 enabled. Set it as `YOUTUBE_DATA_API_KEY` in `.env.local` and your deployment's server environment. Do not add a `NEXT_PUBLIC_` prefix. Restrict the key to the YouTube Data API and the server environments that need it.
5. Start the app with `npm run dev`.
6. Sign in at `/poof/admin` with the initial administrator account (Firebase UID `3H3BclyO2FePQ59KYIO2kKSirnx2`). On first sign-in, the app creates `admins/{uid}` automatically. Only this UID can bootstrap the first admin; any active administrator can invite another administrator by email. Existing enabled administrator records, including legacy `codeHash` records, remain active without re-invitation. Every active administrator receives the same website management permissions. The former `/admin` route is not available.
7. Add a channel by URL, handle, or channel ID. The initial sync discovers playlists, playlist order, and unique video records. The homepage reads the shared cached public catalog; playlist pages load their available videos separately from D1, so older playlist videos are not limited by the homepage's newest-video window. Its Most Viewed shelf uses the bounded per-channel view-count query described below.

8. Configure the email environment variables below, deploy to Vercel, and verify your sending domain in Resend. Open `/poof/admin/mailing` to verify meeting requests, add meeting members, and create or schedule emails.

Firebase Web API keys identify the Firebase project and are expected to be present in the browser. YouTube and email credentials remain server-side. Existing enabled admin records (including records using the earlier `codeHash` field) remain authorized without a new invitation. Only new admins need an invitation. Admin sessions persist in a secure, HTTP-only cookie and expire after four calendar months without activity; normal admin activity renews that deadline. Explicit sign-out clears the session immediately.

## Routes and data

- `app/(public)` contains the public experience; the route group does not add a URL segment.
- `app/(admin)/poof/admin` contains channel and catalog management.
- `app/api/youtube` validates a Firebase ID token against Firebase Authentication, checks the caller's Firestore admin record, and then calls YouTube. It saves synchronized video records to D1 from the server; channels, playlists, meetings, and library metadata continue using Firestore.
- `videos/{youtubeVideoId}` uses the YouTube video ID as its D1 primary key. Playlist membership/order remain on Firestore playlist records. Video editorial controls remain in each D1 video record's `website` map. During a channel sync, deleted/private YouTube videos are removed from playlist membership and a video no longer belonging to a connected channel is marked unavailable, so it disappears from public pages.
- The homepage's Most Viewed shelf queries indexed D1 video metadata for each enabled channel, then merges those small result sets. The shared 24-hour server-cached catalog feed remains in place.
- Existing Firestore video rows and editorial settings are imported automatically on the first successful D1 sync of each channel. After configuring D1, use **Sync now** once for each connected channel before relying on the D1-backed public video feed.
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

### Paystack donations

- Set the server-only `PAYSTACK_SECRET_KEY` to the live secret key in the deployment environment. The hosted checkout flow does not require `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, and no Paystack secret or card data is sent through the application browser bundle.
- Donors enter their intended gift in USD. The server converts it to KES using the cached daily USD/KES reference rate from Frankfurter and initializes every Paystack transaction with `currency: "KES"`; Paystack therefore receives only KES charges from this donation flow. Set the optional server-only `DONATION_USD_KES_RATE` to a positive KES-per-USD value (up to six decimal places) when an operator-controlled rate is preferred. The application rejects converted charges below Paystack's KES 3.00 minimum.
- Each Firestore donation record preserves `originalAmountSubunit`, `originalCurrency: "USD"`, `conversionRate`, rate provenance/date, and the actual `chargeAmountSubunit`/`chargeCurrency: "KES"`. The compatibility `amountSubunit` and `currency` fields also represent the real KES Paystack charge, so verification and aggregate totals cannot accidentally compare or add the original USD amount.
- Checkout is initialized with `card`, `apple_pay`, and `google_pay`. Card remains available as the universal fallback; each wallet is shown by Paystack only when the merchant setting, device, browser, and saved card are eligible. Keep **Cards**, **Apple Pay**, **Google Pay**, and **Accept international payments** enabled in Paystack Dashboard → Preferences. A donor's card issuer may convert the KES charge to the card's own currency.
- In the Paystack live dashboard, set the webhook URL to `https://faithofthepioneers.org/api/paystack/webhook` (replace the origin if `NEXT_PUBLIC_SITE_URL` differs). The endpoint verifies Paystack's HMAC-SHA512 signature and re-verifies each successful transaction against Paystack before recording it.
- Donation attempts are stored in the server-only Firestore `donations` collection. `/poof/admin/donations` shows verified totals, donor name and email, failed/abandoned attempts, exact local date/time, Paystack status, and receipt delivery state. **Refresh payment statuses** reconciles pending attempts because Paystack only emits transaction webhooks for successful charges.
- Successful payments send an idempotent receipt through the existing Resend sender. Configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in production. Receipt failure never changes a verified payment into a failed donation; it remains visible to administrators as a receipt-delivery failure.
- `donationRateLimits` records have an `expireAt` field. Enable a Firestore TTL policy for that field on this collection so expired abuse-control buckets are removed automatically.

### Cloudflare catalog and document storage

- Create a Cloudflare D1 database and apply [`migrations/0001_videos.sql`](migrations/0001_videos.sql). Create a Cloudflare API token with D1 read/edit permissions and set `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, and `CLOUDFLARE_API_TOKEN` in local development and Vercel. The existing `R2_ACCOUNT_ID` and `D1_DATABASE_ID` names are also accepted for the matching ID variables. `R2_API_TOKEN` is not used for D1: Cloudflare's R2 token/ S3 credentials do not automatically grant D1 API access. These values are server-only; do not add a `NEXT_PUBLIC_` prefix.
- Create an R2 bucket for public library files, attach a public custom domain, and set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and `R2_PUBLIC_BASE_URL` (the full HTTPS base URL) in local development and Vercel. Use bucket-scoped S3 credentials and keep them server-only.
- Run `npm run r2:cors` once to allow browser `PUT` uploads from `NEXT_PUBLIC_SITE_URL` (plus its www/apex counterpart and local development), allow the signed `Content-Type` header, and expose `ETag`. The script uses bucket-level S3 credentials when available; if the configured S3 key is object-only, set a separate server-only `CLOUDFLARE_R2_ADMIN_TOKEN` with R2 bucket edit permission and rerun it. Uploads use short-lived, MIME-bound presigned URLs and bypass the Vercel request-body limit. The library currently accepts PDF, DOC/DOCX, and PPT/PPTX files up to 25 MB. R2 files are public because the library itself is public; do not store private documents in this bucket.
- Cloudinary continues to handle uploaded images, meeting posters, mailing images, and image transformations. Existing library file URLs remain readable during the transition; new PDF and Office files go to R2 without a visible change to the admin workflow.

## Sync operation

The admin page checks enabled channels at a six-hour interval while an admin session is open and provides a manual **Sync now** action. A Firestore lease prevents concurrent browser sessions from syncing the same channel at once. Sync uses the YouTube API's paginated channel, playlist, playlist-item, and video resources, with a 2,500 item safety cap per paginated collection. Existing catalog content remains available while a sync runs or fails.

Catalog synchronization still runs from an administrator browser; it does not run when no administrator session is open. Do not make catalog writes public to simulate a scheduler. The separate mailing worker uses the Firebase Admin SDK only for its protected server-side mailing collections. The YouTube Data API quota and the 2,500 item guard also bound very large channels.

## Deployment

Set the six Firebase Web configuration variables, `YOUTUBE_DATA_API_KEY`, and the mailing environment variables in the hosting provider's environment settings. Deploy the Next.js application and publish the Firestore rules/indexes. The Firebase Authentication authorized domain must include the production hostname. Keep `.env.local` out of source control and rotate any key exposed outside its intended environment.
