import { registerRootComponent } from 'expo';
import { registerBackgroundMessageHandler } from './src/lib/firebase';
import App from './App';
import { NotificationService } from './src/lib/api/notification-service';

// Must run outside any component, at module scope — mirrors
// FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler)
// registered in main.dart before runApp().
registerBackgroundMessageHandler(async (remoteMessage) => {
    console.log('Background FCM message received');
    await NotificationService.pushToStream({ data: remoteMessage.data ?? {} });
});

registerRootComponent(App);