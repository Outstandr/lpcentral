-- Update message_notes policy to allow viewing by channel members
DROP POLICY IF EXISTS "Users can view their own notes" ON public.message_notes;

CREATE POLICY "Users can view notes on accessible messages"
ON public.message_notes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN channels c ON c.id = m.channel_id
    WHERE m.id = message_notes.message_id
    AND (
      c.is_private = false
      OR EXISTS (
        SELECT 1 FROM channel_members cm
        WHERE cm.channel_id = c.id AND cm.user_id = auth.uid()
      )
      OR c.created_by = auth.uid()
    )
  )
);