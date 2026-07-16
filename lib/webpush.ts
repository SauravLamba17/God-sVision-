import webpush from 'web-push';

const vapidPublic = process.env.VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com';

let configured = false;
if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  configured = true;
}

export async function sendPushNotification(
  subscription: any,
  payload: { title: string; body: string; url?: string }
) {
  if (!configured) return { success: false, error: 'VAPID keys not configured' };
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export function isPushConfigured() {
  return configured;
}
