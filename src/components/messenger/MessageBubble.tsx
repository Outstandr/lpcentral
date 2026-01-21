import { format } from 'date-fns';
import { FileIcon } from 'lucide-react';
import { Message, Profile } from '@/types/messenger';
import { cn } from '@/lib/utils';
import { MessageActions } from './MessageActions';

// Generate consistent color from user ID
function getUserColor(userId: string): string {
  const colors = [
    { border: 'border-l-rose-400', bg: 'bg-rose-500', light: 'bg-rose-50' },
    { border: 'border-l-sky-400', bg: 'bg-sky-500', light: 'bg-sky-50' },
    { border: 'border-l-amber-400', bg: 'bg-amber-500', light: 'bg-amber-50' },
    { border: 'border-l-emerald-400', bg: 'bg-emerald-500', light: 'bg-emerald-50' },
    { border: 'border-l-violet-400', bg: 'bg-violet-500', light: 'bg-violet-50' },
    { border: 'border-l-pink-400', bg: 'bg-pink-500', light: 'bg-pink-50' },
    { border: 'border-l-cyan-400', bg: 'bg-cyan-500', light: 'bg-cyan-50' },
    { border: 'border-l-orange-400', bg: 'bg-orange-500', light: 'bg-orange-50' },
    { border: 'border-l-teal-400', bg: 'bg-teal-500', light: 'bg-teal-50' },
    { border: 'border-l-indigo-400', bg: 'bg-indigo-500', light: 'bg-indigo-50' },
  ];
  
  // Hash the user ID to get a consistent index
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return colors[Math.abs(hash) % colors.length].border;
}

function getUserAvatarColor(userId: string): string {
  const colors = [
    'bg-gradient-to-br from-rose-400 to-rose-600',
    'bg-gradient-to-br from-sky-400 to-sky-600',
    'bg-gradient-to-br from-amber-400 to-amber-600',
    'bg-gradient-to-br from-emerald-400 to-emerald-600',
    'bg-gradient-to-br from-violet-400 to-violet-600',
    'bg-gradient-to-br from-pink-400 to-pink-600',
    'bg-gradient-to-br from-cyan-400 to-cyan-600',
    'bg-gradient-to-br from-orange-400 to-orange-600',
    'bg-gradient-to-br from-teal-400 to-teal-600',
    'bg-gradient-to-br from-indigo-400 to-indigo-600',
  ];
  
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return colors[Math.abs(hash) % colors.length];
}

interface MessageBubbleProps {
  message: Message;
  profile: Profile | undefined;
  profiles: Record<string, Profile>;
  showHeader: boolean;
  isOwn: boolean;
  isHighlighted: boolean;
}

export function MessageBubble({ 
  message, 
  profile,
  profiles,
  showHeader, 
  isOwn, 
  isHighlighted 
}: MessageBubbleProps) {
  const borderColor = getUserColor(message.user_id);
  const avatarColor = getUserAvatarColor(message.user_id);
  
  const isImageFile = (type: string | null) => {
    return type?.startsWith('image/');
  };

  return (
    <div 
      id={`message-${message.id}`}
      className={cn(
        "group flex gap-3 transition-colors duration-300",
        !showHeader && "mt-0.5",
        isHighlighted && "bg-yellow-100 rounded-lg"
      )}
    >
      {/* Avatar column */}
      <div className="w-9 shrink-0">
        {showHeader && (
          <div className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium text-white shadow-sm",
            avatarColor
          )}>
            {profile?.username?.[0]?.toUpperCase() || '?'}
          </div>
        )}
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0">
        {showHeader && (
          <div className="mb-1 flex items-center gap-2">
            <span className="font-semibold text-slate-900">
              {profile?.username || 'Unknown'}
            </span>
            <span className="text-xs text-slate-400">
              {format(new Date(message.created_at), 'h:mm a')}
            </span>
          </div>
        )}
        
        {/* Chat bubble */}
        <div className={cn(
          "relative rounded-lg border-l-4 bg-white px-4 py-2.5 shadow-sm",
          "border border-slate-100",
          borderColor,
          isOwn && "bg-slate-50"
        )}>
          {message.content && (
            <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
              {message.content}
            </p>
          )}
          
          {message.file_url && (
            <div className={cn(message.content && "mt-2")}>
              {isImageFile(message.file_type) ? (
                <a href={message.file_url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={message.file_url}
                    alt={message.file_name || 'Uploaded image'}
                    className="max-w-xs rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                  />
                </a>
              ) : (
                <a
                  href={message.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <FileIcon className="h-4 w-4 text-slate-400" />
                  {message.file_name || 'Download file'}
                </a>
              )}
            </div>
          )}
          
          {/* Timestamp on hover for grouped messages */}
          {!showHeader && (
            <span className="absolute -left-16 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
              {format(new Date(message.created_at), 'h:mm a')}
            </span>
          )}

          {/* Message Actions (Reactions, Notes, Moderation) */}
          <MessageActions message={message} profiles={profiles} />
        </div>
      </div>
    </div>
  );
}
