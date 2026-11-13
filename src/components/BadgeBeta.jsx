import { afficherBadgeBeta } from '@/lib/environnement'

/** Petite pastille visible seulement hors production. */
export default function BadgeBeta() {
  if (!afficherBadgeBeta()) return null
  return (
    <span className="ha-badge-beta" title="Version de test — pas encore la production">Bêta</span>
  )
}
