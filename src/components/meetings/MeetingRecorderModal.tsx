import { useState, useEffect } from 'react';
import { Mic, Square, Pause, Play, Loader2, X, Settings, AlertTriangle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useNativeMicrophone, PermissionStatus } from '@/hooks/useNativeMicrophone';
import { haptics } from '@/hooks/useHaptics';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Channel } from '@/types/messenger';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface MeetingRecorderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channels: Channel[];
  onMeetingCreated?: (meetingId: string) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function MeetingRecorderModal({
  open,
  onOpenChange,
  channels,
  onMeetingCreated,
}: MeetingRecorderModalProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('none');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [localPermissionStatus, setLocalPermissionStatus] = useState<PermissionStatus>('unknown');
  const [isCheckingPermission, setIsCheckingPermission] = useState(false);

  const {
    isRecording,
    isPaused,
    recordingTime,
    audioBlob,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  } = useAudioRecorder();

  const { 
    requestMicrophonePermission, 
    checkMicrophoneAvailable, 
    checkPermissionStatus 
  } = useNativeMicrophone();

  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();

  // Check permission status when modal opens
  useEffect(() => {
    if (open && isNative) {
      setIsCheckingPermission(true);
      checkPermissionStatus()
        .then(status => {
          setLocalPermissionStatus(status);
        })
        .finally(() => {
          setIsCheckingPermission(false);
        });
    }
  }, [open, isNative, checkPermissionStatus]);

  const handleStartRecording = async () => {
    try {
      // Haptic feedback on tap
      await haptics.medium();

      // Check if microphone is available
      const hasMic = await checkMicrophoneAvailable();
      if (!hasMic) {
        await haptics.error();
        toast({
          title: 'No Microphone Found',
          description: 'Please connect a microphone to record meetings.',
          variant: 'destructive',
        });
        return;
      }

      // Request permission first on native platforms
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        setLocalPermissionStatus('denied');
        await haptics.error();
        toast({
          title: 'Microphone Access Required',
          description: 'Please grant microphone permission to record meetings.',
          variant: 'destructive',
        });
        return;
      }

      setLocalPermissionStatus('granted');
      await startRecording();
      await haptics.success();
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      await haptics.error();
      toast({
        title: 'Recording Failed',
        description: error.message || 'Could not start recording. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleStopRecording = async () => {
    await haptics.heavy();
    await stopRecording();
  };

  const handlePauseRecording = async () => {
    await haptics.light();
    pauseRecording();
  };

  const handleResumeRecording = async () => {
    await haptics.light();
    resumeRecording();
  };

  const handleSubmit = async () => {
    if (!audioBlob) {
      toast({
        title: 'No Recording',
        description: 'Please record a meeting first.',
        variant: 'destructive',
      });
      return;
    }

    const meetingTitle = title.trim() || `Meeting ${new Date().toLocaleDateString()}`;
    
    setIsProcessing(true);
    setProcessingStatus('Uploading audio...');

    try {
      await haptics.medium();

      const formData = new FormData();
      // Determine file extension based on blob type
      const extension = audioBlob.type.includes('aac') ? 'aac' : 
                       audioBlob.type.includes('m4a') ? 'm4a' : 'webm';
      formData.append('audio', audioBlob, `recording.${extension}`);
      formData.append('title', meetingTitle);
      if (selectedChannel !== 'none') {
        formData.append('channel_id', selectedChannel);
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      setProcessingStatus('Transcribing audio...');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-meeting`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process meeting');
      }

      setProcessingStatus('Complete!');
      await haptics.success();

      toast({
        title: 'Meeting Recorded',
        description: 'Your meeting has been transcribed and analyzed.',
      });

      if (onMeetingCreated) {
        onMeetingCreated(result.meeting_id);
      }

      // Reset state
      resetRecording();
      setTitle('');
      setSelectedChannel('none');
      onOpenChange(false);

    } catch (error: any) {
      console.error('Error processing meeting:', error);
      await haptics.error();
      toast({
        title: 'Processing Failed',
        description: error.message || 'Failed to process the recording.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const handleClose = () => {
    if (isRecording) {
      stopRecording();
    }
    resetRecording();
    setTitle('');
    setSelectedChannel('none');
    setLocalPermissionStatus('unknown');
    onOpenChange(false);
  };

  const getSettingsInstructions = () => {
    if (platform === 'android') {
      return 'Go to Settings → Apps → LP Central → Permissions → Microphone';
    } else if (platform === 'ios') {
      return 'Go to Settings → LP Central → Microphone';
    }
    return 'Check your browser settings to enable microphone access.';
  };

  // Permission denied state for native
  const showPermissionDenied = isNative && localPermissionStatus === 'denied' && !isRecording && !audioBlob;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-border bg-background text-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-primary" />
            Record Meeting
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Permission Denied Warning */}
          {showPermissionDenied && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                <div className="flex-1 space-y-2">
                  <h4 className="font-medium text-destructive">Microphone Access Denied</h4>
                  <p className="text-sm text-muted-foreground">
                    {getSettingsInstructions()}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={async () => {
                      // Re-request permission
                      const granted = await requestMicrophonePermission();
                      if (granted) {
                        setLocalPermissionStatus('granted');
                      }
                    }}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Recording Controls */}
          <div className="flex flex-col items-center gap-4 py-6">
            {/* Timer */}
            <div className={cn(
              "text-4xl font-mono tabular-nums",
              isRecording && !isPaused ? "text-destructive" : "text-muted-foreground"
            )}>
              {formatTime(recordingTime)}
            </div>

            {/* Recording indicator */}
            {isRecording && !isPaused && (
              <div className="flex items-center gap-2 text-destructive">
                <div className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                <span className="text-sm">Recording...</span>
              </div>
            )}

            {isPaused && (
              <div className="flex items-center gap-2 text-yellow-500">
                <Pause className="h-4 w-4" />
                <span className="text-sm">Paused</span>
              </div>
            )}

            {audioBlob && !isRecording && (
              <div className="flex items-center gap-2 text-primary">
                <span className="text-sm">Recording ready</span>
              </div>
            )}

            {isCheckingPermission && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Checking permissions...</span>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-3">
              {!isRecording && !audioBlob && !showPermissionDenied && (
                <Button
                  onClick={handleStartRecording}
                  className="h-16 w-16 rounded-full bg-destructive hover:bg-destructive/90"
                  disabled={isProcessing || isCheckingPermission}
                >
                  <Mic className="h-8 w-8" />
                </Button>
              )}

              {isRecording && (
                <>
                  <Button
                    onClick={isPaused ? handleResumeRecording : handlePauseRecording}
                    variant="outline"
                    className="h-12 w-12 rounded-full"
                  >
                    {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                  </Button>
                  <Button
                    onClick={handleStopRecording}
                    className="h-16 w-16 rounded-full bg-muted hover:bg-muted/80"
                  >
                    <Square className="h-6 w-6" />
                  </Button>
                </>
              )}

              {audioBlob && !isRecording && (
                <Button
                  onClick={() => {
                    haptics.light();
                    resetRecording();
                  }}
                  variant="outline"
                >
                  <X className="mr-2 h-4 w-4" />
                  Discard
                </Button>
              )}
            </div>
          </div>

          {/* Meeting Details */}
          {(audioBlob || isRecording) && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="meeting-title" className="text-muted-foreground">
                  Meeting Title (optional)
                </Label>
                <Input
                  id="meeting-title"
                  placeholder="e.g., Weekly Standup"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isProcessing}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Link to Channel (optional)</Label>
                <Select value={selectedChannel} onValueChange={setSelectedChannel} disabled={isProcessing}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a channel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No channel</SelectItem>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        #{channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Submit Button */}
          {audioBlob && !isRecording && (
            <Button
              onClick={handleSubmit}
              className="w-full"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {processingStatus}
                </>
              ) : (
                'Save & Transcribe'
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
