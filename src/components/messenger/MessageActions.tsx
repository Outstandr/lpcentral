import { useState, useEffect } from 'react';
import { 
  Smile, 
  StickyNote, 
  Shield, 
  Check, 
  X, 
  MessageSquare,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { Message, Profile } from '@/types/messenger';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const EMOJI_OPTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👀'];

interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

interface MessageNote {
  id: string;
  message_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

interface MessageModeration {
  id: string;
  message_id: string;
  moderator_id: string;
  status: 'approved' | 'rejected' | 'pending';
  feedback: string | null;
}

interface MessageActionsProps {
  message: Message;
  profiles: Record<string, Profile>;
}

export function MessageActions({ message, profiles }: MessageActionsProps) {
  const { user } = useAuth();
  const { isModerator } = useUserRole();
  const { toast } = useToast();
  
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [notes, setNotes] = useState<MessageNote[]>([]);
  const [moderation, setModeration] = useState<MessageModeration | null>(null);
  
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showModerateDialog, setShowModerateDialog] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [moderationFeedback, setModerationFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchReactions();
    fetchNotes();
    fetchModeration();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`message-actions-${message.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions', filter: `message_id=eq.${message.id}` }, () => fetchReactions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_notes', filter: `message_id=eq.${message.id}` }, () => fetchNotes())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_moderation', filter: `message_id=eq.${message.id}` }, () => fetchModeration())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [message.id]);

  const fetchReactions = async () => {
    const { data } = await supabase
      .from('message_reactions')
      .select('*')
      .eq('message_id', message.id);
    if (data) setReactions(data);
  };

  const fetchNotes = async () => {
    const { data } = await supabase
      .from('message_notes')
      .select('*')
      .eq('message_id', message.id)
      .order('created_at', { ascending: true });
    if (data) setNotes(data);
  };

  const fetchModeration = async () => {
    const { data } = await supabase
      .from('message_moderation')
      .select('*')
      .eq('message_id', message.id)
      .maybeSingle();
    if (data) setModeration(data as MessageModeration);
  };

  const handleReaction = async (emoji: string) => {
    if (!user) return;

    const existing = reactions.find(r => r.user_id === user.id && r.emoji === emoji);
    
    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('message_reactions').insert({
        message_id: message.id,
        user_id: user.id,
        emoji,
      });
    }
  };

  const handleAddNote = async () => {
    if (!user || !noteContent.trim()) return;

    setIsSubmitting(true);
    const { error } = await supabase.from('message_notes').insert({
      message_id: message.id,
      user_id: user.id,
      content: noteContent.trim(),
    });

    setIsSubmitting(false);
    if (error) {
      toast({ title: 'Failed to add note', variant: 'destructive' });
    } else {
      setNoteContent('');
      setShowNoteDialog(false);
      toast({ title: 'Note added' });
    }
  };

  const handleModerate = async (status: 'approved' | 'rejected') => {
    if (!user) return;

    setIsSubmitting(true);
    
    if (moderation) {
      await supabase.from('message_moderation')
        .update({ 
          status, 
          feedback: status === 'rejected' ? moderationFeedback : null,
          moderator_id: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', moderation.id);
    } else {
      await supabase.from('message_moderation').insert({
        message_id: message.id,
        moderator_id: user.id,
        status,
        feedback: status === 'rejected' ? moderationFeedback : null,
      });
    }

    setIsSubmitting(false);
    setShowModerateDialog(false);
    setModerationFeedback('');
    toast({ 
      title: status === 'approved' ? 'Message approved' : 'Message rejected',
      description: status === 'rejected' ? 'Feedback sent to user' : undefined
    });
  };

  // Group reactions by emoji
  const reactionGroups = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = [];
    acc[r.emoji].push(r.user_id);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="mt-2 space-y-2">
      {/* Moderation Status Banner */}
      {moderation && moderation.status === 'rejected' && (
        <div className="flex items-start gap-2 rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
          <div>
            <span className="font-medium text-red-400">Content requires changes</span>
            {moderation.feedback && (
              <p className="text-red-300/80 mt-1">{moderation.feedback}</p>
            )}
          </div>
        </div>
      )}

      {moderation && moderation.status === 'approved' && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
          <Check className="h-3 w-3" />
          <span>Approved</span>
        </div>
      )}

      {/* Reactions Display */}
      {Object.keys(reactionGroups).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(reactionGroups).map(([emoji, userIds]) => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm transition-colors",
                userIds.includes(user?.id || '')
                  ? "border-teal-500/50 bg-teal-500/10 text-teal-300"
                  : "border-slate-300 bg-slate-100 hover:bg-slate-200"
              )}
            >
              <span>{emoji}</span>
              <span className="text-xs font-medium">{userIds.length}</span>
            </button>
          ))}
        </div>
      )}

      {/* Notes Display */}
      {notes.length > 0 && (
        <div className="space-y-1">
          {notes.map((note) => (
            <div 
              key={note.id} 
              className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm"
            >
              <StickyNote className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-amber-700">
                    {profiles[note.user_id]?.username || 'User'}
                  </span>
                </div>
                <p className="text-amber-800 whitespace-pre-wrap">{note.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Emoji Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600">
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="flex gap-1">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className="p-1.5 text-lg hover:bg-slate-100 rounded transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Add Note */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7 text-slate-400 hover:text-slate-600"
          onClick={() => setShowNoteDialog(true)}
        >
          <StickyNote className="h-4 w-4" />
        </Button>

        {/* Moderate (Admin/Moderator only) */}
        {isModerator && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-slate-400 hover:text-slate-600"
            onClick={() => setShowModerateDialog(true)}
          >
            <Shield className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Add Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent className="border-slate-700 bg-slate-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-amber-400" />
              Add Note
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Add a note to this message..."
              className="border-slate-600 bg-slate-700 text-white min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNoteDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddNote} 
              disabled={isSubmitting || !noteContent.trim()}
              className="bg-teal-500 hover:bg-teal-600"
            >
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Moderate Dialog */}
      <Dialog open={showModerateDialog} onOpenChange={setShowModerateDialog}>
        <DialogContent className="border-slate-700 bg-slate-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-teal-400" />
              Moderate Message
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-600 bg-slate-700 p-3">
              <p className="text-sm text-slate-300">{message.content || '(File attachment)'}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-300">Feedback for rejection (optional)</label>
              <Textarea
                value={moderationFeedback}
                onChange={(e) => setModerationFeedback(e.target.value)}
                placeholder="Explain what needs to be changed..."
                className="border-slate-600 bg-slate-700 text-white"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button 
              variant="ghost" 
              onClick={() => setShowModerateDialog(false)}
              className="text-slate-300"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => handleModerate('rejected')} 
              disabled={isSubmitting}
              variant="destructive"
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Reject
            </Button>
            <Button 
              onClick={() => handleModerate('approved')} 
              disabled={isSubmitting}
              className="bg-emerald-500 hover:bg-emerald-600 gap-2"
            >
              <Check className="h-4 w-4" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
