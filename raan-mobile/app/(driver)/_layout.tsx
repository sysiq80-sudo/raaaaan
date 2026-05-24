/**
 * ران - Driver Layout (expo-router)
 * Stack يحتوي على Tabs + شاشات فرعية
 */

import { Stack } from 'expo-router';

export default function DriverLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_left',
        contentStyle: { backgroundColor: '#0f172a' },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="profile"
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: '#0f172a' },
          headerTintColor: '#f1f5f9',
          headerTitle: 'الملف الشخصي',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  );
}
