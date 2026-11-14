import { isIOS, isStandalone } from '@/hooks/useInstall'
import { env } from './env'
import { supabase } from './supabase'

/**
 * Why push can or can't work on this device right now, in plain English.
 *   ready        – supported and allowed, just needs turning on
 *   on           – this device is subscribed
 *   ios-install  – iPhone/iPad in a browser tab: must Add to Home Screen first
 *   ios-old      – iOS older than 16.4
 *   denied       – the person said "Don't allow" (fix in Settings)
 *   unsupported  – this browser can't do push
 *   not-setup    – the family's push keys haven't been configured yet
 */
export type PushStatus = 'ready' | 'on' | 'ios-install' | 'ios-old' | 'denied' | 'unsupported' | 'not-setup'

export function iosVersion(): number | null {
  const m = /OS (\d+)[._](\d+)/.exec(navigator.userAgent)
  return isIOS() && m ? Number(m[1]) + Number(m[2]) / 100 : null
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function getPushStatus(): Promise<PushStatus> {
  const v = iosVersion()
  if (isIOS() && v !== null && v < 16.04) return 'ios-old'
  if (isIOS() && !isStandalone()) return 'ios-install'
  if (!pushSupported()) return 'unsupported'
  if (!env.vapidPublicKey) return 'not-setup'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'ready'
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

function deviceLabel(): string {
  const ua = navigator.userAgent
  const device = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Device'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : ''
  return isStandalone() ? `${device} (app)` : `${device} ${browser}`.trim()
}

/** Ask permission (must be called from a tap) and save this device's subscription. */
export async function enablePush(userId: string): Promise<void> {
  if (!pushSupported()) throw new Error('This browser can’t show notifications.')
  if (!env.vapidPublicKey) throw new Error('Push isn’t set up for this Family Hub yet (an admin needs to add the key).')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Notifications are blocked. Turn them on in your device settings.' : 'Notifications weren’t allowed.')
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(env.vapidPublicKey) as BufferSource })
  }
  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint: sub.endpoint, p256dh: json.keys!.p256dh, auth: json.keys!.auth, device_label: deviceLabel() },
    { onConflict: 'endpoint' },
  )
  if (error) throw error
}

/** Stop push on this device (keeps in-app notifications). */
export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

/** Show the unread count on the app icon (supported on installed apps, incl. iOS 16.4+). */
export function setAppBadge(count: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
  try {
    if (count > 0) nav.setAppBadge?.(count)?.catch(() => {})
    else nav.clearAppBadge?.()?.catch(() => {})
  } catch {
    /* not supported */
  }
}
