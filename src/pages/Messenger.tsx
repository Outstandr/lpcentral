import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ChannelSidebar } from '@/components/messenger/ChannelSidebar';
import { ChatWindow } from '@/components/messenger/ChatWindow';
import { DMChatWindow } from '@/components/messenger/DMChatWindow';
import { MeetingsPanel } from '@/components/meetings/MeetingsPanel';
import { Channel, DMConversation, Profile } from '@/types/messenger';
import { LoadingScreen } from '@/components/ui/loading-screen';
import { useIsMobile } from '@/hooks/use-mobile';

type ChatMode = 'channel' | 'dm' | 'meetings';

export default function Messenger() {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();
  const [chatMode, setChatMode] = useState<ChatMode>('channel');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<DMConversation | null>(null);
  const [selectedDMUser, setSelectedDMUser] = useState<Profile | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [showMobileChat, setShowMobileChat] = useState(false);

  // Handle keyboard visibility on mobile
  useEffect(() => {
    const handleResize = () => {
      // Scroll to bottom when keyboard opens on mobile
      if (window.visualViewport) {
        const viewport = window.visualViewport;
        if (viewport.height < window.innerHeight * 0.8) {
          // Keyboard is likely open
          document.body.style.height = `${viewport.height}px`;
        } else {
          document.body.style.height = '100%';
        }
      }
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    return () => window.visualViewport?.removeEventListener('resize', handleResize);
  }, []);

  if (loading) {
    return <LoadingScreen message="Loading your workspace..." />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleSelectChannel = (channel: Channel) => {
    setChatMode('channel');
    setSelectedChannel(channel);
    setSelectedConversation(null);
    setSelectedDMUser(null);
    if (isMobile) setShowMobileChat(true);
  };

  const handleSelectDM = (conversation: DMConversation, otherUser: Profile) => {
    setChatMode('dm');
    setSelectedConversation(conversation);
    setSelectedDMUser(otherUser);
    setSelectedChannel(null);
    if (isMobile) setShowMobileChat(true);
  };

  const handleSelectMeetings = () => {
    setChatMode('meetings');
    setSelectedChannel(null);
    setSelectedConversation(null);
    setSelectedDMUser(null);
    if (isMobile) setShowMobileChat(true);
  };

  const handleMobileBack = () => {
    setShowMobileChat(false);
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

  // On mobile: show sidebar OR chat, not both
  const showSidebar = !isMobile || !showMobileChat;
  const showChat = !isMobile || showMobileChat;

  return (
    <div className="flex h-full w-full overflow-hidden">
      {showSidebar && (
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
      )}
      {showChat && chatMode === 'channel' && (
        <ChatWindow 
          channel={selectedChannel} 
          onChannelUpdate={handleChannelUpdate}
          onChannelDelete={handleChannelDelete}
          onMobileBack={isMobile ? handleMobileBack : undefined}
        />
      )}
      {showChat && chatMode === 'dm' && (
        <DMChatWindow 
          conversation={selectedConversation} 
          otherUser={selectedDMUser}
          onMobileBack={isMobile ? handleMobileBack : undefined}
        />
      )}
      {showChat && chatMode === 'meetings' && (
        <div className="flex-1 flex flex-col">
          <MeetingsPanel 
            channels={channels} 
            onClose={() => {
              if (isMobile) {
                handleMobileBack();
              } else if (selectedChannel) {
                setChatMode('channel');
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
