// Install prompt helper + SW registration is handled by vite-plugin-pwa.
// This module just captures the install event so a button can call promptInstall().

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEvent | null = null

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e as BeforeInstallPromptEvent
  window.dispatchEvent(new CustomEvent('pcc:installable'))
})

window.addEventListener('appinstalled', () => {
  deferredPrompt = null
})

export function canPromptInstall(): boolean {
  return deferredPrompt !== null
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable'
  deferredPrompt.prompt()
  const { outcome } = await deferredPrompt.userChoice
  deferredPrompt = null
  return outcome
}
