-- Message reactions table
CREATE TABLE public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all reactions"
  ON public.message_reactions FOR SELECT
  USING (true);

CREATE POLICY "Users can add reactions"
  ON public.message_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions"
  ON public.message_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Message notes table
CREATE TABLE public.message_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.message_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notes on accessible messages"
  ON public.message_notes FOR SELECT
  USING (true);

CREATE POLICY "Users can add notes"
  ON public.message_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON public.message_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON public.message_notes FOR DELETE
  USING (auth.uid() = user_id);

-- Message moderation table (admin only)
CREATE TABLE public.message_moderation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE UNIQUE,
  moderator_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('approved', 'rejected', 'pending')),
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.message_moderation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view moderation status"
  ON public.message_moderation FOR SELECT
  USING (true);

CREATE POLICY "Admins can moderate messages"
  ON public.message_moderation FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

CREATE POLICY "Admins can update moderation"
  ON public.message_moderation FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_moderation;