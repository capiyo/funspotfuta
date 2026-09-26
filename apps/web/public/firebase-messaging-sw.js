// apps/web/public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: 'AIzaSyCWMGz6AIRXgu7GVZiJWlkvO6tVZADf5tY',
    authDomain: 'funzy-d56d7.firebaseapp.com',
    projectId: 'funzy-d56d7',
    storageBucket: 'funzy-d56d7.firebasestorage.app',
    messagingSenderId: '661929781606',
    appId: '1:661929781606:web:3f306a659ae64ac7f780a7',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const { title, body } = payload.notification ?? {};
    self.registration.showNotification(title ?? 'New Notification', {
        body: body ?? '',
        icon: '/icons/funspot.png',
    });
});