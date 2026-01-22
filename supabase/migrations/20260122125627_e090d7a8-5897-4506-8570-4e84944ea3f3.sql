-- Enable the pg_net extension for HTTP requests from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Make the triggers resilient by handling failures gracefully
-- Update notify_on_new_message to handle missing pg_net gracefully
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  channel_member RECORD;
  sender_username TEXT;
  channel_name TEXT;
BEGIN
  -- Only attempt push notifications if pg_net is available
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RETURN NEW;
  END IF;

  -- Get sender username
  SELECT username INTO sender_username 
  FROM public.profiles 
  WHERE user_id = NEW.user_id;

  -- Get channel name
  SELECT name INTO channel_name 
  FROM public.channels 
  WHERE id = NEW.channel_id;

  -- Notify all channel members except sender
  FOR channel_member IN 
    SELECT cm.user_id 
    FROM public.channel_members cm 
    WHERE cm.channel_id = NEW.channel_id 
    AND cm.user_id != NEW.user_id
  LOOP
    -- Call edge function via pg_net (async HTTP)
    BEGIN
      PERFORM net.http_post(
        url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
          'userId', channel_member.user_id,
          'title', COALESCE(sender_username, 'Someone') || ' in #' || COALESCE(channel_name, 'channel'),
          'body', LEFT(COALESCE(NEW.content, 'Sent a file'), 100),
          'data', jsonb_build_object('channelId', NEW.channel_id, 'messageId', NEW.id)
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the insert
      RAISE WARNING 'Push notification failed: %', SQLERRM;
    END;
  END LOOP;
  
  RETURN NEW;
END;
$function$;

-- Update notify_on_new_dm to handle missing pg_net gracefully
CREATE OR REPLACE FUNCTION public.notify_on_new_dm()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  recipient_id UUID;
  sender_username TEXT;
  conv RECORD;
BEGIN
  -- Only attempt push notifications if pg_net is available
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RETURN NEW;
  END IF;

  -- Get conversation details
  SELECT * INTO conv 
  FROM public.dm_conversations 
  WHERE id = NEW.conversation_id;

  -- Determine recipient (the other participant)
  IF conv.participant_one = NEW.sender_id THEN
    recipient_id := conv.participant_two;
  ELSE
    recipient_id := conv.participant_one;
  END IF;

  -- Get sender username
  SELECT username INTO sender_username 
  FROM public.profiles 
  WHERE user_id = NEW.sender_id;

  -- Call edge function via pg_net (async HTTP)
  BEGIN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := jsonb_build_object(
        'userId', recipient_id,
        'title', COALESCE(sender_username, 'Someone') || ' sent you a message',
        'body', LEFT(COALESCE(NEW.content, 'Sent a file'), 100),
        'data', jsonb_build_object('conversationId', NEW.conversation_id, 'messageId', NEW.id)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Push notification failed: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$function$;