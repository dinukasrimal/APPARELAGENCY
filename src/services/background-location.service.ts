import { Capacitor, registerPlugin } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

// What the phone needs before a closed app can answer a location check.
export interface BackgroundLocationStatus {
  fineLocation: boolean;
  /** "Allow all the time" — Android only grants this from Settings, not a prompt. */
  backgroundLocation: boolean;
  /**
   * Reported for diagnostics only. A location check shows the agent nothing, and
   * the foreground service behind it runs whether or not this is granted.
   */
  notifications: boolean;
  /** Battery optimisation off. The usual reason a push never lands. */
  batteryUnrestricted: boolean;
  pushToken: boolean;
}

interface BackgroundLocationPlugin {
  getPushToken(): Promise<{ token: string; deviceLabel?: string }>;
  getStatus(): Promise<BackgroundLocationStatus>;
  openAppSettings(): Promise<void>;
  requestUnrestrictedBattery(): Promise<void>;
}

const plugin = registerPlugin<BackgroundLocationPlugin>('BackgroundLocation');

// Only the Android app can be woken while closed. On iOS and in a browser this
// whole feature is unavailable, and the caller falls back to the last known
// location — so every entry point here is a no-op rather than an error.
export const canAnswerWhenClosed = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export const BackgroundLocationService = {
  isSupported: canAnswerWhenClosed,

  async getStatus(): Promise<BackgroundLocationStatus | null> {
    if (!canAnswerWhenClosed()) return null;
    try {
      return await plugin.getStatus();
    } catch {
      return null;
    }
  },

  /**
   * Stores this phone's push token against the signed-in user, so head office
   * can reach it. Safe to call on every launch: the row is keyed by token.
   */
  async registerDevice(userId: string): Promise<boolean> {
    if (!canAnswerWhenClosed()) return false;

    try {
      const { token, deviceLabel } = await plugin.getPushToken();
      if (!token) return false;

      const { error } = await supabase
        .from('device_push_tokens')
        .upsert(
          {
            user_id: userId,
            token,
            platform: 'android',
            device_label: deviceLabel ?? null,
            disabled_at: null,
            // Re-points the phone at whoever is signed in now: the same handset
            // passed to another agent must never answer for the previous one.
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'token' },
        );

      if (error) {
        console.error('Could not register this device for location checks:', error.message);
        return false;
      }
      return true;
    } catch (error) {
      // No Firebase in this build, or Google Play services missing on the phone.
      console.warn('Push token unavailable:', error);
      return false;
    }
  },

  /**
   * Drops this phone's registration at sign-out, so a location check can never
   * wake a handset the agent has handed on or sold.
   */
  async unregisterDevice(): Promise<void> {
    if (!canAnswerWhenClosed()) return;
    try {
      const { token } = await plugin.getPushToken();
      if (token) await supabase.from('device_push_tokens').delete().eq('token', token);
    } catch {
      // Signing out must never be blocked by this; a stale row ages out anyway.
    }
  },

  async openAppSettings(): Promise<void> {
    if (canAnswerWhenClosed()) await plugin.openAppSettings();
  },

  async requestUnrestrictedBattery(): Promise<void> {
    if (canAnswerWhenClosed()) await plugin.requestUnrestrictedBattery();
  },
};
