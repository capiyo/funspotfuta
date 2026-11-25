import { registerRootComponent } from 'expo';
import App from './App';

// FCM payloads from the backend include a native notification block. Android
// and iOS display those while the app is backgrounded or terminated. Do not
// mutate the shared local notification cache from a headless JS context:
// AuthProvider is not mounted there, so no authenticated account namespace is
// available. On resume, NotificationRuntime reconciles unread state from the
// authenticated backend session and handles notification-open deep links.

registerRootComponent(App);
