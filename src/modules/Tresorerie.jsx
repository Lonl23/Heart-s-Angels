import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Empty, Loading, Btn } from '@/components/ui'
import { STATUTS_NOTE, fmtEuro, titrePeriode } from '@/modules/defraiements/constantes'

const TUILES = [
  { l: 'Demandées', pred: s => s === 'soumise' },
  { l: 'Vérifiées', pred: s => s === 'verifiee' },
  { l: 'Autorisées', pred: s => s === 'approuve_n1' || s === 'approuve_n2' },
  { l: 'Payées', pred: s => s === 'paye' },
]

function nomProfil(p) {
  return [p?.prenom, p?.nom].filter(Boolean).join(' ') || 'Volontaire'
}

export default function Tresorerie() {
  const { peutGererDefraiements } = useAuth()
  const [notes, setNotes] = useState(null)
  const [profils, setProfils] = useState({})
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!peutGererDefraiements()) return
    supabase.from('notes_frais').select('id,user_id,periode_mois,periode_annee,statut,total').order('periode_annee', { ascending: false }).order('periode_mois', { ascending: false })
      .then(async ({ data, error }) => {
        if (error) setErr(error.message)
        const rows = data || []
        setNotes(rows)
        const ids = [...new Set(rows.map(n => n.user_id).filter(Boolean))]
        if (!ids.length) return
        const { data: ps } = await supabase.from('profiles').select('id,prenom,nom').in('id', ids)
        setProfils(Object.fromEntries((ps || []).map(p => [p.id, p])))
      })
  }, [peutGererDefraiements])

  if (!peutGererDefraiements()) return <Navigate to="/app" replace />

  const somme = pred => (notes || []).filter(n => pred(n.statut)).reduce((s, n) => s + (Number(n.total) || 0), 0)

  return (
    <Page
      title="Trésorerie"
      subtitle="Suivi des notes de frais. La saisie et la validation restent dans Défraiements."
      action={<Link to="/app/defraiements"><Btn kind="soft">Ouvrir les notes ›</Btn></Link>}
    >
      {err && <div style={{ color: '#A32D2D', fontSize: 13, marginBottom: 10 }}>{err}</div>}
      {notes === null ? <Loading /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 18 }}>
            {TUILES.map(t => (
              <Card key={t.l} style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{t.l}</div>
                <div style={{ fontSize: '1.25rem', color: 'var(--heading)', marginTop: 4 }}>{fmtEuro(somme(t.pred))}</div>
              </Card>
            ))}
          </div>
          {notes.length === 0 ? (
            <Empty title="Aucune note de frais" hint="Les notes enregistrées par les volontaires apparaîtront ici." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notes.map(n => {
                const st = STATUTS_NOTE[n.statut] || STATUTS_NOTE.en_attente
                return (
                  <Card key={n.id} style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 650, color: 'var(--text)' }}>{titrePeriode(n.periode_mois, n.periode_annee)}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{nomProfil(profils[n.user_id])}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 650, color: st.c, background: st.bg, borderRadius: 99, padding: '3px 8px' }}>{st.l}</span>
                        <span style={{ fontWeight: 700, color: 'var(--heading)' }}>{fmtEuro(n.total)}</span>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </Page>
  )
}
