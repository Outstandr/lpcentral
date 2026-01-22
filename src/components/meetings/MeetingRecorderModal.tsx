import { useState } from 'react';
import { Mic, Square, Pause, Play, Loader2, X } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useNativeMicrophone } from '@/hooks/useNativeMicrophone';
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

  const { requestMicrophonePermission, checkMicrophoneAvailable } = useNativeMicrophone();

  const handleStartRecording = async () => {
    try {
      // Check if microphone is available
      const hasMic = await checkMicrophoneAvailable();
      if (!hasMic) {
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
        toast({
          title: 'Microphone Access Required',
          description: 'Please grant microphone permission in your device settings to record meetings.',
          variant: 'destructive',
        });
        return;
      }

      await startRecording();
    } catch (error: any) {
      console.error('Failed to start recording:', error);
      toast({
        title: 'Recording Failed',
        description: error.message || 'Could not start recording. Please try again.',
        variant: 'destructive',
      });
    }
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
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-slate-700 bg-slate-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-teal-400" />
            Record Meeting
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Recording Controls */}
          <div className="flex flex-col items-center gap-4 py-6">
            {/* Timer */}
            <div className={cn(
              "text-4xl font-mono tabular-nums",
              isRecording && !isPaused ? "text-red-400" : "text-slate-400"
            )}>
              {formatTime(recordingTime)}
            </div>

            {/* Recording indicator */}
            {isRecording && !isPaused && (
              <div className="flex items-center gap-2 text-red-400">
                <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                <span className="text-sm">Recording...</span>
              </div>
            )}

            {isPaused && (
              <div className="flex items-center gap-2 text-yellow-400">
                <Pause className="h-4 w-4" />
                <span className="text-sm">Paused</span>
              </div>
            )}

            {audioBlob && !isRecording && (
              <div className="flex items-center gap-2 text-teal-400">
                <span className="text-sm">Recording ready</span>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center gap-3">
              {!isRecording && !audioBlob && (
                <Button
                  onClick={handleStartRecording}
                  className="h-16 w-16 rounded-full bg-red-500 hover:bg-red-600"
                  disabled={isProcessing}
                >
                  <Mic className="h-8 w-8" />
                </Button>
              )}

              {isRecording && (
                <>
                  <Button
                    onClick={isPaused ? resumeRecording : pauseRecording}
                    variant="outline"
                    className="h-12 w-12 rounded-full border-slate-600"
                  >
                    {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                  </Button>
                  <Button
                    onClick={stopRecording}
                    className="h-16 w-16 rounded-full bg-slate-600 hover:bg-slate-500"
                  >
                    <Square className="h-6 w-6" />
                  </Button>
                </>
              )}

              {audioBlob && !isRecording && (
                <Button
                  onClick={resetRecording}
                  variant="outline"
                  className="border-slate-600"
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
                <Label htmlFor="meeting-title" className="text-slate-300">
                  Meeting Title (optional)
                </Label>
                <Input
                  id="meeting-title"
                  placeholder="e.g., Weekly Standup"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="border-slate-600 bg-slate-700 text-white"
                  disabled={isProcessing}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Link to Channel (optional)</Label>
                <Select value={selectedChannel} onValueChange={setSelectedChannel} disabled={isProcessing}>
                  <SelectTrigger className="border-slate-600 bg-slate-700 text-white">
                    <SelectValue placeholder="Select a channel" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-600 bg-slate-700">
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
              className="w-full bg-teal-500 hover:bg-teal-600"
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
