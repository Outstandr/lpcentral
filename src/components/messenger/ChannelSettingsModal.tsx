import { useState, useEffect } from 'react';
import { Lock, Settings, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Channel } from '@/types/messenger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { ChannelIconPicker } from './ChannelIconPicker';
import { getChannelIcon } from './channelIcons';

interface ChannelSettingsModalProps {
  channel: Channel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChannelUpdate: (channel: Channel) => void;
  onChannelDelete: () => void;
}

export function ChannelSettingsModal({ 
  channel, 
  open, 
  onOpenChange, 
  onChannelUpdate,
  onChannelDelete 
}: ChannelSettingsModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description || '');
  const [icon, setIcon] = useState(channel.icon || 'hash');
  const [isPrivate, setIsPrivate] = useState(channel.is_private);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Only reset form when modal opens, not when channel prop updates
  useEffect(() => {
    if (open) {
      setName(channel.name);
      setDescription(channel.description || '');
      setIcon(channel.icon || 'hash');
      setIsPrivate(channel.is_private);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = async () => {
    if (!user || !name.trim()) return;

    setIsSaving(true);

    const updates = {
      name: name.toLowerCase().replace(/\s+/g, '-'),
      description: description || null,
      icon,
      is_private: isPrivate,
    };

    const { data, error } = await supabase
      .from('channels')
      .update(updates)
      .eq('id', channel.id)
      .select()
      .single();

    setIsSaving(false);

    if (error) {
      toast({
        title: "Failed to update channel",
        description: error.message,
        variant: "destructive"
      });
    } else {
      // If changing to private, add creator as member
      if (isPrivate && !channel.is_private) {
        await supabase.from('channel_members').upsert({
          channel_id: channel.id,
          user_id: user.id,
        }, { onConflict: 'channel_id,user_id' });
      }

      toast({
        title: "Channel updated",
        description: "Your changes have been saved."
      });
      onChannelUpdate(data as Channel);
      onOpenChange(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    const { error } = await supabase
      .from('channels')
      .delete()
      .eq('id', channel.id);

    setIsDeleting(false);

    if (error) {
      toast({
        title: "Failed to delete channel",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Channel deleted",
        description: `#${channel.name} has been deleted.`
      });
      setShowDeleteConfirm(false);
      onOpenChange(false);
      onChannelDelete();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="border-slate-700 bg-slate-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-teal-400" />
              Channel Settings
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="channel-name" className="text-slate-300">Name</Label>
              <div className="flex gap-2">
                <ChannelIconPicker
                  value={icon}
                  onChange={setIcon}
                  disabled={isSaving}
                />
                <Input
                  id="channel-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-slate-600 bg-slate-700 text-white"
                  placeholder="channel-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel-desc" className="text-slate-300">Description</Label>
              <Textarea
                id="channel-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="border-slate-600 bg-slate-700 text-white"
                placeholder="What's this channel about?"
                rows={3}
              />
            </div>

            <div className="rounded-lg border border-slate-600 bg-slate-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {(() => {
                    const IconComponent = isPrivate ? Lock : getChannelIcon(icon);
                    return <IconComponent className="h-5 w-5 text-teal-400" />;
                  })()}
                  <div>
                    <Label htmlFor="is-private" className="text-sm font-medium text-white">
                      Private channel
                    </Label>
                    <p className="text-xs text-slate-400">
                      {isPrivate 
                        ? "Only invited members can see this channel" 
                        : "Anyone in the workspace can see this channel"}
                    </p>
                  </div>
                </div>
                <Switch
                  id="is-private"
                  checked={isPrivate}
                  onCheckedChange={setIsPrivate}
                />
              </div>
            </div>

            {/* Danger Zone */}
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <h4 className="text-sm font-medium text-red-400 mb-2">Danger Zone</h4>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Channel
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-slate-300 hover:text-white hover:bg-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
              className="bg-teal-500 hover:bg-teal-600"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="border-slate-700 bg-slate-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete #{channel.name}?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This action cannot be undone. All messages in this channel will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-slate-600 bg-slate-700 text-white hover:bg-slate-600">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600"
            >
              {isDeleting ? 'Deleting...' : 'Delete Channel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
