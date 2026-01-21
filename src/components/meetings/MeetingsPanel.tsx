import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Mic, Calendar, Hash, Loader2, ChevronLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Channel } from '@/types/messenger';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { MeetingRecorderModal } from './MeetingRecorderModal';
import { MeetingDetailView } from './MeetingDetailView';

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  status: string | null;
  channel_id: string | null;
}

interface MeetingsPanelProps {
  channels: Channel[];
  onClose?: () => void;
}

export function MeetingsPanel({ channels, onClose }: MeetingsPanelProps) {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);

  useEffect(() => {
    fetchMeetings();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('meetings-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meetings',
        },
        () => {
          fetchMeetings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchMeetings = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('meetings')
      .select('id, title, meeting_date, status, channel_id')
      .order('meeting_date', { ascending: false });

    if (error) {
      console.error('Error fetching meetings:', error);
    } else {
      setMeetings(data || []);
    }
    setLoading(false);
  };

  const getChannelName = (channelId: string | null) => {
    if (!channelId) return null;
    return channels.find(c => c.id === channelId)?.name;
  };

  const handleMeetingCreated = (meetingId: string) => {
    setSelectedMeetingId(meetingId);
    fetchMeetings();
  };

  // Show meeting detail view
  if (selectedMeetingId) {
    return (
      <div className="flex h-full flex-col bg-slate-800">
        <div className="flex items-center gap-2 border-b border-slate-700 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedMeetingId(null)}
            className="h-8 w-8 text-slate-400 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm text-slate-400">Back to meetings</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <MeetingDetailView meetingId={selectedMeetingId} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 p-4">
        <div className="flex items-center gap-2">
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 text-slate-400 hover:text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <h2 className="text-lg font-semibold text-white">Meetings</h2>
        </div>
        <Button
          onClick={() => setIsRecorderOpen(true)}
          className="bg-teal-500 hover:bg-teal-600"
          size="sm"
        >
          <Mic className="mr-2 h-4 w-4" />
          Record
        </Button>
      </div>

      {/* Meetings List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
          </div>
        ) : meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12 px-4 text-center">
            <div className="rounded-full bg-slate-700 p-4">
              <Mic className="h-8 w-8 text-slate-400" />
            </div>
            <div>
              <p className="text-slate-300">No meetings yet</p>
              <p className="text-sm text-slate-500">
                Record your first in-person meeting to get started
              </p>
            </div>
            <Button
              onClick={() => setIsRecorderOpen(true)}
              variant="outline"
              className="border-slate-600"
            >
              <Mic className="mr-2 h-4 w-4" />
              Record Meeting
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {meetings.map((meeting) => (
              <button
                key={meeting.id}
                onClick={() => setSelectedMeetingId(meeting.id)}
                className="w-full p-4 text-left transition-colors hover:bg-slate-700/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="truncate font-medium text-white">
                      {meeting.title}
                    </h3>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(meeting.meeting_date), 'MMM d, yyyy')}
                      </span>
                      {meeting.channel_id && (
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {getChannelName(meeting.channel_id)}
                        </span>
                      )}
                    </div>
                  </div>
                  {meeting.status === 'processing' && (
                    <Loader2 className="h-4 w-4 animate-spin text-yellow-400 shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Recorder Modal */}
      <MeetingRecorderModal
        open={isRecorderOpen}
        onOpenChange={setIsRecorderOpen}
        channels={channels}
        onMeetingCreated={handleMeetingCreated}
      />
    </div>
  );
}
