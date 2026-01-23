import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type PresenceStatus = 'online' | 'away' | 'offline';

interface UserPresence {
  userId: string;
  status: PresenceStatus;
  lastSeenAt: string;
}

interface UsePresenceReturn {
  userPresences: Map<string, UserPresence>;
  myStatus: PresenceStatus;
  setMyStatus: (status: PresenceStatus) => Promise<void>;
  getPresence: (userId: string) => UserPresence | undefined;
}

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const AWAY_TIMEOUT = 60000; // 1 minute of inactivity
const OFFLINE_TIMEOUT = 120000; // 2 minutes

export function usePresence(): UsePresenceReturn {
  const { user } = useAuth();
  const [userPresences, setUserPresences] = useState<Map<string, UserPresence>>(new Map());
  const [myStatus, setMyStatusState] = useState<PresenceStatus>('online');
  const lastActivityRef = useRef<number>(Date.now());
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // Update my presence in the database
  const updateMyPresence = useCallback(async (status: PresenceStatus) => {
    if (!user) return;

    try {
      await supabase
        .from('user_presence')
        .upsert({
          user_id: user.id,
          status,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });
    } catch (error) {
      console.error('Failed to update presence:', error);
    }
  }, [user]);

  // Set my status (public API)
  const setMyStatus = useCallback(async (status: PresenceStatus) => {
    setMyStatusState(status);
    await updateMyPresence(status);
  }, [updateMyPresence]);

  // Fetch all user presences
  const fetchPresences = useCallback(async () => {
    const { data } = await supabase
      .from('user_presence')
      .select('user_id, status, last_seen_at');

    if (data) {
      const presenceMap = new Map<string, UserPresence>();
      const now = Date.now();

      data.forEach(p => {
        const lastSeenAt = new Date(p.last_seen_at).getTime();
        const timeSinceLastSeen = now - lastSeenAt;

        // Override status if user hasn't been seen recently
        let effectiveStatus: PresenceStatus = p.status as PresenceStatus;
        if (timeSinceLastSeen > OFFLINE_TIMEOUT) {
          effectiveStatus = 'offline';
        } else if (timeSinceLastSeen > AWAY_TIMEOUT && effectiveStatus === 'online') {
          effectiveStatus = 'away';
        }

        presenceMap.set(p.user_id, {
          userId: p.user_id,
          status: effectiveStatus,
          lastSeenAt: p.last_seen_at,
        });
      });

      setUserPresences(presenceMap);
    }
  }, []);

  // Get presence for a specific user
  const getPresence = useCallback((userId: string): UserPresence | undefined => {
    return userPresences.get(userId);
  }, [userPresences]);

  // Track user activity for auto-away
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      if (myStatus === 'away') {
        setMyStatus('online');
      }
    };

    // Track various user activities
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('touchstart', updateActivity);
    window.addEventListener('scroll', updateActivity);

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, [myStatus, setMyStatus]);

  // Check for inactivity and set away
  useEffect(() => {
    const checkActivity = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      if (timeSinceActivity > AWAY_TIMEOUT && myStatus === 'online') {
        setMyStatus('away');
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(checkActivity);
  }, [myStatus, setMyStatus]);

  // Heartbeat to keep presence alive
  useEffect(() => {
    if (!user) return;

    // Initial presence set
    updateMyPresence('online');
    fetchPresences();

    // Heartbeat interval
    heartbeatRef.current = setInterval(() => {
      updateMyPresence(myStatus);
      fetchPresences();
    }, HEARTBEAT_INTERVAL);

    // Set offline on unmount/close
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliability on page close
      const data = JSON.stringify({
        user_id: user.id,
        status: 'offline',
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      navigator.sendBeacon?.(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_presence?on_conflict=user_id`, data);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      updateMyPresence('offline');
    };
  }, [user, myStatus, updateMyPresence, fetchPresences]);

  // Subscribe to presence changes in real-time
  useEffect(() => {
    const channel = supabase
      .channel('presence-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_presence',
      }, () => {
        fetchPresences();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPresences]);

  return {
    userPresences,
    myStatus,
    setMyStatus,
    getPresence,
  };
}
