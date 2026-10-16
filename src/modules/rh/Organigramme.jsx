import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Empty, Loading } from '@/components/ui'
import { arbrePlace } from './organigrammeArbre'
import OrganigrammeArbre from './OrganigrammeArbre'

export default function Organigramme() {
  const { peutGererApp } = useAuth()
  const [gens, setGens] = useState(null)
  const [liens, setLiens] = useState([])
  const [err, setErr] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('id,prenom,nom,email,telephone,fiche,actif').neq('role', 'partenaire').eq('actif', true),
      supabase.from('organigramme').select('profile_id,n1_id,ordre'),
    ]).then(([profils, places]) => {
      if (profils.error) setErr(profils.error.message)
      else if (places.error) setErr(places.error.message)
      setGens(profils.data || [])
      setLiens(places.data || [])
    })
  }, [])

  const arbre = useMemo(() => (gens ? arbrePlace(gens, liens) : []), [gens, liens])

  if (gens === null) return <Page title="Organigramme"><Loading /></Page>

  return (
    <Page
      title="Organigramme"
      subtitle="La personne juste au-dessus est le N+1, celle encore au-dessus le N+2. Le téléphone et l’e-mail servent à la joindre."
    >
      {err && <div style={{ color: '#A32D2D', fontSize: 13, marginBottom: 10 }}>{err}</div>}
      {arbre.length === 0 ? (
        <Empty
          title="Organigramme à composer"
          hint="Les personnes et leur N+1 sont choisis dans IT, à partir des rôles des fiches."
          action={peutGererApp() ? <Link to="/app/it/organigramme">Composer dans IT ›</Link> : null}
        />
      ) : (
        <>
          {peutGererApp() && (
            <p style={{ margin: '0 0 14px' }}>
              <Link to="/app/it/organigramme">Modifier dans IT ›</Link>
            </p>
          )}
          <OrganigrammeArbre arbre={arbre} />
        </>
      )}
    </Page>
  )
}
