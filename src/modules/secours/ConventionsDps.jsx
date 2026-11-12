import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, Empty, Loading, Flash } from '@/components/ui'
import {
  DISPOSITIFS,
  libelleDispositif,
  peutCreerActiviteSecours,
  STATUTS_CONVENTION,
  MODELE_ENGAGEMENTS_ASBL,
  MODELE_ENGAGEMENTS_ORGANISATEUR,
  MODELE_ENGAGEMENTS_COMMUNS,
  dispositifsDeActivite,
} from './activitesSecours'

const VIDE = {
  id: null,
  titre: '',
  activiteId: '',
  organisateurNom: '',
  organisateurRepresentant: '',
  organisateurAdresse: '',
  organisateurContact: '',
  manifestationLieu: '',
  manifestationAdresse: '',
  montant: '',
  engagementsAsbl: MODELE_ENGAGEMENTS_ASBL,
  engagementsOrganisateur: MODELE_ENGAGEMENTS_ORGANISATEUR,
  engagementsCommuns: MODELE_ENGAGEMENTS_COMMUNS,
  litiges: 'En cas de litige, les parties recherchent une solution amiable avant tout recours.',
  statut: 'brouillon',
  typeDispositifs: [],
}

function fmtEuro(n) {
  if (n == null || n === '') return '—'
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(v)
}

