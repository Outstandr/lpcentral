import { useState, useEffect } from 'react';
import { UserPlus, X, Check, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Channel, Profile } from '@/types/messenger';
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
import { cn } from '@/lib/utils';

interface InviteMembersModalProps {
  channel: Channel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteMembersModal({ channel, open, onOpenChange }: InviteMembersModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchProfilesAndMembers();
    }
  }, [open, channel.id]);

  const fetchProfilesAndMembers = async () => {
    setIsLoading(true);
    
    // Fetch all profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('username');

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      setIsLoading(false);
      return;
    }

    // Fetch current channel members
    const { data: membersData, error: membersError } = await supabase
      .from('channel_members')
      .select('user_id')
      .eq('channel_id', channel.id);

    if (membersError) {
      console.error('Error fetching members:', membersError);
    }

    setProfiles(profilesData as Profile[]);
    setMemberIds(new Set(membersData?.map(m => m.user_id) || []));
    setIsLoading(false);
  };

  const handleInvite = async (profileUserId: string) => {
    if (!user) return;
    
    setAddingUserId(profileUserId);

    const { error } = await supabase
      .from('channel_members')
      .insert({
        channel_id: channel.id,
        user_id: profileUserId,
      });

    setAddingUserId(null);

    if (error) {
      toast({
        title: "Failed to invite user",
        description: error.message,
        variant: "destructive"
      });
    } else {
      setMemberIds(prev => new Set([...prev, profileUserId]));
      toast({
        title: "User invited!",
        description: "They can now see this channel."
      });
    }
  };

  const handleRemove = async (profileUserId: string) => {
    if (!user) return;
    
    setAddingUserId(profileUserId);

    const { error } = await supabase
      .from('channel_members')
      .delete()
      .eq('channel_id', channel.id)
      .eq('user_id', profileUserId);

    setAddingUserId(null);

    if (error) {
      toast({
        title: "Failed to remove user",
        description: error.message,
        variant: "destructive"
      });
    } else {
      setMemberIds(prev => {
        const next = new Set(prev);
        next.delete(profileUserId);
        return next;
      });
      toast({
        title: "User removed",
        description: "They can no longer see this channel."
      });
    }
  };

  const filteredProfiles = profiles.filter(profile => {
    // Don't show the channel creator (they always have access)
    if (profile.user_id === channel.created_by) return false;
    
    if (!searchQuery.trim()) return true;
    return profile.username.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-slate-700 bg-slate-800 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-teal-400" />
            Invite to #{channel.name}
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
              {searchQuery ? 'No users found' : 'No users to invite'}
            </p>
          ) : (
            <div className="space-y-1">
              {filteredProfiles.map((profile) => {
                const isMember = memberIds.has(profile.user_id);
                const isProcessing = addingUserId === profile.user_id;

                return (
                  <div
                    key={profile.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-700/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/20 text-sm font-medium text-teal-400">
                        {profile.username[0]?.toUpperCase() || '?'}
                      </div>
                      <span className="text-sm font-medium">{profile.username}</span>
                    </div>
                    
                    {isMember ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(profile.user_id)}
                        disabled={isProcessing}
                        className="h-8 gap-1 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                      >
                        {isProcessing ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <>
                            <X className="h-3 w-3" />
                            Remove
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleInvite(profile.user_id)}
                        disabled={isProcessing}
                        className="h-8 gap-1 text-teal-400 hover:bg-teal-500/20 hover:text-teal-300"
                      >
                        {isProcessing ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <>
                            <UserPlus className="h-3 w-3" />
                            Invite
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
