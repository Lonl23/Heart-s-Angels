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

function csvEscape(v) {
  const s = String(v ?? '')
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export default function Tresorerie() {
  const { peutGererDefraiements } = useAuth()
  const [notes, setNotes] = useState(null)
  const [profils, setProfils] = useState({})
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    if (!peutGererDefraiements()) return
    charger()
  }, [peutGererDefraiements])

  async function charger() {
    const { data, error } = await supabase
      .from('notes_frais')
      .select('id,user_id,periode_mois,periode_annee,statut,total')
      .order('periode_annee', { ascending: false })
      .order('periode_mois', { ascending: false })
    if (error) setErr(error.message)
    const rows = data || []
    setNotes(rows)
    const ids = [...new Set(rows.map(n => n.user_id).filter(Boolean))]
    if (!ids.length) { setProfils({}); return }
    const { data: ps } = await supabase.from('profiles').select('id,prenom,nom').in('id', ids)
    setProfils(Object.fromEntries((ps || []).map(p => [p.id, p])))
  }

  if (!peutGererDefraiements()) return <Navigate to="/app" replace />

  const somme = pred => (notes || []).filter(n => pred(n.statut)).reduce((s, n) => s + (Number(n.total) || 0), 0)

  function exporterCsv() {
    if (!notes?.length) return
    const lignes = [
      ['periode', 'volontaire', 'statut', 'total'].join(';'),
      ...notes.map(n => {
        const st = STATUTS_NOTE[n.statut] || STATUTS_NOTE.en_attente
        return [
          csvEscape(titrePeriode(n.periode_mois, n.periode_annee)),
          csvEscape(nomProfil(profils[n.user_id])),
          csvEscape(st.l),
          csvEscape(String(Number(n.total) || 0).replace('.', ',')),
        ].join(';')
      }),
    ]
    const blob = new Blob([lignes.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'tresorerie-notes-frais.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1500)
  }

  async function marquerPayee(n) {
    if (!n?.id || busy) return
    if (!['approuve_n1', 'approuve_n2'].includes(n.statut)) return
    if (!window.confirm(`Marquer comme payée la note ${titrePeriode(n.periode_mois, n.periode_annee)} ?`)) return
    setBusy(n.id)
    setErr(null)
    const { error } = await supabase.from('notes_frais').update({ statut: 'paye' }).eq('id', n.id)
    if (error) setErr(error.message)
    else await charger()
    setBusy(null)
  }

  return (
    <Page
      title="Trésorerie"
      subtitle="Suivi des notes de frais. La saisie et la validation restent dans Défraiements."
      action={(
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn kind="soft" onClick={exporterCsv} disabled={!notes?.length}>Exporter CSV</Btn>
          <Link to="/app/defraiements"><Btn kind="soft">Ouvrir les notes ›</Btn></Link>
        </div>
      )}
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
                const peutPayer = n.statut === 'approuve_n1' || n.statut === 'approuve_n2'
                return (
                  <Card key={n.id} style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 650, color: 'var(--text)' }}>{titrePeriode(n.periode_mois, n.periode_annee)}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{nomProfil(profils[n.user_id])}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 650, color: st.c, background: st.bg, borderRadius: 99, padding: '3px 8px' }}>{st.l}</span>
                        <span style={{ fontWeight: 700, color: 'var(--heading)' }}>{fmtEuro(n.total)}</span>
                        {peutPayer && (
                          <Btn kind="soft" style={{ padding: '4px 10px' }} disabled={busy === n.id} onClick={() => marquerPayee(n)}>
                            {busy === n.id ? '…' : 'Marquer payée'}
                          </Btn>
                        )}
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
