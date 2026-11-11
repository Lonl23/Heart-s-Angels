import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import config from '@/app.config'
import { Page, Card, Btn, F, Sel, Empty, Loading, Pill, Flash, inp, lbl } from '@/components/ui'

const CATS = [
  { v: 'transport_km', l: 'Transport (km)' },
  { v: 'carburant', l: 'Carburant' },
  { v: 'repas', l: 'Repas' },
  { v: 'materiel_medical', l: 'Matériel médical' },
  { v: 'materiel_logistique', l: 'Matériel logistique' },
  { v: 'billets_entrees', l: 'Billets / entrées' },
  { v: 'hebergement', l: 'Hébergement' },
  { v: 'communication', l: 'Communication' },
  { v: 'autre', l: 'Autre' },
]

const STATUT = {
  en_attente: { l: 'En attente', c: '#BA7517', bg: '#FAEEDA' },
  approuve_n1: { l: 'Validé N1', c: '#185FA5', bg: '#E6F1FB' },
  approuve_n2: { l: 'Validé N2', c: '#1E5C1E', bg: '#EAF5EA' },
  refuse: { l: 'Refusé', c: '#A32D2D', bg: '#FCEBEB' },
  paye: { l: 'Payé', c: '#1E5C1E', bg: '#EAF5EA' },
}

function euro(n) {
  const v = Number(n)
  if (Number.isNaN(v)) return '—'
  return v.toLocaleString('fr-BE', { style: 'currency', currency: 'EUR' })
}

