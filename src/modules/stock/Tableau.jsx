import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, Btn, Pill, Empty, Loading, inp } from '@/components/ui'
import {
  cheminLieux, idsLieuEtEnfants, profondeurLieu, qteEnStock, niveauStock,
  resteLabel, lblMode, LIB_MVT, systemeDe, uniteComptage, PRESSION_ALERTE,
} from './stockSchema'

const NIVEAU = {
  ok: null,
  bas: { l: 'Sous le seuil', color: '#A32D2D', bg: '#FCEBEB' },
  vide: { l: 'Rien en stock', color: '#A32D2D', bg: '#FCEBEB' },
  attention: { l: 'O₂ basse', color: '#BA7517', bg: '#FAEEDA' },
}

function niveauPill(cat, qte) {
  const n = NIVEAU[niveauStock(cat, qte)]
  if (!n) return null
  return <Pill color={n.color} bg={n.bg}>{n.l}</Pill>
}

export function EcranJour({ cats, unites, lieux, alertes, onReception, onRanger, onCompter, onArticle }) {
  const [filtre, setFiltre] = useState('')
  const [alerte, setAlerte] = useState(null)
  const lignes = useMemo(() => {
    const q = filtre.trim().toLowerCase()
    return (cats || [])
      .map(c => ({ c, qte: qteEnStock(c, unites) }))
      .filter(({ c }) => !q || c.nom.toLowerCase().includes(q) || (c.categorie || '').toLowerCase().includes(q))
      .sort((a, b) => a.c.nom.localeCompare(b.c.nom, 'fr'))
  }, [cats, unites, filtre])

  const blocs = [
    { k: 'perimes', t: 'Périmés', kind: 'bad' },
    { k: 'o2_basse', t: `O₂ ≤ ${PRESSION_ALERTE} bar`, kind: 'bad' },
    { k: 'proches', t: 'Péremption ≤ 90 j', kind: 'warn' },
    { k: 'bas', t: 'Sous le seuil', kind: 'bad' },
    { k: 'vides', t: 'Presque vides', kind: 'warn' },
  ]
  const totalAlertes = blocs.reduce((s, b) => s + ((alertes?.[b.k] || []).length), 0)

  return (
    <div>
      <div className="ha-stock-ops">
        <button type="button" className="ha-stock-op" onClick={() => onReception()}>
          <div className="ha-stock-op-kicker">Entrée</div>
          <strong>Réceptionner</strong>
          <p>Un colis arrive. On choisit l’article, le lot, et l’étiquette se prépare.</p>
          <div className="ha-stock-op-go">Nouvelle réception ›</div>
        </button>
        <button type="button" className="ha-stock-op" onClick={onRanger}>
          <div className="ha-stock-op-kicker">Déplacement</div>
          <strong>Ranger</strong>
          <p>Scanner l’emplacement, puis les articles à y poser.</p>
          <div className="ha-stock-op-go">Ranger maintenant ›</div>
        </button>
        <button type="button" className="ha-stock-op" onClick={onCompter}>
          <div className="ha-stock-op-kicker">Contrôle</div>
          <strong>Compter</strong>
          <p>Ce que l’appli affiche, à côté de ce que vous voyez vraiment.</p>
          <div className="ha-stock-op-go">Inventaire d’un lieu ›</div>
        </button>
      </div>

      <div className="ha-stock-alerts">
        {totalAlertes === 0 ? (
          <span className="ha-stock-alert is-ok">Aucune alerte</span>
        ) : blocs.map(b => {
          const n = (alertes?.[b.k] || []).length
          if (!n) return null
          return (
            <button key={b.k} type="button"
              className={'ha-stock-alert is-' + b.kind + (alerte === b.k ? ' is-on' : '')}
              onClick={() => setAlerte(alerte === b.k ? null : b.k)}>
              {b.t} · {n}
            </button>
          )
        })}
      </div>

      {alerte && <ListeAlerte titre={blocs.find(b => b.k === alerte)?.t} rows={alertes?.[alerte] || []} onArticle={onArticle} cats={cats} />}

      <div style={{ display:'flex', justifyContent:'space-between', gap:10, flexWrap:'wrap', alignItems:'center', margin:'6px 0 10px' }}>
        <div style={{ fontWeight:700, color:'var(--heading)' }}>En stock</div>
        <input className="ha-search" value={filtre} onChange={e => setFiltre(e.target.value)} placeholder="Chercher un article" aria-label="Chercher un article" />
      </div>

      {lieux.length === 0 && cats.length > 0 && (
        <Empty title="Pas encore d’emplacement" hint="Créez la réserve, une armoire ou un sac dans l’onglet Emplacements. Ensuite, réceptionnez le matériel." />
      )}
      {cats.length === 0 ? (
        <Empty title="Aucun article" hint="La réception commence par un type : gants, compresses, oxygène…" action={<Btn onClick={() => onReception(null, { creer: true })}>Créer un article</Btn>} />
      ) : lignes.length === 0 ? (
        <Empty title="Aucun résultat" hint="Essayez un autre mot, ou créez le type d’article." />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {lignes.map(({ c, qte }) => (
            <Card key={c.id} clickable onClick={() => onArticle(c.id)} style={{ padding:'12px 14px' }}>
              <div className="ha-stock-line">
                <div style={{ minWidth:0 }}>
                  <div style={{ fontWeight:600 }}>{c.nom}</div>
                  <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:2 }}>
                    {lblMode(c.mode).split(' (')[0]}
                    {qte.detail ? ` · ${qte.detail}` : ''}
                    {c.stock_minimal > 0 && c.mode !== 'oxygene' ? ` · seuil ${Number(c.stock_minimal)}` : ''}
                  </div>
                  <div style={{ marginTop:6 }}>{niveauPill(c, qte)}</div>
                </div>
                <div className="ha-onhand">
                  {qte.nombre}
                  <small>{qte.unite}</small>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function ListeAlerte({ titre, rows, onArticle, cats }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontWeight:700, marginBottom:8, color:'var(--heading)' }}>{titre}</div>
      {rows.map((u, i) => {
        const connu = (cats || []).some(c => c.id === (u.catalogue_id || (u.reste != null ? u.id : null)))
        return (
          <Card key={u.id || i} clickable={!!u.catalogue_id || connu} onClick={() => {
            const id = u.catalogue_id || (u.reste != null ? u.id : null)
            if (id) onArticle(id)
          }} style={{ padding:'10px 14px', marginBottom:6 }}>
            <div style={{ fontWeight:600 }}>{u.nom}</div>
            <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>
              {u.reste != null
                ? `En stock ${u.reste} · seuil ${u.stock_minimal}`
                : `${resteLabel(u)}${u.lieu_nom ? ' · ' + u.lieu_nom : ''}${u.date_peremption ? ' · DLC ' + u.date_peremption : ''}`}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

export function EcranArticles({ cats, unites, lieux, articleId, choixReception, onArticle, onReception, onNouveau, onModifier, onSupprimer, onEtiquette, onBack }) {
  const [filtre, setFiltre] = useState('')
  const [mode, setMode] = useState('')
  const cat = (cats || []).find(c => c.id === articleId)
  if (cat && !choixReception) {
    return (
      <FicheArticle cat={cat} unites={unites} lieux={lieux} onBack={onBack} onReception={() => onReception(cat)} onModifier={() => onModifier(cat)} onSupprimer={() => onSupprimer(cat)} onEtiquette={onEtiquette} />
    )
  }
  const lignes = (cats || [])
    .filter(c => !mode || c.mode === mode)
    .filter(c => {
      const q = filtre.trim().toLowerCase()
      return !q || c.nom.toLowerCase().includes(q) || (c.categorie || '').toLowerCase().includes(q)
    })
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  return (
    <div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:12 }}>
        <Btn onClick={onNouveau}>+ Type d’article</Btn>
        <input className="ha-search" value={filtre} onChange={e => setFiltre(e.target.value)} placeholder="Chercher" aria-label="Chercher un type" />
      </div>
      {choixReception && (
        <p style={{ margin:'0 0 12px', color:'var(--heading)', fontWeight:600 }}>Quel article arrive ?</p>
      )}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
        {[['', 'Tous'], ['piece', 'Pièces'], ['boite', 'Boîtes'], ['oxygene', 'Oxygène'], ['durable', 'Durables']].map(([v, l]) => (
          <button key={v || 'tous'} type="button" className={'ha-tab-like' + (mode === v ? ' is-on' : '')} onClick={() => setMode(v)}>{l}</button>
        ))}
      </div>
      {lignes.length === 0 ? (
        <Empty title="Aucun article" hint="Créez un type, puis réceptionnez pour générer les étiquettes." action={<Btn onClick={onNouveau}>Créer un type</Btn>} />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {lignes.map(c => {
            const qte = qteEnStock(c, unites)
            return (
              <Card key={c.id} clickable onClick={() => choixReception ? onReception(c) : onArticle(c.id)} style={{ padding:'12px 14px' }}>
                <div className="ha-stock-line">
                  <div>
                    <div style={{ fontWeight:600 }}>{c.nom}</div>
                    <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:2 }}>{lblMode(c.mode).split(' (')[0]}{c.categorie ? ` · ${c.categorie}` : ''}</div>
                    <div style={{ marginTop:6 }}>{niveauPill(c, qte)}</div>
                  </div>
                  <div className="ha-onhand">{qte.nombre}<small>{qte.unite}</small></div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FicheArticle({ cat, unites, lieux, onBack, onReception, onModifier, onSupprimer, onEtiquette }) {
  const qte = qteEnStock(cat, unites)
  const lignes = (unites || []).filter(u => u.catalogue_id === cat.id)
  const lieuxIds = new Set(lignes.filter(u => u.etat === 'dispo' && u.lieu_id).map(u => u.lieu_id))
  return (
    <div>
      <p className="ha-crumb"><button type="button" onClick={onBack}>Articles</button> · {cat.nom}</p>
      <Card>
        <div className="ha-stock-line" style={{ alignItems:'flex-start' }}>
          <div>
            <div style={{ fontFamily:'Cormorant Garamond, Georgia, serif', fontSize:'1.6rem', color:'var(--heading)', lineHeight:1.1 }}>{cat.nom}</div>
            <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:4 }}>{lblMode(cat.mode)}{cat.categorie ? ` · ${cat.categorie}` : ''}</div>
            <div style={{ marginTop:8 }}>{niveauPill(cat, qte)}</div>
          </div>
          <div className="ha-onhand" style={{ fontSize:'2rem' }}>{qte.nombre}<small>en stock · {qte.unite}</small></div>
        </div>
        <div className="ha-smarts">
          <div className="ha-smart"><b>{lignes.length}</b><span>étiquette{lignes.length > 1 ? 's' : ''}</span></div>
          <div className="ha-smart"><b>{lieuxIds.size}</b><span>emplacement{lieuxIds.size > 1 ? 's' : ''}</span></div>
          {cat.mode !== 'oxygene' && cat.mode !== 'durable' && (
            <div className="ha-smart"><b>{Number(cat.stock_minimal) || 0}</b><span>seuil d’alerte</span></div>
          )}
          {qte.detail && <div className="ha-smart"><b style={{ fontSize:14 }}>{qte.detail}</b><span>détail</span></div>}
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <Btn onClick={onReception}>Réceptionner</Btn>
          <Btn kind="soft" onClick={onModifier}>Modifier</Btn>
          <Btn kind="danger" onClick={onSupprimer}>Retirer</Btn>
        </div>
      </Card>
      <div style={{ fontWeight:700, margin:'16px 0 8px', color:'var(--heading)' }}>Où c’est rangé</div>
      {lignes.length === 0 ? <Empty title="Aucune étiquette" hint="Réceptionnez pour créer le QR de cet article." /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {lignes.map(u => (
            <Card key={u.id} style={{ padding:'10px 14px' }}>
              <div className="ha-stock-line">
                <div>
                  <div style={{ fontWeight:600 }}>{resteLabel(u)}</div>
                  <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>
                    {cheminLieux(lieux, u.lieu_id) || 'Pas encore rangé'}
                    {u.lot ? ` · lot ${u.lot}` : ''}
                    {u.date_peremption ? ` · DLC ${u.date_peremption}` : ''}
                    {u.etat !== 'dispo' ? ` · ${u.etat}` : ''}
                  </div>
                </div>
                <Btn kind="soft" onClick={() => onEtiquette(u)}>QR</Btn>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function EcranMouvements({ cats, lieux }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState(null)
  const [type, setType] = useState('')
  useEffect(() => {
    let stop = false
    supabase.from('stock_mouvements')
      .select('id, type, quantite, motif, created_at, lieu_id, catalogue_id')
      .order('created_at', { ascending: false })
      .limit(120)
      .then(({ data, error }) => {
        if (stop) return
        if (error) setErr(error.message)
        setRows(data || [])
      })
    return () => { stop = true }
  }, [])
  if (rows === null && !err) return <Loading />
  if (err) return <Empty title="Historique indisponible" hint="Les réceptions, rangements et sorties s’afficheront ici dès qu’ils seront enregistrés." />
  const vis = rows.filter(r => !type || r.type === type)
  const nomCat = id => (cats || []).find(c => c.id === id)?.nom
  return (
    <div>
      <p style={{ fontSize:13, color:'var(--text-muted)', margin:'0 0 12px' }}>
        Chaque réception, rangement, sortie de mission ou comptage laisse une trace : d’où ça vient, où ça va.
      </p>
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
        {[['', 'Tout'], ['entree', 'Réceptions'], ['transfert', 'Rangements'], ['sortie', 'Sorties'], ['emport', 'Emportés'], ['ajustement', 'Inventaires']].map(([v, l]) => (
          <button key={v || 'tout'} type="button" className={'ha-tab-like' + (type === v ? ' is-on' : '')} onClick={() => setType(v)}>{l}</button>
        ))}
      </div>
      {vis.length === 0 ? <Empty title="Aucun mouvement" hint="Une réception ou un rangement apparaîtra ici." /> : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {vis.map(m => (
            <Card key={m.id} style={{ padding:'10px 14px' }}>
              <div className="ha-stock-line" style={{ alignItems:'flex-start' }}>
                <div style={{ minWidth:0 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                    <Pill color="var(--heading)" bg="var(--bg-alt)">{LIB_MVT[m.type] || m.type}</Pill>
                    <span style={{ fontWeight:600 }}>{nomCat(m.catalogue_id) || m.motif || 'Mouvement'}</span>
                  </div>
                  <div style={{ fontSize:12.5, color:'var(--text-muted)', marginTop:4 }}>
                    {cheminLieux(lieux, m.lieu_id) || 'Sans emplacement'}
                    {m.motif ? ` · ${m.motif}` : ''}
                  </div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontWeight:700 }}>{Number(m.quantite)}</div>
                  <div style={{ fontSize:11.5, color:'var(--text-faint)' }}>
                    {m.created_at ? new Date(m.created_at).toLocaleString('fr-BE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : ''}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export function EcranCompter({ lieux, unites, inv, onChoisir, onScan, onApplique, onTermine, onFermer }) {
  const [qtes, setQtes] = useState({})
  const [busy, setBusy] = useState(false)
  const [cherche, setCherche] = useState('')
  useEffect(() => { setQtes({}) }, [inv?.lieu?.id])

  if (!inv) {
    const q = cherche.trim().toLowerCase()
    const liste = [...(lieux || [])].sort((a, b) => cheminLieux(lieux, a.id).localeCompare(cheminLieux(lieux, b.id), 'fr'))
      .filter(l => !q || cheminLieux(lieux, l.id).toLowerCase().includes(q) || l.nom.toLowerCase().includes(q))
    return (
      <div>
        <p style={{ fontSize:13.5, color:'var(--text-muted)', margin:'0 0 12px' }}>
          Choisissez l’endroit à compter. L’appli affiche aussi ce qui est rangé à l’intérieur.
        </p>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
          <Btn onClick={onScan}>Scanner le QR du lieu</Btn>
          <input className="ha-search" value={cherche} onChange={e => setCherche(e.target.value)} placeholder="Chercher un emplacement" aria-label="Chercher un emplacement" />
        </div>
        {liste.length === 0 ? <Empty title="Aucun emplacement" hint="Créez-en un dans l’onglet Emplacements." /> : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {liste.map(l => {
              const n = (unites || []).filter(u => idsLieuEtEnfants(lieux, l.id).has(u.lieu_id) && (u.etat === 'dispo' || u.etat === 'vide')).length
              return (
                <Card key={l.id} clickable onClick={() => onChoisir(l.id)} style={{ padding:'12px 14px', marginLeft: Math.min(profondeurLieu(lieux, l.id), 4) * 12 }}>
                  <div className="ha-stock-line">
                    <div>
                      <div style={{ fontWeight:600 }}>{l.nom}</div>
                      <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>{cheminLieux(lieux, l.id)}</div>
                    </div>
                    <div className="ha-onhand" style={{ fontSize:'1.15rem' }}>{n}<small>article{n > 1 ? 's' : ''}</small></div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const items = inv.items || []
  function ecartDe(u) {
    const brut = qtes[u.id]
    if (brut === '' || brut == null) return null
    const n = Number(brut)
    if (Number.isNaN(n)) return null
    return n - systemeDe(u)
  }
  const aCorriger = items.filter(u => {
    const e = ecartDe(u)
    return e != null && e !== 0
  })

  async function appliquer(liste) {
    setBusy(true)
    let n = 0
    for (const u of liste) {
      const ok = await onApplique(u, Number(qtes[u.id]))
      if (!ok) break
      n++
    }
    setQtes({})
    setBusy(false)
    if (n) onTermine?.()
  }

  return (
    <div>
      <p className="ha-crumb">
        <button type="button" onClick={onFermer}>Emplacements</button> · {inv.lieu?.nom}
      </p>
      <div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap', alignItems:'center', marginBottom:12 }}>
        <div>
          <div style={{ fontFamily:'Cormorant Garamond, Georgia, serif', fontSize:'1.45rem', color:'var(--heading)' }}>{inv.lieu?.nom}</div>
          <div style={{ fontSize:13, color:'var(--text-muted)' }}>Laissez vide ce que vous n’avez pas encore compté.</div>
        </div>
        <Btn onClick={() => appliquer(aCorriger)} disabled={busy || aCorriger.length === 0}>
          {busy ? '…' : `Appliquer ${aCorriger.length || ''} écart${aCorriger.length > 1 ? 's' : ''}`}
        </Btn>
      </div>
      {items.length === 0 ? <Empty title="Rien à cet endroit" hint="Réceptionnez ou rangez du matériel ici, puis recommencez le comptage." /> : items.map(u => {
        const sys = systemeDe(u)
        const e = ecartDe(u)
        const unite = uniteComptage(u)
        return (
          <Card key={u.id} style={{ padding:'12px 14px', marginBottom:8 }}>
            <div style={{ fontWeight:600 }}>{u.nom}</div>
            <div style={{ fontSize:12.5, color:'var(--text-muted)', marginBottom:8 }}>
              {u.lieu_nom || '—'}{u.lot ? ` · lot ${u.lot}` : ''}{u.date_peremption ? ` · DLC ${u.date_peremption}` : ''}
            </div>
            <div className="ha-compte">
              <div>
                <div style={{ fontSize:11.5, color:'var(--text-muted)', fontWeight:700 }}>En système</div>
                <div style={{ fontWeight:700 }}>{sys} {unite}</div>
              </div>
              <div>
                <label style={{ fontSize:11.5, color:'var(--text-muted)', fontWeight:700 }}>Compté ({unite})</label>
                <input type="number" inputMode="decimal" value={qtes[u.id] ?? ''} placeholder="—"
                  onChange={ev => setQtes(s => ({ ...s, [u.id]: ev.target.value }))}
                  style={{ ...inp, marginTop:4 }} aria-label={`Compté pour ${u.nom}`} />
              </div>
              <div>
                <div style={{ fontSize:11.5, color:'var(--text-muted)', fontWeight:700 }}>Écart</div>
                <div className={e == null ? 'ha-ecart-zero' : e > 0 ? 'ha-ecart-plus' : e < 0 ? 'ha-ecart-moins' : 'ha-ecart-zero'}>
                  {e == null ? '—' : e > 0 ? `+${e}` : String(e)}
                </div>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
