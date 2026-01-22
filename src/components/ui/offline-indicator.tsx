import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };
    
    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline && !showReconnected) return null;

  return (
    <div 
      className={cn(
        "fixed top-0 left-0 right-0 z-50 flex items-center justify-center py-2 px-4 text-sm font-medium text-white transition-all duration-300",
        isOffline 
          ? "bg-destructive" 
          : "bg-emerald-500"
      )}
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)' }}
    >
      {isOffline ? (
        <>
          <WifiOff className="mr-2 h-4 w-4" />
          You're offline. Some features may be unavailable.
        </>
      ) : (
        'Back online!'
      )}
    </div>
  );
}
