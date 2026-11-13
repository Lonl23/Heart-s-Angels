import { Capacitor } from '@capacitor/core'
import { supabase } from '@/lib/supabase'
import { estNatif } from '@/lib/native'
import config from '@/app.config'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const b64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function vapidPublic() {
  if (config.vapidPublicKey) return config.vapidPublicKey
  const { data } = await supabase.rpc('vapid_cle_publique')
  return data || ''
}

async function enregistrer(plateforme, token, abonnement) {
  await supabase.rpc('enregistrer_push_token', {
    p_plateforme: plateforme,
    p_token: token,
    p_abonnement: abonnement || null,
  })
}

async function enregistrerWeb() {
  if (estNatif()) return { ok: false, raison: 'natif' }
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, raison: 'navigateur' }
  }
  if (Notification.permission === 'denied') return { ok: false, raison: 'refuse' }
  if (Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return { ok: false, raison: 'refuse' }
  }
  const cle = await vapidPublic()
  if (!cle) return { ok: false, raison: 'cle' }
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cle),
    })
  }
  const json = sub.toJSON()
  await enregistrer('web', json.endpoint, json)
  return { ok: true }
}

let natifEcoute = false

async function enregistrerNatif(onLien) {
  if (!estNatif()) return { ok: false, raison: 'web' }
  const { PushNotifications } = await import('@capacitor/push-notifications')
  const perm = await PushNotifications.requestPermissions()
  if (perm.receive !== 'granted') return { ok: false, raison: 'refuse' }
  if (!natifEcoute) {
    natifEcoute = true
    PushNotifications.addListener('registration', async ({ value }) => {
      if (!value) return
      const plateforme = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android'
      await enregistrer(plateforme, value, null)
    })
    PushNotifications.addListener('pushNotificationActionPerformed', (ev) => {
      const lien = ev?.notification?.data?.lien
      if (lien && onLien) onLien(lien)
    })
    PushNotifications.addListener('pushNotificationReceived', () => {})
  }
  await PushNotifications.register()
  return { ok: true }
}

export async function activerPush(onLien) {
  try {
    if (estNatif()) return await enregistrerNatif(onLien)
    return await enregistrerWeb()
  } catch {
    return { ok: false, raison: 'erreur' }
  }
}

export function permissionPush() {
  if (estNatif()) return 'natif'
  if (!('Notification' in window)) return 'absent'
  return Notification.permission
}
