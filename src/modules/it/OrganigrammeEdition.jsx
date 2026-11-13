import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Page, Card, Btn, Empty, Loading } from '@/components/ui'
import { arbrePlace, listePlacee, nomPersonne, vuePersonne } from '@/modules/rh/organigrammeArbre'
import OrganigrammeArbre from '@/modules/rh/OrganigrammeArbre'

export default function OrganigrammeEdition() {
  const [profils, setProfils] = useState(null)
  const [liens, setLiens] = useState([])
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(null)
  const [recherche, setRecherche] = useState('')
  const [sous, setSous] = useState({})

  async function charger() {
    const [gens, places] = await Promise.all([
      supabase.from('profiles').select('id,prenom,nom,email,telephone,fiche,actif,role').neq('role', 'partenaire').order('nom'),
      supabase.from('organigramme').select('profile_id,n1_id,ordre,n1_volontaires'),
    ])
    if (gens.error) setErr(gens.error.message)
    else if (places.error) setErr(places.error.message)
    else setErr(null)
    setProfils(gens.data || [])
    setLiens(places.data || [])
  }

  useEffect(() => { charger() }, [])

  const parId = useMemo(() => new Map((profils || []).map(p => [p.id, p])), [profils])
  const lignes = useMemo(() => listePlacee(profils || [], liens), [profils, liens])
  const placesIds = useMemo(() => new Set(liens.map(l => l.profile_id)), [liens])
  const arbre = useMemo(() => arbrePlace(profils || [], liens), [profils, liens])

  const candidats = useMemo(() => {
    const q = recherche.trim().toLocaleLowerCase('fr')
    return (profils || [])
      .filter(p => {
        const vue = vuePersonne(p)
        if (!vue.aUnRole || !vue.actif || placesIds.has(p.id)) return false
        if (!q) return true
        return `${vue.prenom} ${vue.nom} ${vue.labels.join(' ')}`.toLocaleLowerCase('fr').includes(q)
      })
      .sort((a, b) => nomPersonne(a).localeCompare(nomPersonne(b), 'fr'))
  }, [profils, placesIds, recherche])

  const horsRole = useMemo(() => liens.filter(l => {
    const p = parId.get(l.profile_id)
    if (!p) return true
    const vue = vuePersonne(p)
    return !vue.aUnRole || !vue.actif
  }), [liens, parId])

  async function agir(id, travail) {
    setBusy(id)
    setErr(null)
    try {
      await travail()
      await charger()
    } catch (e) {
      setErr(e.message || 'Enregistrement impossible.')
    } finally {
      setBusy(null)
    }
  }

  function placer(id) {
    const n1 = sous[id] || null
    const freres = liens.filter(l => (l.n1_id || null) === n1)
    const ordre = freres.reduce((m, l) => Math.max(m, Number(l.ordre) || 0), 0) + 10
    return agir(id, async () => {
      const { error } = await supabase.from('organigramme').insert({ profile_id: id, n1_id: n1, ordre })
      if (error) throw error
    })
  }

  function changerN1(id, n1) {
    const parent = n1 || null
    const freres = liens.filter(l => (l.n1_id || null) === parent && l.profile_id !== id)
    const ordre = freres.reduce((m, l) => Math.max(m, Number(l.ordre) || 0), 0) + 10
    return agir(id, async () => {
      const { error } = await supabase.from('organigramme').update({ n1_id: parent, ordre }).eq('profile_id', id)
      if (error) throw error
    })
  }

  function deplacer(ligne, sens) {
    const ids = [...ligne.siblingIds]
    const i = ligne.index
    const j = i + sens
    if (j < 0 || j >= ids.length) return
    const tmp = ids[i]
    ids[i] = ids[j]
    ids[j] = tmp
    return agir(ligne.personne.id, async () => {
      for (let k = 0; k < ids.length; k++) {
        const { error } = await supabase.from('organigramme').update({ ordre: (k + 1) * 10 }).eq('profile_id', ids[k])
        if (error) throw error
      }
    })
  }

  function basculerRelais(id, on) {
    return agir(id, async () => {
      const { error } = await supabase.from('organigramme').update({ n1_volontaires: on }).eq('profile_id', id)
      if (error) throw error
    })
  }

  function retirer(id, nom) {
    if (!window.confirm(`Retirer ${nom} de l’organigramme ? Les personnes en dessous remontent d’un niveau.`)) return
    return agir(id, async () => {
      const { error } = await supabase.from('organigramme').delete().eq('profile_id', id)
      if (error) throw error
    })
  }

  if (profils === null) return <Page title="Organigramme"><Loading /></Page>

  return (
    <Page
      title="Organigramme"
      subtitle="Le volontaire est le N et n’apparaît pas. Vous placez son N+1, puis le N+2 au-dessus. Les rôles viennent des fiches."
    >
      {err && <div className="ha-flash ha-flash-err">{err}</div>}

      <Card style={{ marginBottom: 16 }}>
        <h2 style={titre}>Personnes avec un rôle</h2>
        <p style={aide}>Un volontaire sans rôle dans l’ASBL n’est pas placé : c’est le N.</p>
        <input
          className="ha-search"
          placeholder="Nom ou rôle"
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        {candidats.length === 0 ? (
          <p style={aide}>{recherche ? 'Aucune personne ne correspond.' : 'Toutes les personnes avec un rôle sont déjà placées.'}</p>
        ) : (
          <ul className="ha-org-edit-candidats">
            {candidats.map(p => {
              const vue = vuePersonne(p)
              return (
                <li key={p.id}>
                  <div>
                    <strong>{nomPersonne(vue)}</strong>
                    <div className="ha-org-edit-roles">{vue.labels.join(' · ')}</div>
                  </div>
                  <label className="ha-org-edit-n1">
                    Au-dessus
                    <select value={sous[p.id] || ''} disabled={!!busy} onChange={e => setSous(s => ({ ...s, [p.id]: e.target.value }))}>
                      <option value="">En haut de l’arbre</option>
                      {lignes.map(l => <option key={l.personne.id} value={l.personne.id}>{nomPersonne(l.personne)}</option>)}
                    </select>
                  </label>
                  <Btn disabled={!!busy} onClick={() => placer(p.id)}>{busy === p.id ? '…' : 'Placer'}</Btn>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h2 style={titre}>Qui est au-dessus de qui</h2>
        <p style={aide}>Cochez les N+1 des volontaires. La personne au-dessus d’eux devient le N+2. À gauche et à droite changent l’ordre sur la même ligne.</p>
        {lignes.length === 0 ? (
          <Empty title="Personne sur l’organigramme" hint="Placez d’abord la personne du haut, puis celles qui sont en dessous." />
        ) : (
          <div>
            {lignes.map(ligne => {
              const id = ligne.personne.id
              const lien = liens.find(l => l.profile_id === id)
              const exclus = descendants(id, liens)
              exclus.add(id)
              const options = lignes
                .filter(l => !exclus.has(l.personne.id))
                .map(l => ({ v: l.personne.id, l: nomPersonne(l.personne) }))
              const n1Actuel = lien?.n1_id || ''
              const n1Connu = !n1Actuel || options.some(o => o.v === n1Actuel)
              return (
                <div key={id} className="ha-org-edit-row" style={{ paddingLeft: 12 + ligne.chaine.length * 18 }}>
                  <div>
                    <strong>{nomPersonne(ligne.personne)}</strong>
                    <div className="ha-org-edit-roles">{ligne.personne.labels.join(' · ')}</div>
                    <div className="ha-org-edit-n2">
                      {ligne.personne.niveau > 0
                        ? `Pour les volontaires : N+${ligne.personne.niveau}`
                        : 'Pas dans la chaîne des volontaires'}
                    </div>
                    <label className="ha-org-edit-n2">
                      <input
                        type="checkbox"
                        checked={!!lien?.n1_volontaires}
                        disabled={!!busy}
                        onChange={e => basculerRelais(id, e.target.checked)}
                      />
                      {' '}N+1 des volontaires
                    </label>
                  </div>
                  <label className="ha-org-edit-n1">
                    Au-dessus
                    <select
                      value={n1Actuel}
                      disabled={!!busy}
                      onChange={e => changerN1(id, e.target.value)}
                    >
                      <option value="">En haut de l’arbre</option>
                      {!n1Connu && <option value={n1Actuel}>{nomPersonne(parId.get(n1Actuel)) || 'N+1 à corriger'}</option>}
                      {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </label>
                  <div className="ha-org-edit-actions">
                    <Btn kind="soft" disabled={!!busy || ligne.index === 0} onClick={() => deplacer(ligne, -1)}>À gauche</Btn>
                    <Btn kind="soft" disabled={!!busy || ligne.index === ligne.siblingIds.length - 1} onClick={() => deplacer(ligne, 1)}>À droite</Btn>
                    <Btn kind="danger" disabled={!!busy} onClick={() => retirer(id, nomPersonne(ligne.personne))}>Retirer</Btn>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {horsRole.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <p style={aide}>Ces personnes n’ont plus de rôle actif. Elles ne s’affichent plus pour les volontaires.</p>
            {horsRole.map(l => {
              const p = parId.get(l.profile_id)
              const nom = p ? nomPersonne(p) : 'Personne retirée'
              return (
                <div key={l.profile_id} className="ha-org-edit-row">
                  <strong>{nom}</strong>
                  <Btn kind="danger" disabled={!!busy} onClick={() => retirer(l.profile_id, nom)}>Retirer</Btn>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <Card>
        <h2 style={titre}>Aperçu</h2>
        <p style={aide}>
          C’est cet arbre que les volontaires voient dans Gestion RH, avec le téléphone et l’e-mail.{' '}
          <Link to="/app/rh/organigramme">Ouvrir l’organigramme ›</Link>
        </p>
        {arbre.length === 0
          ? <p style={aide}>L’aperçu apparaîtra dès qu’une personne est placée.</p>
          : <OrganigrammeArbre arbre={arbre} />}
      </Card>
    </Page>
  )
}

function descendants(id, liens) {
  const out = new Set()
  const pile = [id]
  while (pile.length) {
    const cur = pile.pop()
    for (const l of liens) {
      if (l.n1_id === cur && !out.has(l.profile_id)) {
        out.add(l.profile_id)
        pile.push(l.profile_id)
      }
    }
  }
  return out
}

const titre = { margin: '0 0 6px', fontSize: '1.35rem', color: 'var(--heading)' }
const aide = { margin: '0 0 12px', color: 'var(--text-muted)', fontSize: 13.5 }
