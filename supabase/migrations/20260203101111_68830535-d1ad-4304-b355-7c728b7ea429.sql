-- Create daily_logs table for journal entries
CREATE TABLE public.daily_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    audio_url TEXT,
    transcript TEXT,
    tasks_completed JSONB DEFAULT '[]'::jsonb,
    challenges JSONB DEFAULT '[]'::jsonb,
    key_learnings JSONB DEFAULT '[]'::jsonb,
    sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
    energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 10),
    duration_seconds INTEGER,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'transcribing', 'processing', 'completed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user_preferences table
CREATE TABLE public.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    reminder_time TIME,
    reminder_enabled BOOLEAN DEFAULT false,
    theme TEXT DEFAULT 'system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies for daily_logs
CREATE POLICY "Users can view their own logs"
ON public.daily_logs FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own logs"
ON public.daily_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own logs"
ON public.daily_logs FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own logs"
ON public.daily_logs FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Admin policy for daily_logs (can view all)
CREATE POLICY "Admins can view all logs"
ON public.daily_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for user_preferences
CREATE POLICY "Users can view their own preferences"
ON public.user_preferences FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own preferences"
ON public.user_preferences FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
ON public.user_preferences FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Create storage bucket for journal audio
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'journal-audio',
    'journal-audio',
    false,
    10485760, -- 10MB
    ARRAY['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm', 'audio/x-m4a']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for journal-audio bucket
CREATE POLICY "Users can upload their own audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'journal-audio' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own audio"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'journal-audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own audio"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'journal-audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Create trigger for updated_at
CREATE TRIGGER update_daily_logs_updated_at
BEFORE UPDATE ON public.daily_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for daily_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_logs;