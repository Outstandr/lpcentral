import { Capacitor } from '@capacitor/core';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { useCallback, useState } from 'react';

export type PermissionStatus = 'prompt' | 'granted' | 'denied' | 'unknown';

interface UseNativeMicrophoneReturn {
  permissionStatus: PermissionStatus;
  requestMicrophonePermission: () => Promise<boolean>;
  checkMicrophoneAvailable: () => Promise<boolean>;
  checkPermissionStatus: () => Promise<PermissionStatus>;
  openAppSettings: () => void;
}

/**
 * Hook to handle microphone permissions on native platforms using Capacitor Voice Recorder plugin.
 * This properly triggers the native Android/iOS permission dialogs.
 */
export function useNativeMicrophone(): UseNativeMicrophoneReturn {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('unknown');

  const checkPermissionStatus = useCallback(async (): Promise<PermissionStatus> => {
    // On web, permissions are handled by the browser
    if (!Capacitor.isNativePlatform()) {
      return 'granted';
    }

    try {
      const result = await VoiceRecorder.hasAudioRecordingPermission();
      const status = result.value ? 'granted' : 'prompt';
      setPermissionStatus(status);
      return status;
    } catch (error) {
      console.error('Error checking permission status:', error);
      setPermissionStatus('unknown');
      return 'unknown';
    }
  }, []);

  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    // On web, permissions are handled by the browser when getUserMedia is called
    if (!Capacitor.isNativePlatform()) {
      try {
        // Still need to check if permission exists on web
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setPermissionStatus('granted');
        return true;
      } catch (error: any) {
        console.error('Web microphone permission denied:', error);
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setPermissionStatus('denied');
          return false;
        }
        throw error;
      }
    }

    try {
      // First check if we already have permission
      const hasPermission = await VoiceRecorder.hasAudioRecordingPermission();
      
      if (hasPermission.value) {
        setPermissionStatus('granted');
        return true;
      }

      // Request permission - this triggers the native Android/iOS dialog
      const permissionResult = await VoiceRecorder.requestAudioRecordingPermission();
      
      if (permissionResult.value) {
        setPermissionStatus('granted');
        return true;
      } else {
        setPermissionStatus('denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      setPermissionStatus('denied');
      return false;
    }
  }, []);

  const checkMicrophoneAvailable = useCallback(async (): Promise<boolean> => {
    // On web, check using enumerateDevices
    if (!Capacitor.isNativePlatform()) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.some(device => device.kind === 'audioinput');
      } catch {
        return false;
      }
    }

    // On native, check if device can record voice
    try {
      const result = await VoiceRecorder.canDeviceVoiceRecord();
      return result.value;
    } catch (error) {
      console.error('Error checking device recording capability:', error);
      return false;
    }
  }, []);

  const openAppSettings = useCallback(() => {
    // On native Android/iOS, guide user to manually open settings
    // The VoiceRecorder plugin doesn't have a direct settings opener,
    // so we inform users to go to Settings manually
    if (Capacitor.isNativePlatform()) {
      const platform = Capacitor.getPlatform();
      const message = platform === 'android'
        ? 'Go to Settings > Apps > LP Central > Permissions > Microphone'
        : 'Go to Settings > LP Central > Microphone';
      
      console.log('Open app settings:', message);
      // This will be shown via the UI component
    }
  }, []);

  return {
    permissionStatus,
    requestMicrophonePermission,
    checkMicrophoneAvailable,
    checkPermissionStatus,
    openAppSettings,
  };
}
