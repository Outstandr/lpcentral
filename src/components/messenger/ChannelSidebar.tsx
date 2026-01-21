import { useState, useEffect } from 'react';
import { Hash, Plus, LogOut, User, Lock, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Channel, Profile } from '@/types/messenger';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { InviteMembersModal } from './InviteMembersModal';

interface ChannelSidebarProps {
  selectedChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
}

export function ChannelSidebar({ selectedChannel, onSelectChannel }: ChannelSidebarProps) {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newChannel, setNewChannel] = useState({ name: '', description: '', isPrivate: false });
  const [isCreating, setIsCreating] = useState(false);
  const [inviteChannel, setInviteChannel] = useState<Channel | null>(null);

  useEffect(() => {
    fetchChannels();
    fetchProfile();
  }, [user]);

  const fetchChannels = async () => {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching channels:', error);
    } else {
      setChannels(data as Channel[]);
      if (data.length > 0 && !selectedChannel) {
        onSelectChannel(data[0] as Channel);
      }
    }
  };

  const fetchProfile = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      setProfile(data as Profile);
    }
  };

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newChannel.name.trim()) return;

    setIsCreating(true);
    const { data, error } = await supabase
      .from('channels')
      .insert({
        name: newChannel.name.toLowerCase().replace(/\s+/g, '-'),
        description: newChannel.description || null,
        created_by: user.id,
        is_private: newChannel.isPrivate,
      })
      .select()
      .single();

    if (error) {
      setIsCreating(false);
      toast({
        title: "Failed to create channel",
        description: error.message,
        variant: "destructive"
      });
      return;
    }

    // If private, auto-add creator as member
    if (newChannel.isPrivate) {
      await supabase.from('channel_members').insert({
        channel_id: data.id,
        user_id: user.id,
      });
    }

    setIsCreating(false);
    setChannels([...channels, data as Channel]);
    setNewChannel({ name: '', description: '', isPrivate: false });
    setIsCreateOpen(false);
    onSelectChannel(data as Channel);
    toast({
      title: "Channel created!",
      description: `#${data.name} is ready to use.`
    });
  };

  return (
    <div className="flex h-full w-64 flex-col bg-slate-900 text-white">
      {/* Workspace Header */}
      <div className="flex h-14 items-center border-b border-slate-700 px-4">
        <h1 className="text-lg font-semibold text-white">Team Messenger</h1>
      </div>

      {/* Channels List */}
      <ScrollArea className="flex-1 px-2 py-4">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-xs font-semibold uppercase text-slate-400">Channels</span>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-400 hover:text-white">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="border-slate-700 bg-slate-800 text-white">
              <DialogHeader>
                <DialogTitle>Create a channel</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateChannel} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="channel-name" className="text-slate-300">Name</Label>
                  <Input
                    id="channel-name"
                    placeholder="e.g. marketing"
                    value={newChannel.name}
                    onChange={(e) => setNewChannel({ ...newChannel, name: e.target.value })}
                    className="border-slate-600 bg-slate-700 text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channel-desc" className="text-slate-300">Description (optional)</Label>
                  <Textarea
                    id="channel-desc"
                    placeholder="What's this channel about?"
                    value={newChannel.description}
                    onChange={(e) => setNewChannel({ ...newChannel, description: e.target.value })}
                  className="border-slate-600 bg-slate-700 text-white"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-600 bg-slate-700 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-slate-400" />
                    <Label htmlFor="is-private" className="text-sm text-slate-300">Private channel</Label>
                  </div>
                  <Switch
                    id="is-private"
                    checked={newChannel.isPrivate}
                    onCheckedChange={(checked) => setNewChannel({ ...newChannel, isPrivate: checked })}
                  />
                </div>
                {newChannel.isPrivate && (
                  <p className="text-xs text-slate-400">
                    Only invited members will be able to see this channel.
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full bg-teal-500 hover:bg-teal-600"
                  disabled={isCreating}
                >
                  Create Channel
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-0.5">
          {channels.map((channel) => (
            <div key={channel.id} className="group flex items-center">
              <button
                onClick={() => onSelectChannel(channel)}
                className={cn(
                  "flex flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors",
                  selectedChannel?.id === channel.id
                    ? "bg-teal-500/20 text-teal-300"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                )}
              >
                {channel.is_private ? (
                  <Lock className="h-4 w-4 shrink-0" />
                ) : (
                  <Hash className="h-4 w-4 shrink-0" />
                )}
                <span className="truncate">{channel.name}</span>
              </button>
              {channel.is_private && channel.created_by === user?.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInviteChannel(channel);
                  }}
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white"
                >
                  <UserPlus className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* User Footer */}
      <div className="border-t border-slate-700 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/20">
            <User className="h-4 w-4 text-teal-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-white">
              {profile?.username || user?.email?.split('@')[0]}
            </p>
            <p className="truncate text-xs text-slate-400">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="h-8 w-8 text-slate-400 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Invite Members Modal */}
      {inviteChannel && (
        <InviteMembersModal
          channel={inviteChannel}
          open={!!inviteChannel}
          onOpenChange={(open) => !open && setInviteChannel(null)}
        />
      )}
    </div>
  );
}
