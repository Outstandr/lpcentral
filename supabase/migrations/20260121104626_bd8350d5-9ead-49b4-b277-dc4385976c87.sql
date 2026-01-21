-- Create meetings table
CREATE TABLE public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  transcript TEXT,
  audio_url TEXT,
  external_id TEXT,
  source TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'pending',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create meeting_notes table (AI-generated content)
CREATE TABLE public.meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES public.meetings(id) ON DELETE CASCADE,
  summary TEXT,
  key_points JSONB,
  action_items JSONB,
  decisions JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies for meetings
CREATE POLICY "Users can view meetings in accessible channels"
ON public.meetings FOR SELECT
USING (
  channel_id IS NULL 
  OR EXISTS (
    SELECT 1 FROM public.channels c
    WHERE c.id = meetings.channel_id
    AND (
      c.is_private = false
      OR EXISTS (SELECT 1 FROM public.channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = auth.uid())
      OR c.created_by = auth.uid()
    )
  )
);

CREATE POLICY "Users can create meetings"
ON public.meetings FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own meetings"
ON public.meetings FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own meetings"
ON public.meetings FOR DELETE
USING (auth.uid() = created_by);

-- RLS policies for meeting_notes
CREATE POLICY "Users can view notes for accessible meetings"
ON public.meeting_notes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_notes.meeting_id
    AND (
      m.channel_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.channels c
        WHERE c.id = m.channel_id
        AND (
          c.is_private = false
          OR EXISTS (SELECT 1 FROM public.channel_members cm WHERE cm.channel_id = c.id AND cm.user_id = auth.uid())
          OR c.created_by = auth.uid()
        )
      )
    )
  )
);

CREATE POLICY "System can insert meeting notes"
ON public.meeting_notes FOR INSERT
WITH CHECK (true);

-- Enable realtime for meeting_notes
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_notes;

-- Update trigger for meetings
CREATE TRIGGER update_meetings_updated_at
BEFORE UPDATE ON public.meetings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();