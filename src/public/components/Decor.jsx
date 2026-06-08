import { useMotif } from '@/lib/siteConfig'
// src/public/components/Decor.jsx
// Bibliothèque de séparateurs et formes décoratives réutilisables sur tout le site public.

// ── Séparateur en VAGUE ──────────────────────────────────────────────────────
// haut = couleur de la section du dessus, bas = couleur de la section du dessous
export function Vague({ haut = 'transparent', bas = '#FDFAF6', h = 80, variante = 1 }) {
  const tracés = {
    1: 'M0,40 C320,90 520,5 720,32 C920,59 1160,92 1440,44 L1440,80 L0,80 Z',
    2: 'M0,48 C360,12 720,72 1080,40 C1260,24 1360,36 1440,40 L1440,80 L0,80 Z',
    3: 'M0,30 C480,80 960,0 1440,50 L1440,80 L0,80 Z',
  }
  return (
    <div style={{ background: haut, lineHeight: 0 }} aria-hidden="true">
      <svg viewBox="0 0 1440 80" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: h }}>
        <path fill={bas} d={tracés[variante] || tracés[1]} />
      </svg>
    </div>
  )
}

// ── Séparateur en DIAGONALE ───────────────────────────────────────────────────
export function Diagonale({ haut = 'transparent', bas = '#FDFAF6', h = 64, sens = 'droite' }) {
  const d = sens === 'droite'
    ? 'M0,80 L1440,0 L1440,80 Z'
    : 'M0,0 L1440,80 L0,80 Z'
  return (
    <div style={{ background: haut, lineHeight: 0 }} aria-hidden="true">
      <svg viewBox="0 0 1440 80" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: h }}>
        <path fill={bas} d={d} />
      </svg>
    </div>
  )
}

// ── Forme ORGANIQUE (blob) en décoration de fond ──────────────────────────────
// À placer en absolute dans une section position:relative
export function Blob({ couleur = 'rgba(27,176,206,.07)', taille = 420, top, left, right, bottom }) {
  return (
    <div aria-hidden="true" style={{
      position: 'absolute', width: taille, height: taille, top, left, right, bottom,
      background: couleur, filter: 'blur(8px)', zIndex: 0, pointerEvents: 'none',
      borderRadius: '42% 58% 63% 37% / 41% 44% 56% 59%',
    }} />
  )
}

// ── Petits points décoratifs (motif) ──────────────────────────────────────────
export function Pointilles({ couleur = 'rgba(27,176,206,.18)', top, left, right, bottom, taille = 120 }) {
  const id = `dots-${Math.random().toString(36).slice(2, 7)}`
  return (
    <svg aria-hidden="true" width={taille} height={taille} style={{ position: 'absolute', top, left, right, bottom, zIndex: 0, pointerEvents: 'none' }}>
      <defs>
        <pattern id={id} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="2.5" fill={couleur} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

// ── Séparateur générique selon un motif choisi ───────────────────────────────
// motif : 'vague1' | 'vague2' | 'vague3' | 'diagonale-d' | 'diagonale-g' | 'droit'
export function Separateur({ motif = 'vague1', haut, bas, h = 80 }) {
  if (motif === 'droit') return <div style={{ background: bas, height: 0 }} />
  if (motif === 'diagonale-d') return <Diagonale haut={haut} bas={bas} h={h} sens="droite" />
  if (motif === 'diagonale-g') return <Diagonale haut={haut} bas={bas} h={h} sens="gauche" />
  const v = motif === 'vague2' ? 2 : motif === 'vague3' ? 3 : 1
  return <Vague haut={haut} bas={bas} h={h} variante={v} />
}

// Aperçus pour le sélecteur de motif (dans l'app interne)
export const MOTIFS = [
  { cle:'vague1',      label:'Vague douce' },
  { cle:'vague2',      label:'Vague ondulée' },
  { cle:'vague3',      label:'Vague ample' },
  { cle:'diagonale-d', label:'Diagonale ↗' },
  { cle:'diagonale-g', label:'Diagonale ↘' },
  { cle:'droit',       label:'Droit (aucun)' },
]


// Séparateur qui suit automatiquement le motif global choisi
export function SepAuto({ haut, bas, h = 80 }) {
  const motif = useMotif()
  return <Separateur motif={motif} haut={haut} bas={bas} h={h} />
}