export default function ConventionsDps() {
  const { profile } = useAuth()
  const gerer = peutCreerActiviteSecours(profile)
  const [rows, setRows] = useState(null)
  const [activites, setActivites] = useState([])
  const [form, setForm] = useState(null)
  const [err, setErr] = useState(null)
  const [flash, setFlash] = useState(null)
  const [sauve, setSauve] = useState(false)

  useEffect(() => { charger() }, [])

  async function charger() {
    setErr(null)
    const [c, a] = await Promise.all([
      supabase.from('conventions_dps').select('*').order('created_at', { ascending: false }),
      supabase.from('activites_secours').select('id,numero,titre,lieu,adresse,organisateur_nom,organisateur_contact,dispositif,dispositifs,debut,fin').order('debut', { ascending: false }).limit(80),
    ])
    if (c.error) setErr(c.error.message)
    setRows(c.data || [])
    setActivites(a.data || [])
  }

  if (!gerer) return <Navigate to="/app/secours/activites" replace />

  function maj(patch) { setForm(f => ({ ...f, ...patch })) }

  function ouvrirCreation() {
    setFlash(null)
    setForm({ ...VIDE })
  }

  function ouvrirEdition(r) {
    setFlash(null)
    setForm({
      id: r.id,
      titre: r.titre || '',
      activiteId: r.activite_id || '',
      organisateurNom: r.organisateur_nom || '',
      organisateurRepresentant: r.organisateur_representant || '',
      organisateurAdresse: r.organisateur_adresse || '',
      organisateurContact: r.organisateur_contact || '',
      manifestationLieu: r.manifestation_lieu || '',
      manifestationAdresse: r.manifestation_adresse || '',
      montant: r.montant_eur == null ? '' : String(r.montant_eur),
      engagementsAsbl: r.engagements_asbl || MODELE_ENGAGEMENTS_ASBL,
      engagementsOrganisateur: r.engagements_organisateur || MODELE_ENGAGEMENTS_ORGANISATEUR,
      engagementsCommuns: r.engagements_communs || MODELE_ENGAGEMENTS_COMMUNS,
      litiges: r.litiges || '',
      statut: r.statut || 'brouillon',
      typeDispositifs: Array.isArray(r.type_dispositifs) ? r.type_dispositifs : [],
    })
  }

  function lierActivite(id) {
    const a = activites.find(x => x.id === id)
    if (!a) { maj({ activiteId: id }); return }
    const types = dispositifsDeActivite(a)
    maj({
      activiteId: id,
      titre: form.titre || `Convention DPS — ${a.titre}`,
      organisateurNom: form.organisateurNom || a.organisateur_nom || '',
      organisateurContact: form.organisateurContact || a.organisateur_contact || '',
      manifestationLieu: form.manifestationLieu || a.lieu || '',
      manifestationAdresse: form.manifestationAdresse || a.adresse || '',
      typeDispositifs: types.length ? types : form.typeDispositifs,
    })
  }

  function toggleType(v) {
    maj({
      typeDispositifs: form.typeDispositifs.includes(v)
        ? form.typeDispositifs.filter(x => x !== v)
        : [...form.typeDispositifs, v],
    })
  }

  async function enregistrer(e) {
    e.preventDefault()
    if (!form || sauve) return
    const titre = form.titre.trim()
    const organisateurNom = form.organisateurNom.trim()
    if (!titre) { setFlash('Indiquez le titre.'); return }
    if (!organisateurNom) { setFlash('Indiquez l’organisateur.'); return }
    const montant = form.montant === '' ? null : Number(String(form.montant).replace(',', '.'))
    if (montant != null && (!Number.isFinite(montant) || montant < 0)) {
      setFlash('Le montant est invalide.'); return
    }
    setSauve(true)
    setFlash(null)
    const payload = {
      titre,
      activite_id: form.activiteId || null,
      organisateur_nom: organisateurNom,
      organisateur_representant: form.organisateurRepresentant.trim() || null,
      organisateur_adresse: form.organisateurAdresse.trim() || null,
      organisateur_contact: form.organisateurContact.trim() || null,
      manifestation_lieu: form.manifestationLieu.trim() || null,
      manifestation_adresse: form.manifestationAdresse.trim() || null,
      type_dispositifs: form.typeDispositifs,
      montant_eur: montant,
      engagements_asbl: form.engagementsAsbl.trim() || null,
      engagements_organisateur: form.engagementsOrganisateur.trim() || null,
      engagements_communs: form.engagementsCommuns.trim() || null,
      litiges: form.litiges.trim() || null,
      statut: form.statut,
      signe_le: form.statut === 'signee' ? new Date().toISOString().slice(0, 10) : null,
    }
    let res
    if (form.id) {
      res = await supabase.from('conventions_dps').update(payload).eq('id', form.id).select('id').maybeSingle()
    } else {
      res = await supabase.from('conventions_dps').insert({ ...payload, created_by: profile?.id || null }).select('id').maybeSingle()
    }
    if (res.error) setFlash(res.error.message || 'Enregistrement impossible.')
    else {
      if (form.activiteId && res.data?.id) {
        await supabase.from('activites_secours').update({ convention_id: res.data.id }).eq('id', form.activiteId)
      }
      setForm(null)
      await charger()
    }
    setSauve(false)
  }

  return (
    <Page
      title="Conventions DPS"
      subtitle="Montant clair, engagements ASBL et organisateur. Modèle aligné sur les clauses DPS (RN-DPS)."
      action={<Btn onClick={ouvrirCreation}>+ Convention</Btn>}
    >
      {err && <Flash kind="err">{err}</Flash>}
      {flash && <Flash kind="err">{flash}</Flash>}

      {form && (
        <Card style={{ marginBottom: 14, padding: 14 }}>
          <form onSubmit={enregistrer}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '0 12px' }}>
              <F label="Titre" value={form.titre} set={v => maj({ titre: v })} required />
              <label style={{ marginBottom: 10, display: 'block' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Activité liée</span>
                <select value={form.activiteId} onChange={e => lierActivite(e.target.value)} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}>
                  <option value="">—</option>
                  {activites.map(a => (
                    <option key={a.id} value={a.id}>#{a.numero} {a.titre}</option>
                  ))}
                </select>
              </label>
              <F label="Organisateur" value={form.organisateurNom} set={v => maj({ organisateurNom: v })} required />
              <F label="Représentant organisateur" value={form.organisateurRepresentant} set={v => maj({ organisateurRepresentant: v })} />
              <F label="Adresse organisateur" value={form.organisateurAdresse} set={v => maj({ organisateurAdresse: v })} />
              <F label="Contact organisateur" value={form.organisateurContact} set={v => maj({ organisateurContact: v })} />
              <F label="Lieu manifestation" value={form.manifestationLieu} set={v => maj({ manifestationLieu: v })} />
              <F label="Adresse exacte manifestation" value={form.manifestationAdresse} set={v => maj({ manifestationAdresse: v })} />
              <F label="Montant participation (€)" value={form.montant} set={v => maj({ montant: v })} />
              <label style={{ marginBottom: 10, display: 'block' }}>
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Statut</span>
                <select value={form.statut} onChange={e => maj({ statut: e.target.value })} style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}>
                  {STATUTS_CONVENTION.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
                </select>
              </label>
            </div>

            <div style={{ margin: '8px 0 12px' }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Prestations / équipes</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {DISPOSITIFS.map(d => (
                  <button
                    key={d.v}
                    type="button"
                    onClick={() => toggleType(d.v)}
                    style={{
                      border: '1px solid var(--border)', borderRadius: 999, padding: '4px 10px', fontSize: 12.5, fontWeight: 600,
                      background: form.typeDispositifs.includes(d.v) ? 'var(--accent)' : 'var(--surface)',
                      color: form.typeDispositifs.includes(d.v) ? '#fff' : 'var(--text)',
                      fontFamily: 'inherit', cursor: 'pointer',
                    }}
                  >
                    {d.court}
                  </button>
                ))}
              </div>
            </div>

            <label style={{ display: 'block', marginBottom: 10 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Engagements Heart's Angels</span>
              <textarea rows={6} value={form.engagementsAsbl} onChange={e => maj({ engagementsAsbl: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }} />
            </label>
            <label style={{ display: 'block', marginBottom: 10 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Engagements organisateur</span>
              <textarea rows={6} value={form.engagementsOrganisateur} onChange={e => maj({ engagementsOrganisateur: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }} />
            </label>
            <label style={{ display: 'block', marginBottom: 10 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Engagements communs</span>
              <textarea rows={3} value={form.engagementsCommuns} onChange={e => maj({ engagementsCommuns: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }} />
            </label>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Litiges</span>
              <textarea rows={2} value={form.litiges} onChange={e => maj({ litiges: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }} />
            </label>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn type="submit" disabled={sauve}>{form.id ? 'Enregistrer' : 'Créer la convention'}</Btn>
              <Btn kind="soft" type="button" onClick={() => setForm(null)} disabled={sauve}>Annuler</Btn>
            </div>
          </form>
        </Card>
      )}

      {rows === null ? <Loading /> : rows.length === 0 ? (
        <Empty title="Aucune convention" hint="Créez la première convention DPS pour un organisateur." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map(r => {
            const st = STATUTS_CONVENTION.find(s => s.v === r.statut)?.l || r.statut
            return (
              <Card key={r.id} style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--heading)' }}>#{r.numero} · {r.titre}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      {r.organisateur_nom}
                      {(r.type_dispositifs || []).length ? ` · ${(r.type_dispositifs || []).map(v => libelleDispositif(v, true)).join(', ')}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700 }}>{fmtEuro(r.montant_eur)}</span>
                    <span style={{ fontSize: 12, fontWeight: 650, padding: '3px 8px', borderRadius: 99, background: 'var(--bg-alt)' }}>{st}</span>
                    <Btn kind="soft" style={{ padding: '4px 10px' }} onClick={() => ouvrirEdition(r)}>Éditer</Btn>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      <p style={{ marginTop: 14, fontSize: 12.5, color: 'var(--text-muted)' }}>
        Les fiches patient du terrain seront gérées dans l’appli liée <code>patient-registry</code>, rattachées à l’activité DPS.
        {' '}<Link to="/app/secours/activites">Retour aux activités ›</Link>
      </p>
    </Page>
  )
}
