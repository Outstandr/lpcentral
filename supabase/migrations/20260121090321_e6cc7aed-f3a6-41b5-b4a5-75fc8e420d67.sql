-- Fix infinite recursion between channels <-> channel_members RLS by using a SECURITY DEFINER helper

-- 1) Helper: check if a user is the creator of a channel (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_channel_creator(_channel_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.channels c
    WHERE c.id = _channel_id
      AND c.created_by = _user_id
  )
$$;

-- 2) Replace the recursive policy on channel_members
DROP POLICY IF EXISTS "Channel creators can manage members" ON public.channel_members;

CREATE POLICY "Channel creators can manage members"
ON public.channel_members
FOR ALL
TO authenticated
USING (public.is_channel_creator(channel_id, auth.uid()))
WITH CHECK (public.is_channel_creator(channel_id, auth.uid()));