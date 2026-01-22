import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.leadersteam',
  appName: 'Leaders Team',
  webDir: 'dist',
  server: {
    url: 'https://c5434383-4da6-44cd-bff9-0b5e0dfb3933.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
};

export default config;
