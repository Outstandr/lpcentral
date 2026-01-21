import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ChannelSidebar } from '@/components/messenger/ChannelSidebar';
import { ChatWindow } from '@/components/messenger/ChatWindow';
import { DMChatWindow } from '@/components/messenger/DMChatWindow';
import { MeetingsPanel } from '@/components/meetings/MeetingsPanel';
import { Channel, DMConversation, Profile } from '@/types/messenger';
import { Loader2 } from 'lucide-react';

type ChatMode = 'channel' | 'dm' | 'meetings';

export default function Messenger() {
  const { user, loading } = useAuth();
  const [chatMode, setChatMode] = useState<ChatMode>('channel');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<DMConversation | null>(null);
  const [selectedDMUser, setSelectedDMUser] = useState<Profile | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [channels, setChannels] = useState<Channel[]>([]);

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

  const handleSelectMeetings = () => {
    setChatMode('meetings');
    setSelectedChannel(null);
    setSelectedConversation(null);
    setSelectedDMUser(null);
  };

  const handleChannelUpdate = (updatedChannel: Channel) => {
    setSelectedChannel(updatedChannel);
    setRefreshKey(prev => prev + 1);
  };

  const handleChannelDelete = () => {
    setSelectedChannel(null);
    setRefreshKey(prev => prev + 1);
  };

  const handleChannelsLoaded = (loadedChannels: Channel[]) => {
    setChannels(loadedChannels);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <ChannelSidebar
        key={refreshKey}
        selectedChannel={selectedChannel}
        onSelectChannel={handleSelectChannel}
        selectedConversation={selectedConversation}
        onSelectDM={handleSelectDM}
        onSelectMeetings={handleSelectMeetings}
        isMeetingsActive={chatMode === 'meetings'}
        onChannelsLoaded={handleChannelsLoaded}
      />
      {chatMode === 'channel' && (
        <ChatWindow 
          channel={selectedChannel} 
          onChannelUpdate={handleChannelUpdate}
          onChannelDelete={handleChannelDelete}
        />
      )}
      {chatMode === 'dm' && (
        <DMChatWindow conversation={selectedConversation} otherUser={selectedDMUser} />
      )}
      {chatMode === 'meetings' && (
        <div className="flex-1">
          <MeetingsPanel 
            channels={channels} 
            onClose={() => {
              if (selectedChannel) {
                setChatMode('channel');
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
