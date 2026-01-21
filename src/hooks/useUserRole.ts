import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useUserRole() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setIsModerator(false);
      setLoading(false);
      return;
    }

    const checkRoles = async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (!error && data) {
        const roles = data.map(r => r.role);
        setIsAdmin(roles.includes('admin'));
        setIsModerator(roles.includes('moderator') || roles.includes('admin'));
      }
      setLoading(false);
    };

    checkRoles();
  }, [user]);

  return { isAdmin, isModerator, loading };
}
