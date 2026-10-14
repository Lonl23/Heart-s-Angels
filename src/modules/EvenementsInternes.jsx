import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, TA, Empty, Modal, Loading } from '@/components/ui'
import { teintePastel } from '@/modules/fiche/ficheSchema'
import GrilleMois from '@/modules/disponibilites/GrilleMois'
import { iso, todayISO, titreMois, grilleMois, fmtJourLong, couvreJour, parseISO } from '@/modules/disponibilites/dates'

/**
 * Création / édition : peutGererApp, peutGererFiches, ou tout siège ASBL
 * (responsable / adjoint). Les volontaires voient la liste et ouvrent le lien.
 */

function fmtPlage(e) {
  const a = fmtJourLong(e.date_debut)
  const b = e.date_fin && e.date_fin !== e.date_debut ? fmtJourLong(e.date_fin) : ''
  return b ? `${a} → ${b}` : a
}

function urlInscription(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  return 'https://' + s
}

export default function EvenementsInternes() {
  const { profile, peutGererEvenementsInternes } = useAuth()
  const gerer = peutGererEvenementsInternes()
  const [anchor, setAnchor] = useState(() => new Date())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [form, setForm] = useState(null)
  const [detail, setDetail] = useState(null)

  const grille = useMemo(() => grilleMois(anchor), [anchor])
  const today = todayISO()

  useEffect(() => { charger() }, [])

  async function charger() {
    setLoading(true)
    setErr(null)
    const { data, error } = await supabase
      .from('evenements_internes')
      .select('id,titre,date_debut,date_fin,description,inscription_url,created_by,created_at,profiles:created_by(prenom,nom)')
      .order('date_debut', { ascending: true })
    if (error) setErr(error.message)
    setItems(data || [])
    setLoading(false)
  }

  function aller(delta) {
    setAnchor(a => new Date(a.getFullYear(), a.getMonth() + delta, 1))
  }
  function nouveau(day) {
    const id = day ? iso(day) : today
    setDetail(null)
    setForm({
      titre: '',
      date_debut: id,
      date_fin: id,
      description: '',
      inscription_url: '',
    })
  }
  function editer(e) {
    setDetail(null)
    setForm({
      id: e.id,
      titre: e.titre || '',
      date_debut: e.date_debut,
      date_fin: e.date_fin || e.date_debut,
      description: e.description || '',
      inscription_url: e.inscription_url || '',
    })
  }
  async function save() {
    const titre = String(form.titre || '').trim()
    if (!titre) { alert('Indiquez un titre.'); return }
    if (!form.date_debut) { alert('Indiquez la date.'); return }
    const fin = form.date_fin && form.date_fin >= form.date_debut ? form.date_fin : form.date_debut
    const payload = {
      titre,
      date_debut: form.date_debut,
      date_fin: fin,
      description: String(form.description || '').trim() || null,
      inscription_url: urlInscription(form.inscription_url) || null,
      created_by: form.id ? undefined : (profile?.id || null),
    }
    if (!form.id) payload.created_by = profile?.id || null
    else delete payload.created_by
    const { error } = form.id
      ? await supabase.from('evenements_internes').update({
          titre: payload.titre,
          date_debut: payload.date_debut,
          date_fin: payload.date_fin,
          description: payload.description,
          inscription_url: payload.inscription_url,
        }).eq('id', form.id)
      : await supabase.from('evenements_internes').insert(payload)
    if (error) { alert(error.message); return }
    setForm(null)
    charger()
  }
  async function supprimer(e) {
    if (!confirm(`Supprimer « ${e.titre} » ?`)) return
    const { error } = await supabase.from('evenements_internes').delete().eq('id', e.id)
    if (error) { alert(error.message); return }
    setDetail(null)
    setForm(null)
    charger()
  }

  function clicJour(day) {
    const id = iso(day)
    const duJour = items.filter(e => couvreJour(e, id))
    if (duJour.length === 1) { setDetail(duJour[0]); return }
    if (duJour.length > 1) { setDetail({ jour: id, liste: duJour }); return }
    if (gerer) nouveau(day)
  }

  const duMois = items.filter(e => {
    const a = parseISO(e.date_debut)
    const b = parseISO(e.date_fin || e.date_debut)
    if (!a) return false
    const m0 = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const m1 = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)
    return a <= m1 && (b || a) >= m0
  })

  return (
    <Page title="Événements internes" subtitle="Réunions, assemblées et rendez-vous ASBL. Ouvrez le lien pour vous inscrire."
      action={gerer ? <Btn onClick={() => nouveau()}>+ Événement</Btn> : null}>

      <div className="ha-cal-toolbar">
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          <Btn kind="soft" onClick={() => aller(-1)}>←</Btn>
          <Btn kind="soft" onClick={() => setAnchor(new Date())}>Aujourd’hui</Btn>
          <Btn kind="soft" onClick={() => aller(1)}>→</Btn>
        </div>
        <div className="ha-cal-titre">{titreMois(anchor)}</div>
        <div />
      </div>

      {err && <div className="ha-flash ha-flash-err">{err}</div>}
      {loading ? <Loading /> : (
        <div className="ha-cal-scroll">
          <GrilleMois weeks={grille.weeks} anchor={anchor} today={today} onJour={clicJour}
            renderJour={(id) => {
              const duJour = items.filter(e => couvreJour(e, id))
              const shown = duJour.slice(0, 3)
              return (
                <>
                  {shown.map(e => (
                    <button key={e.id} type="button"
                      className={'ha-mois-pill dispo-' + teintePastel(e.id)}
                      title={e.titre}
                      onClick={ev => { ev.stopPropagation(); setDetail(e) }}>
                      {e.titre}
                    </button>
                  ))}
                  {duJour.length > shown.length && <span className="ha-mois-more">…</span>}
                </>
              )
            }} />
        </div>
      )}

      <div style={{ fontSize:13, fontWeight:700, color:'var(--heading)', margin:'18px 0 10px' }}>
        {duMois.length ? 'Ce mois-ci' : 'Aucun événement ce mois-ci'}
      </div>
      {duMois.length === 0 && !loading && (
        <Empty title="Rien de prévu" hint={gerer ? 'Ajoutez un événement interne et le lien d’inscription.' : 'Quand un événement sera publié, il apparaîtra ici.'} />
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {duMois.map(e => (
          <Card key={e.id} clickable onClick={() => setDetail(e)}>
            <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
              <div>
                <div style={{ fontWeight:700, color:'var(--text)' }}>{e.titre}</div>
                <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:3 }}>{fmtPlage(e)}</div>
              </div>
              {e.inscription_url && (
                <a href={urlInscription(e.inscription_url)} target="_blank" rel="noreferrer"
                  onClick={ev => ev.stopPropagation()}
                  style={{ color:'var(--accent)', fontWeight:600, fontSize:13, alignSelf:'center' }}>
                  S’inscrire ›
                </a>
              )}
            </div>
          </Card>
        ))}
      </div>

      {gerer && (
        <button type="button" className="ha-fab" onClick={() => nouveau()} aria-label="Ajouter un événement">+</button>
      )}

      {detail && !detail.liste && (
        <Modal title={detail.titre} onClose={() => setDetail(null)} footer={
          <>
            {detail.inscription_url && (
              <Btn onClick={() => window.open(urlInscription(detail.inscription_url), '_blank', 'noopener')}>S’inscrire</Btn>
            )}
            {gerer && <Btn kind="soft" onClick={() => editer(detail)}>Modifier</Btn>}
            {gerer && <Btn kind="danger" onClick={() => supprimer(detail)}>Supprimer</Btn>}
            <Btn kind="soft" onClick={() => setDetail(null)}>Fermer</Btn>
          </>
        }>
          <div style={{ fontSize:13.5, color:'var(--text-2)', marginBottom:10 }}>{fmtPlage(detail)}</div>
          {detail.description && (
            <p style={{ fontSize:14, color:'var(--text)', whiteSpace:'pre-wrap', margin:'0 0 10px', lineHeight:1.45 }}>{detail.description}</p>
          )}
          {detail.profiles && (
            <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>
              Publié par {detail.profiles.prenom} {detail.profiles.nom}
            </div>
          )}
        </Modal>
      )}

      {detail?.liste && (
        <Modal title={fmtJourLong(detail.jour)} onClose={() => setDetail(null)}>
          {detail.liste.map(e => (
            <button key={e.id} type="button" className="ha-pick-row" onClick={() => setDetail(e)}>
              <strong>{e.titre}</strong>
              <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:2 }}>{fmtPlage(e)}</div>
            </button>
          ))}
          {gerer && <Btn onClick={() => nouveau(parseISO(detail.jour))} style={{ marginTop:8 }}>+ Événement ce jour</Btn>}
        </Modal>
      )}

      {form && (
        <Modal title={form.id ? 'Modifier l’événement' : 'Nouvel événement interne'} onClose={() => setForm(null)} footer={
          <>
            <Btn onClick={save}>Enregistrer</Btn>
            {form.id && <Btn kind="danger" onClick={() => supprimer(form)}>Supprimer</Btn>}
            <Btn kind="soft" onClick={() => setForm(null)}>Annuler</Btn>
          </>
        }>
          <F label="Titre" value={form.titre} set={v => setForm(s => ({ ...s, titre: v }))} required />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <F label="Du" type="date" value={form.date_debut} set={v => setForm(s => ({ ...s, date_debut: v }))} required />
            <F label="Au" type="date" value={form.date_fin || form.date_debut} set={v => setForm(s => ({ ...s, date_fin: v }))} />
          </div>
          <TA label="Description" value={form.description} set={v => setForm(s => ({ ...s, description: v }))} rows={4} />
          <F label="Lien d’inscription" value={form.inscription_url} set={v => setForm(s => ({ ...s, inscription_url: v }))} placeholder="https://…" />
        </Modal>
      )}
    </Page>
  )
}
