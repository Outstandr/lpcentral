-- Drop the broken policy
DROP POLICY IF EXISTS "Users can view public channels" ON public.channels;

-- Recreate with the correct condition
CREATE POLICY "Users can view public channels" ON public.channels
  FOR SELECT TO authenticated 
  USING (
    is_private = false 
    OR EXISTS (SELECT 1 FROM public.channel_members WHERE channel_members.channel_id = channels.id AND channel_members.user_id = auth.uid())
    OR created_by = auth.uid()
  );