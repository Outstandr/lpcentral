import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.leadersteam',
  appName: 'Leaders Team',
  webDir: 'dist',
  
  // Production: Load from bundled assets (webDir: 'dist')
  // For development hot-reload, uncomment the server block below:
  // server: {
  //   url: 'https://c5434383-4da6-44cd-bff9-0b5e0dfb3933.lovableproject.com?forceHideBadge=true',
  //   cleartext: true
  // },
  
  android: {
    allowMixedContent: true,
    backgroundColor: '#0f172a',
    webContentsDebuggingEnabled: false,
    // Prevent screenshots in app switcher (security)
    // Uncomment for production: captureInput: true
  },
  
  ios: {
    backgroundColor: '#0f172a',
    contentInset: 'automatic',
    scrollEnabled: true,
    preferredContentMode: 'mobile',
    // Use WKWebView for better performance
    limitsNavigationsToAppBoundDomains: true
  },
  
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#0f172a',
      showSpinner: true,
      spinnerColor: '#14b8a6',
      splashFullScreen: true,
      splashImmersive: true
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
      // iOS specific - move content above keyboard
      style: 'dark'
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0f172a'
    },
    Haptics: {
      // Enable haptic feedback
    }
  }
};

export default config;
