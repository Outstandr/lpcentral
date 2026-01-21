import { useState, useEffect } from 'react';
import { Hash, Lock, Calendar, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Channel, Profile } from '@/types/messenger';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { format } from 'date-fns';

interface ChannelInfoPanelProps {
  channel: Channel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChannelInfoPanel({ channel, open, onOpenChange }: ChannelInfoPanelProps) {
  const [creator, setCreator] = useState<Profile | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchChannelInfo();
    }
  }, [open, channel.id]);

  const fetchChannelInfo = async () => {
    setIsLoading(true);

    // Fetch creator
    if (channel.created_by) {
      const { data: creatorData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', channel.created_by)
        .maybeSingle();

      if (creatorData) {
        setCreator(creatorData as Profile);
      }
    }

    // Fetch members (for private channels)
    if (channel.is_private) {
      const { data: memberData, error } = await supabase
        .from('channel_members')
        .select('user_id')
        .eq('channel_id', channel.id);

      if (!error && memberData) {
        setMemberCount(memberData.length + 1); // +1 for creator

        const userIds = memberData.map(m => m.user_id);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('user_id', userIds);

          if (profiles) {
            setMembers(profiles as Profile[]);
          }
        }
      }
    }

    setIsLoading(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-80 sm:w-96">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {channel.is_private ? (
              <Lock className="h-5 w-5 text-slate-400" />
            ) : (
              <Hash className="h-5 w-5 text-slate-400" />
            )}
            {channel.name}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {/* Channel Description */}
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-1">Description</h4>
              <p className="text-sm text-slate-700">
                {channel.description || 'No description provided'}
              </p>
            </div>

            {/* Channel Type */}
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-1">Type</h4>
              <div className="flex items-center gap-2">
                {channel.is_private ? (
                  <>
                    <Lock className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-700">Private channel</span>
                  </>
                ) : (
                  <>
                    <Hash className="h-4 w-4 text-slate-400" />
                    <span className="text-sm text-slate-700">Public channel</span>
                  </>
                )}
              </div>
            </div>

            {/* Created Info */}
            <div>
              <h4 className="text-sm font-medium text-slate-500 mb-1">Created</h4>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Calendar className="h-4 w-4 text-slate-400" />
                {format(new Date(channel.created_at), 'MMMM d, yyyy')}
              </div>
              {creator && (
                <div className="flex items-center gap-2 text-sm text-slate-700 mt-1">
                  <User className="h-4 w-4 text-slate-400" />
                  by {creator.username}
                </div>
              )}
            </div>

            {/* Members (for private channels) */}
            {channel.is_private && (
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-2">
                  Members ({memberCount})
                </h4>
                <div className="space-y-2">
                  {/* Creator */}
                  {creator && (
                    <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500 text-sm font-medium text-white">
                        {creator.username[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {creator.username}
                        </p>
                        <p className="text-xs text-slate-400">Owner</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Other members */}
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-400 text-sm font-medium text-white">
                        {member.username[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {member.username}
                        </p>
                        <p className="text-xs text-slate-400">Member</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
