import { useState, useRef, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { VoiceRecorder, RecordingData } from 'capacitor-voice-recorder';

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  audioBlob: Blob | null;
  permissionDenied: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
}

/**
 * Cross-platform audio recorder hook.
 * Uses native Capacitor VoiceRecorder on mobile for proper permission handling.
 * Falls back to Web MediaRecorder API on web/PWA.
 * 
 * IMPORTANT: On native platforms, this hook handles permission requests internally.
 * The native Android/iOS permission dialog will appear when startRecording is called.
 */
export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  
  // Web-only refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Timer ref (shared)
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const isNative = Capacitor.isNativePlatform();

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (!isNative && streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isNative, stopTimer]);

  /**
   * Request microphone permission on native platforms.
   * Returns true if permission granted, false otherwise.
   */
  const requestNativePermission = useCallback(async (): Promise<boolean> => {
    try {
      console.log('[useAudioRecorder] Checking native microphone permission...');
      
      // First check if we already have permission
      const hasPermission = await VoiceRecorder.hasAudioRecordingPermission();
      console.log('[useAudioRecorder] Has permission:', hasPermission.value);
      
      if (hasPermission.value) {
        setPermissionDenied(false);
        return true;
      }

      // Request permission - this triggers the native Android/iOS dialog
      console.log('[useAudioRecorder] Requesting native permission...');
      const permissionResult = await VoiceRecorder.requestAudioRecordingPermission();
      console.log('[useAudioRecorder] Permission result:', permissionResult.value);
      
      if (permissionResult.value) {
        setPermissionDenied(false);
        return true;
      } else {
        setPermissionDenied(true);
        return false;
      }
    } catch (error) {
      console.error('[useAudioRecorder] Error requesting permission:', error);
      setPermissionDenied(true);
      return false;
    }
  }, []);

  const startRecordingNative = useCallback(async () => {
    // ALWAYS request permission before starting native recording
    const hasPermission = await requestNativePermission();
    
    if (!hasPermission) {
      console.error('[useAudioRecorder] Permission denied, cannot start recording');
      throw new Error('Microphone permission denied. Please grant access in Settings.');
    }

    try {
      console.log('[useAudioRecorder] Starting native recording...');
      const result = await VoiceRecorder.startRecording();
      console.log('[useAudioRecorder] Start recording result:', result.value);
      
      if (result.value) {
        setIsRecording(true);
        setIsPaused(false);
        setRecordingTime(0);
        setAudioBlob(null);
        startTimer();
      } else {
        throw new Error('Failed to start native recording');
      }
    } catch (error) {
      console.error('[useAudioRecorder] Error starting native recording:', error);
      throw error;
    }
  }, [requestNativePermission, startTimer]);

  const startRecordingWeb = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      streamRef.current = stream;
      chunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      setAudioBlob(null);
      setPermissionDenied(false);
      startTimer();
    } catch (error: any) {
      console.error('[useAudioRecorder] Error starting web recording:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
      }
      throw error;
    }
  }, [startTimer]);

  const startRecording = useCallback(async () => {
    console.log('[useAudioRecorder] startRecording called, isNative:', isNative);
    if (isNative) {
      await startRecordingNative();
    } else {
      await startRecordingWeb();
    }
  }, [isNative, startRecordingNative, startRecordingWeb]);

  const stopRecordingNative = useCallback(async () => {
    try {
      console.log('[useAudioRecorder] Stopping native recording...');
      const result: RecordingData = await VoiceRecorder.stopRecording();
      
      setIsRecording(false);
      setIsPaused(false);
      stopTimer();

      if (result.value && result.value.recordDataBase64) {
        // Convert base64 to Blob
        const base64 = result.value.recordDataBase64;
        const mimeType = result.value.mimeType || 'audio/aac';
        
        console.log('[useAudioRecorder] Got recording, mimeType:', mimeType, 'base64 length:', base64.length);
        
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        
        setAudioBlob(blob);
      }
    } catch (error) {
      console.error('[useAudioRecorder] Error stopping native recording:', error);
      setIsRecording(false);
      setIsPaused(false);
      stopTimer();
      throw error;
    }
  }, [stopTimer]);

  const stopRecordingWeb = useCallback(async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      stopTimer();
    }
  }, [isRecording, stopTimer]);

  const stopRecording = useCallback(async () => {
    if (isNative) {
      await stopRecordingNative();
    } else {
      await stopRecordingWeb();
    }
  }, [isNative, stopRecordingNative, stopRecordingWeb]);

  const pauseRecording = useCallback(() => {
    if (!isRecording || isPaused) return;
    
    if (isNative) {
      // Note: capacitor-voice-recorder v5+ supports pause/resume
      VoiceRecorder.pauseRecording().catch(err => {
        console.error('[useAudioRecorder] Pause not supported or failed:', err);
      });
    } else if (mediaRecorderRef.current) {
      mediaRecorderRef.current.pause();
    }
    
    setIsPaused(true);
    stopTimer();
  }, [isRecording, isPaused, isNative, stopTimer]);

  const resumeRecording = useCallback(() => {
    if (!isRecording || !isPaused) return;
    
    if (isNative) {
      VoiceRecorder.resumeRecording().catch(err => {
        console.error('[useAudioRecorder] Resume not supported or failed:', err);
      });
    } else if (mediaRecorderRef.current) {
      mediaRecorderRef.current.resume();
    }
    
    setIsPaused(false);
    startTimer();
  }, [isRecording, isPaused, isNative, startTimer]);

  const resetRecording = useCallback(() => {
    // Stop any ongoing recording
    if (isRecording) {
      if (isNative) {
        VoiceRecorder.stopRecording().catch(() => {
          // Ignore errors when stopping for reset
        });
      } else if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
    }
    
    // Cleanup web stream
    if (!isNative && streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
    setAudioBlob(null);
    setPermissionDenied(false);
    chunksRef.current = [];
    stopTimer();
  }, [isRecording, isNative, stopTimer]);

  return {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    permissionDenied,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  };
}
