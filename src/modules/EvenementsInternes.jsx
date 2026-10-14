import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, TA, Empty, Loading } from '@/components/ui'
import { compressImage } from '@/modules/souhaits/TerrainPhotos'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { fmtJourLong } from '@/modules/disponibilites/dates'

const BUCKET = 'evenements-vignettes'
const SELECT = 'id,titre,date_debut,date_fin,html_page,html_vignette,vignette_path,created_by,created_at'

function urlVignette(path) {
  if (!path) return ''
  const p = String(path)
  if (p.startsWith('/') || p.startsWith('http://') || p.startsWith('https://')) return p
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data?.publicUrl || ''
}

function extraRepas(row) {
  const x = row?.extra && typeof row.extra === 'object' ? row.extra : {}
  const a = Number(x.adultes)
  const e = Number(x.enfants)
  return {
    adultes: Number.isFinite(a) && a >= 0 ? Math.min(20, Math.floor(a)) : 1,
    enfants: Number.isFinite(e) && e >= 0 ? Math.min(20, Math.floor(e)) : 0,
  }
}

function fmtPlage(e) {
  if (!e?.date_debut) return ''
  const a = fmtJourLong(e.date_debut)
  const b = e.date_fin && e.date_fin !== e.date_debut ? fmtJourLong(e.date_fin) : ''
  return b ? `${a} → ${b}` : a
}

function HtmlSafe({ html, className }) {
  const clean = sanitizeHtml(html)
  if (!clean) return null
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />
}

