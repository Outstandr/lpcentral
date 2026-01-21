-- Create dm_conversations table for tracking DM conversations between users
CREATE TABLE public.dm_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_one uuid NOT NULL,
  participant_two uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(participant_one, participant_two)
);

-- Enable RLS
ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;

-- Create direct_messages table
CREATE TABLE public.direct_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text,
  file_url text,
  file_name text,
  file_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for dm_conversations
CREATE POLICY "Users can view their own conversations"
ON public.dm_conversations
FOR SELECT
TO authenticated
USING (auth.uid() = participant_one OR auth.uid() = participant_two);

CREATE POLICY "Users can create conversations they're part of"
ON public.dm_conversations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = participant_one OR auth.uid() = participant_two);

-- RLS policies for direct_messages
CREATE POLICY "Users can view messages in their conversations"
ON public.direct_messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.dm_conversations c
    WHERE c.id = direct_messages.conversation_id
    AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
  )
);

CREATE POLICY "Users can send messages in their conversations"
ON public.direct_messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.dm_conversations c
    WHERE c.id = direct_messages.conversation_id
    AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
  )
);

CREATE POLICY "Users can delete their own messages"
ON public.direct_messages
FOR DELETE
TO authenticated
USING (auth.uid() = sender_id);

-- Enable realtime for direct_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- Update trigger for timestamps
CREATE TRIGGER update_dm_conversations_updated_at
BEFORE UPDATE ON public.dm_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_direct_messages_updated_at
BEFORE UPDATE ON public.direct_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();