# Firebase push setup

## Web

1. In Firebase Console, open project `funzy-d56d7` and use the existing Web app configuration.
2. Set the `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, and `VITE_FIREBASE_VAPID_KEY` values in `apps/web/.env.local` and the production build environment. Never commit environment files.
3. Under **Authentication → Settings → Authorized domains**, add `localhost` and `funspot.co.ke` (plus any production subdomain).
4. Under **Authentication → Sign-in method**, enable **Phone** and allow Kenya (+254) in the SMS region policy. Use Firebase test numbers for development.
5. Under **Cloud Messaging → Web configuration**, generate a Web Push certificate key pair and set its public key as `VITE_FIREBASE_VAPID_KEY`.
6. The web `predev` and `prebuild` scripts generate the ignored `public/firebase-config.js` file from those variables. The service worker loads that file at startup, so background push remains configured after the browser terminates and restarts the worker.
7. Serve `/firebase-messaging-sw.js` and `/firebase-config.js` from the site root with JavaScript content types. Push requires HTTPS except on localhost.

## Android and iOS

1. Register the Android app in Firebase with package `com.tech.Funzy`; place its generated `google-services.json` at `apps/mobile/google-services.json` (the path configured by Expo).
2. Register the iOS app with bundle identifier `com.tech.Funzy`.
3. In Apple Developer, enable **Push Notifications** for the app ID and ensure the EAS provisioning profile contains the push entitlement. In Firebase Console → Project Settings → Cloud Messaging, upload the APNs authentication key (.p8) with its Key ID and Apple Team ID.
4. Expo config declares the iOS `remote-notification` background mode and Android `POST_NOTIFICATIONS` permission. Rebuild the native app after changing native configuration; an OTA JavaScript update cannot add these capabilities.
5. Verify permission grant/denial, token registration, foreground delivery, background delivery, cold-start notification taps, and logout token removal on physical Android and iOS devices.

## Backend

The Rust FCM service requires these deployment environment variables: `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_PRIVATE_KEY_ID`, and `FIREBASE_PROJECT_ID`. Store them as deployment secrets; never commit a service-account JSON or private key.

The shared token endpoints are:
- `POST /api/notifications/register-token` with `user_id`, `fcm_token`, and `platform` (`web`, `android`, or `ios`).
- `DELETE /api/notifications/unregister-token` with `user_id` and `fcm_token`; clients call this on logout.
- `GET /api/notifications/unread-summary/:user_id` for server-authoritative unread totals.
- `PUT /api/notifications/mark-read` accepts `user_id` and optionally `fixture_id` to clear one fixture's push notifications.

A device/browser token is owned by one active account. Registering it for another account removes stale ownership rows so a shared device does not continue receiving the previous account's pushes.

## Runtime behavior and verification

- Permission is requested only after an explicit user action on web and after successful sign-in on mobile. Declining permission does not block the app.
- Foreground pushes update unread counts; mobile also shows an in-app toast. Background pushes persist unread state and notification taps open the relevant fixture chat.
- Opening a fixture chat clears that fixture's notification unread state on the server and locally.
- CI validates TypeScript, the web build, and the Android JavaScript bundle. It cannot prove live Firebase/APNs delivery. Complete the physical-device checks above before calling production delivery verified.
