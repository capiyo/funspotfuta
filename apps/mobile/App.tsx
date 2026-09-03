import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/lib/auth/auth-context';
import { ToastProvider } from '@/lib/toast/toast-context';
import RootNavigator from '@/navigation/RootNavigator';
import { colors } from '@/theme';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    primary: colors.green,
    text: colors.textPrimary,
    border: colors.border,
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <NavigationContainer theme={navTheme}>
            <RootNavigator />
          </NavigationContainer>
          <StatusBar style="light" />
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
