import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TypingUser {
  userId: string;
  username: string;
  startedAt: string;
}

interface UseTypingIndicatorReturn {
  typingUsers: TypingUser[];
  startTyping: () => void;
  stopTyping: () => void;
}

const TYPING_TIMEOUT = 3000; // 3 seconds after last keystroke

export function useTypingIndicator(
  channelId?: string,
  conversationId?: string
): UseTypingIndicatorReturn {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Clean up old typing indicators
  const cleanupTyping = useCallback(async () => {
    if (!user) return;

    try {
      // Delete my typing indicator
      if (channelId) {
        await supabase
          .from('typing_indicators')
          .delete()
          .eq('user_id', user.id)
          .eq('channel_id', channelId);
      } else if (conversationId) {
        await supabase
          .from('typing_indicators')
          .delete()
          .eq('user_id', user.id)
          .eq('conversation_id', conversationId);
      }
    } catch (error) {
      console.error('Failed to cleanup typing indicator:', error);
    }
  }, [user, channelId, conversationId]);

  // Start typing indicator
  const startTyping = useCallback(async () => {
    if (!user || (!channelId && !conversationId)) return;

    // Don't re-insert if already typing
    if (isTypingRef.current) {
      // Just reset the timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, TYPING_TIMEOUT);
      return;
    }

    isTypingRef.current = true;

    try {
      // Clean up any existing indicators first
      await cleanupTyping();

      // Insert new typing indicator
      await supabase.from('typing_indicators').insert({
        user_id: user.id,
        channel_id: channelId || null,
        conversation_id: conversationId || null,
      });

      // Auto-stop after timeout
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, TYPING_TIMEOUT);
    } catch (error) {
      console.error('Failed to start typing indicator:', error);
    }
  }, [user, channelId, conversationId, cleanupTyping]);

  // Stop typing indicator
  const stopTyping = useCallback(async () => {
    if (!user) return;

    isTypingRef.current = false;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    await cleanupTyping();
  }, [user, cleanupTyping]);

  // Fetch typing users
  const fetchTypingUsers = useCallback(async () => {
    if (!user || (!channelId && !conversationId)) return;

    try {
      let query = supabase
        .from('typing_indicators')
        .select('user_id, started_at')
        .neq('user_id', user.id);

      if (channelId) {
        query = query.eq('channel_id', channelId);
      } else if (conversationId) {
        query = query.eq('conversation_id', conversationId);
      }

      // Only get recent typing (within last 5 seconds)
      const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();
      query = query.gt('started_at', fiveSecondsAgo);

      const { data } = await query;

      if (data && data.length > 0) {
        // Fetch usernames for typing users
        const userIds = data.map(t => t.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, username')
          .in('user_id', userIds);

        const profileMap = new Map<string, string>();
        profiles?.forEach(p => {
          profileMap.set(p.user_id, p.username);
        });

        const typingList: TypingUser[] = data.map(t => ({
          userId: t.user_id,
          username: profileMap.get(t.user_id) || 'Someone',
          startedAt: t.started_at,
        }));

        setTypingUsers(typingList);
      } else {
        setTypingUsers([]);
      }
    } catch (error) {
      console.error('Failed to fetch typing users:', error);
    }
  }, [user, channelId, conversationId]);

  // Subscribe to typing changes
  useEffect(() => {
    if (!user || (!channelId && !conversationId)) return;

    // Initial fetch
    fetchTypingUsers();

    // Subscribe to changes
    const channel = supabase
      .channel(`typing-${channelId || conversationId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'typing_indicators',
        filter: channelId 
          ? `channel_id=eq.${channelId}` 
          : `conversation_id=eq.${conversationId}`,
      }, () => {
        fetchTypingUsers();
      })
      .subscribe();

    // Periodic cleanup of stale typing indicators
    const cleanupInterval = setInterval(fetchTypingUsers, 2000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(cleanupInterval);
      stopTyping();
    };
  }, [user, channelId, conversationId, fetchTypingUsers, stopTyping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return {
    typingUsers,
    startTyping,
    stopTyping,
  };
}
