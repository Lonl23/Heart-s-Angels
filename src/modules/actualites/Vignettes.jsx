import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { sanitizeHtml } from '@/lib/sanitizeHtml'

const BUCKET = 'actualites-images'

export function urlActu(path) {
  if (!path) return ''
  const p = String(path)
  if (p.startsWith('/') || p.startsWith('http://') || p.startsWith('https://')) return p
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data?.publicUrl || ''
}

export function fmtPublie(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function Couverture({ path, titre, hero }) {
  const url = urlActu(path)
  return (
    <div className={hero ? 'ha-actu-hero' : 'ha-actu-couv'}>
      {url
        ? <img src={url} alt="" />
        : <div className="ha-actu-ph">{(titre || '?').slice(0, 1).toUpperCase()}</div>}
    </div>
  )
}

export function CarteActualite({ row, onOpen }) {
  const html = sanitizeHtml(row?.vignette_html)
  function clavier(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen?.() }
  }
  return (
    <div className="ha-actu-card" role="link" tabIndex={0} onClick={() => onOpen?.()} onKeyDown={clavier}>
      {html ? (
        <>
          {row.statut && row.statut !== 'publie' && (
            <div className="ha-actu-card-corps" style={{ paddingBottom: 0 }}>
              <div className="ha-actu-brouillon">Brouillon</div>
            </div>
          )}
          <div className="ha-actu-html ha-actu-vignette-html" dangerouslySetInnerHTML={{ __html: html }} />
        </>
      ) : (
        <>
          <Couverture path={row.vignette_path} titre={row.titre} />
          <div className="ha-actu-card-corps">
            {row.statut && row.statut !== 'publie' && <div className="ha-actu-brouillon">Brouillon</div>}
            <div className="ha-actu-card-titre">{row.titre}</div>
            {row.chapo && <div className="ha-actu-card-chapo">{row.chapo}</div>}
            {fmtPublie(row.publie_le) && <div className="ha-actu-card-date">{fmtPublie(row.publie_le)}</div>}
          </div>
        </>
      )}
    </div>
  )
}

export function VignettesActualites() {
  const nav = useNavigate()
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let on = true
    supabase.from('actualites')
      .select('id,titre,chapo,vignette_path,vignette_html,publie_le')
      .eq('statut', 'publie')
      .or(`publie_le.is.null,publie_le.lte."${new Date().toISOString()}"`)
      .order('publie_le', { ascending: false, nullsFirst: false })
      .limit(4)
      .then(({ data }) => { if (on) setRows(data || []) })
      .catch(() => { if (on) setRows([]) })
    return () => { on = false }
  }, [])

  if (!rows?.length) return null
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--heading)' }}>Actualités</div>
        <button type="button" onClick={() => nav('/app/actualites')} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
          Toutes les actualités
        </button>
      </div>
      <div className="ha-actu-grid">
        {rows.map(a => (
          <CarteActualite key={a.id} row={a} onOpen={() => nav(`/app/actualites/${a.id}`)} />
        ))}
      </div>
    </section>
  )
}
