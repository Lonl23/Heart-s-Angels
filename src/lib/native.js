import { Capacitor } from '@capacitor/core'

export function estNatif() {
  return Capacitor.isNativePlatform()
}

export async function syncNativeTheme() {
  if (!estNatif()) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    const dark = document.documentElement.getAttribute('data-theme') === 'dark'
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
  } catch { /* plugin absent au web */ }
}

export async function initNative() {
  if (!estNatif()) return
  document.documentElement.classList.add('ha-natif')
  try {
    const { App } = await import('@capacitor/app')
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack || window.history.length > 1) window.history.back()
      else App.exitApp()
    })
  } catch { /* plugin absent au web */ }
  try {
    const { StatusBar } = await import('@capacitor/status-bar')
    await StatusBar.setOverlaysWebView({ overlay: false })
    await syncNativeTheme()
  } catch { /* */ }
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch { /* */ }
}
