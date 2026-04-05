/**
 * ران - Root Layout (Expo Router)
 */

import { Slot } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../src/hooks/useAuth';
import { ErrorBoundary } from '../src/components/shared/ErrorBoundary';
import { StatusBar } from 'expo-status-bar';
import { I18nManager } from 'react-native';

// تفعيل RTL
I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30000,
    },
  },
});

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" />
          <Slot />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
