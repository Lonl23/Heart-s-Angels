import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, Empty, Loading, Pill, F } from '@/components/ui'
import { QUALIFS, ROLES_ASBL } from '@/modules/fiche/ficheSchema'
import { libelleValidite, onboardingScore, validitesFiche } from '@/lib/erpRh'

const lblQual = v => QUALIFS.find(q => q.v === v)?.l || v
const lblRole = v => ROLES_ASBL.find(r => r.v === v)?.l || v

export default function Equipe() {
  const { peutGererFiches, peutGererDispos, accesTotal, can } = useAuth()
  const ok = accesTotal() || can('admin') || peutGererFiches() || peutGererDispos()
  const [membres, setMembres] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filtre, setFiltre] = useState('tous') // tous | alertes | incomplet

  useEffect(() => {
    if (!ok) return
    setLoading(true)
    supabase.from('profiles')
      .select('id,prenom,nom,email,role,actif,fiche')
      .neq('role', 'partenaire')
      .order('nom')
      .then(({ data }) => { setMembres(data || []); setLoading(false) })
  }, [ok])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return membres
      .map(m => {
        const fiche = m.fiche || {}
        const alerts = validitesFiche(fiche)
        const onboard = onboardingScore(fiche)
        return { ...m, fiche, alerts, onboard }
      })
      .filter(m => {
        if (filtre === 'alertes' && !m.alerts.length) return false
        if (filtre === 'incomplet' && m.onboard.pct >= 100) return false
        if (!needle) return true
        const blob = `${m.prenom} ${m.nom} ${m.email} ${(m.fiche.qualifications || []).join(' ')}`.toLowerCase()
        return blob.includes(needle)
      })
  }, [membres, q, filtre])

  if (!ok) {
    return (
      <Page title="Équipe" subtitle="Module RH">
        <Empty title="Accès réservé" hint="Coordination bénévoles, coordinateurs et administration." />
      </Page>
    )
  }

  const nbAlertes = membres.filter(m => validitesFiche(m.fiche || {}).length).length
  const nbInc = membres.filter(m => onboardingScore(m.fiche || {}).pct < 100).length

  return (
    <Page title="Équipe" subtitle="Hub RH — membres, onboarding, validités ATNUP / 112 / sélection"
      action={<Link to="/app/admin"><Btn kind="soft">Administration ›</Btn></Link>}>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
        {[
          { v:'tous', l:`Tous (${membres.length})` },
          { v:'alertes', l:`Validités (${nbAlertes})` },
          { v:'incomplet', l:`Onboarding (${nbInc})` },
        ].map(f => (
          <button key={f.v} type="button" onClick={() => setFiltre(f.v)}
            style={{ padding:'8px 12px', borderRadius:9, border:'1px solid var(--border)', background: filtre===f.v?'var(--accent)':'var(--card)', color: filtre===f.v?'#fff':'var(--text-2)', fontWeight:600, fontSize:13, cursor:'pointer' }}>
            {f.l}
          </button>
        ))}
      </div>
      <div style={{ maxWidth:360, marginBottom:16 }}>
        <F label="Rechercher" value={q} set={setQ} placeholder="Nom, e-mail, qualification…" />
      </div>

      {loading ? <Loading /> : rows.length === 0 ? (
        <Empty title="Personne ici" hint="Modifiez le filtre ou invitez un membre dans Administration." />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {rows.map(m => (
            <Card key={m.id} style={{ padding:'14px 16px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap', alignItems:'flex-start' }}>
                <div style={{ minWidth:0, flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                    <strong style={{ color:'var(--text)', fontSize:15 }}>{m.prenom} {m.nom}</strong>
                    {!m.actif && <Pill color="#A32D2D" bg="#FCEBEB">Inactif</Pill>}
                    <Pill color="#185FA5" bg="#E6F1FB">{m.role}</Pill>
                    <Pill color={m.onboard.pct === 100 ? '#1E5C1E' : '#BA7517'} bg={m.onboard.pct === 100 ? '#EAF5EA' : '#FAEEDA'}>
                      Onboarding {m.onboard.pct}%
                    </Pill>
                  </div>
                  <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:4 }}>
                    {(m.fiche.qualifications || []).map(lblQual).join(' · ') || 'Sans qualification'}
                    {(m.fiche.roles_asbl || []).length > 0 && ` · ${m.fiche.roles_asbl.map(lblRole).join(', ')}`}
                  </div>
                  {m.alerts.length > 0 && (
                    <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:4 }}>
                      {m.alerts.map(a => (
                        <div key={a.id} style={{ fontSize:12.5, color: a.level === 'bientot' ? '#BA7517' : '#A32D2D' }}>
                          {libelleValidite(a)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {peutGererFiches() || accesTotal() || can('admin') ? (
                  <Link to="/app/admin" state={{ openFiche: m.id }}>
                    <Btn kind="soft">Ouvrir fiche</Btn>
                  </Link>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
      <p style={{ fontSize:12, color:'var(--text-faint)', marginTop:16 }}>
        Les fiches se gèrent encore dans Administration. Ce hub regroupe la vision RH du coordinateur.
      </p>
    </Page>
  )
}
