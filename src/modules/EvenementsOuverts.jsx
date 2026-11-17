import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, TA, Empty, Loading, Flash, Modal } from '@/components/ui'
import { copierTexte, urlEvenementOuvert } from '@/lib/urls'
import { genCode, CodeBox, FormInvit } from '@/modules/admin/inviteUi'

function genToken() {
  const s = 'abcdefghjkmnpqrstuvwxyz23456789'
  const part = () => Array.from({ length: 5 }, () => s[Math.floor(Math.random() * s.length)]).join('')
  return `${part()}${part()}`
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('fr-BE')
}

export default function EvenementsOuverts() {
  const { id } = useParams()
  const nav = useNavigate()
  const { profile, peutGererEvenementsInternes, peutGererFiches } = useAuth()
  const gerer = peutGererEvenementsInternes()
  const peutInviter = peutGererFiches()
  const [items, setItems] = useState([])
  const [inscrits, setInscrits] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [flash, setFlash] = useState(null)
  const [edit, setEdit] = useState(null)
  const [inviteForm, setInviteForm] = useState(null)
  const [lastInvite, setLastInvite] = useState(null)
  const [copie, setCopie] = useState(null)

  const detail = useMemo(() => (id && id !== 'nouveau' ? items.find(x => x.id === id) : null), [items, id])
  const inscritsEvt = useMemo(
    () => (detail ? inscrits.filter(i => i.evenement_id === detail.id) : []),
    [inscrits, detail],
  )

  useEffect(() => { charger() }, [])

  async function charger() {
    setLoading(true)
    setErr(null)
    const [a, b] = await Promise.all([
      supabase.from('evenements_ouverts').select('*').order('created_at', { ascending: false }),
      supabase.from('evenements_ouverts_inscrits').select('*').order('created_at', { ascending: false }),
    ])
    if (a.error) setErr(a.error.message)
    setItems(a.data || [])
    setInscrits(b.data || [])
    setLoading(false)
  }

  function ok(msg) {
    setFlash(msg)
    setTimeout(() => setFlash(null), 2500)
  }

  async function sauverEvenement(f) {
    if (!f.titre?.trim()) { setErr('Titre requis.'); return }
    const payload = {
      titre: f.titre.trim(),
      date_debut: f.date_debut || null,
      heure_debut: f.heure_debut?.trim() || null,
      lieu: f.lieu?.trim() || null,
      description: f.description?.trim() || null,
      actif: f.actif !== false,
      token: f.token || genToken(),
    }
    if (f.id) {
      const { error } = await supabase.from('evenements_ouverts').update(payload).eq('id', f.id)
      if (error) { setErr(error.message); return }
      ok('Événement mis à jour.')
    } else {
      const { data, error } = await supabase.from('evenements_ouverts').insert({
        ...payload,
        created_by: profile?.id || null,
      }).select('id').single()
      if (error) { setErr(error.message); return }
      ok('Lien créé — copiez-le pour Facebook.')
      setEdit(null)
      await charger()
      nav(`/app/ouvertures/${data.id}`)
      return
    }
    setEdit(null)
    charger()
  }

  async function toggleActif(e) {
    const { error } = await supabase.from('evenements_ouverts').update({ actif: !e.actif }).eq('id', e.id)
    if (error) setErr(error.message)
    else { ok(e.actif ? 'Inscriptions fermées.' : 'Inscriptions ouvertes.'); charger() }
  }

  async function supprimerInscrit(row) {
    if (!confirm(`Retirer ${row.prenom} ${row.nom} de la liste ?`)) return
    const { error } = await supabase.from('evenements_ouverts_inscrits').delete().eq('id', row.id)
    if (error) setErr(error.message)
    else { ok('Inscription retirée.'); charger() }
  }

  async function inviterDepuis(row) {
    setLastInvite(null)
    setInviteForm({
      prenom: row.prenom || '',
      nom: row.nom || '',
      email: (row.email || '').trim(),
      telephone: row.telephone || '',
      role: 'volontaire_non_medical',
      inscrit_id: row.id,
      date_naissance: row.date_naissance || '',
    })
  }

  async function sauverInvitation(f) {
    const email = (f.email || '').trim()
    if (!email) { setErr('E-mail requis pour envoyer l’accès à l’app.'); return }

    const { data: fiche, error: eFiche } = await supabase.rpc('creer_volontaire_sans_compte', {
      p_prenom: (f.prenom || '').trim(),
      p_nom: (f.nom || '').trim(),
      p_role: f.role,
      p_telephone: (f.telephone || '').trim() || null,
    })
    if (eFiche || !fiche?.ok) {
      setErr(fiche?.error || eFiche?.message || 'Impossible de créer la fiche.'); return
    }
    const profileId = fiche.id

    const code = genCode()
    const { error } = await supabase.from('invitations').insert({
      code,
      email,
      prenom: f.prenom,
      nom: f.nom,
      role: f.role,
      type_benevole: f.role === 'volontaire_medical' ? 'medical' : 'non_medical',
      profile_cible_id: profileId,
    })
    if (error) { setErr(error.message); return }

    if (f.inscrit_id) {
      await supabase.from('evenements_ouverts_inscrits').update({
        invitation_code: code,
        profile_id: profileId,
        email,
      }).eq('id', f.inscrit_id)
    }

    setInviteForm(null)
    setLastInvite({ code, email, prenom: f.prenom, typeBenevole: f.role })
    ok('Invitation prête — envoyez le mail ou copiez le lien.')
    charger()
  }

  async function copierLien(token) {
    const lien = urlEvenementOuvert(token)
    const okCopy = await copierTexte(lien)
    if (!okCopy) { setErr('Copie impossible — sélectionnez le lien manuellement.'); return }
    setCopie(token)
    setTimeout(() => setCopie(null), 2000)
  }

  if (!gerer && !peutInviter) {
    return (
      <Page title="Inscriptions ouvertes" subtitle="Réservé à l’équipe qui gère les événements ou les fiches.">
        <Empty title="Accès limité" hint="Demandez à un responsable RH / événements." />
      </Page>
    )
  }

  if (loading) return <Page title="Inscriptions ouvertes"><Loading /></Page>

  // Détail d’un événement
  if (detail) {
    const lien = urlEvenementOuvert(detail.token)
    return (
      <Page
        title={detail.titre}
        subtitle={[fmtDate(detail.date_debut), detail.heure_debut, detail.lieu].filter(Boolean).join(' · ') || 'Lien public'}
        actions={<Btn kind="soft" onClick={() => nav('/app/ouvertures')}>‹ Liste</Btn>}
      >
        {flash && <Flash>{flash}</Flash>}
        {err && <Flash kind="err">{err}</Flash>}
        <Card style={{ padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
            Lien à coller sur Facebook / WhatsApp {detail.actif ? '' : '(inscriptions fermées)'}
          </div>
          <div style={{
            fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5, wordBreak: 'break-all',
            padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 9, marginBottom: 10,
            background: 'var(--bg-alt)',
          }}>{lien}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn onClick={() => copierLien(detail.token)}>{copie === detail.token ? '✓ Copié' : 'Copier le lien'}</Btn>
            {gerer && (
              <>
                <Btn kind="soft" onClick={() => setEdit(detail)}>Modifier</Btn>
                <Btn kind="soft" onClick={() => toggleActif(detail)}>{detail.actif ? 'Fermer les inscriptions' : 'Rouvrir'}</Btn>
              </>
            )}
          </div>
          {detail.description && (
            <p style={{ margin: '12px 0 0', fontSize: 13.5, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{detail.description}</p>
          )}
        </Card>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <strong style={{ color: 'var(--heading)' }}>{inscritsEvt.length} inscrit{inscritsEvt.length > 1 ? 's' : ''}</strong>
        </div>
        {inscritsEvt.length === 0 ? (
          <Empty title="Personne pour l’instant" hint="Partagez le lien : les inscriptions apparaîtront ici." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {inscritsEvt.map(row => (
              <Card key={row.id} style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 650 }}>{row.prenom} {row.nom}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                      {row.date_naissance ? `né(e) le ${fmtDate(row.date_naissance)}` : 'DDN non indiquée'}
                      {row.email ? ` · ${row.email}` : ''}
                      {row.telephone ? ` · ${row.telephone}` : ''}
                      {row.invitation_code ? ' · invitation envoyée' : ''}
                    </div>
                    {row.notes && <div style={{ fontSize: 12.5, marginTop: 4 }}>{row.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {peutInviter && !row.invitation_code && (
                      <Btn onClick={() => inviterDepuis(row)} style={{ padding: '5px 10px' }}>Créer l’accès app</Btn>
                    )}
                    {(gerer || peutInviter) && (
                      <Btn kind="danger" onClick={() => supprimerInscrit(row)} style={{ padding: '5px 10px' }}>Retirer</Btn>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {edit && (
          <Modal title="Modifier l’événement" onClose={() => setEdit(null)}>
            <FormEvenement item={edit} onSave={sauverEvenement} onCancel={() => setEdit(null)} />
          </Modal>
        )}
        {(inviteForm || lastInvite) && (
          <Modal
            title={lastInvite ? 'Lien d’invitation app' : `Accès app — ${inviteForm.prenom}`}
            onClose={() => { setInviteForm(null); setLastInvite(null) }}
          >
            {lastInvite ? (
              <CodeBox embedded code={lastInvite.code} email={lastInvite.email} prenom={lastInvite.prenom} typeBenevole={lastInvite.typeBenevole} />
            ) : (
              <FormInvit
                embedded
                form={inviteForm}
                setForm={setInviteForm}
                onSave={sauverInvitation}
                roles={[
                  { v: 'volontaire_non_medical', l: 'Volontaire non médical' },
                  { v: 'volontaire_medical', l: 'Volontaire médical' },
                ]}
                roleLabel="Type de volontaire"
                titre="Créer l’accès application"
              />
            )}
          </Modal>
        )}
      </Page>
    )
  }

  // Liste
  return (
    <Page
      title="Inscriptions ouvertes"
      subtitle="Liens publics (Facebook…) pour soirées d’info et portes ouvertes — estimez les présents, puis créez les accès app."
      actions={gerer ? <Btn onClick={() => setEdit({ titre: '', date_debut: '', heure_debut: '', lieu: '', description: '', actif: true })}>+ Nouveau lien</Btn> : null}
    >
      {flash && <Flash>{flash}</Flash>}
      {err && <Flash kind="err">{err}</Flash>}
      {items.length === 0 ? (
        <Empty title="Aucun lien" hint="Créez une soirée d’info et copiez le lien sur Facebook." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(e => {
            const n = inscrits.filter(i => i.evenement_id === e.id).length
            return (
              <Card key={e.id} style={{ padding: '12px 14px', cursor: 'pointer' }} onClick={() => nav(`/app/ouvertures/${e.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 650 }}>{e.titre}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                      {fmtDate(e.date_debut)}{e.heure_debut ? ` · ${e.heure_debut}` : ''}{e.lieu ? ` · ${e.lieu}` : ''}
                      {' · '}{n} inscrit{n > 1 ? 's' : ''}
                      {e.actif ? '' : ' · fermé'}
                    </div>
                  </div>
                  <Btn kind="soft" onClick={ev => { ev.stopPropagation(); copierLien(e.token) }} style={{ padding: '5px 10px' }}>
                    {copie === e.token ? '✓ Copié' : 'Copier le lien'}
                  </Btn>
                </div>
              </Card>
            )
          })}
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? 'Modifier' : 'Nouveau lien d’inscription'} onClose={() => setEdit(null)}>
          <FormEvenement item={edit} onSave={sauverEvenement} onCancel={() => setEdit(null)} />
        </Modal>
      )}
    </Page>
  )
}

function FormEvenement({ item, onSave, onCancel }) {
  const [f, setF] = useState({ ...item })
  const [busy, setBusy] = useState(false)
  async function go(e) {
    e?.preventDefault?.()
    setBusy(true)
    await onSave(f)
    setBusy(false)
  }
  return (
    <form onSubmit={go}>
      <F label="Titre *" value={f.titre || ''} set={v => setF(s => ({ ...s, titre: v }))} required placeholder="Soirée d’info nouveaux volontaires" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <F label="Date" type="date" value={f.date_debut || ''} set={v => setF(s => ({ ...s, date_debut: v }))} />
        <F label="Heure" value={f.heure_debut || ''} set={v => setF(s => ({ ...s, heure_debut: v }))} placeholder="19h30" />
      </div>
      <F label="Lieu" value={f.lieu || ''} set={v => setF(s => ({ ...s, lieu: v }))} placeholder="Locaux Heart’s Angels…" />
      <TA label="Texte d’accueil (sur la page publique)" value={f.description || ''} set={v => setF(s => ({ ...s, description: v }))} rows={3} />
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, marginBottom: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={f.actif !== false} onChange={e => setF(s => ({ ...s, actif: e.target.checked }))} />
        Inscriptions ouvertes
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn type="submit" disabled={busy}>{busy ? '…' : 'Enregistrer'}</Btn>
        <Btn kind="soft" type="button" onClick={onCancel}>Annuler</Btn>
      </div>
    </form>
  )
}
