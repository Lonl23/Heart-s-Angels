import { defsHorairesPartenaire } from './missionSchema'

function fmtDt(v) {
  if (!v) return ''
  return new Date(v).toLocaleString('fr-BE', { dateStyle: 'short', timeStyle: 'short' }).replace(' ', ' · ')
}

/** Aperçu du rapport partenaire : patient, horaires du trajet, récit. Sans km ni photos véhicule. */
export function ApercuPartenaire({ patient, dateTxt, souhait, vecteurs, deroulement, etat, observations }) {
  const defs = defsHorairesPartenaire()
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '8px 18px', fontSize: 13.5, marginBottom: 12 }}>
        {patient ? (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Patient</div>
            <div>{patient}</div>
          </div>
        ) : null}
        {dateTxt ? (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Date</div>
            <div>{dateTxt}</div>
          </div>
        ) : null}
      </div>
      {souhait && <div style={{ fontSize: 14, fontStyle: 'italic', marginBottom: 12 }}>« {souhait} »</div>}

      {(vecteurs || []).map(v => (
        <div key={v.id || v.nom} style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 6 }}>{v.nom || 'Véhicule'}</div>
          <table className="ha-rapport-heures">
            <tbody>
              {defs.map(e => (
                <tr key={e.id}>
                  <td>{e.l}</td>
                  <td>{fmtDt(v.heures?.[e.id]) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {deroulement && <p style={{ margin: '8px 0', fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}><strong>La journée.</strong> {deroulement}</p>}
      {etat && <p style={{ margin: '8px 0', fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}><strong>État au retour.</strong> {etat}</p>}
      {observations && <p style={{ margin: '8px 0', fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}><strong>Observations.</strong> {observations}</p>}
    </div>
  )
}
