import { useState } from 'react';
import { 
  MoreVertical, 
  Users, 
  Info, 
  Image as ImageIcon, 
  Search, 
  BellOff, 
  Trash2,
  UserPlus
} from 'lucide-react';
import { Channel } from '@/types/messenger';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ChatHeaderMenuProps {
  channel: Channel;
  onShowInfo: () => void;
  onShowMedia: () => void;
  onSearchMessages: () => void;
  onInviteMembers?: () => void;
  isOwner: boolean;
}

export function ChatHeaderMenu({ 
  channel, 
  onShowInfo, 
  onShowMedia, 
  onSearchMessages,
  onInviteMembers,
  isOwner 
}: ChatHeaderMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-700">
          <MoreVertical className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {channel.is_private && isOwner && onInviteMembers && (
          <DropdownMenuItem onClick={onInviteMembers} className="gap-3">
            <UserPlus className="h-4 w-4" />
            Add members
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onShowInfo} className="gap-3">
          <Info className="h-4 w-4" />
          Channel info
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onShowMedia} className="gap-3">
          <ImageIcon className="h-4 w-4" />
          Media & files
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSearchMessages} className="gap-3">
          <Search className="h-4 w-4" />
          Search messages
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-3 text-slate-500">
          <BellOff className="h-4 w-4" />
          Mute notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
