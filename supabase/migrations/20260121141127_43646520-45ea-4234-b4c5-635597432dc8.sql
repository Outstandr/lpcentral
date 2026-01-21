-- Fix 1: Profiles - require authentication for SELECT
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Fix 2: Message notes - restrict to note owner only
DROP POLICY IF EXISTS "Users can view notes on accessible messages" ON public.message_notes;
CREATE POLICY "Users can view their own notes"
ON public.message_notes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Fix 3: Message moderation - restrict to moderators/admins only
DROP POLICY IF EXISTS "Everyone can view moderation status" ON public.message_moderation;
CREATE POLICY "Moderators and admins can view moderation"
ON public.message_moderation
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'moderator'::app_role));

-- Fix 4: Message reactions - require authentication
DROP POLICY IF EXISTS "Users can view all reactions" ON public.message_reactions;
CREATE POLICY "Authenticated users can view reactions"
ON public.message_reactions
FOR SELECT
TO authenticated
USING (true);

-- Fix 5: Channel members - require authentication
DROP POLICY IF EXISTS "Users can view channel memberships" ON public.channel_members;
CREATE POLICY "Authenticated users can view channel memberships"
ON public.channel_members
FOR SELECT
TO authenticated
USING (true);

-- Fix 6: Meeting notes - tighten insert policy to only allow via service role
DROP POLICY IF EXISTS "System can insert meeting notes" ON public.meeting_notes;
CREATE POLICY "Service role can insert meeting notes"
ON public.meeting_notes
FOR INSERT
TO service_role
WITH CHECK (true);