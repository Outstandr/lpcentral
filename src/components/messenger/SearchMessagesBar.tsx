import { useState, useEffect, useRef } from 'react';
import { Search, X, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Channel, Message, Profile } from '@/types/messenger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface SearchMessagesBarProps {
  channel: Channel;
  open: boolean;
  onClose: () => void;
  onResultClick: (messageId: string) => void;
}

interface SearchResult {
  message: Message;
  profile: Profile | null;
}

export function SearchMessagesBar({ channel, open, onClose, onResultClick }: SearchMessagesBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const debounceTimer = setTimeout(() => {
      searchMessages();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [query, channel.id]);

  const searchMessages = async () => {
    setIsSearching(true);

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channel.id)
      .ilike('content', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Search error:', error);
      setIsSearching(false);
      return;
    }

    // Fetch profiles for results
    const messages = data as Message[];
    const userIds = [...new Set(messages.map(m => m.user_id))];
    
    let profilesMap: Record<string, Profile> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds);

      if (profiles) {
        (profiles as Profile[]).forEach(p => {
          profilesMap[p.user_id] = p;
        });
      }
    }

    setResults(messages.map(m => ({
      message: m,
      profile: profilesMap[m.user_id] || null
    })));
    setCurrentIndex(0);
    setIsSearching(false);
  };

  const handlePrevious = () => {
    if (results.length > 0) {
      const newIndex = currentIndex > 0 ? currentIndex - 1 : results.length - 1;
      setCurrentIndex(newIndex);
      onResultClick(results[newIndex].message.id);
    }
  };

  const handleNext = () => {
    if (results.length > 0) {
      const newIndex = currentIndex < results.length - 1 ? currentIndex + 1 : 0;
      setCurrentIndex(newIndex);
      onResultClick(results[newIndex].message.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && results.length > 0) {
      onResultClick(results[currentIndex].message.id);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="absolute top-14 left-0 right-0 z-10 border-b border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search messages..."
            className="pl-9 pr-4"
          />
        </div>
        
        {results.length > 0 && (
          <div className="flex items-center gap-1 text-sm text-slate-500">
            <span>{currentIndex + 1} of {results.length}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevious}>
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNext}>
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        {isSearching && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
        )}
        
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick Results Preview */}
      {results.length > 0 && query.trim() && (
        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border bg-slate-50">
          {results.slice(0, 5).map((result, idx) => (
            <button
              key={result.message.id}
              onClick={() => {
                setCurrentIndex(idx);
                onResultClick(result.message.id);
              }}
              className={cn(
                "flex w-full items-start gap-3 p-2 text-left hover:bg-slate-100 transition-colors",
                idx === currentIndex && "bg-teal-50"
              )}
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-300 text-xs font-medium text-white shrink-0">
                {result.profile?.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-700">
                    {result.profile?.username || 'Unknown'}
                  </span>
                  <span className="text-xs text-slate-400">
                    {format(new Date(result.message.created_at), 'MMM d, h:mm a')}
                  </span>
                </div>
                <p className="text-sm text-slate-600 truncate">{result.message.content}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
