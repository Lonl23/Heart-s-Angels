import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, Btn, Loading, Flash, Pill } from '@/components/ui'
import { STATUTS, stInfo } from './statuts'

const STATUTS_SUIVI = ['pret', 'en_cours', 'terminee_terrain']

function fmtKm(v) {
  if (v == null || v === '') return '—'
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? String(n) : String(v)
}

function fmtEssence(v) {
  if (v == null || v === '') return '—'
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) ? `${n} %` : String(v)
}

function TrackerBloc({ v }) {
  const t = v?.tracker || {}
  const id = t.id || v?.tracker_id || ''
  const vitesse = t.vitesse_kmh ?? v?.tracker_vitesse
  const lat = t.lat ?? v?.tracker_lat
  const lng = t.lng ?? v?.tracker_lng
  const maj = t.maj_at || v?.tracker_maj_at
  if (!id && vitesse == null && lat == null) {
    return (
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>
        Tracker ambulance : en attente de branchement (vitesse / position dès que le boîtier est relié).
      </div>
    )
  }
  return (
    <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>
      <div><strong>Tracker</strong>{id ? ` · ${id}` : ''}</div>
      <div>
        Vitesse : {vitesse == null || vitesse === '' ? '—' : `${vitesse} km/h`}
        {(lat != null && lng != null) ? ` · ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : ''}
      </div>
      {maj && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Maj : {new Date(maj).toLocaleString('fr-BE')}</div>}
    </div>
  )
}

export default function SuiviTerrain() {
  const nav = useNavigate()
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)

  async function load() {
    setErr(null)
    const { data, error } = await supabase.from('souhaits')
      .select('id, statut, beneficiaire_prenom, beneficiaire_nom, date_souhaitee, date_fin, mission, fictif')
      .in('statut', STATUTS_SUIVI)
      .order('date_souhaitee', { ascending: true })
    if (error) { setErr(error.message); setRows([]); return }
    setRows((data || []).filter(s => !s.fictif && !s.mission?.demo_cle))
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  if (rows == null) return <div style={{ padding: 16 }}><Loading /></div>
  if (err) return <div style={{ padding: 16 }}><Flash kind="err">{err}</Flash></div>

  return (
    <div className="ha-page-scroll" style={{ padding: '8px 0 40px' }}>
      <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--text-muted)' }}>
        Souhaits prêts ou en cours : kilométrages, carburant au départ, statut, et emplacement pour le tracker ambulance.
      </p>
      {rows.length === 0 && (
        <Card>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Aucun souhait en cours pour le moment.</div>
        </Card>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map(s => {
          const st = stInfo(s.statut)
          const vecteurs = Array.isArray(s.mission?.vecteurs) ? s.mission.vecteurs : []
          const nom = [s.beneficiaire_prenom, s.beneficiaire_nom].filter(Boolean).join(' ') || 'Souhait'
          return (
            <Card key={s.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--heading)', fontSize: '1.05rem' }}>{nom}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                    {s.date_souhaitee
                      ? new Date(String(s.date_souhaitee).slice(0, 10) + 'T12:00:00').toLocaleDateString('fr-BE')
                      : 'Date à préciser'}
                    {s.date_fin && s.date_fin !== s.date_souhaitee
                      ? ` → ${new Date(String(s.date_fin).slice(0, 10) + 'T12:00:00').toLocaleDateString('fr-BE')}`
                      : ''}
                  </div>
                </div>
                <Pill color={st.c} bg={st.bg}>{st.l || STATUTS[s.statut]?.l || s.statut}</Pill>
              </div>
              {vecteurs.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 10 }}>Aucun vecteur encodé.</div>
              ) : vecteurs.map((v, i) => (
                <div key={v.id || i} style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--heading)' }}>
                    {v.nom || `Vecteur ${i + 1}`}{v.plaque ? ` · ${v.plaque}` : ''}{v.type_transport ? ` · ${v.type_transport}` : ''}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, marginTop: 8, fontSize: 13.5 }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>KM début</span><div style={{ fontWeight: 700 }}>{fmtKm(v.kms_depart)}</div></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>KM fin</span><div style={{ fontWeight: 700 }}>{fmtKm(v.kms_retour)}</div></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Carburant départ</span><div style={{ fontWeight: 700 }}>{fmtEssence(v.essence_pct)}</div></div>
                  </div>
                  <TrackerBloc v={v} />
                </div>
              ))}
              <div style={{ marginTop: 12 }}>
                <Btn kind="soft" onClick={() => nav(`/app/souhaits/${s.id}/preparer`)}>Ouvrir</Btn>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
