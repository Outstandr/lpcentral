import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, X, FileIcon, Image as ImageIcon, Hash, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Channel, Message, Profile } from '@/types/messenger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ChatHeaderMenu } from './ChatHeaderMenu';
import { ChannelInfoPanel } from './ChannelInfoPanel';
import { MediaPanel } from './MediaPanel';
import { SearchMessagesBar } from './SearchMessagesBar';
import { InviteMembersModal } from './InviteMembersModal';

interface ChatWindowProps {
  channel: Channel | null;
}

export function ChatWindow({ channel }: ChatWindowProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!channel) return;

    fetchMessages();

    // Subscribe to realtime messages
    const subscription = supabase
      .channel(`messages:${channel.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channel.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
          // Fetch profile for the new message if we don't have it
          if (!profiles[newMsg.user_id]) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', newMsg.user_id)
              .maybeSingle();
            if (profile) {
              setProfiles(prev => ({ ...prev, [newMsg.user_id]: profile as Profile }));
            }
          }
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [channel?.id]);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMessages = async () => {
    if (!channel) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channel.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    setMessages(data as Message[]);

    // Fetch all profiles for message authors
    const userIds = [...new Set(data.map((m) => m.user_id))];
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds);

      if (profilesData) {
        const profilesMap: Record<string, Profile> = {};
        profilesData.forEach((p) => {
          profilesMap[p.user_id] = p as Profile;
        });
        setProfiles(profilesMap);
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !channel || (!newMessage.trim() && !selectedFile)) return;

    setIsSending(true);

    let fileUrl = null;
    let fileName = null;
    let fileType = null;

    // Upload file if selected
    if (selectedFile) {
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(filePath, selectedFile);

      if (uploadError) {
        toast({
          title: "File upload failed",
          description: uploadError.message,
          variant: "destructive"
        });
        setIsSending(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('chat-files')
        .getPublicUrl(uploadData.path);

      fileUrl = urlData.publicUrl;
      fileName = selectedFile.name;
      fileType = selectedFile.type;
    }

    // Send message
    const { error } = await supabase.from('messages').insert({
      channel_id: channel.id,
      user_id: user.id,
      content: newMessage.trim() || null,
      file_url: fileUrl,
      file_name: fileName,
      file_type: fileType,
    });

    setIsSending(false);

    if (error) {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive"
      });
    } else {
      setNewMessage('');
      setSelectedFile(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 10MB",
          variant: "destructive"
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const isImageFile = (type: string | null) => {
    return type?.startsWith('image/');
  };

  const scrollToMessage = (messageId: string) => {
    setHighlightedMessageId(messageId);
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  };

  if (!channel) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-200">
            <Hash className="h-8 w-8 text-slate-400" />
          </div>
          <p className="text-lg font-medium text-slate-600">Select a channel</p>
          <p className="text-sm text-slate-400">Choose a channel from the sidebar to start chatting</p>
        </div>
      </div>
    );
  }

  const isOwner = channel.created_by === user?.id;

  return (
    <div className="relative flex flex-1 flex-col bg-white">
      {/* Channel Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/10">
            {channel.is_private ? (
              <Lock className="h-5 w-5 text-teal-600" />
            ) : (
              <Hash className="h-5 w-5 text-teal-600" />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">{channel.name}</h2>
            {channel.description && (
              <p className="text-xs text-slate-500 truncate max-w-xs">{channel.description}</p>
            )}
          </div>
        </div>
        <ChatHeaderMenu
          channel={channel}
          onShowInfo={() => setShowInfo(true)}
          onShowMedia={() => setShowMedia(true)}
          onSearchMessages={() => setShowSearch(true)}
          onInviteMembers={isOwner && channel.is_private ? () => setShowInvite(true) : undefined}
          isOwner={isOwner}
        />
      </div>

      {/* Search Bar */}
      <SearchMessagesBar
        channel={channel}
        open={showSearch}
        onClose={() => setShowSearch(false)}
        onResultClick={scrollToMessage}
      />

      {/* Messages */}
      <ScrollArea className="flex-1 p-6" ref={scrollRef}>
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/10">
                {channel.is_private ? (
                  <Lock className="h-6 w-6 text-teal-500" />
                ) : (
                  <Hash className="h-6 w-6 text-teal-500" />
                )}
              </div>
              <p className="text-sm font-medium">Welcome to #{channel.name}</p>
              <p className="text-xs">This is the start of the channel. Say hello!</p>
            </div>
          )}
          {messages.map((message, index) => {
            const profile = profiles[message.user_id];
            const showHeader = index === 0 || messages[index - 1].user_id !== message.user_id;
            const isOwn = message.user_id === user?.id;
            const isHighlighted = highlightedMessageId === message.id;

            return (
              <div 
                key={message.id} 
                id={`message-${message.id}`}
                className={cn(
                  "group rounded-lg px-2 py-1 -mx-2 transition-colors duration-300",
                  !showHeader && "mt-1",
                  isHighlighted && "bg-yellow-100"
                )}
              >
                {showHeader && (
                  <div className="mb-1 flex items-center gap-2">
                    <div className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium text-white shadow-sm",
                      isOwn ? "bg-gradient-to-br from-teal-400 to-teal-600" : "bg-gradient-to-br from-slate-400 to-slate-500"
                    )}>
                      {profile?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="font-semibold text-slate-900">
                      {profile?.username || 'Unknown'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {format(new Date(message.created_at), 'h:mm a')}
                    </span>
                  </div>
                )}
                <div className={cn("ml-11", !showHeader && "")}>
                  {message.content && (
                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  )}
                  {message.file_url && (
                    <div className="mt-2">
                      {isImageFile(message.file_type) ? (
                        <a href={message.file_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={message.file_url}
                            alt={message.file_name || 'Uploaded image'}
                            className="max-w-sm rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                          />
                        </a>
                      ) : (
                        <a
                          href={message.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          <FileIcon className="h-4 w-4 text-slate-400" />
                          {message.file_name || 'Download file'}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="border-t border-slate-200 p-4">
        {selectedFile && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
            {selectedFile.type.startsWith('image/') ? (
              <ImageIcon className="h-4 w-4 text-slate-500" />
            ) : (
              <FileIcon className="h-4 w-4 text-slate-500" />
            )}
            <span className="flex-1 truncate text-sm text-slate-600">{selectedFile.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setSelectedFile(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.txt,.zip"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-slate-500 hover:text-slate-700"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message #${channel.name}`}
            className="flex-1 border-slate-200 bg-slate-50"
            disabled={isSending}
          />
          <Button
            type="submit"
            size="icon"
            className="shrink-0 bg-teal-500 hover:bg-teal-600"
            disabled={isSending || (!newMessage.trim() && !selectedFile)}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Panels */}
      <ChannelInfoPanel
        channel={channel}
        open={showInfo}
        onOpenChange={setShowInfo}
      />
      <MediaPanel
        channel={channel}
        open={showMedia}
        onOpenChange={setShowMedia}
      />
      {channel.is_private && isOwner && (
        <InviteMembersModal
          channel={channel}
          open={showInvite}
          onOpenChange={setShowInvite}
        />
      )}
    </div>
  );
}
