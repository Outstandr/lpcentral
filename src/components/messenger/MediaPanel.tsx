import { useState, useEffect } from 'react';
import { X, Image as ImageIcon, FileIcon, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Channel, Message } from '@/types/messenger';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

interface MediaPanelProps {
  channel: Channel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MediaPanel({ channel, open, onOpenChange }: MediaPanelProps) {
  const [media, setMedia] = useState<Message[]>([]);
  const [files, setFiles] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchMediaAndFiles();
    }
  }, [open, channel.id]);

  const fetchMediaAndFiles = async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channel.id)
      .not('file_url', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching media:', error);
      setIsLoading(false);
      return;
    }

    const messages = data as Message[];
    setMedia(messages.filter(m => m.file_type?.startsWith('image/')));
    setFiles(messages.filter(m => !m.file_type?.startsWith('image/')));
    setIsLoading(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-80 sm:w-96">
        <SheetHeader>
          <SheetTitle>Media & Files</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="media" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
          </TabsList>

          <TabsContent value="media">
            <ScrollArea className="h-[calc(100vh-200px)]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                </div>
              ) : media.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <ImageIcon className="h-12 w-12 mb-2" />
                  <p>No media shared yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1 p-2">
                  {media.map((msg) => (
                    <a
                      key={msg.id}
                      href={msg.file_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square overflow-hidden rounded-md hover:opacity-80 transition-opacity"
                    >
                      <img
                        src={msg.file_url!}
                        alt={msg.file_name || 'Image'}
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="files">
            <ScrollArea className="h-[calc(100vh-200px)]">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                </div>
              ) : files.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <FileIcon className="h-12 w-12 mb-2" />
                  <p>No files shared yet</p>
                </div>
              ) : (
                <div className="space-y-2 p-2">
                  {files.map((msg) => (
                    <a
                      key={msg.id}
                      href={msg.file_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg border bg-slate-50 p-3 hover:bg-slate-100 transition-colors"
                    >
                      <FileIcon className="h-8 w-8 text-slate-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">
                          {msg.file_name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {format(new Date(msg.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <Download className="h-4 w-4 text-slate-400" />
                    </a>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
