import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ChannelSidebar } from '@/components/messenger/ChannelSidebar';
import { ChatWindow } from '@/components/messenger/ChatWindow';
import { Channel } from '@/types/messenger';
import { Loader2 } from 'lucide-react';

export default function Messenger() {
  const { user, loading } = useAuth();
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

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

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <ChannelSidebar
        selectedChannel={selectedChannel}
        onSelectChannel={setSelectedChannel}
      />
      <ChatWindow channel={selectedChannel} />
    </div>
  );
}
