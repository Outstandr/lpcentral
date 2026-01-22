import { Capacitor } from '@capacitor/core';
import { useCallback } from 'react';

/**
 * Hook to request microphone permissions on native platforms
 * On web, this is handled automatically by navigator.mediaDevices.getUserMedia
 * On native (Android/iOS), we need to check and request permissions first
 */
export function useNativeMicrophone() {
  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    // On web, permissions are handled by the browser
    if (!Capacitor.isNativePlatform()) {
      return true;
    }

    try {
      // For native platforms, we try to get the microphone stream
      // which will trigger the native permission dialog if not already granted
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Clean up the stream immediately - we just needed to trigger the permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error: any) {
      console.error('Microphone permission denied:', error);
      
      // Check if it's a permission error
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        return false;
      }
      
      // For other errors (e.g., no microphone available)
      throw error;
    }
  }, []);

  const checkMicrophoneAvailable = useCallback(async (): Promise<boolean> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some(device => device.kind === 'audioinput');
    } catch {
      return false;
    }
  }, []);

  return {
    requestMicrophonePermission,
    checkMicrophoneAvailable,
  };
}
