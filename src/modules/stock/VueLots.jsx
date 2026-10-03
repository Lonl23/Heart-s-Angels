import { Card, Btn, Empty } from '@/components/ui'
import { PhotoArticle } from './photoStock'
import { fmtDlc, dlcPassee, dlcProche, qteLotLabel, lotCorrespond } from './lotsStock'

export default function VueLots({ lots, filtre, onVoirPieces }) {
  const q = (filtre || '').trim().toLowerCase()
  const vis = (lots || []).filter(l => lotCorrespond(l, q))

  if (!vis.length) {
    return (
      <Empty
        title={q ? 'Aucun lot ne correspond' : 'Aucun lot en stock'}
        hint={q
          ? 'Essayez le n° de lot tel qu’il est imprimé sur la boîte, ou le nom de l’article.'
          : 'À la réception, saisissez le n° de lot et la DLC : ils resteront liés. Les pièces sans lot apparaissent ici comme « sans lot ».'}
      />
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {vis.map(lot => {
        const key = `${lot.catalogue_id}-${lot.lot || 'sans'}`
        const perime = dlcPassee(lot.dlc)
        const proche = dlcProche(lot.dlc)
        const dlcColor = perime ? '#A32D2D' : proche ? '#BA7517' : 'var(--text-muted)'
        return (
          <Card key={key} style={{ padding:'12px 14px' }}>
            <div className="ha-stock-row" style={{ alignItems:'flex-start' }}>
              <PhotoArticle path={lot.photo_path} size={56} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontWeight:600 }}>{lot.article}</div>
                    <div style={{ fontSize:15, fontWeight:700, color:'var(--heading)', marginTop:2, letterSpacing:'.02em' }}>
                      {lot.lot ? `Lot ${lot.lot}` : 'Sans n° de lot'}
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontWeight:700 }}>{qteLotLabel(lot)}</div>
                    <div style={{ fontSize:12.5, color: dlcColor, marginTop:2 }}>
                      DLC {fmtDlc(lot.dlc)}
                      {perime ? ' · périmé' : proche ? ' · bientôt' : ''}
                    </div>
                  </div>
                </div>
                {lot.dlc_incoherente && (
                  <div style={{ marginTop:6, fontSize:12.5, color:'#A32D2D', fontWeight:600 }}>
                    DLC différentes sur ce lot : {(lot.dlcs || []).map(fmtDlc).join(', ')}
                  </div>
                )}
                <div className="ha-stock-lot-lieux">
                  <div className="ha-stock-lot-lieux-titre">Où c’est rangé</div>
                  {(lot.lieux || []).length === 0 ? (
                    <div style={{ fontSize:13, color:'var(--text-muted)' }}>Pas encore rangé</div>
                  ) : (lot.lieux || []).map((x, i) => (
                    <div key={x.lieu_id || `nl-${i}`} className="ha-stock-lot-lieu">
                      <span>{x.chemin || x.nom || 'sans lieu'}</span>
                      <strong>{Number(x.qte)}</strong>
                    </div>
                  ))}
                </div>
                {onVoirPieces && lot.lot && (
                  <div style={{ marginTop:8 }}>
                    <Btn kind="soft" onClick={() => onVoirPieces(lot.lot)} style={{ padding:'5px 10px' }}>
                      Voir les QR de ce lot
                    </Btn>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
