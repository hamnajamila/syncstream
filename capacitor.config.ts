import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.example.syncstream',
  appName: 'syncstream',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    hostname: 'localhost'
  }
};

export default config;
