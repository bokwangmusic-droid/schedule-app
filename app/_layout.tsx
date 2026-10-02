import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { captureAuthUrl } from '../src/auth/deepLinkInbox';
import { DATABASE_NAME, migrateDatabase } from '../src/db/database';

export default function RootLayout() {
  useEffect(() => {
    let active = true;
    void Linking.getInitialURL().then((url) => {
      if (active) captureAuthUrl(url);
    }).catch(console.error);

    const subscription = Linking.addEventListener('url', ({ url }) => {
      captureAuthUrl(url);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDatabase}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#F7F8FA' },
        }}
      />
    </SQLiteProvider>
  );
}
