import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.leadersteam',
  appName: 'Leaders Team',
  webDir: 'dist',
  // Server config for development hot-reload
  // Comment out or remove the 'server' block for production builds
  server: {
    url: 'https://c5434383-4da6-44cd-bff9-0b5e0dfb3933.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0f172a',
    // Ensure proper status bar handling
    webContentsDebuggingEnabled: false
  },
  ios: {
    backgroundColor: '#0f172a',
    contentInset: 'automatic',
    scrollEnabled: true,
    // Handle safe areas properly
    preferredContentMode: 'mobile'
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      showSpinner: false
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    }
  }
};

export default config;
