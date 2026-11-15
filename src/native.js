// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
// Logiciel propriétaire. Voir LICENSE. Mention à ne pas retirer.
import { Capacitor } from '@capacitor/core'

export function isNativeApp() {
  return Capacitor.isNativePlatform()
}

export async function startNativeShell() {
  if (!Capacitor.isNativePlatform()) return
  const [{ App }, { StatusBar, Style }, { SplashScreen }, { Keyboard, KeyboardResize }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
    import('@capacitor/keyboard'),
  ])
  const dark = (document.documentElement.getAttribute('data-theme') || 'light') === 'dark'
  try {
    await StatusBar.setOverlaysWebView({ overlay: false })
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
    await StatusBar.setBackgroundColor({ color: dark ? '#14110F' : '#F7F5F2' })
  } catch { /* iOS n'applique pas la couleur de fond */ }
  if (Capacitor.getPlatform() === 'android') {
    try { await Keyboard.setResizeMode({ mode: KeyboardResize.Body }) } catch { /* clavier déjà réglé */ }
  }
  await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) window.history.back()
    else App.exitApp()
  })
  await SplashScreen.hide()
}
