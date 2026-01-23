import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  usernames: string[];
  className?: string;
}

export function TypingIndicator({ usernames, className }: TypingIndicatorProps) {
  if (usernames.length === 0) return null;

  const getText = () => {
    if (usernames.length === 1) {
      return `${usernames[0]} is typing`;
    } else if (usernames.length === 2) {
      return `${usernames[0]} and ${usernames[1]} are typing`;
    } else {
      return `${usernames[0]} and ${usernames.length - 1} others are typing`;
    }
  };

  return (
    <div className={cn("flex items-center gap-2 text-xs text-slate-500", className)}>
      <div className="flex gap-0.5">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
      </div>
      <span>{getText()}</span>
    </div>
  );
}
