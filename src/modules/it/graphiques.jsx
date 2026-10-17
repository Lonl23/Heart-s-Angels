const PALETTE = ['#1BB0CE', '#0F6E56', '#BA7517', '#3D5A80', '#6B4C9A', '#A32D2D', '#3B6D11', '#185FA5']

function coupe(label, n = 28) {
  const s = String(label || '')
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

export function Barres({ titre, rows, unite = '' }) {
  const data = (rows || []).slice(0, 12)
  const max = data.reduce((m, r) => Math.max(m, r.n), 0) || 1
  const h = Math.max(data.length, 1) * 32 + 8
  return (
    <section className="ha-graph" style={titre ? undefined : { border: 'none', padding: '4px 0', margin: 0, background: 'transparent' }}>
      {titre ? <h2>{titre}</h2> : null}
      {!data.length ? <p className="ha-graph-vide">Aucune donnée sur cette période.</p> : (
        <svg viewBox={`0 0 640 ${h}`} width="100%" role="img" aria-label={titre}>
          {data.map((r, i) => {
            const w = Math.max(4, (r.n / max) * 300)
            const y = 8 + i * 32
            return (
              <g key={r.label || i}>
                <text x="0" y={y + 16} fontSize="13" fill="currentColor">{coupe(r.label)}</text>
                <rect x="210" y={y + 4} width={w} height="16" rx="4" fill={PALETTE[i % PALETTE.length]} />
                <text x={218 + w} y={y + 16} fontSize="13" fontWeight="700" fill="currentColor">{r.n}{unite ? ` ${unite}` : ''}</text>
              </g>
            )
          })}
        </svg>
      )}
    </section>
  )
}

export function Colonnes({ titre, rows }) {
  const data = rows || []
  const max = data.reduce((m, r) => Math.max(m, r.n), 0) || 1
  const largeur = Math.max(data.length * 72, 220)
  return (
    <section className="ha-graph">
      <h2>{titre}</h2>
      {!data.length ? <p className="ha-graph-vide">Aucune donnée.</p> : (
        <svg viewBox={`0 0 ${largeur} 180`} width="100%" role="img" aria-label={titre}>
          {data.map((r, i) => {
            const h = Math.max(4, (r.n / max) * 120)
            const x = 16 + i * 72
            return (
              <g key={r.annee || r.label || i}>
                <rect x={x} y={140 - h} width="40" height={h} rx="4" fill={PALETTE[i % PALETTE.length]} />
                <text x={x + 20} y={134 - h} textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor">{r.n}</text>
                <text x={x + 20} y="164" textAnchor="middle" fontSize="12" fill="currentColor">{r.annee || r.label}</text>
              </g>
            )
          })}
        </svg>
      )}
    </section>
  )
}
