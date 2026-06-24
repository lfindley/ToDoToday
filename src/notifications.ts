// Thin wrapper around the browser Notification API. Backend-free: these only
// fire while the app/tab is open.

export type PermissionState = NotificationPermission | 'unsupported'

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): PermissionState {
  if (!notificationsSupported()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (!notificationsSupported()) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export function fireNotification(title: string, body: string): boolean {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false
  try {
    // eslint-disable-next-line no-new
    new Notification(title, { body, icon: '/favicon.ico' })
    return true
  } catch {
    return false
  }
}
