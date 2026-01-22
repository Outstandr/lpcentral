-- Create push_tokens table for storing device tokens
CREATE TABLE public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Enable RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own tokens
CREATE POLICY "Users can insert own tokens" 
  ON public.push_tokens FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own tokens" 
  ON public.push_tokens FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens" 
  ON public.push_tokens FOR DELETE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens" 
  ON public.push_tokens FOR UPDATE 
  USING (auth.uid() = user_id);

-- Enable realtime for push_tokens
ALTER PUBLICATION supabase_realtime ADD TABLE public.push_tokens;