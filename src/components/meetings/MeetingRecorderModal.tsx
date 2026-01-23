import { useState } from 'react';
import { Mic, Square, Pause, Play, Loader2, X, RotateCcw, Check } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { haptics } from '@/hooks/useHaptics';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Channel } from '@/types/messenger';
import {
  Dialog,
  DialogContent,
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

type RecorderPhase = 'idle' | 'recording' | 'paused' | 'review' | 'processing';

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

  const {
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
  } = useAudioRecorder();

  const isNative = Capacitor.isNativePlatform();
  const platform = Capacitor.getPlatform();

  // Determine current phase
  const getPhase = (): RecorderPhase => {
    if (isProcessing) return 'processing';
    if (audioBlob && !isRecording) return 'review';
    if (isPaused) return 'paused';
    if (isRecording) return 'recording';
    return 'idle';
  };

  const phase = getPhase();

  const handleStartRecording = async () => {
    try {
      await haptics.medium();
      await startRecording();
      await haptics.success();
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      await haptics.error();
      toast({
        title: 'Recording Failed',
        description: error.message || 'Could not start recording. Please check microphone permissions.',
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

  const handleDiscard = () => {
    haptics.light();
    resetRecording();
    setTitle('');
    setSelectedChannel('none');
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
    setProcessingStatus('Uploading...');

    try {
      await haptics.medium();

      const formData = new FormData();
      const extension = audioBlob.type.includes('aac') ? 'aac' : 
                       audioBlob.type.includes('m4a') ? 'm4a' : 'webm';
      formData.append('audio', audioBlob, `recording.${extension}`);
      formData.append('title', meetingTitle);
      if (selectedChannel !== 'none') {
        formData.append('channel_id', selectedChannel);
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      setProcessingStatus('Transcribing...');

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

      setProcessingStatus('Done!');
      await haptics.success();

      toast({
        title: 'Meeting Saved',
        description: 'Your meeting has been transcribed successfully.',
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
    onOpenChange(false);
  };

  const getSettingsInstructions = () => {
    if (platform === 'android') {
      return 'Open Settings → Apps → LP Central → Permissions and enable Microphone';
    } else if (platform === 'ios') {
      return 'Open Settings → LP Central → enable Microphone';
    }
    return 'Please enable microphone access in your browser settings.';
  };

  // Permission denied state
  const showPermissionDenied = permissionDenied && phase === 'idle';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-0 bg-slate-900 text-white p-0 sm:max-w-sm overflow-hidden">
        {/* Processing Overlay */}
        {phase === 'processing' && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-sm">
            <div className="relative mb-6">
              <div className="h-16 w-16 rounded-full border-4 border-slate-700" />
              <div className="absolute inset-0 h-16 w-16 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-lg font-medium text-white">{processingStatus}</p>
            <p className="mt-2 text-sm text-slate-400">This may take a moment...</p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <div className="flex items-center gap-2">
            {phase === 'review' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDiscard}
                className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800 -ml-2"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <span className="text-base font-semibold">
              {phase === 'review' ? 'Save Recording' : 'Record Meeting'}
            </span>
          </div>
          {phase !== 'review' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Main Content */}
        <div className="px-5 pb-6">
          {/* Permission Denied State */}
          {showPermissionDenied && (
            <div className="flex flex-col items-center py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                <Mic className="h-8 w-8 text-red-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Microphone Access Needed</h3>
              <p className="text-sm text-slate-400 mb-6 max-w-[250px]">
                {getSettingsInstructions()}
              </p>
              <Button
                onClick={handleStartRecording}
                className="bg-teal-500 hover:bg-teal-600 text-white"
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Recording/Idle State */}
          {(phase === 'idle' || phase === 'recording' || phase === 'paused') && !showPermissionDenied && (
            <div className="flex flex-col items-center py-8">
              {/* Timer Display */}
              <div className={cn(
                "text-6xl font-bold tracking-tighter tabular-nums mb-3 transition-colors duration-300",
                phase === 'recording' && "text-red-500",
                phase === 'paused' && "text-amber-400",
                phase === 'idle' && "text-slate-500"
              )}>
                {formatTime(recordingTime)}
              </div>

              {/* Status Badge */}
              <div className={cn(
                "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-10 transition-all duration-300",
                phase === 'recording' && "bg-red-500/20 text-red-400",
                phase === 'paused' && "bg-amber-500/20 text-amber-400",
                phase === 'idle' && "bg-slate-700 text-slate-400"
              )}>
                {phase === 'recording' && (
                  <>
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-recording-pulse" />
                    Recording
                  </>
                )}
                {phase === 'paused' && (
                  <>
                    <Pause className="h-3 w-3" />
                    Paused
                  </>
                )}
                {phase === 'idle' && 'Ready to record'}
              </div>

              {/* Recording Controls */}
              <div className="flex items-center justify-center gap-6">
                {phase === 'idle' && (
                  <button
                    onClick={handleStartRecording}
                    className="relative flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition-all duration-200 active:scale-95 hover:bg-red-400"
                  >
                    <Mic className="h-8 w-8" />
                  </button>
                )}

                {(phase === 'recording' || phase === 'paused') && (
                  <>
                    {/* Pause/Resume Button */}
                    <button
                      onClick={phase === 'paused' ? handleResumeRecording : handlePauseRecording}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-700 text-white transition-all duration-200 active:scale-95 hover:bg-slate-600"
                    >
                      {phase === 'paused' ? (
                        <Play className="h-6 w-6 ml-0.5" />
                      ) : (
                        <Pause className="h-6 w-6" />
                      )}
                    </button>

                    {/* Stop Button */}
                    <button
                      onClick={handleStopRecording}
                      className="relative flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-900 shadow-lg transition-all duration-200 active:scale-95 hover:bg-white"
                    >
                      {/* Animated ring when recording */}
                      {phase === 'recording' && (
                        <span className="absolute inset-0 rounded-full border-2 border-red-500 animate-recording-ring" />
                      )}
                      <Square className="h-7 w-7" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Review State - Show form to save */}
          {phase === 'review' && (
            <div className="space-y-5 py-4">
              {/* Duration display */}
              <div className="flex flex-col items-center mb-6">
                <span className="text-4xl font-bold tracking-tighter tabular-nums text-teal-400 mb-1">
                  {formatTime(recordingTime)}
                </span>
                <span className="text-sm text-slate-400 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  Recording complete
                </span>
              </div>

              {/* Meeting Title */}
              <div className="space-y-2">
                <Label htmlFor="meeting-title" className="text-sm text-slate-400">
                  Title (optional)
                </Label>
                <Input
                  id="meeting-title"
                  placeholder="Weekly Standup, 1:1 with Sarah..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus:border-teal-500 focus:ring-teal-500/20"
                />
              </div>

              {/* Channel Selection */}
              <div className="space-y-2">
                <Label className="text-sm text-slate-400">Link to Channel</Label>
                <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                  <SelectTrigger className="border-slate-700 bg-slate-800 text-white focus:border-teal-500 focus:ring-teal-500/20">
                    <SelectValue placeholder="Select a channel" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-700 bg-slate-800">
                    <SelectItem value="none" className="text-slate-300">No channel</SelectItem>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id} className="text-slate-300">
                        #{channel.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={handleDiscard}
                  className="flex-1 border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Discard
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="flex-1 bg-teal-500 hover:bg-teal-600 text-white"
                >
                  Save & Transcribe
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
