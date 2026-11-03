// App.tsx
//cd /d/Javascript/funspot/apps/mobile && rm -rf android ~/.gradle/caches/build-cache-1 $TMPDIR/metro-* && npx expo prebuild --platform android --clean && cd android && ./gradlew.bat clean
//
// Provider order matters:
//   AuthProvider       — must come first; LoginModalProvider and everything
//                        below it reads useAuth()
//   LoginModalProvider — mounts LoginModal globally; every screen calls
//                        useLoginModal().requireLogin() to gate actions
//   ToastProvider
//   QueryProvider      — rehydrates the MMKV-backed cache; calls onReady
//                        when done
//   NavigationContainer → RootNavigator

//flutter emulators --launch Pixel_Lite

///d/Dart/sdk/platform-tools/adb.exe devices

//cd / d / Javascript / funspot / apps / mobile && rm - rf android && npx expo prebuild--platform android--clean

///d/Dart/sdk/platform-tools/adb.exe install -r "D:\Javascript\funspot\apps\mobile\android\app\build\outputs\apk\release\app-release.apk"
///d/Dart/sdk/platform-tools/adb.exe install -r "D:\Javascript\funspot\apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk"


///d/Dart/sdk/platform-tools/adb.exe logcat -c
///d/Dart / sdk / platform - tools / adb.exe logcat | grep - iE "FATAL|AndroidRuntime|ReactNativeJS|Error"









//
// QueryProvider is ALWAYS mounted (it's the thing that calls onReady, so it
// can't be behind the gate it's supposed to open). Only the nav tree below
// it is gated on fontsLoaded AND cacheReady. Until both are true we render
// nothing but keep providers mounted, and keep the native splash up. That
// way RootNavigator mounts with a warm cache instead of firing a network
// request on boot.
//
// SAFE AREA: there is exactly ONE SafeAreaView in the whole app, right
// here, wrapping NavigationContainer. It's scoped with `edges` to just
// top/left/right (bottom is handled per-screen, e.g. FloatingPillTabBar
// positions itself off FAN_SPACING.lg, not an inset) so it doesn't
// double up with anything below it. Individual screens/components (e.g.
// AppHeader) read insets via useSafeAreaInsets() instead of adding their
// own SafeAreaView — a second SafeAreaView deeper in the tree defaults to
// flex: 1 and will stretch to fill its parent's available space, pushing
// every sibling below it down into a dead gap. Don't add another one.

///d/Dart/sdk/platform-tools/adb.exe install -r /d/Javascript/funspot/apps/mobile/android/app/build/outputs/apk/release/app-release.apk

/*/d/Dart/sdk/platform-tools/adb.exe logcat -c
/d/Dart/sdk/platform-tools/adb.exe logcat | grep -iE "FATAL|AndroidRuntime|ReactNativeJS|Error"*/

import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { StatusBar } from 'expo-status-bar';
import {
    NavigationContainer,
    DarkTheme,
    DefaultTheme,
} from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
    useFonts,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
    SairaCondensed_400Regular,
    SairaCondensed_600SemiBold,
    SairaCondensed_700Bold,
    SairaCondensed_800ExtraBold,
} from '@expo-google-fonts/saira-condensed';
import * as SplashScreen from 'expo-splash-screen';

import { AuthProvider } from '@/lib/auth/auth-context';
import { LoginModalProvider } from './src/modals/Login-modal-context';
import { ToastProvider } from '@/lib/toast/toast-context';
import { QueryProvider } from './QueryProvider';
import RootNavigator from '@/navigation/RootNavigator';
import { useFanColors } from '@/theme/use-fan-colors';

SplashScreen.preventAutoHideAsync();

export default function App() {
    const colors = useFanColors();
    const [cacheReady, setCacheReady] = useState(false);

    const [fontsLoaded] = useFonts({
        DMSans_400Regular,
        DMSans_500Medium,
        DMSans_700Bold,
        SairaCondensed_400Regular,
        SairaCondensed_600SemiBold,
        SairaCondensed_700Bold,
        SairaCondensed_800ExtraBold,
    });

    const appReady = fontsLoaded && cacheReady;

    const onLayout = useCallback(async () => {
        if (appReady) await SplashScreen.hideAsync();
    }, [appReady]);

    const navTheme = {
        ...(colors.background === '#0F1E27' ? DarkTheme : DefaultTheme),
        colors: {
            ...(colors.background === '#0F1E27'
                ? DarkTheme.colors
                : DefaultTheme.colors),
            background: colors.background,
            card: colors.surfaceElevated,
            primary: colors.primary,
            text: colors.textPrimary,
            border: colors.border,
        },
    };

    return (
        <View style={{ flex: 1 }} onLayout={onLayout}>
            <SafeAreaProvider>
                <AuthProvider>
                    <LoginModalProvider>
                        <ToastProvider>
                            <QueryProvider onReady={() => setCacheReady(true)}>
                                {appReady ? (
                                    <SafeAreaView
                                        style={{ flex: 1, backgroundColor: colors.background }}
                                        edges={['top', 'left', 'right']}
                                    >
                                        <NavigationContainer theme={navTheme}>
                                            <RootNavigator />
                                        </NavigationContainer>
                                        <StatusBar
                                            style={
                                                colors.background === '#0F1E27' ? 'light' : 'dark'
                                            }
                                        />
                                    </SafeAreaView>
                                ) : null}
                            </QueryProvider>
                        </ToastProvider>
                    </LoginModalProvider>
                </AuthProvider>
            </SafeAreaProvider>
        </View>
    );
}