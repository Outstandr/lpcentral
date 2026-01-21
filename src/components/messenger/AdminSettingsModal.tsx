import { useState, useEffect } from 'react';
import { Shield, ShieldCheck, ShieldX, Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Profile } from '@/types/messenger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

type AppRole = 'admin' | 'moderator' | 'user';

interface UserWithRole {
  profile: Profile;
  role: AppRole;
  roleId: string | null;
}

interface AdminSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminSettingsModal({ open, onOpenChange }: AdminSettingsModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingUser, setUpdatingUser] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchUsersWithRoles();
    }
  }, [open]);

  const fetchUsersWithRoles = async () => {
    setLoading(true);
    
    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('username', { ascending: true });

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      setLoading(false);
      return;
    }

    // Fetch all user roles
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*');

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
    }

    // Map profiles with their roles
    const usersWithRoles: UserWithRole[] = (profiles as Profile[]).map(profile => {
      const userRole = roles?.find(r => r.user_id === profile.user_id);
      return {
        profile,
        role: (userRole?.role as AppRole) || 'user',
        roleId: userRole?.id || null,
      };
    });

    setUsers(usersWithRoles);
    setLoading(false);
  };

  const handleRoleChange = async (targetUserId: string, newRole: AppRole) => {
    if (!user) return;
    
    setUpdatingUser(targetUserId);
    
    const userWithRole = users.find(u => u.profile.user_id === targetUserId);
    
    if (userWithRole?.roleId) {
      // Update existing role
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('id', userWithRole.roleId);

      if (error) {
        toast({
          title: 'Failed to update role',
          description: error.message,
          variant: 'destructive',
        });
        setUpdatingUser(null);
        return;
      }
    } else {
      // Insert new role
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: targetUserId, role: newRole });

      if (error) {
        toast({
          title: 'Failed to set role',
          description: error.message,
          variant: 'destructive',
        });
        setUpdatingUser(null);
        return;
      }
    }

    // Update local state
    setUsers(prev => prev.map(u => 
      u.profile.user_id === targetUserId 
        ? { ...u, role: newRole } 
        : u
    ));

    toast({
      title: 'Role updated',
      description: `User is now a ${newRole}`,
    });
    
    setUpdatingUser(null);
  };

  const filteredUsers = users.filter(u =>
    u.profile.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeColor = (role: AppRole) => {
    switch (role) {
      case 'admin':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'moderator':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-slate-700 bg-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-teal-400" />
            Admin Settings - User Roles
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-slate-600 bg-slate-700 pl-9 text-white placeholder:text-slate-400"
            />
          </div>

          {/* Users List */}
          <ScrollArea className="h-[400px] pr-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No users found</p>
            ) : (
              <div className="space-y-2">
                {filteredUsers.map(({ profile, role }) => (
                  <div
                    key={profile.user_id}
                    className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-750 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-teal-600 text-sm font-medium text-white">
                        {profile.username[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-white">{profile.username}</p>
                        <Badge 
                          variant="outline" 
                          className={`mt-0.5 text-xs ${getRoleBadgeColor(role)}`}
                        >
                          {role === 'admin' && <ShieldCheck className="mr-1 h-3 w-3" />}
                          {role === 'moderator' && <Shield className="mr-1 h-3 w-3" />}
                          {role}
                        </Badge>
                      </div>
                    </div>

                    <Select
                      value={role}
                      onValueChange={(value: AppRole) => handleRoleChange(profile.user_id, value)}
                      disabled={updatingUser === profile.user_id || profile.user_id === user?.id}
                    >
                      <SelectTrigger className="w-32 border-slate-600 bg-slate-700 text-white">
                        {updatingUser === profile.user_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <SelectValue />
                        )}
                      </SelectTrigger>
                      <SelectContent className="border-slate-600 bg-slate-700">
                        <SelectItem value="user" className="text-white focus:bg-slate-600 focus:text-white">
                          User
                        </SelectItem>
                        <SelectItem value="moderator" className="text-white focus:bg-slate-600 focus:text-white">
                          Moderator
                        </SelectItem>
                        <SelectItem value="admin" className="text-white focus:bg-slate-600 focus:text-white">
                          Admin
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Info */}
          <div className="rounded-lg border border-slate-700 bg-slate-750 p-3 text-sm text-slate-400">
            <p className="mb-2 font-medium text-slate-300">Role Permissions:</p>
            <ul className="space-y-1 text-xs">
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-3 w-3 text-red-400" />
                <span><strong>Admin:</strong> Full access, can manage roles & moderate content</span>
              </li>
              <li className="flex items-center gap-2">
                <Shield className="h-3 w-3 text-amber-400" />
                <span><strong>Moderator:</strong> Can approve/reject messages and content</span>
              </li>
              <li className="flex items-center gap-2">
                <ShieldX className="h-3 w-3 text-slate-400" />
                <span><strong>User:</strong> Standard user permissions</span>
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
