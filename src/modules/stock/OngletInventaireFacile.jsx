import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, Btn, F, Sel, Empty, inp } from '@/components/ui'
import { cheminLieux, gestionLot, gestionDlc, gestionQr, resteLabel } from './stockSchema'
import { fmtDlc, dlcPassee, dlcProche, aggregerLots } from './lotsStock'
import { PhotoArticle } from './photoStock'
import { FormReception } from './formsStock'

/**
 * Hub terrain inventaire — 3 vues max, sans jargon.
 */
export default function OngletInventaireFacile({
  cats, lieux, unites, onChange, onOk, onErr, onScanLieu, onRanger,
}) {
  const [vue, setVue] = useState('parcours') // parcours | chercher | completer
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
    if (!needle) return []
    const lots = aggregerLots(unites, lieux)
    return lots.filter(l => {
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
    const ajusterQte = (cat.mode === 'boite' || cat.mode === 'piece' || !gestionQr(cat))
      && edit.qte !== '' && edit.qte != null
    const { data, error } = await supabase.rpc('stock_completer_unite', {
      p_unite: edit.id,
      p_lot: gestionLot(cat) ? (edit.lot || null) : null,
      p_dlc: gestionDlc(cat) ? (edit.dlc || null) : null,
      p_lieu: edit.lieu_id || null,
      p_qte: ajusterQte ? Number(edit.qte) : null,
    })
    setBusy(false)
    if (error || data?.ok === false) {
      onErr?.(error?.message || data?.error || 'Enregistrement impossible.')
      return
    }
    onOk?.('Enregistré.')
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
      gestion_qr: cat.gestion_qr,
    })
  }

  async function supprimerUnite(u) {
    const nom = u.nom || 'cet article'
    if (!confirm(`Retirer « ${nom} » de l’inventaire ?${u.lot ? ` (lot ${u.lot})` : ''}\nCette entrée disparaît du stock.`)) return
    setBusy(true)
    const { error } = await supabase.from('stock_unites').delete().eq('id', u.id)
    setBusy(false)
    if (error) { onErr?.(error.message); return }
    if (edit?.id === u.id) setEdit(null)
    onOk?.('Retiré de l’inventaire.')
    onChange?.()
  }

  const catEdit = edit ? (byCat[edit.catalogue_id] || { mode: edit.mode, gestion_qr: edit.gestion_qr }) : null
  const peutAjusterQte = !!catEdit && (catEdit.mode === 'boite' || catEdit.mode === 'piece' || !gestionQr(catEdit))

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {onRanger && (
          <Btn onClick={onRanger} style={{ minHeight: 48, flex: '1 1 140px' }}>
            Ranger (scan QR)
          </Btn>
        )}
        {onScanLieu && (
          <Btn kind="soft" onClick={onScanLieu} style={{ minHeight: 48, flex: '1 1 140px' }}>
            Contrôler un lieu
          </Btn>
        )}
      </div>

      <div className="ha-stock-vue" style={{ marginBottom: 14 }}>
        <button type="button" className={'ha-tab-like' + (vue === 'parcours' ? ' is-on' : '')} onClick={() => setVue('parcours')}>
          Un lieu
        </button>
        <button type="button" className={'ha-tab-like' + (vue === 'chercher' ? ' is-on' : '')} onClick={() => setVue('chercher')}>
          Chercher
        </button>
        <button type="button" className={'ha-tab-like' + (vue === 'completer' ? ' is-on' : '')} onClick={() => setVue('completer')}>
          À compléter{incomplets.length ? ` (${incomplets.length})` : ''}
        </button>
      </div>

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

      {edit && catEdit && (
        <Card style={{ padding: 14, marginBottom: 12 }}>
          <form onSubmit={sauverComplet}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <strong>{edit.nom}</strong>
              <Btn kind="soft" type="button" onClick={() => setEdit(null)}>Annuler</Btn>
            </div>
            <Sel
              label="Emplacement"
              value={edit.lieu_id}
              set={v => setEdit(s => ({ ...s, lieu_id: v }))}
              options={[{ v: '', l: '— Sans lieu —' }, ...lieux.map(l => ({ v: l.id, l: cheminLieux(lieux, l.id) || l.nom }))]}
            />
            {gestionLot(catEdit) && (
              <F label="N° de lot" value={edit.lot} set={v => setEdit(s => ({ ...s, lot: v }))} required />
            )}
            {gestionDlc(catEdit) && (
              <F label="Péremption" type="date" value={edit.dlc} set={v => setEdit(s => ({ ...s, dlc: v }))} required />
            )}
            {peutAjusterQte && (
              <F
                label={catEdit.mode === 'boite' ? 'Quantité dans la boîte' : 'Quantité'}
                type="number"
                value={edit.qte}
                set={v => setEdit(s => ({ ...s, qte: v }))}
              />
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn type="submit" disabled={busy}>{busy ? '…' : 'Enregistrer'}</Btn>
              <Btn kind="danger" type="button" disabled={busy} onClick={() => supprimerUnite(edit)}>
                Supprimer
              </Btn>
            </div>
          </form>
        </Card>
      )}

      {vue === 'parcours' && (
        <>
          <Sel
            label="Emplacement"
            value={lieuId}
            set={v => { setLieuId(v); setRecv(null) }}
            options={[{ v: '', l: '— Choisir —' }, ...lieux.map(l => ({ v: l.id, l: cheminLieux(lieux, l.id) || l.nom }))]}
          />
          {lieuId && !recv && (
            <>
              {contenuLieu.length === 0 ? (
                <Empty title="Rien ici" hint="Ajoutez un article ci-dessous, ou rangez des QR déjà créés." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {contenuLieu.map(u => {
                    const cat = byCat[u.catalogue_id] || {}
                    return (
                      <Card key={u.id} style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ fontWeight: 650 }}>{u.nom}</div>
                            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                              {resteLabel(u)}
                              {gestionLot(cat) && (u.lot ? ` · lot ${u.lot}` : ' · lot manquant')}
                              {gestionDlc(cat) && (u.date_peremption ? ` · ${fmtDlc(u.date_peremption)}` : ' · DLC manquante')}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <Btn kind="soft" onClick={() => ouvrirEdit(u)} style={{ padding: '5px 10px' }}>Modifier</Btn>
                            <Btn kind="danger" disabled={busy} onClick={() => supprimerUnite(u)} style={{ padding: '5px 10px' }}>Supprimer</Btn>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
              <label style={{ fontSize: 12.5, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Ajouter ici
              </label>
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
                <option value="">— Type d’article —</option>
                {(cats || []).map(c => (
                  <option key={c.id} value={c.id}>{c.nom}</option>
                ))}
              </select>
            </>
          )}
        </>
      )}

      {vue === 'chercher' && (
        <>
          <input
            className="ha-search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Nom d’article ou n° de lot…"
            autoComplete="off"
            style={{ ...inp, marginBottom: 12 }}
          />
          {!q.trim() ? (
            <Empty title="Cherchez un article" hint="Tapez un nom ou un n° de lot pour voir où c’est rangé." />
          ) : ouEstQuoi.length === 0 ? (
            <Empty title="Aucun résultat" hint="Essayez un autre mot." />
          ) : ouEstQuoi.map(l => {
            const cat = byCat[l.catalogue_id] || { mode: l.mode }
            const perime = dlcPassee(l.dlc)
            const j15 = dlcProche(l.dlc, 15)
            return (
              <Card key={`${l.catalogue_id}-${l.lot || 'x'}-${l.dlc || ''}`} style={{ padding: '10px 14px', marginBottom: 8 }}>
                <div style={{ fontWeight: 650 }}>{l.article}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                  {gestionLot(cat) ? (l.lot ? `Lot ${l.lot}` : 'sans lot') : null}
                  {gestionDlc(cat)
                    ? `${gestionLot(cat) ? ' · ' : ''}DLC ${fmtDlc(l.dlc)}${perime ? ' · périmé' : j15 ? ' · bientôt' : ''}`
                    : null}
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

      {vue === 'completer' && (
        incomplets.length === 0 ? (
          <Empty title="Rien à compléter" hint="Tout a un lieu, et lot / péremption si besoin." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {incomplets.map(u => {
              const cat = byCat[u.catalogue_id] || {}
              const manques = []
              if (!u.lieu_id) manques.push('lieu')
              if (gestionLot(cat) && !(u.lot || '').trim()) manques.push('lot')
              if (gestionDlc(cat) && !u.date_peremption) manques.push('péremption')
              return (
                <Card key={u.id} style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <PhotoArticle path={u.photo_path} size={48} />
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 650 }}>{u.nom}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                        Manque : {manques.join(', ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Btn onClick={() => ouvrirEdit(u)} style={{ padding: '5px 10px' }}>Compléter</Btn>
                      <Btn kind="danger" disabled={busy} onClick={() => supprimerUnite(u)} style={{ padding: '5px 10px' }}>Supprimer</Btn>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
