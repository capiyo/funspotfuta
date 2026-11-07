importScripts('/notification-url-normalizer.js');
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging-compat.js');
importScripts('/firebase-config.js');
try {
  const config = self.FUNSPOT_FIREBASE_CONFIG;
  if (config && !firebase.apps.length) firebase.initializeApp(config);
  if (config) {
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      self.registration.showNotification(payload.notification?.title || 'Funspot', {
        body: payload.notification?.body || '', data: payload.data || {}, icon: '/icons/app_icon.png',
      });
    });
  }
} catch (error) {
  console.error('Firebase Messaging service worker setup failed', error);
}
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const normalize = self.FunspotNotificationUrl?.normalize;
  const target = normalize ? normalize(event.notification.data?.url) : '/app/';
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('focus' in client) {
        await client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
