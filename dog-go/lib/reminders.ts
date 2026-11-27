/**
 * Daily walk reminder.
 *  - Android: @capacitor/local-notifications, repeating daily at HH:MM (fires even when app is closed).
 *  - Browser: Notification API while the tab is open + an in-app banner (see Home screen).
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { makeT } from './i18n';
import { loadSettings } from './storage';

const tr = () => makeT(loadSettings().language);

const REMINDER_ID = 1001;
let webTimer: ReturnType<typeof setTimeout> | null = null;

function parse(time: string) {
  const [h, m] = time.split(':').map(Number);
  return { hour: h || 0, minute: m || 0 };
}

export async function scheduleDailyReminder(time: string, dogName: string): Promise<boolean> {
  const { hour, minute } = parse(time);
  if (Capacitor.isNativePlatform()) {
    let p = await LocalNotifications.checkPermissions();
    if (p.display !== 'granted') p = await LocalNotifications.requestPermissions();
    if (p.display !== 'granted') return false;
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REMINDER_ID,
          title: tr()('notif.title'),
          body: tr()('notif.body', { name: dogName }),
          schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
        },
      ],
    });
    return true;
  }

  // Web fallback
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  if (webTimer) clearTimeout(webTimer);
  const now = new Date();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  webTimer = setTimeout(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(tr()('notif.title'), { body: tr()('notif.body', { name: dogName }) });
    }
    scheduleDailyReminder(time, dogName);
  }, next.getTime() - now.getTime());
  return true;
}

export async function cancelDailyReminder() {
  if (webTimer) clearTimeout(webTimer);
  webTimer = null;
  if (Capacitor.isNativePlatform()) {
    await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
  }
}

/** True if reminder time has passed today and no walk was logged today. */
export function isReminderDue(time: string, lastWalkAt: number | undefined) {
  const { hour, minute } = parse(time);
  const now = new Date();
  const due = new Date();
  due.setHours(hour, minute, 0, 0);
  if (now < due) return false;
  if (!lastWalkAt) return true;
  return new Date(lastWalkAt).toDateString() !== now.toDateString();
}