export default function EvenementsInternes() {
  const { id } = useParams()
  const loc = useLocation()
  const { profile, peutGererEvenementsInternes, peutVoirInscritsEvenements } = useAuth()
  const gerer = peutGererEvenementsInternes()
  const voirInscrits = peutVoirInscritsEvenements()
  const nav = useNavigate()
  // Même schéma que Souhaits : /nouveau n’a pas de :id, donc pathname et pas useParams.
  const path = String(loc.pathname || '').replace(/\/+$/, '')
  const estNouveau = path.endsWith('/evenements/nouveau') || id === 'nouveau'
  const estEditer = path.endsWith('/editer')
  const edition = estNouveau || estEditer
  const [items, setItems] = useState([])
  const [inscrits, setInscrits] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  useEffect(() => { charger() }, [voirInscrits, profile?.id])

  async function charger() {
    setLoading(true)
    setErr(null)
    try {
      const { data, error } = await supabase
        .from('evenements_internes')
        .select(SELECT)
        .order('created_at', { ascending: false })
      if (error) setErr(error.message)
      const rows = (Array.isArray(data) ? data : []).slice().sort((a, b) => {
        const da = a.date_debut || '9999-99-99'
        const db = b.date_debut || '9999-99-99'
        if (da !== db) return da.localeCompare(db)
        return String(b.created_at || '').localeCompare(String(a.created_at || ''))
      })
      setItems(rows)
      if (voirInscrits) {
        let insRes = await supabase
          .from('evenements_internes_inscrits')
          .select('id,evenement_id,user_id,created_at,extra,profiles:user_id(prenom,nom)')
          .order('created_at')
        if (insRes.error) {
          insRes = await supabase
            .from('evenements_internes_inscrits')
            .select('id,evenement_id,user_id,created_at,extra')
            .order('created_at')
        }
        if (insRes.error) {
          insRes = await supabase
            .from('evenements_internes_inscrits')
            .select('id,evenement_id,user_id,created_at')
            .order('created_at')
        }
        setInscrits(Array.isArray(insRes.data) ? insRes.data : [])
      } else if (profile?.id) {
        let mineRes = await supabase
          .from('evenements_internes_inscrits')
          .select('id,evenement_id,user_id,created_at,extra')
          .eq('user_id', profile.id)
        if (mineRes.error) {
          mineRes = await supabase
            .from('evenements_internes_inscrits')
            .select('id,evenement_id,user_id,created_at')
            .eq('user_id', profile.id)
        }
        const ins = mineRes.data
        setInscrits(Array.isArray(ins) ? ins : [])
      } else {
        setInscrits([])
      }
    } catch (e) {
      setErr(e?.message || 'Chargement impossible.')
      setItems([])
      setInscrits([])
    }
    setLoading(false)
  }

  const listeInscrits = Array.isArray(inscrits) ? inscrits : []

  if (edition) {
    if (!gerer) return <Page title="Événements internes"><Empty title="Réservé à l’informatique" hint="Seule l’équipe informatique compose les pages d’inscription." /></Page>
    return (
      <FormEvenement
        profile={profile}
        editId={estEditer && id && id !== 'nouveau' ? id : null}
        onDone={() => nav(estEditer && id && id !== 'nouveau' ? `/app/evenements/${id}` : '/app/evenements')}
      />
    )
  }
  if (id && id !== 'nouveau') {
    const ev = items.find(e => e.id === id)
    if (loading && !ev) return <Page title="Événements internes"><Loading /></Page>
    if (!ev) return <Page title="Événements internes"><Empty title="Événement introuvable" action={<Btn kind="soft" onClick={() => nav('/app/evenements')}>Retour</Btn>} /></Page>
    return (
      <DetailEvenement
        ev={ev} profile={profile} gerer={gerer} voirInscrits={voirInscrits}
        inscrits={listeInscrits.filter(i => i.evenement_id === ev.id)}
        onBack={() => nav('/app/evenements')}
        onEdit={() => nav(`/app/evenements/${ev.id}/editer`)}
        onReload={charger}
      />
    )
  }

  const counts = {}
  const repasA = {}
  const repasE = {}
  for (const i of listeInscrits) {
    counts[i.evenement_id] = (counts[i.evenement_id] || 0) + 1
    const r = extraRepas(i)
    repasA[i.evenement_id] = (repasA[i.evenement_id] || 0) + r.adultes
    repasE[i.evenement_id] = (repasE[i.evenement_id] || 0) + r.enfants
  }

  return (
    <Page title="Événements internes" subtitle="Choisissez un événement pour lire la page et vous inscrire."
      action={gerer ? <Btn onClick={() => nav('/app/evenements/nouveau')}>+ Événement</Btn> : null}>
      {err && <div className="ha-flash ha-flash-err">{err}</div>}
      {loading ? <Loading />
        : items.length === 0 ? (
          <Empty title="Aucun événement" hint={gerer ? 'Ajoutez une vignette et la page HTML d’inscription.' : 'Quand l’informatique publiera un événement, il apparaîtra ici.'} />
        ) : (
          <div className="ha-evt-grid">
            {items.map(e => (
              <Card key={e.id} clickable className="ha-evt-card" onClick={() => nav(`/app/evenements/${e.id}`)} style={{ padding: 0, overflow: 'hidden' }}>
                <div className="ha-evt-vignette">
                  {e.vignette_path
                    ? <img src={urlVignette(e.vignette_path)} alt="" />
                    : sanitizeHtml(e.html_vignette)
                      ? <HtmlSafe html={e.html_vignette} className="ha-evt-html ha-evt-html-card" />
                      : <div className="ha-evt-ph">{(e.titre || '?').slice(0, 1).toUpperCase()}</div>}
                </div>
                <div className="ha-evt-body">
                  <div className="ha-evt-titre">{e.titre}</div>
                  {fmtPlage(e) && <div className="ha-evt-meta">{fmtPlage(e)}</div>}
                  {voirInscrits && (
                    <div className="ha-evt-meta">
                      {counts[e.id] || 0} inscrit{(counts[e.id] || 0) > 1 ? 's' : ''}
                      {(repasA[e.id] || repasE[e.id])
                        ? ` · ${repasA[e.id] || 0} ad. / ${repasE[e.id] || 0} enf.`
                        : ''}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
    </Page>
  )
}

function DetailEvenement({ ev, profile, gerer, voirInscrits, inscrits, onBack, onEdit, onReload }) {
  const [busy, setBusy] = useState(false)
  const mine = inscrits.find(i => i.user_id === profile?.id)
  const init = extraRepas(mine)
  const [adultes, setAdultes] = useState(init.adultes)
  const [enfants, setEnfants] = useState(init.enfants)
  useEffect(() => {
    const r = extraRepas(mine)
    setAdultes(r.adultes)
    setEnfants(r.enfants)
  }, [mine?.id, mine?.extra])

  function repasPayload() {
    const a = Math.max(0, Math.min(20, Number(adultes) || 0))
    const e = Math.max(0, Math.min(20, Number(enfants) || 0))
    return { adultes: a, enfants: e }
  }

  async function toggle() {
    if (!profile?.id) return
    const extra = repasPayload()
    if (!mine && extra.adultes + extra.enfants < 1) {
      alert('Indiquez au moins un repas (adulte ou enfant).')
      return
    }
    setBusy(true)
    const { error } = mine
      ? await supabase.from('evenements_internes_inscrits').delete().eq('id', mine.id)
      : await supabase.from('evenements_internes_inscrits').insert({
        evenement_id: ev.id, user_id: profile.id, extra,
      })
    setBusy(false)
    if (error) { alert(error.message); return }
    onReload()
  }

  async function sauverRepas() {
    if (!mine?.id) return
    const extra = repasPayload()
    if (extra.adultes + extra.enfants < 1) {
      alert('Indiquez au moins un repas, ou désinscrivez-vous.')
      return
    }
    setBusy(true)
    const { error } = await supabase.from('evenements_internes_inscrits').update({ extra }).eq('id', mine.id)
    setBusy(false)
    if (error) { alert(error.message); return }
    onReload()
  }

  async function supprimer() {
    if (!confirm(`Supprimer « ${ev.titre} » ? Les inscriptions seront perdues.`)) return
    const p = ev.vignette_path
    if (p && !String(p).startsWith('/') && !String(p).startsWith('http')) {
      await supabase.storage.from(BUCKET).remove([p]).catch(() => {})
    }
    const { error } = await supabase.from('evenements_internes').delete().eq('id', ev.id)
    if (error) { alert(error.message); return }
    onBack()
  }

  const n = inscrits.length
  const totA = inscrits.reduce((s, i) => s + extraRepas(i).adultes, 0)
  const totE = inscrits.reduce((s, i) => s + extraRepas(i).enfants, 0)
  const showHero = ev.vignette_path && !ev.html_page

  return (
    <Page title={ev.titre} subtitle={fmtPlage(ev) || 'Événement interne ASBL'}
      action={<Btn kind="soft" onClick={onBack}>Retour</Btn>}>
      {showHero && (
        <div className="ha-evt-hero"><img src={urlVignette(ev.vignette_path)} alt="" /></div>
      )}
      <HtmlSafe html={ev.html_page} className="ha-evt-html ha-evt-page" />
      {!ev.html_page && <p style={{ color:'var(--text-muted)', fontSize:14 }}>La page d’inscription n’est pas encore rédigée.</p>}
      <div className="ha-evt-repas">
        <label>Repas adultes
          <input type="number" min="0" max="20" value={adultes} onChange={e => setAdultes(e.target.value)} />
        </label>
        <label>Repas enfants
          <input type="number" min="0" max="20" value={enfants} onChange={e => setEnfants(e.target.value)} />
        </label>
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:12 }}>
        <Btn onClick={toggle} disabled={busy}>{mine ? 'Se désinscrire' : 'S’inscrire'}</Btn>
        {mine && <Btn kind="soft" onClick={sauverRepas} disabled={busy}>Mettre à jour les repas</Btn>}
        {gerer && <Btn kind="soft" onClick={onEdit}>Modifier le code</Btn>}
        {gerer && <Btn kind="danger" onClick={supprimer}>Supprimer</Btn>}
      </div>
      {voirInscrits && (
        <Card style={{ marginTop:18 }}>
          <div style={{ fontWeight:700, color:'var(--heading)', marginBottom:8 }}>
            {n} inscrit{n > 1 ? 's' : ''}
            {n > 0 && ` · ${totA} repas adulte${totA > 1 ? 's' : ''} · ${totE} repas enfant${totE > 1 ? 's' : ''}`}
          </div>
          {n === 0
            ? <div style={{ fontSize:13, color:'var(--text-muted)' }}>Personne ne s’est encore inscrit.</div>
            : (
              <ul className="ha-evt-noms">
                {inscrits.map(i => {
                  const r = extraRepas(i)
                  const nom = i.profiles ? `${i.profiles.prenom} ${i.profiles.nom}` : 'Volontaire'
                  return <li key={i.id}>{nom} — {r.adultes} ad. / {r.enfants} enf.</li>
                })}
              </ul>
            )}
        </Card>
      )}
    </Page>
  )
}

function FormEvenement({ onDone, profile, editId }) {
  const [form, setForm] = useState({
    titre: '', date_debut: '', date_fin: '', html_page: '', html_vignette: '', vignette_path: '',
  })
  const [loaded, setLoaded] = useState(!editId)
  const [saving, setSaving] = useState(false)
  const [apercu, setApercu] = useState('page')
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!editId) { setLoaded(true); return }
    let on = true
    supabase.from('evenements_internes').select(SELECT).eq('id', editId).maybeSingle()
      .then(({ data, error }) => {
        if (!on) return
        if (error) setErr(error.message)
        if (data) setForm({
          id: data.id,
          titre: data.titre || '',
          date_debut: data.date_debut || '',
          date_fin: data.date_fin || '',
          html_page: data.html_page || '',
          html_vignette: data.html_vignette || '',
          vignette_path: data.vignette_path || '',
        })
        setLoaded(true)
      })
      .catch(e => { if (on) { setErr(e?.message || 'Chargement impossible.'); setLoaded(true) } })
    return () => { on = false }
  }, [editId])

  async function uploadVignette(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('Choisissez une image (JPG, PNG, WebP).'); return }
    setSaving(true)
    try {
      const blob = await compressImage(file)
      const uid = crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
      const path = `${profile?.id || 'it'}/${uid}.jpg`
      const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
      if (error) throw error
      if (form.vignette_path) await supabase.storage.from(BUCKET).remove([form.vignette_path]).catch(() => {})
      setForm(s => ({ ...s, vignette_path: path }))
    } catch (e) {
      alert(e.message || 'Envoi impossible.')
    }
    setSaving(false)
  }

  async function save() {
    const titre = String(form.titre || '').trim()
    if (!titre) { alert('Indiquez un titre.'); return }
    const debut = form.date_debut || null
    const fin = form.date_fin && debut && form.date_fin >= debut ? form.date_fin : debut
    setSaving(true)
    const payload = {
      titre,
      date_debut: debut,
      date_fin: fin,
      html_page: sanitizeHtml(form.html_page) || '',
      html_vignette: sanitizeHtml(form.html_vignette) || null,
      vignette_path: form.vignette_path || null,
    }
    try {
      let error
      if (form.id) {
        ({ error } = await supabase.from('evenements_internes').update(payload).eq('id', form.id))
      } else {
        ({ error } = await supabase.from('evenements_internes').insert({ ...payload, created_by: profile?.id || null }))
      }
      setSaving(false)
      if (error) { alert(error.message); return }
      onDone()
    } catch (e) {
      setSaving(false)
      alert(e?.message || 'Enregistrement impossible.')
    }
  }

  if (!loaded) return <Page title="Événement"><Loading /></Page>
  return (
    <Page title={form.id ? 'Modifier l’événement' : 'Nouvel événement interne'}
      subtitle="Vignette du menu et HTML de la page d’inscription. Vous pourrez y revenir."
      action={<Btn kind="soft" onClick={onDone}>Annuler</Btn>}>
      {err && <div className="ha-flash ha-flash-err">{err}</div>}
      <F label="Titre" value={form.titre} set={v => setForm(s => ({ ...s, titre: v }))} required />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <F label="Date (optionnel)" type="date" value={form.date_debut} set={v => setForm(s => ({ ...s, date_debut: v }))} />
        <F label="Au (optionnel)" type="date" value={form.date_fin} set={v => setForm(s => ({ ...s, date_fin: v }))} />
      </div>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:12.5, color:'var(--text-muted)', marginBottom:6 }}>Vignette (image)</div>
        {form.vignette_path && (
          <img src={urlVignette(form.vignette_path)} alt="" className="ha-evt-preview-img" />
        )}
        <label className="ha-stock-photo-btn" style={{ marginTop:8 }}>
          {form.vignette_path ? 'Changer l’image' : 'Choisir une image'}
          <input type="file" accept="image/*" onChange={e => { uploadVignette(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        {form.vignette_path && (
          <button type="button" className="ha-stock-photo-del" style={{ marginLeft:10 }}
            onClick={() => setForm(s => ({ ...s, vignette_path: '' }))}>Retirer</button>
        )}
      </div>
      <TA label="HTML de la vignette (optionnel, si pas d’image)" value={form.html_vignette}
        set={v => setForm(s => ({ ...s, html_vignette: v }))} rows={3}
        placeholder="<p>Court texte sur la carte</p>" />
      <div className="ha-tabs" style={{ marginBottom:10 }}>
        <button type="button" className={'ha-tab' + (apercu === 'page' ? ' is-on' : '')} onClick={() => setApercu('page')}>Code de la page</button>
        <button type="button" className={'ha-tab' + (apercu === 'preview' ? ' is-on' : '')} onClick={() => setApercu('preview')}>Aperçu</button>
      </div>
      {apercu === 'page' ? (
        <TA label="HTML de la page d’inscription" value={form.html_page}
          set={v => setForm(s => ({ ...s, html_page: v }))} rows={14}
          placeholder={'<h2>Assemblée générale</h2>\n<p>Inscrivez-vous ci-dessous.</p>'} />
      ) : (
        <div className="ha-evt-preview">
          <HtmlSafe html={form.html_page} className="ha-evt-html" />
          {!sanitizeHtml(form.html_page) && <div style={{ color:'var(--text-muted)', fontSize:13 }}>Rien à prévisualiser.</div>}
        </div>
      )}
      <p style={{ fontSize:12.5, color:'var(--text-muted)', margin:'4px 0 14px' }}>
        Titres, paragraphes, listes, liens et images. Les scripts et gestionnaires d’événements sont retirés.
      </p>
      <Btn onClick={save} disabled={saving}>{saving ? '…' : 'Enregistrer'}</Btn>
    </Page>
  )
}
