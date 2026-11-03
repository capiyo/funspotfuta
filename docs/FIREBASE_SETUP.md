# Firebase web setup

1. In Firebase Console, open project `funzy-d56d7` and add a **Web app**.
2. Copy the app config to local `apps/web/.env.local` using the variable names in `.env.example`: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, and `VITE_FIREBASE_VAPID_KEY`. Never commit real values.
3. Under **Authentication → Settings → Authorized domains**, add `localhost` and `funspot.co.ke` (plus the actual production subdomain if different).
4. Under **Authentication → Sign-in method**, enable **Phone**. Check the SMS region allowlist and enable Kenya (+254) if it is not already enabled. Use Firebase test numbers for safe development tests.
5. Under **Cloud Messaging → Web configuration**, generate a Web Push certificate key pair and set the public key as `VITE_FIREBASE_VAPID_KEY`.
6. Serve `public/firebase-messaging-sw.js` from the site root with a JavaScript content type. Push requires HTTPS except on localhost.
7. Confirm backend support for browser FCM tokens before enabling registration. Reuse mobile's endpoint and payload if supported; if not, document the precise backend API change instead of inventing an endpoint.

## Browser runtime behavior

- The web provider order is AuthProvider → ToastProvider → LoginModalProvider. The login-modal provider mounts the global login dialog and notification gate so protected actions can request login without navigating to a separate screen.
- Notification permission is requested only after the user clicks Allow Notifications. If the browser does not support push, permission is blocked, or token initialization fails, the gate provides a continue-without-notifications path; the app does not fabricate a token.
- /messages/:channelId? is the protected browser equivalent of the mobile Chat screen. It opens the global login modal for logged-out users; Home/Tabs remains public.
- Passing CI does not verify real Firebase SMS delivery or browser push delivery. Complete the manual checks above with valid local .env.local values before enabling production traffic.
