-- Create function to send push notifications on new messages
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_member RECORD;
  sender_username TEXT;
  channel_name TEXT;
BEGIN
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
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'userId', channel_member.user_id,
        'title', COALESCE(sender_username, 'Someone') || ' in #' || COALESCE(channel_name, 'channel'),
        'body', LEFT(COALESCE(NEW.content, 'Sent a file'), 100),
        'data', jsonb_build_object('channelId', NEW.channel_id, 'messageId', NEW.id)
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create function to send push notifications on new DMs
CREATE OR REPLACE FUNCTION public.notify_on_new_dm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id UUID;
  sender_username TEXT;
  conv RECORD;
BEGIN
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
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'userId', recipient_id,
      'title', COALESCE(sender_username, 'Someone') || ' sent you a message',
      'body', LEFT(COALESCE(NEW.content, 'Sent a file'), 100),
      'data', jsonb_build_object('conversationId', NEW.conversation_id, 'messageId', NEW.id)
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER trigger_notify_on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_message();

CREATE TRIGGER trigger_notify_on_new_dm
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_dm();