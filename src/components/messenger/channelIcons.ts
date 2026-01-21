import { 
  Hash, 
  MessageCircle, 
  Megaphone, 
  Lightbulb, 
  Code, 
  Bug, 
  Rocket, 
  Heart, 
  Star, 
  Zap,
  Coffee,
  Music,
  Gamepad2,
  BookOpen,
  Users,
  Calendar,
  Bell,
  Gift,
  Target,
  Flame,
  LucideIcon
} from 'lucide-react';

export interface ChannelIconOption {
  name: string;
  icon: LucideIcon;
  label: string;
}

export const channelIcons: ChannelIconOption[] = [
  { name: 'hash', icon: Hash, label: 'Hash' },
  { name: 'message-circle', icon: MessageCircle, label: 'Chat' },
  { name: 'megaphone', icon: Megaphone, label: 'Announcements' },
  { name: 'lightbulb', icon: Lightbulb, label: 'Ideas' },
  { name: 'code', icon: Code, label: 'Code' },
  { name: 'bug', icon: Bug, label: 'Bugs' },
  { name: 'rocket', icon: Rocket, label: 'Launch' },
  { name: 'heart', icon: Heart, label: 'Kudos' },
  { name: 'star', icon: Star, label: 'Featured' },
  { name: 'zap', icon: Zap, label: 'Quick' },
  { name: 'coffee', icon: Coffee, label: 'Break' },
  { name: 'music', icon: Music, label: 'Music' },
  { name: 'gamepad-2', icon: Gamepad2, label: 'Games' },
  { name: 'book-open', icon: BookOpen, label: 'Docs' },
  { name: 'users', icon: Users, label: 'Team' },
  { name: 'calendar', icon: Calendar, label: 'Events' },
  { name: 'bell', icon: Bell, label: 'Alerts' },
  { name: 'gift', icon: Gift, label: 'Perks' },
  { name: 'target', icon: Target, label: 'Goals' },
  { name: 'flame', icon: Flame, label: 'Hot' },
];

export function getChannelIcon(iconName: string | null): LucideIcon {
  const found = channelIcons.find(i => i.name === iconName);
  return found?.icon || Hash;
}