export default function Defraiements() {
  const { user, profile, peutValiderDefraiementsN1, peutValiderDefraiementsN2 } = useAuth()
  const n1 = peutValiderDefraiementsN1?.()
  const n2 = peutValiderDefraiementsN2?.()
  const taux = Number(config.organisation?.tauxKm) || 0.4201
  const [tab, setTab] = useState('mine')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => { load() }, [tab, user?.id])

  async function load() {
    if (!user?.id) return
    setLoading(true); setErr(null)
    let q = supabase.from('defraiements').select('*, profiles:user_id(prenom,nom)').order('created_at', { ascending: false }).limit(200)
    if (tab === 'mine') q = q.eq('user_id', user.id)
    else if (tab === 'valider') q = q.in('statut', ['en_attente', 'approuve_n1'])
    else if (tab === 'payes') q = q.eq('statut', 'paye')
    const { data, error } = await q
    if (error) setErr(error.message)
    setRows(data || [])
    setLoading(false)
  }

  function flash(t, ok = true) {
    setMsg({ t, ok })
    setTimeout(() => setMsg(null), 3500)
  }

  async function creer(f) {
    const isKm = f.categorie === 'transport_km'
    const km = isKm ? Number(f.km) : null
    const montant = isKm ? Math.round(km * taux * 100) / 100 : Number(f.montant)
    if (!f.description?.trim()) { flash('Description requise.', false); return }
    if (!f.date_frais) { flash('Date requise.', false); return }
    if (isKm && (!(km > 0))) { flash('Indiquez les kilomètres.', false); return }
    if (!isKm && (!(montant > 0))) { flash('Montant invalide.', false); return }
    const payload = {
      user_id: user.id,
      date_frais: f.date_frais,
      categorie: f.categorie,
      description: f.description.trim(),
      montant: montant > 0 ? montant : 0.01,
      km: isKm ? km : null,
      taux_km: isKm ? taux : null,
      statut: 'en_attente',
    }
    const { error } = await supabase.from('defraiements').insert(payload)
    if (error) { flash(error.message, false); return }
    setForm(null); flash('Note de frais envoyée.'); load()
  }

  async function patch(id, body) {
    const { error } = await supabase.from('defraiements').update(body).eq('id', id)
    if (error) { flash(error.message, false); return }
    flash('Mis à jour.'); load()
  }

  const tabs = useMemo(() => {
    const t = [{ v: 'mine', l: 'Mes notes' }]
    if (n1 || n2) t.push({ v: 'valider', l: 'À valider' })
    if (n2) t.push({ v: 'payes', l: 'Payés' })
    return t
  }, [n1, n2])

  return (
    <Page title="Défraiements" subtitle={`Notes de frais · barème ${taux} €/km`}
      action={<Btn onClick={() => setForm({
        date_frais: new Date().toISOString().slice(0, 10),
        categorie: 'transport_km',
        description: '',
        km: '',
        montant: '',
      })}>+ Nouvelle note</Btn>}>
      {msg && <Flash kind={msg.ok ? undefined : 'err'}>{msg.t}</Flash>}
      {err && <Flash kind="err">{err}</Flash>}

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
        {tabs.map(t => (
          <button key={t.v} type="button" onClick={() => setTab(t.v)}
            style={{ padding:'8px 12px', borderRadius:9, border:'1px solid var(--border)', background: tab===t.v?'var(--accent)':'var(--card)', color: tab===t.v?'#fff':'var(--text-2)', fontWeight:600, fontSize:13, cursor:'pointer' }}>
            {t.l}
          </button>
        ))}
      </div>

      {form && (
        <Card style={{ marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
            <strong>Nouvelle note de frais</strong>
            <Btn kind="soft" onClick={() => setForm(null)}>Annuler</Btn>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12 }}>
            <F label="Date" type="date" value={form.date_frais} set={v => setForm(s => ({ ...s, date_frais: v }))} required />
            <Sel label="Catégorie" value={form.categorie} set={v => setForm(s => ({ ...s, categorie: v }))} options={CATS} />
            {form.categorie === 'transport_km' ? (
              <F label="Kilomètres" type="number" value={form.km} set={v => setForm(s => ({ ...s, km: v }))} required />
            ) : (
              <F label="Montant (€)" type="number" value={form.montant} set={v => setForm(s => ({ ...s, montant: v }))} required />
            )}
          </div>
          {form.categorie === 'transport_km' && Number(form.km) > 0 && (
            <div style={{ fontSize:13, color:'var(--text-muted)', margin:'8px 0' }}>
              Estimation : {euro(Number(form.km) * taux)} ({form.km} km × {taux} €)
            </div>
          )}
          <div style={{ marginTop:8 }}>
            <label style={lbl}>Description</label>
            <textarea value={form.description} onChange={e => setForm(s => ({ ...s, description: e.target.value }))}
              rows={3} style={{ ...inp, width:'100%', minHeight:72 }} placeholder="Mission, trajet, motif…" />
          </div>
          <Btn onClick={() => creer(form)} style={{ width:'100%', marginTop:12 }}>Envoyer</Btn>
        </Card>
      )}

      {loading ? <Loading /> : rows.length === 0 ? (
        <Empty title="Aucune note" hint="Créez une note de frais (km ou montant)." />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {rows.map(r => {
            const st = STATUT[r.statut] || STATUT.en_attente
            const qui = r.profiles ? `${r.profiles.prenom || ''} ${r.profiles.nom || ''}`.trim() : ''
            return (
              <Card key={r.id} style={{ padding:'14px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
                  <div>
                    <div style={{ fontWeight:700, color:'var(--text)' }}>
                      {r.numero || 'Sans n°'} · {euro(r.montant_km || r.montant)}
                    </div>
                    <div style={{ fontSize:13, color:'var(--text-2)', marginTop:4 }}>{r.description}</div>
                    <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:4 }}>
                      {r.date_frais} · {CATS.find(c => c.v === r.categorie)?.l || r.categorie}
                      {r.km != null ? ` · ${r.km} km` : ''}
                      {qui && tab !== 'mine' ? ` · ${qui}` : ''}
                    </div>
                  </div>
                  <Pill color={st.c} bg={st.bg}>{st.l}</Pill>
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:10 }}>
                  {tab === 'mine' && r.statut === 'en_attente' && r.user_id === user.id && (
                    <Btn kind="danger" onClick={async () => {
                      if (!confirm('Supprimer cette note ?')) return
                      const { error } = await supabase.from('defraiements').delete().eq('id', r.id)
                      if (error) flash(error.message, false)
                      else { flash('Supprimée.'); load() }
                    }}>
                      Supprimer
                    </Btn>
                  )}
                  {tab === 'valider' && r.statut === 'en_attente' && n1 && (
                    <>
                      <Btn onClick={() => patch(r.id, { statut: 'approuve_n1', valide_n1_par: user.id, valide_n1_a: new Date().toISOString() })}>Valider N1</Btn>
                      <Btn kind="danger" onClick={() => patch(r.id, { statut: 'refuse', valide_n1_par: user.id, valide_n1_a: new Date().toISOString(), note_n1: 'Refusé' })}>Refuser</Btn>
                    </>
                  )}
                  {tab === 'valider' && r.statut === 'approuve_n1' && n2 && (
                    <>
                      <Btn onClick={() => patch(r.id, { statut: 'approuve_n2', valide_n2_par: user.id, valide_n2_a: new Date().toISOString() })}>Valider N2</Btn>
                      <Btn kind="soft" onClick={() => patch(r.id, { statut: 'paye', paye_a: new Date().toISOString() })}>Marquer payé</Btn>
                      <Btn kind="danger" onClick={() => patch(r.id, { statut: 'refuse', valide_n2_par: user.id, valide_n2_a: new Date().toISOString(), note_n2: 'Refusé' })}>Refuser</Btn>
                    </>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </Page>
  )
}
