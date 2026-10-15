import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, Card, Empty, Loading } from '@/components/ui'
import { lblMouv, couleurMouv, fmtQuand } from './stockSchema'
import { PhotoArticle } from './photoStock'
import { exporterMouvementsCsv } from './excelStock'
import { fmtDatesSouhait } from '@/modules/souhaits/datesSouhait'
import OngletMouvements from './OngletMouvements'

export default function OngletRapportSortie({ cats }) {
  const [vue, setVue] = useState('declasse')
  const [missions, setMissions] = useState(null)
  const [err, setErr] = useState(null)
  const [ouvert, setOuvert] = useState(null)
  const [detail, setDetail] = useState(null)

  async function loadMissions() {
    setErr(null)
    const { data, error } = await supabase.rpc('stock_rapports_mission')
    if (error || data?.ok === false) { setErr(error?.message || data?.error); setMissions([]); return }
    setMissions(data.missions || [])
  }

  useEffect(() => { if (vue === 'missions') loadMissions() }, [vue])

  async function ouvrir(m) {
    if (ouvert === m.souhait_id) { setOuvert(null); setDetail(null); return }
    setOuvert(m.souhait_id)
    setDetail(null)
    const { data, error } = await supabase.rpc('stock_rapport_souhait', { p_souhait: m.souhait_id })
    if (error || data?.ok === false) { setErr(error?.message || data?.error); setDetail({ items: [] }); return }
    if (data.vide) { setOuvert(null); setDetail(null); loadMissions(); return }
    setDetail(data)
  }

  return (
    <div>
      <div className="ha-stock-vue" style={{ marginBottom: 12 }}>
        <button type="button" className={'ha-tab-like' + (vue === 'declasse' ? ' is-on' : '')} onClick={() => setVue('declasse')}>
          Déclassement
        </button>
        <button type="button" className={'ha-tab-like' + (vue === 'missions' ? ' is-on' : '')} onClick={() => setVue('missions')}>
          Utilisation mission
        </button>
      </div>

      {vue === 'declasse' && (
        <OngletMouvements
          cats={cats}
          typesAutorises={['sortie']}
          sansSouhait
          csv
          hint="Casse, don, destruction, cession — sorties hors mission." />
      )}

      {vue === 'missions' && (
        <div>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)', margin: '0 0 12px' }}>
            Un rapport par souhait dès qu’un emport ou une consommation a été scannée. Rien n’est créé à vide.
          </p>
          {err && <div style={{ color: '#A32D2D', fontSize: 13.5, marginBottom: 10 }}>{err}</div>}
          {missions == null ? <Loading /> : missions.length === 0 ? (
            <Empty title="Aucun rapport de mission" hint="Dès qu’un sac ou un article est emporté ou consommé sur un souhait, le rapport apparaît ici." />
          ) : missions.map(m => {
            const on = ouvert === m.souhait_id
            const dates = fmtDatesSouhait(m)
            return (
              <Card key={m.souhait_id} style={{ padding: '12px 14px', marginBottom: 8 }}>
                <button type="button" className="ha-stock-table-link" onClick={() => ouvrir(m)} style={{ width: '100%', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <strong>{m.titre || 'Mission'}</strong>
                    <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{fmtQuand(m.derniere)}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 3 }}>
                    {dates}
                    {m.nb_emport ? ` · ${m.nb_emport} emport${m.nb_emport > 1 ? 's' : ''}` : ''}
                    {m.nb_conso ? ` · ${m.nb_conso} conso` : ''}
                  </div>
                </button>
                {on && (
                  <div style={{ marginTop: 10 }}>
                    {detail == null ? (
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Chargement…</div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                          <Btn kind="soft" onClick={() => exporterMouvementsCsv(detail.items || [], `rapport-mission.csv`)} disabled={!detail.items?.length}>
                            CSV
                          </Btn>
                        </div>
                        {(detail.items || []).length === 0 ? (
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Plus rien à afficher.</div>
                        ) : (detail.items || []).map(x => (
                          <div key={x.id} className="ha-stock-row" style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                            <PhotoArticle path={x.photo_path} size={40} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ fontWeight: 600 }}>{x.article || x.lieu_nom || 'Mouvement'}</span>
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: couleurMouv(x.type) }}>{lblMouv(x.type)}</span>
                              </div>
                              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                                {x.quantite != null ? `Qté ${Number(x.quantite)}` : ''}
                                {x.lot ? ` · lot ${x.lot}` : ''}
                                {x.lieu_nom ? ` · ${x.lieu_nom}` : ''}
                                {x.motif ? ` · ${x.motif}` : ''}
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                                {fmtQuand(x.created_at)}{x.par_nom ? ` · ${x.par_nom}` : ''}
                              </div>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
