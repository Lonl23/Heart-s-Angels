import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, Btn, F, Sel, Empty, inp } from '@/components/ui'
import { cheminLieux, gestionLot, gestionDlc, libelleTracabilite, resteLabel } from './stockSchema'
import { fmtDlc, dlcPassee, dlcProche, aggregerLots } from './lotsStock'
import { PhotoArticle } from './photoStock'
import { FormReception } from './formsStock'

/**
 * Inventaire terrain : compléter articles, voir où c’est rangé,
 * lots + DLC seulement quand le type d’article le demande.
 */
export default function OngletInventaireFacile({
  cats, lieux, unites, onChange, onOk, onErr, onScanLieu, onRanger,
}) {
  const [vue, setVue] = useState('completer') // completer | ou | parcours
  const [q, setQ] = useState('')
  const [lieuId, setLieuId] = useState('')
  const [edit, setEdit] = useState(null)
  const [recv, setRecv] = useState(null)
  const [busy, setBusy] = useState(false)

  const byCat = useMemo(() => Object.fromEntries((cats || []).map(c => [c.id, c])), [cats])

  const incomplets = useMemo(() => {
    return (unites || []).filter(u => {
      if (u.etat && u.etat !== 'dispo') return false
      const cat = byCat[u.catalogue_id] || { mode: u.mode, nature: u.nature, gestion_lot: u.gestion_lot, gestion_dlc: u.gestion_dlc }
      const manqueLieu = !u.lieu_id
      const manqueLot = gestionLot(cat) && !(u.lot || '').trim()
      const manqueDlc = gestionDlc(cat) && !u.date_peremption
      return manqueLieu || manqueLot || manqueDlc
    }).sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'))
  }, [unites, byCat])

  const ouEstQuoi = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const lots = aggregerLots(unites, lieux)
    return lots.filter(l => {
      if (!needle) return true
      const lieuxTxt = (l.lieux || []).map(x => x.chemin || x.nom).join(' ')
      return [l.article, l.lot, lieuxTxt, l.dlc].some(x => String(x || '').toLowerCase().includes(needle))
    }).sort((a, b) => (a.article || '').localeCompare(b.article || '', 'fr'))
  }, [unites, lieux, q])

  const contenuLieu = useMemo(() => {
    if (!lieuId) return []
    return (unites || [])
      .filter(u => u.lieu_id === lieuId && (!u.etat || u.etat === 'dispo'))
      .sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'))
  }, [unites, lieuId])

  async function sauverComplet(e) {
    e?.preventDefault?.()
    if (!edit || busy) return
    const cat = byCat[edit.catalogue_id] || {}
    if (gestionLot(cat) && !(edit.lot || '').trim()) {
      onErr?.('Indiquez le n° de lot.'); return
    }
    if (gestionDlc(cat) && !edit.dlc) {
      onErr?.('Indiquez la date de péremption.'); return
    }
    setBusy(true)
    const { data, error } = await supabase.rpc('stock_completer_unite', {
      p_unite: edit.id,
      p_lot: gestionLot(cat) ? (edit.lot || null) : null,
      p_dlc: gestionDlc(cat) ? (edit.dlc || null) : null,
      p_lieu: edit.lieu_id || null,
      p_qte: cat.mode === 'boite' && edit.qte !== '' && edit.qte != null ? Number(edit.qte) : null,
    })
    setBusy(false)
    if (error || data?.ok === false) {
      onErr?.(error?.message || data?.error || 'Enregistrement impossible.')
      return
    }
    onOk?.('Fiche article complétée.')
    setEdit(null)
    onChange?.()
  }

  function ouvrirEdit(u) {
    const cat = byCat[u.catalogue_id] || {}
    setEdit({
      id: u.id,
      catalogue_id: u.catalogue_id,
      nom: u.nom,
      lot: u.lot || '',
      dlc: u.date_peremption ? String(u.date_peremption).slice(0, 10) : '',
      lieu_id: u.lieu_id || '',
      qte: u.qte_restante != null ? String(u.qte_restante) : '',
      mode: cat.mode || u.mode,
    })
  }

  return (
    <div>
      <Card style={{ padding: '12px 14px', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 4 }}>Inventaire facile</div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45 }}>
          Complétez ce qui manque (lieu, lot, péremption). Les articles <strong>sans date de péremption</strong> se configurent
          dans Gestion articles (case « Suivi péremption » décochée). Même logique pour le n° de lot.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <Btn kind={vue === 'completer' ? 'primary' : 'soft'} onClick={() => setVue('completer')}>
            À compléter ({incomplets.length})
          </Btn>
          <Btn kind={vue === 'ou' ? 'primary' : 'soft'} onClick={() => setVue('ou')}>Où est quoi</Btn>
          <Btn kind={vue === 'parcours' ? 'primary' : 'soft'} onClick={() => setVue('parcours')}>Parcours lieu</Btn>
          {onScanLieu && <Btn kind="soft" onClick={onScanLieu}>Scan lieu</Btn>}
          {onRanger && <Btn kind="soft" onClick={onRanger}>Ranger (QR)</Btn>}
        </div>
      </Card>

      {recv && (
        <FormReception
          cat={recv.cat}
          lieux={lieux}
          unites={unites}
          lieuPref={recv.lieuPref || lieuId || undefined}
          onDone={() => { setRecv(null); onChange?.() }}
          onOk={onOk}
          onErr={onErr}
        />
      )}

      {edit && (
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <form onSubmit={sauverComplet}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <strong>Compléter — {edit.nom}</strong>
              <Btn kind="soft" type="button" onClick={() => setEdit(null)}>Annuler</Btn>
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 10px' }}>
              {libelleTracabilite(byCat[edit.catalogue_id] || { mode: edit.mode })}
            </p>
            <Sel
              label="Emplacement"
              value={edit.lieu_id}
              set={v => setEdit(s => ({ ...s, lieu_id: v }))}
              options={[{ v: '', l: '— Sans lieu —' }, ...lieux.map(l => ({ v: l.id, l: cheminLieux(lieux, l.id) || l.nom }))]}
            />
            {gestionLot(byCat[edit.catalogue_id] || { mode: edit.mode }) && (
              <F label="N° de lot" value={edit.lot} set={v => setEdit(s => ({ ...s, lot: v }))} required />
            )}
            {gestionDlc(byCat[edit.catalogue_id] || { mode: edit.mode }) && (
              <F label="Péremption (DLC)" type="date" value={edit.dlc} set={v => setEdit(s => ({ ...s, dlc: v }))} required />
            )}
            {!gestionDlc(byCat[edit.catalogue_id] || { mode: edit.mode }) && (
              <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 10px' }}>Pas de date de péremption pour ce type d’article.</p>
            )}
            {(byCat[edit.catalogue_id]?.mode === 'boite' || edit.mode === 'boite') && (
              <F label="Quantité restante dans la boîte" type="number" value={edit.qte} set={v => setEdit(s => ({ ...s, qte: v }))} />
            )}
            <Btn type="submit" disabled={busy}>{busy ? '…' : 'Enregistrer'}</Btn>
          </form>
        </Card>
      )}

      {vue === 'completer' && (
        incomplets.length === 0 ? (
          <Empty title="Rien à compléter" hint="Tous les articles disponibles ont un lieu et, si besoin, un lot / une DLC. Passez à « Où est quoi » ou ajoutez du stock via Réception." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {incomplets.map(u => {
              const cat = byCat[u.catalogue_id] || {}
              const manques = []
              if (!u.lieu_id) manques.push('lieu')
              if (gestionLot(cat) && !(u.lot || '').trim()) manques.push('lot')
              if (gestionDlc(cat) && !u.date_peremption) manques.push('DLC')
              return (
                <Card key={u.id} style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <PhotoArticle path={u.photo_path} size={48} />
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 650 }}>{u.nom}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                        {cheminLieux(lieux, u.lieu_id) || 'sans lieu'}
                        {u.lot ? ` · lot ${u.lot}` : ''}
                        {u.date_peremption ? ` · DLC ${fmtDlc(u.date_peremption)}` : ''}
                        {' · '}manque : {manques.join(', ')}
                      </div>
                    </div>
                    <Btn onClick={() => ouvrirEdit(u)} style={{ padding: '5px 10px' }}>Compléter</Btn>
                  </div>
                </Card>
              )
            })}
          </div>
        )
      )}

      {vue === 'ou' && (
        <>
          <label className="ha-stock-search-lab" htmlFor="inv-ou">Rechercher un article ou un lot</label>
          <input
            id="inv-ou"
            className="ha-search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="ex. gants, A23-481, mallette…"
            autoComplete="off"
            style={{ ...inp, marginBottom: 12 }}
          />
          {ouEstQuoi.length === 0 ? (
            <Empty title="Aucun résultat" hint="Réceptionnez des articles ou élargissez la recherche." />
          ) : ouEstQuoi.map(l => {
            const cat = byCat[l.catalogue_id] || { mode: l.mode }
            const perime = dlcPassee(l.dlc)
            const j15 = dlcProche(l.dlc, 15)
            return (
              <Card key={`${l.catalogue_id}-${l.lot || 'x'}-${l.dlc || ''}`} style={{ padding: '10px 14px', marginBottom: 8 }}>
                <div style={{ fontWeight: 650 }}>{l.article}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                  {gestionLot(cat) ? (l.lot ? `Lot ${l.lot}` : 'sans n° de lot') : 'sans suivi de lot'}
                  {gestionDlc(cat)
                    ? ` · DLC ${fmtDlc(l.dlc)}${perime ? ' · périmé' : j15 ? ' · bientôt' : ''}`
                    : ' · pas de péremption'}
                  {' · '}{l.nb_unites} QR
                </div>
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13.5 }}>
                  {(l.lieux || []).map((x, i) => (
                    <li key={x.lieu_id || i}>
                      <strong>{x.chemin || x.nom || 'sans lieu'}</strong>
                      {x.qte != null ? ` · ${Number(x.qte)}` : ''}
                    </li>
                  ))}
                </ul>
              </Card>
            )
          })}
        </>
      )}

      {vue === 'parcours' && (
        <>
          <Sel
            label="Emplacement à inventorier"
            value={lieuId}
            set={setLieuId}
            options={[{ v: '', l: '— Choisir —' }, ...lieux.map(l => ({ v: l.id, l: cheminLieux(lieux, l.id) || l.nom }))]}
          />
          {lieuId && (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 12px' }}>
                Contenu actuel de cet emplacement. Pour ajouter du stock : choisissez un type ci-dessous (réception avec ce lieu prérempli).
              </p>
              {contenuLieu.length === 0 ? (
                <Empty title="Rien ici pour l’instant" hint="Réceptionnez ou rangez des QR dans cet emplacement." />
              ) : contenuLieu.map(u => {
                const cat = byCat[u.catalogue_id] || {}
                return (
                  <Card key={u.id} style={{ padding: '10px 14px', marginBottom: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: 650 }}>{u.nom}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                          {resteLabel(u)}
                          {gestionLot(cat) && (u.lot ? ` · lot ${u.lot}` : ' · lot manquant')}
                          {gestionDlc(cat) && (u.date_peremption ? ` · DLC ${fmtDlc(u.date_peremption)}` : ' · DLC manquante')}
                          {!gestionDlc(cat) && ' · sans péremption'}
                        </div>
                      </div>
                      <Btn kind="soft" onClick={() => ouvrirEdit(u)} style={{ padding: '5px 10px' }}>Corriger</Btn>
                    </div>
                  </Card>
                )
              })}
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Réception rapide — type d’article</label>
                <select
                  defaultValue=""
                  onChange={e => {
                    const id = e.target.value
                    e.target.value = ''
                    const cat = cats.find(c => c.id === id)
                    if (!cat) return
                    setRecv({ cat, lieuPref: lieuId })
                  }}
                  style={{ width: '100%', maxWidth: 420, padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 9, background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}
                >
                  <option value="">— Choisir un type à ajouter ici —</option>
                  {(cats || []).map(c => (
                    <option key={c.id} value={c.id}>{c.nom} · {libelleTracabilite(c)}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
