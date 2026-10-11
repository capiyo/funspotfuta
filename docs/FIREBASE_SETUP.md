# Firebase web setup

1. In Firebase Console, open project `funzy-d56d7` and add a **Web app**.
2. Copy the app config to local `apps/web/.env.local` using the variable names in `.env.example`: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, and `VITE_FIREBASE_VAPID_KEY`. Never commit real values.
3. Under **Authentication → Settings → Authorized domains**, add `localhost` and `funspot.co.ke` (plus the actual production subdomain if different).
4. Under **Authentication → Sign-in method**, enable **Phone**. Check the SMS region allowlist and enable Kenya (+254) if it is not already enabled. Use Firebase test numbers for safe development tests.
5. Under **Cloud Messaging → Web configuration**, generate a Web Push certificate key pair and set the public key as `VITE_FIREBASE_VAPID_KEY`.
6. Serve `public/firebase-messaging-sw.js` from the site root with a JavaScript content type. Push requires HTTPS except on localhost.
7. Confirm backend support for browser FCM tokens before enabling registration. Reuse mobile's endpoint and payload if supported; if not, document the precise backend API change instead of inventing an endpoint.
