import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Page, Card, Empty, Loading } from '@/components/ui'

const STATUTS = [
  { v: 'en_attente', l: 'En attente' },
  { v: 'approuve_n1', l: 'Validé (niveau 1)' },
  { v: 'approuve_n2', l: 'Validé (niveau 2)' },
  { v: 'paye', l: 'Payé' },
  { v: 'refuse', l: 'Refusé' },
]
const lblStatut = v => STATUTS.find(s => s.v === v)?.l || v || '—'
const euros = n => new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0)
function fmtDate(d) {
  const [y, m, day] = String(d || '').slice(0, 10).split('-')
  return y && m && day ? `${day}/${m}/${y}` : '—'
}

export default function Tresorerie() {
  const [lignes, setLignes] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    supabase.from('defraiements').select('id,numero,date_frais,description,montant,statut').order('date_frais', { ascending: false })
      .then(({ data, error }) => {
        if (error) setErr(error.message)
        setLignes(data || [])
      })
  }, [])

  const somme = (pred) => (lignes || []).filter(pred).reduce((s, l) => s + Number(l.montant || 0), 0)
  const tuiles = [
    { l: 'En attente', n: somme(l => l.statut === 'en_attente') },
    { l: 'Validés', n: somme(l => l.statut === 'approuve_n1' || l.statut === 'approuve_n2') },
    { l: 'Payés', n: somme(l => l.statut === 'paye') },
    { l: 'Refusés', n: somme(l => l.statut === 'refuse') },
  ]

  return (
    <Page title="Trésorerie" subtitle="Suivi des défraiements. La saisie d’un frais se fait dans Gestion RH.">
      {err && <div style={{ color: '#A32D2D', fontSize: 13, marginBottom: 10 }}>{err}</div>}
      {lignes === null ? <Loading /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginBottom: 18 }}>
            {tuiles.map(t => (
              <Card key={t.l} style={{ padding: '12px 14px' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{t.l}</div>
                <div style={{ fontSize: '1.25rem', color: 'var(--heading)', marginTop: 4 }}>{euros(t.n)}</div>
              </Card>
            ))}
          </div>
          {lignes.length === 0 ? (
            <Empty title="Aucun défraiement" hint="Les notes de frais enregistrées apparaîtront ici." />
          ) : (
            <Card style={{ padding: 0, overflow: 'auto' }}>
              <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-alt)' }}>
                    {['Date', 'N°', 'Description', 'Statut', 'Montant'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: h === 'Montant' ? 'right' : 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lignes.map(l => (
                    <tr key={l.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={td}>{fmtDate(l.date_frais)}</td>
                      <td style={td}>{l.numero || '—'}</td>
                      <td style={td}>{l.description}</td>
                      <td style={td}>{lblStatut(l.statut)}</td>
                      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{euros(l.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </Page>
  )
}

const td = { padding: '10px 14px', color: 'var(--text)' }
