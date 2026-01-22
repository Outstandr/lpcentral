import { useEffect, useState } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';
import { Capacitor } from '@capacitor/core';
import { useAuth } from './useAuth';

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<string>('prompt');

  useEffect(() => {
    if (!user || !Capacitor.isNativePlatform()) {
      return;
    }

    const registerPushNotifications = async () => {
      try {
        // Check permissions
        let permission = await PushNotifications.checkPermissions();
        
        if (permission.receive === 'prompt') {
          permission = await PushNotifications.requestPermissions();
        }

        setPermissionStatus(permission.receive);

        if (permission.receive !== 'granted') {
          console.log('Push notification permission not granted');
          return;
        }

        // Register for push notifications
        await PushNotifications.register();

        // Listen for registration success
        PushNotifications.addListener('registration', async (token) => {
          console.log('Push registration success, token:', token.value);
          
          // Save token to database
          const platform = Capacitor.getPlatform() as 'ios' | 'android';
          
          // First try to find existing token
          const { data: existingToken } = await supabase
            .from('push_tokens')
            .select('id')
            .eq('user_id', user.id)
            .eq('token', token.value)
            .maybeSingle();

          if (existingToken) {
            // Update existing token
            await supabase
              .from('push_tokens')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', existingToken.id);
          } else {
            // Insert new token
            const { error } = await supabase
              .from('push_tokens')
              .insert({
                user_id: user.id,
                token: token.value,
                platform,
              });

            if (error) {
              console.error('Error saving push token:', error);
            }
          }
        });

        // Listen for registration errors
        PushNotifications.addListener('registrationError', (error) => {
          console.error('Push registration error:', error);
        });

        // Listen for received notifications (foreground)
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push notification received:', notification);
        });

        // Listen for notification taps
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Push notification action performed:', notification);
          // Handle navigation based on notification data
          const data = notification.notification.data;
          if (data?.channelId) {
            window.location.href = `/chat?channel=${data.channelId}`;
          } else if (data?.conversationId) {
            window.location.href = `/chat?dm=${data.conversationId}`;
          }
        });
      } catch (error) {
        console.error('Error setting up push notifications:', error);
      }
    };

    registerPushNotifications();

    // Cleanup on unmount
    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [user]);

  const unregisterToken = async () => {
    if (!user) return;
    
    try {
      // Remove all tokens for this user
      await supabase
        .from('push_tokens')
        .delete()
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error unregistering push token:', error);
    }
  };

  return {
    permissionStatus,
    unregisterToken,
  };
};
