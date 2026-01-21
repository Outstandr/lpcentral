import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  FileText, 
  Target, 
  CheckSquare, 
  Hammer, 
  ChevronDown, 
  ChevronUp,
  Loader2,
  Calendar,
  Hash,
  Play,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Meeting {
  id: string;
  title: string;
  meeting_date: string;
  transcript: string | null;
  audio_url: string | null;
  status: string | null;
  channel_id: string | null;
}

interface KeyPoint {
  point: string;
  importance: string;
}

interface ActionItem {
  task: string;
  owner: string;
  deadline: string;
}

interface Decision {
  decision: string;
  context: string;
}

interface MeetingNotes {
  id: string;
  summary: string | null;
  key_points: KeyPoint[] | null;
  action_items: ActionItem[] | null;
  decisions: Decision[] | null;
}

interface Channel {
  id: string;
  name: string;
}

interface MeetingDetailViewProps {
  meetingId: string;
}

export function MeetingDetailView({ meetingId }: MeetingDetailViewProps) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [notes, setNotes] = useState<MeetingNotes | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    fetchMeetingDetails();
  }, [meetingId]);

  const fetchMeetingDetails = async () => {
    setLoading(true);

    // Fetch meeting
    const { data: meetingData, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (meetingError) {
      console.error('Error fetching meeting:', meetingError);
      setLoading(false);
      return;
    }

    setMeeting(meetingData);

    // Fetch notes
    const { data: notesData } = await supabase
      .from('meeting_notes')
      .select('*')
      .eq('meeting_id', meetingId)
      .maybeSingle();

    if (notesData) {
      setNotes({
        id: notesData.id,
        summary: notesData.summary,
        key_points: notesData.key_points as unknown as KeyPoint[] | null,
        action_items: notesData.action_items as unknown as ActionItem[] | null,
        decisions: notesData.decisions as unknown as Decision[] | null,
      });
    }

    // Fetch channel if linked
    if (meetingData.channel_id) {
      const { data: channelData } = await supabase
        .from('channels')
        .select('id, name')
        .eq('id', meetingData.channel_id)
        .single();

      if (channelData) {
        setChannel(channelData);
      }
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        Meeting not found
      </div>
    );
  }

  const importanceColor = (importance: string) => {
    switch (importance) {
      case 'high': return 'bg-red-500/20 text-red-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <h1 className="text-2xl font-bold text-white">{meeting.title}</h1>
            {meeting.status === 'processing' && (
              <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                Processing
              </Badge>
            )}
            {meeting.status === 'completed' && (
              <Badge variant="outline" className="border-teal-500/50 text-teal-400">
                Completed
              </Badge>
            )}
            {meeting.status === 'failed' && (
              <Badge variant="outline" className="border-red-500/50 text-red-400">
                Failed
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {format(new Date(meeting.meeting_date), 'PPP')}
            </span>
            {channel && (
              <span className="flex items-center gap-1">
                <Hash className="h-4 w-4" />
                {channel.name}
              </span>
            )}
          </div>

          {meeting.audio_url && (
            <div className="pt-2">
              <audio controls className="w-full max-w-md">
                <source src={meeting.audio_url} type="audio/webm" />
                Your browser does not support the audio element.
              </audio>
            </div>
          )}
        </div>

        {/* Notes Sections */}
        {notes && (
          <div className="space-y-4">
            {/* Summary */}
            {notes.summary && (
              <section className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
                  <FileText className="h-5 w-5 text-teal-400" />
                  Summary
                </h2>
                <p className="text-slate-300 leading-relaxed">{notes.summary}</p>
              </section>
            )}

            {/* Key Points */}
            {notes.key_points && notes.key_points.length > 0 && (
              <section className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
                  <Target className="h-5 w-5 text-teal-400" />
                  Key Points
                </h2>
                <ul className="space-y-2">
                  {notes.key_points.map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Badge className={cn("shrink-0 text-xs", importanceColor(item.importance))}>
                        {item.importance}
                      </Badge>
                      <span className="text-slate-300">{item.point}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Action Items */}
            {notes.action_items && notes.action_items.length > 0 && (
              <section className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
                  <CheckSquare className="h-5 w-5 text-teal-400" />
                  Action Items
                </h2>
                <ul className="space-y-3">
                  {notes.action_items.map((item, index) => (
                    <li key={index} className="flex items-start gap-3 rounded-md bg-slate-700/50 p-3">
                      <div className="h-5 w-5 shrink-0 rounded border border-slate-500" />
                      <div className="flex-1">
                        <p className="text-slate-200">{item.task}</p>
                        <div className="mt-1 flex gap-3 text-xs text-slate-400">
                          {item.owner && <span>@{item.owner}</span>}
                          {item.deadline && <span>Due: {item.deadline}</span>}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Decisions */}
            {notes.decisions && notes.decisions.length > 0 && (
              <section className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
                  <Hammer className="h-5 w-5 text-teal-400" />
                  Decisions
                </h2>
                <ul className="space-y-3">
                  {notes.decisions.map((item, index) => (
                    <li key={index} className="border-l-2 border-teal-500/50 pl-4">
                      <p className="font-medium text-slate-200">{item.decision}</p>
                      {item.context && (
                        <p className="mt-1 text-sm text-slate-400">{item.context}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}

        {/* Transcript */}
        {meeting.transcript && (
          <section className="rounded-lg border border-slate-700 bg-slate-800/50">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <FileText className="h-5 w-5 text-slate-400" />
                Full Transcript
              </h2>
              {showTranscript ? (
                <ChevronUp className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              )}
            </button>
            {showTranscript && (
              <div className="border-t border-slate-700 p-4">
                <pre className="whitespace-pre-wrap font-sans text-sm text-slate-300 leading-relaxed">
                  {meeting.transcript}
                </pre>
              </div>
            )}
          </section>
        )}

        {/* Processing state */}
        {meeting.status === 'processing' && !notes && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Analyzing meeting transcript...</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
