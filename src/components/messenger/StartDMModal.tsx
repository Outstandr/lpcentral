import { useState, useEffect } from 'react';
import { MessageCircle, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Profile, DMConversation } from '@/types/messenger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface StartDMModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartConversation: (conversation: DMConversation, otherUser: Profile) => void;
}

export function StartDMModal({ open, onOpenChange, onStartConversation }: StartDMModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [startingDM, setStartingDM] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchProfiles();
    }
  }, [open]);

  const fetchProfiles = async () => {
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('username');

    if (error) {
      console.error('Error fetching profiles:', error);
    } else {
      // Filter out current user
      setProfiles((data as Profile[]).filter(p => p.user_id !== user?.id));
    }
    setIsLoading(false);
  };

  const handleStartDM = async (otherProfile: Profile) => {
    if (!user) return;
    
    setStartingDM(otherProfile.user_id);

    // Check if conversation already exists
    const { data: existing } = await supabase
      .from('dm_conversations')
      .select('*')
      .or(`and(participant_one.eq.${user.id},participant_two.eq.${otherProfile.user_id}),and(participant_one.eq.${otherProfile.user_id},participant_two.eq.${user.id})`)
      .maybeSingle();

    if (existing) {
      setStartingDM(null);
      onStartConversation(existing as DMConversation, otherProfile);
      onOpenChange(false);
      return;
    }

    // Create new conversation
    const { data, error } = await supabase
      .from('dm_conversations')
      .insert({
        participant_one: user.id,
        participant_two: otherProfile.user_id,
      })
      .select()
      .single();

    setStartingDM(null);

    if (error) {
      toast({
        title: "Failed to start conversation",
        description: error.message,
        variant: "destructive"
      });
    } else {
      onStartConversation(data as DMConversation, otherProfile);
      onOpenChange(false);
    }
  };

  const filteredProfiles = profiles.filter(profile => {
    if (!searchQuery.trim()) return true;
    return profile.username.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-slate-700 bg-slate-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-teal-400" />
            Start a conversation
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-slate-600 bg-slate-700 pl-9 text-white placeholder:text-slate-400"
          />
        </div>

        <ScrollArea className="max-h-64">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
            </div>
          ) : filteredProfiles.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              {searchQuery ? 'No users found' : 'No users available'}
            </p>
          ) : (
            <div className="space-y-1">
              {filteredProfiles.map((profile) => {
                const isProcessing = startingDM === profile.user_id;

                return (
                  <button
                    key={profile.id}
                    onClick={() => handleStartDM(profile)}
                    disabled={isProcessing}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/20 text-sm font-medium text-teal-400">
                        {profile.username[0]?.toUpperCase() || '?'}
                      </div>
                      <span className="text-sm font-medium">{profile.username}</span>
                    </div>
                    
                    {isProcessing && (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
