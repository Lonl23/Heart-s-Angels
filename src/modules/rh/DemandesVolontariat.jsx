import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, Pill, Loading, Empty, Flash, Sel, TA } from '@/components/ui'
import { CodeBox } from '@/modules/admin/inviteUi'
import { envoyerInvitationEmail } from '@/lib/envoyerInvitation'

const STATUTS = {
  nouvelle: { l: 'Nouvelle', c: '#185FA5', bg: '#E6F1FB' },
  en_cours: { l: 'En cours', c: '#BA7517', bg: '#FAEEDA' },
  acceptee: { l: 'Acceptée', c: '#3B6D11', bg: '#EAF3DE' },
  refusee: { l: 'Refusée', c: '#A32D2D', bg: '#FCEBEB' },
}

function quand(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function adr(a) {
  if (!a || typeof a !== 'object') return ''
  return [a.rue, [a.cp, a.localite].filter(Boolean).join(' '), a.pays].filter(Boolean).join(', ')
}

function Pastille({ statut }) {
  const s = STATUTS[statut] || STATUTS.nouvelle
  return <span style={{ fontSize: 12, fontWeight: 700, color: s.c, background: s.bg, borderRadius: 99, padding: '2px 8px' }}>{s.l}</span>
}

export default function DemandesVolontariat() {
  const { peutGererFiches } = useAuth()
  if (!peutGererFiches()) return <Navigate to="/app" replace />

  const [items, setItems] = useState(null)
  const [filtre, setFiltre] = useState('actives')
  const [ouvert, setOuvert] = useState(null)
  const [err, setErr] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  const [role, setRole] = useState('volontaire_non_medical')
  const [notes, setNotes] = useState('')
  const [lastInvite, setLastInvite] = useState(null)

  async function charger() {
    const { data, error } = await supabase
      .from('candidatures_benevoles')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setErr(error.message)
    else setItems(data || [])
  }

  useEffect(() => {
    charger()
    const ch = supabase
      .channel('ha-candidatures')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidatures_benevoles' }, () => { charger() })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const liste = (items || []).filter(c => {
    if (filtre === 'actives') return c.statut === 'nouvelle' || c.statut === 'en_cours'
    if (filtre === 'toutes') return true
    return c.statut === filtre
  })
  const courant = (items || []).find(c => c.id === ouvert) || null

  async function accepter() {
    if (!courant) return
    setBusy(true); setErr(null); setMsg(null); setLastInvite(null)
    const { data, error } = await supabase.rpc('accepter_candidature_benevole', {
      p_id: courant.id,
      p_role: role,
      p_envoyer_invitation: true,
    })
    if (error || data?.ok === false) {
      setBusy(false)
      setErr(error?.message || data?.error || 'Acceptation impossible.')
      return
    }
    if (data.invitation_code) {
      const envoi = await envoyerInvitationEmail(data.invitation_code)
      setLastInvite({
        code: data.invitation_code,
        email: data.email || courant.email,
        prenom: courant.prenom,
        typeBenevole: role,
        mailEnvoye: !!envoi.ok,
        mailErreur: envoi.ok ? null : (envoi.error || 'Envoi impossible.'),
      })
      setMsg(envoi.ok
        ? `Fiche créée et invitation envoyée à ${data.email || courant.email}.`
        : `Fiche créée. Le mail n’est pas parti : ${envoi.error || 'erreur'}.`)
    } else {
      setMsg('Fiche volontaire créée (sans invitation — e-mail manquant ou invalide).')
    }
    setBusy(false)
    await charger()
  }

  async function refuser() {
    if (!courant) return
    if (!confirm('Refuser cette candidature ?')) return
    setBusy(true); setErr(null)
    const { data, error } = await supabase.rpc('refuser_candidature_benevole', {
      p_id: courant.id,
      p_notes: notes || null,
    })
    setBusy(false)
    if (error || data?.ok === false) {
      setErr(error?.message || data?.error || 'Refus impossible.')
      return
    }
    setMsg('Candidature refusée.')
    setNotes('')
    await charger()
  }

  async function marquerEnCours() {
    if (!courant) return
    setBusy(true)
    await supabase.from('candidatures_benevoles').update({ statut: 'en_cours' }).eq('id', courant.id)
    setBusy(false)
    await charger()
  }

  return (
    <Page
      title="Demandes de volontariat"
      subtitle="Candidatures reçues via le site (Devenir bénévole). Créez la fiche et l’accès depuis ici."
    >
      {err && <Flash kind="err">{err}</Flash>}
      {msg && <Flash>{msg}</Flash>}
      <div className="ha-tabs" style={{ marginBottom: 12 }}>
        {[
          ['actives', 'À traiter'],
          ['acceptee', 'Acceptées'],
          ['refusee', 'Refusées'],
          ['toutes', 'Toutes'],
        ].map(([v, l]) => (
          <button key={v} type="button" className={'ha-tab' + (filtre === v ? ' is-on' : '')}
            onClick={() => { setFiltre(v); setOuvert(null); setLastInvite(null) }}>
            {l}
          </button>
        ))}
      </div>

      {items === null ? <Loading /> : liste.length === 0 ? (
        <Empty title="Aucune candidature" hint="Les envois du formulaire WordPress « Devenir bénévole » apparaîtront ici." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {liste.map(c => (
            <button key={c.id} type="button" className="ha-actu-ligne" onClick={() => { setOuvert(c.id); setLastInvite(null); setRole(c.type_benevole === 'medical' ? 'volontaire_medical' : 'volontaire_non_medical') }}>
              <div style={{ textAlign: 'left' }}>
                <strong>{c.prenom} {c.nom}</strong>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {c.email}{c.telephone ? ` · ${c.telephone}` : ''} · {quand(c.created_at)}
                  {c.source === 'wordpress' ? ' · Site web' : ''}
                </div>
              </div>
              <Pastille statut={c.statut} />
            </button>
          ))}
        </div>
      )}

      {courant && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{courant.prenom} {courant.nom}</h2>
            <Pastille statut={courant.statut} />
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text-2)', marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div><strong>E-mail</strong> · {courant.email}</div>
            {courant.telephone && <div><strong>Téléphone</strong> · {courant.telephone}</div>}
            {courant.date_naissance && <div><strong>Naissance</strong> · {courant.date_naissance}</div>}
            {adr(courant.adresse) && <div><strong>Adresse</strong> · {adr(courant.adresse)}</div>}
            {courant.registre && <div><strong>Registre</strong> · {courant.registre}</div>}
            {courant.profession && <div><strong>Profession</strong> · {courant.profession}</div>}
            {(courant.comites || []).length > 0 && (
              <div><strong>Comités</strong> · {(courant.comites || []).join(', ')}</div>
            )}
            {courant.motivation && (
              <div style={{ marginTop: 6 }}>
                <strong>Motivation</strong>
                <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{courant.motivation}</div>
              </div>
            )}
            {courant.commentaires && (
              <div style={{ marginTop: 6 }}>
                <strong>Commentaires</strong>
                <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{courant.commentaires}</div>
              </div>
            )}
            {(courant.photo_nom || courant.diplome_nom) && (
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 6 }}>
                Pièces jointes côté site / e-mail :
                {courant.photo_nom ? ` photo « ${courant.photo_nom} »` : ''}
                {courant.diplome_nom ? ` · diplôme « ${courant.diplome_nom} »` : ''}
              </div>
            )}
          </div>

          {courant.statut === 'acceptee' && courant.profile_id && (
            <div style={{ marginTop: 12 }}>
              <Pill color="#3B6D11" bg="#EAF3DE">Fiche créée</Pill>
              <div style={{ marginTop: 8 }}>
                <Btn kind="soft" onClick={() => { window.location.href = `/app/volontaires` }}>Voir les fiches volontaires</Btn>
              </div>
            </div>
          )}

          {lastInvite && (
            <div style={{ marginTop: 14 }}>
              <CodeBox
                embedded
                code={lastInvite.code}
                email={lastInvite.email}
                prenom={lastInvite.prenom}
                typeBenevole={lastInvite.typeBenevole}
                mailEnvoye={lastInvite.mailEnvoye}
                mailErreur={lastInvite.mailErreur}
              />
            </div>
          )}

          {(courant.statut === 'nouvelle' || courant.statut === 'en_cours') && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Sel
                label="Type de volontaire"
                value={role}
                set={setRole}
                options={[
                  { v: 'volontaire_non_medical', l: 'Volontaire non médical' },
                  { v: 'volontaire_medical', l: 'Volontaire médical' },
                ]}
              />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Btn onClick={accepter} disabled={busy}>{busy ? '…' : 'Créer la fiche et envoyer l’accès'}</Btn>
                {courant.statut === 'nouvelle' && (
                  <Btn kind="soft" onClick={marquerEnCours} disabled={busy}>Marquer en cours</Btn>
                )}
              </div>
              <TA label="Note interne (si refus)" value={notes} set={setNotes} rows={2} />
              <Btn kind="danger" onClick={refuser} disabled={busy}>Refuser</Btn>
            </div>
          )}
        </Card>
      )}
    </Page>
  )
}
