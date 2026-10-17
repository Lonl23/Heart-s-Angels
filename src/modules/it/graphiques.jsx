const PALETTE = ['#1BB0CE', '#0F6E56', '#BA7517', '#3D5A80', '#6B4C9A', '#A32D2D', '#3B6D11', '#185FA5']

function coupe(label, n = 32) {
  const s = String(label || '')
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function plafond(rows, echelle) {
  const local = (rows || []).reduce((m, r) => Math.max(m, Number(r.n) || 0), 0)
  return Math.max(Number(echelle) || 0, local, 1)
}

export function Barres({ titre, rows, unite = '', echelle }) {
  const data = rows || []
  const max = plafond(data, echelle)
  const h = Math.max(data.length, 1) * 32 + 8
  return (
    <section className="ha-graph" style={titre ? undefined : { border: 'none', padding: '4px 0', margin: 0, background: 'transparent' }}>
      {titre ? <h2>{titre}</h2> : null}
      {!data.length ? <p className="ha-graph-vide">Aucune donnée pour ce filtre.</p> : (
        <svg viewBox={`0 0 640 ${h}`} width="100%" role="img" aria-label={titre || 'Graphique'}>
          <line x1="210" y1="4" x2="210" y2={h - 4} stroke="currentColor" strokeOpacity="0.15" />
          <line x1="510" y1="4" x2="510" y2={h - 4} stroke="currentColor" strokeOpacity="0.15" />
          {data.map((r, i) => {
            const w = (Number(r.n) || 0) / max * 300
            const y = 8 + i * 32
            return (
              <g key={`${r.label || i}-${i}`}>
                <text x="0" y={y + 16} fontSize="13" fill="currentColor">{coupe(r.label)}</text>
                <rect x="210" y={y + 4} width={Math.max(w, r.n > 0 ? 2 : 0)} height="16" rx="4" fill={PALETTE[i % PALETTE.length]} />
                <text x={Math.min(518, 218 + w)} y={y + 16} fontSize="13" fontWeight="700" fill="currentColor">{r.n}{unite ? ` ${unite}` : ''}</text>
              </g>
            )
          })}
        </svg>
      )}
    </section>
  )
}

export function Colonnes({ titre, rows, echelle }) {
  const data = rows || []
  const max = plafond(data, echelle)
  const largeur = Math.max(data.length * 72, 220)
  return (
    <section className="ha-graph">
      <h2>{titre}</h2>
      {!data.length ? <p className="ha-graph-vide">Aucune donnée.</p> : (
        <svg viewBox={`0 0 ${largeur} 180`} width="100%" role="img" aria-label={titre}>
          <line x1="8" y1="140" x2={largeur - 8} y2="140" stroke="currentColor" strokeOpacity="0.2" />
          {data.map((r, i) => {
            const h = (Number(r.n) || 0) / max * 120
            const x = 16 + i * 72
            return (
              <g key={r.annee || r.label || i}>
                <rect x={x} y={140 - h} width="40" height={Math.max(h, r.n > 0 ? 2 : 0)} rx="4" fill={PALETTE[i % PALETTE.length]} />
                <text x={x + 20} y={Math.max(14, 134 - h)} textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor">{r.n}</text>
                <text x={x + 20} y="164" textAnchor="middle" fontSize="12" fill="currentColor">{r.annee || r.label}</text>
              </g>
            )
          })}
        </svg>
      )}
    </section>
  )
}
