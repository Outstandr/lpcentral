import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

export const haptics = {
  /**
   * Light impact feedback - for selections, toggles
   */
  light: async () => {
    if (!isNative) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {
      console.warn('Haptics not available');
    }
  },

  /**
   * Medium impact feedback - for button presses
   */
  medium: async () => {
    if (!isNative) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {
      console.warn('Haptics not available');
    }
  },

  /**
   * Heavy impact feedback - for important actions
   */
  heavy: async () => {
    if (!isNative) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (e) {
      console.warn('Haptics not available');
    }
  },

  /**
   * Success notification feedback
   */
  success: async () => {
    if (!isNative) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch (e) {
      console.warn('Haptics not available');
    }
  },

  /**
   * Warning notification feedback
   */
  warning: async () => {
    if (!isNative) return;
    try {
      await Haptics.notification({ type: NotificationType.Warning });
    } catch (e) {
      console.warn('Haptics not available');
    }
  },

  /**
   * Error notification feedback
   */
  error: async () => {
    if (!isNative) return;
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch (e) {
      console.warn('Haptics not available');
    }
  },

  /**
   * Selection change feedback
   */
  selection: async () => {
    if (!isNative) return;
    try {
      await Haptics.selectionChanged();
    } catch (e) {
      console.warn('Haptics not available');
    }
  },
};
