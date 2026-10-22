import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { CATEGORIES, compteOuverts, plaquePourFiltre, totalOuverts } from './vehicules'

/** Aperçu sur le souhait : les points ouverts du véhicule, pas la checklist du jour. */
export default function EtatVehicule({ plaque }) {
  const [row, setRow] = useState(null)

  useEffect(() => {
    const filtre = plaquePourFiltre(plaque)
    if (!filtre) { setRow(null); return }
    let cancel = false
    ;(async () => {
      const { data: liste, error } = await supabase
        .from('plaques_vehicules')
        .select('id,plaque,libelle')
        .eq('actif', true)
        .ilike('plaque', filtre)
      if (cancel || error) { if (!cancel) setRow(null); return }
      const v = (liste || []).find(x => String(x.plaque || '').trim().toLowerCase() === filtre.toLowerCase()) || liste?.[0]
      if (!v) { setRow(null); return }
      const { data: ouverts, error: errC } = await supabase
        .from('vehicule_constats')
        .select('categorie,ouvert')
        .eq('vehicule_id', v.id)
        .eq('ouvert', true)
      if (cancel || errC) { if (!cancel) setRow(null); return }
      setRow({ ...v, n: compteOuverts(ouverts || []) })
    })()
    return () => { cancel = true }
  }, [plaque])

  if (!row) return null
  const total = totalOuverts(row.n)
  return (
    <Link to={`/app/logistique/vehicules/${row.id}`} className="ha-veh-apercu">
      <span className="ha-veh-apercu-titre">État du véhicule</span>
      <span className="ha-veh-apercu-pts">
        {CATEGORIES.map(c => (
          <span key={c.v} className={row.n[c.v] ? 'is-alerte' : 'is-ok'}>
            {c.l} {row.n[c.v] ? row.n[c.v] : '✓'}
          </span>
        ))}
      </span>
      <span className="ha-veh-apercu-suite">
        {total
          ? `${total} point${total > 1 ? 's' : ''} encore ouvert${total > 1 ? 's' : ''}`
          : 'Rien d’ouvert'}
        {' · ouvrir le check'}
      </span>
    </Link>
  )
}
