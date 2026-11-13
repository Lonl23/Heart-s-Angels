import { JOURS, iso, addDays, isoWeekNum } from './dates'

/** Grille mensuelle : numéro de semaine, aujourd’hui cerclé, clic sur un jour. */
export default function GrilleMois({ weeks, anchor, today, onJour, renderJour }) {
  return (
    <div className="ha-mois">
      <div className="ha-mois-head">
        <span className="ha-mois-wk" aria-hidden />
        {JOURS.map((j, i) => (
          <div key={j} className={'ha-mois-dow' + (i >= 5 ? ' is-we' : '')}>{j}</div>
        ))}
      </div>
      {weeks.map(ws => {
        const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(ws, i))
        return (
          <div key={iso(ws)} className="ha-mois-week">
            <span className="ha-mois-wk" title={'Semaine ' + isoWeekNum(ws)}>{isoWeekNum(ws)}</span>
            {days.map((day, i) => {
              const id = iso(day)
              const we = i >= 5
              const out = day.getMonth() !== anchor.getMonth()
              return (
                <div
                  key={id}
                  role="button"
                  tabIndex={0}
                  className={'ha-mois-cell' + (we ? ' is-we' : '') + (out ? ' is-out' : '') + (id === today ? ' is-today' : '')}
                  onClick={() => onJour(day)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onJour(day) } }}
                >
                  <span className={'ha-mois-num' + (id === today ? ' is-today' : '')}>{day.getDate()}</span>
                  <div className="ha-mois-pills">
                    {renderJour ? renderJour(id, day) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
