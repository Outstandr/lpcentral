import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UnreadCount {
  channelId: string;
  count: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageSender: string | null;
}

interface DMUnreadCount {
  conversationId: string;
  count: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastMessageSender: string | null;
}

interface UseUnreadStatusReturn {
  channelUnreads: Map<string, UnreadCount>;
  dmUnreads: Map<string, DMUnreadCount>;
  markChannelAsRead: (channelId: string) => Promise<void>;
  markDMAsRead: (conversationId: string) => Promise<void>;
  totalUnreadChannels: number;
  totalUnreadDMs: number;
}

export function useUnreadStatus(): UseUnreadStatusReturn {
  const { user } = useAuth();
  const [channelUnreads, setChannelUnreads] = useState<Map<string, UnreadCount>>(new Map());
  const [dmUnreads, setDMUnreads] = useState<Map<string, DMUnreadCount>>(new Map());

  // Fetch channel unread counts
  const fetchChannelUnreads = useCallback(async () => {
    if (!user) return;

    // Get all channels the user can access
    const { data: channels } = await supabase
      .from('channels')
      .select('id');

    if (!channels) return;

    // Get user's read status for each channel
    const { data: readStatuses } = await supabase
      .from('channel_read_status')
      .select('channel_id, last_read_at')
      .eq('user_id', user.id);

    const readStatusMap = new Map<string, string>();
    readStatuses?.forEach(rs => {
      readStatusMap.set(rs.channel_id, rs.last_read_at);
    });

    // For each channel, count unread messages and get last message
    const unreadsMap = new Map<string, UnreadCount>();

    for (const channel of channels) {
      const lastReadAt = readStatusMap.get(channel.id) || '1970-01-01T00:00:00Z';

      // Count unread messages
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('channel_id', channel.id)
        .gt('created_at', lastReadAt)
        .neq('user_id', user.id);

      // Get last message for preview
      const { data: lastMessage } = await supabase
        .from('messages')
        .select('content, created_at, user_id')
        .eq('channel_id', channel.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let senderName = null;
      if (lastMessage?.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('user_id', lastMessage.user_id)
          .maybeSingle();
        senderName = profile?.username || null;
      }

      unreadsMap.set(channel.id, {
        channelId: channel.id,
        count: count || 0,
        lastMessageAt: lastMessage?.created_at || null,
        lastMessagePreview: lastMessage?.content?.substring(0, 50) || null,
        lastMessageSender: senderName,
      });
    }

    setChannelUnreads(unreadsMap);
  }, [user]);

  // Fetch DM unread counts
  const fetchDMUnreads = useCallback(async () => {
    if (!user) return;

    // Get all DM conversations
    const { data: conversations } = await supabase
      .from('dm_conversations')
      .select('id')
      .or(`participant_one.eq.${user.id},participant_two.eq.${user.id}`);

    if (!conversations) return;

    // Get user's read status for each DM
    const { data: readStatuses } = await supabase
      .from('dm_read_status')
      .select('conversation_id, last_read_at')
      .eq('user_id', user.id);

    const readStatusMap = new Map<string, string>();
    readStatuses?.forEach(rs => {
      readStatusMap.set(rs.conversation_id, rs.last_read_at);
    });

    const unreadsMap = new Map<string, DMUnreadCount>();

    for (const conv of conversations) {
      const lastReadAt = readStatusMap.get(conv.id) || '1970-01-01T00:00:00Z';

      // Count unread messages
      const { count } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .gt('created_at', lastReadAt)
        .neq('sender_id', user.id);

      // Get last message for preview
      const { data: lastMessage } = await supabase
        .from('direct_messages')
        .select('content, created_at, sender_id')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let senderName = null;
      if (lastMessage?.sender_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('user_id', lastMessage.sender_id)
          .maybeSingle();
        senderName = profile?.username || null;
      }

      unreadsMap.set(conv.id, {
        conversationId: conv.id,
        count: count || 0,
        lastMessageAt: lastMessage?.created_at || null,
        lastMessagePreview: lastMessage?.content?.substring(0, 50) || null,
        lastMessageSender: senderName,
      });
    }

    setDMUnreads(unreadsMap);
  }, [user]);

  // Mark channel as read
  const markChannelAsRead = useCallback(async (channelId: string) => {
    if (!user) return;

    await supabase
      .from('channel_read_status')
      .upsert({
        user_id: user.id,
        channel_id: channelId,
        last_read_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,channel_id',
      });

    // Update local state
    setChannelUnreads(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(channelId);
      if (existing) {
        newMap.set(channelId, { ...existing, count: 0 });
      }
      return newMap;
    });
  }, [user]);

  // Mark DM as read
  const markDMAsRead = useCallback(async (conversationId: string) => {
    if (!user) return;

    await supabase
      .from('dm_read_status')
      .upsert({
        user_id: user.id,
        conversation_id: conversationId,
        last_read_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,conversation_id',
      });

    // Update local state
    setDMUnreads(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(conversationId);
      if (existing) {
        newMap.set(conversationId, { ...existing, count: 0 });
      }
      return newMap;
    });
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchChannelUnreads();
    fetchDMUnreads();
  }, [fetchChannelUnreads, fetchDMUnreads]);

  // Subscribe to new messages to update unreads in real-time
  useEffect(() => {
    if (!user) return;

    const channelSub = supabase
      .channel('unread-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, () => {
        fetchChannelUnreads();
      })
      .subscribe();

    const dmSub = supabase
      .channel('unread-dms')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
      }, () => {
        fetchDMUnreads();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelSub);
      supabase.removeChannel(dmSub);
    };
  }, [user, fetchChannelUnreads, fetchDMUnreads]);

  const totalUnreadChannels = Array.from(channelUnreads.values()).filter(u => u.count > 0).length;
  const totalUnreadDMs = Array.from(dmUnreads.values()).filter(u => u.count > 0).length;

  return {
    channelUnreads,
    dmUnreads,
    markChannelAsRead,
    markDMAsRead,
    totalUnreadChannels,
    totalUnreadDMs,
  };
}
