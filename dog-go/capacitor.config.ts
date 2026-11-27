import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.doggo.app',
  appName: 'Dog-go',
  webDir: 'out',
  // useLegacyBridge: keeps background-geolocation updates flowing after 5 min in the background
  android: { allowMixedContent: false, useLegacyBridge: true },
  plugins: {
    LocalNotifications: { iconColor: '#6BA368' },
  },
};
export default config;
