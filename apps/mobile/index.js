import { registerRootComponent } from 'expo';
import { registerBackgroundMessageHandler } from './src/lib/firebase';
import App from './App';

// Must run outside any component, at module scope — mirrors
// FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler)
// registered in main.dart before runApp().
registerBackgroundMessageHandler(async (remoteMessage) => {
    console.log('Background FCM message:', remoteMessage);
    // Mirror the Dart handler: stash comrade_added notifications for
    // pickup on next foreground launch, if you want that behavior ported too.
});

registerRootComponent(App);