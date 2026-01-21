import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ChannelSidebar } from '@/components/messenger/ChannelSidebar';
import { ChatWindow } from '@/components/messenger/ChatWindow';
import { DMChatWindow } from '@/components/messenger/DMChatWindow';
import { Channel, DMConversation, Profile } from '@/types/messenger';
import { Loader2 } from 'lucide-react';

type ChatMode = 'channel' | 'dm';

export default function Messenger() {
  const { user, loading } = useAuth();
  const [chatMode, setChatMode] = useState<ChatMode>('channel');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<DMConversation | null>(null);
  const [selectedDMUser, setSelectedDMUser] = useState<Profile | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleSelectChannel = (channel: Channel) => {
    setChatMode('channel');
    setSelectedChannel(channel);
    setSelectedConversation(null);
    setSelectedDMUser(null);
  };

  const handleSelectDM = (conversation: DMConversation, otherUser: Profile) => {
    setChatMode('dm');
    setSelectedConversation(conversation);
    setSelectedDMUser(otherUser);
    setSelectedChannel(null);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <ChannelSidebar
        selectedChannel={selectedChannel}
        onSelectChannel={handleSelectChannel}
        selectedConversation={selectedConversation}
        onSelectDM={handleSelectDM}
      />
      {chatMode === 'channel' ? (
        <ChatWindow channel={selectedChannel} />
      ) : (
        <DMChatWindow conversation={selectedConversation} otherUser={selectedDMUser} />
      )}
    </div>
  );
}
