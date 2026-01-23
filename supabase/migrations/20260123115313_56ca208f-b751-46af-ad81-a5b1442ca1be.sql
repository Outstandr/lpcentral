-- =============================================
-- UNREAD TRACKING SYSTEM
-- =============================================

-- Track when users last read each channel
CREATE TABLE public.channel_read_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

-- Track when users last read each DM conversation
CREATE TABLE public.dm_read_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  conversation_id UUID NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, conversation_id)
);

-- Enable RLS
ALTER TABLE public.channel_read_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_read_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies for channel_read_status
CREATE POLICY "Users can view their own read status"
  ON public.channel_read_status FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own read status"
  ON public.channel_read_status FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own read status"
  ON public.channel_read_status FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for dm_read_status
CREATE POLICY "Users can view their own DM read status"
  ON public.dm_read_status FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own DM read status"
  ON public.dm_read_status FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own DM read status"
  ON public.dm_read_status FOR UPDATE
  USING (auth.uid() = user_id);

-- =============================================
-- USER PRESENCE SYSTEM
-- =============================================

CREATE TABLE public.user_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'offline')),
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Everyone can see presence (team app)
CREATE POLICY "Anyone can view presence"
  ON public.user_presence FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own presence"
  ON public.user_presence FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presence"
  ON public.user_presence FOR UPDATE
  USING (auth.uid() = user_id);

-- =============================================
-- TYPING INDICATORS (ephemeral, via realtime)
-- =============================================

CREATE TABLE public.typing_indicators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT typing_has_target CHECK (
    (channel_id IS NOT NULL AND conversation_id IS NULL) OR
    (channel_id IS NULL AND conversation_id IS NOT NULL)
  )
);

-- Enable RLS
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

-- Everyone can view typing (team app)
CREATE POLICY "Anyone can view typing indicators"
  ON public.typing_indicators FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own typing"
  ON public.typing_indicators FOR ALL
  USING (auth.uid() = user_id);

-- Enable realtime for typing and presence
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_channel_read_status_user ON public.channel_read_status(user_id);
CREATE INDEX idx_channel_read_status_channel ON public.channel_read_status(channel_id);
CREATE INDEX idx_dm_read_status_user ON public.dm_read_status(user_id);
CREATE INDEX idx_dm_read_status_conversation ON public.dm_read_status(conversation_id);
CREATE INDEX idx_user_presence_status ON public.user_presence(status);
CREATE INDEX idx_typing_indicators_channel ON public.typing_indicators(channel_id);
CREATE INDEX idx_typing_indicators_conversation ON public.typing_indicators(conversation_id);