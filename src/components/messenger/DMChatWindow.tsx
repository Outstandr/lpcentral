import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, X, FileIcon, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DMConversation, DirectMessage, Profile } from '@/types/messenger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DMChatWindowProps {
  conversation: DMConversation | null;
  otherUser: Profile | null;
  onMobileBack?: () => void;
}

export function DMChatWindow({ conversation, otherUser, onMobileBack }: DMChatWindowProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!conversation) return;

    fetchMessages();

    // Subscribe to realtime messages
    const subscription = supabase
      .channel(`dm:${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as DirectMessage;
          if (!profiles[newMsg.sender_id]) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', newMsg.sender_id)
              .maybeSingle();
            if (profile) {
              setProfiles(prev => ({ ...prev, [newMsg.sender_id]: profile as Profile }));
            }
          }
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [conversation?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMessages = async () => {
    if (!conversation) return;

    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching DMs:', error);
      return;
    }

    setMessages(data as DirectMessage[]);

    const userIds = [...new Set(data.map((m) => m.sender_id))];
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
    if (!user || !conversation || (!newMessage.trim() && !selectedFile)) return;

    setIsSending(true);

    let fileUrl = null;
    let fileName = null;
    let fileType = null;

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

    const { error } = await supabase.from('direct_messages').insert({
      conversation_id: conversation.id,
      sender_id: user.id,
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

  if (!conversation || !otherUser) {
    return (
      <div className="flex flex-1 w-full items-center justify-center bg-slate-50">
        <p className="text-slate-400">Select a conversation to start chatting</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 w-full flex-col bg-white">
      {/* DM Header */}
      <div className="flex h-14 items-center border-b border-slate-200 px-4 md:px-6">
        <div className="flex items-center gap-2 md:gap-3">
          {onMobileBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMobileBack}
              className="h-8 w-8 text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500/20 text-sm font-medium text-teal-600">
            {otherUser.username[0]?.toUpperCase() || '?'}
          </div>
          <h2 className="font-semibold text-slate-900">{otherUser.username}</h2>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-6" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((message, index) => {
            const profile = profiles[message.sender_id];
            const showHeader = index === 0 || messages[index - 1].sender_id !== message.sender_id;
            const isOwn = message.sender_id === user?.id;

            return (
              <div key={message.id} className={cn("group", !showHeader && "mt-1")}>
                {showHeader && (
                  <div className="mb-1 flex items-center gap-2">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium text-white",
                      isOwn ? "bg-teal-500" : "bg-slate-400"
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
                <div className={cn("ml-10", !showHeader && "")}>
                  {message.content && (
                    <p className="text-slate-700 whitespace-pre-wrap">{message.content}</p>
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
            placeholder={`Message ${otherUser.username}`}
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
    </div>
  );
}
