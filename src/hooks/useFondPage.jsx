import { useEffect, useState } from 'react'
import { chargerFondsPages, fondPourPage, pageFondDepuisChemin, styleFond } from '@/lib/fondsPages'

export function FondEcran({ page, children, style, className }) {
  const { style: fond, actif } = useFondPage(page)
  const cls = [actif ? 'ha-main-fond' : '', className].filter(Boolean).join(' ') || undefined
  return (
    <div className={cls} style={{ backgroundColor: 'var(--bg)', ...fond, ...style }}>
      {children}
    </div>
  )
}

export function useFondPage(pageOuChemin) {
  const page = pageOuChemin && pageOuChemin.startsWith('/')
    ? pageFondDepuisChemin(pageOuChemin)
    : pageOuChemin
  const [fond, setFond] = useState(null)

  useEffect(() => {
    let on = true
    async function load() {
      if (!page) { setFond(null); return }
      try {
        const etat = await chargerFondsPages()
        if (on) setFond(fondPourPage(etat, page))
      } catch {
        if (on) setFond(null)
      }
    }
    load()
    window.addEventListener('ha-fonds-maj', load)
    return () => { on = false; window.removeEventListener('ha-fonds-maj', load) }
  }, [page])

  return {
    page,
    fond,
    style: fond?.url ? styleFond(fond.url, fond.intensite) : {},
    actif: !!fond?.url,
  }
}
