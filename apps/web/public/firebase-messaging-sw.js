importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.2.0/firebase-messaging-compat.js');

let messagingReady = false;
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'FUNSPOT_FIREBASE_CONFIG' || messagingReady) return;
  try {
    if (!firebase.apps.length) firebase.initializeApp(event.data.config);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
      const title = payload.notification?.title || 'Funspot';
      self.registration.showNotification(title, {
        body: payload.notification?.body || '',
        data: payload.data || {},
        icon: '/icons/app_icon.png',
      });
    });
    messagingReady = true;
  } catch (error) {
    console.error('Firebase Messaging service worker setup failed', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if ('focus' in client) {
        client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  }));
});
