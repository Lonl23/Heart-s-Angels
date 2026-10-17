import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

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

export function VignettesActualites() {
  const nav = useNavigate()
  const [rows, setRows] = useState(null)

  useEffect(() => {
    let on = true
    supabase.from('actualites')
      .select('id,titre,chapo,vignette_path,publie_le')
      .eq('statut', 'publie')
      .order('publie_le', { ascending: false })
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
          <button key={a.id} type="button" className="ha-actu-card" onClick={() => nav(`/app/actualites/${a.id}`)}>
            <Couverture path={a.vignette_path} titre={a.titre} />
            <div className="ha-actu-card-corps">
              <div className="ha-actu-card-titre">{a.titre}</div>
              {a.chapo && <div className="ha-actu-card-chapo">{a.chapo}</div>}
              {fmtPublie(a.publie_le) && <div className="ha-actu-card-date">{fmtPublie(a.publie_le)}</div>}
            </div>
          </button>
        ))}
      </div>
    </section>
  )
}
