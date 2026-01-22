import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingScreenProps {
  message?: string;
  className?: string;
  fullScreen?: boolean;
}

export function LoadingScreen({ 
  message = 'Loading...', 
  className,
  fullScreen = true 
}: LoadingScreenProps) {
  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center gap-4 bg-background",
        fullScreen ? "h-full min-h-screen w-full" : "h-full min-h-[200px] w-full",
        className
      )}
    >
      <div className="relative">
        <div className="absolute inset-0 animate-ping">
          <div className="h-12 w-12 rounded-full bg-teal-500/20" />
        </div>
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-600">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      </div>
      <p className="text-sm font-medium text-muted-foreground animate-pulse">
        {message}
      </p>
    </div>
  );
}
