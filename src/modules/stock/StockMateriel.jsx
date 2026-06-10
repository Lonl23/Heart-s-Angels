// src/modules/stock/StockMateriel.jsx
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { notifStockMinimal } from '@/lib/notifications'
import PhotoUpload from '@/components/shared/PhotoUpload'

const CATEGORIES = ['consommable', 'équipement', 'médicament', 'oxygène', 'protection', 'autre']
const TVA_TAUX = [0, 6, 21]

export default function StockMateriel() {
  const { profile, can } = useAuth()
  const peutGerer = can('stock.write') || can('nav.stock')

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)        // item en édition (ou {} pour nouveau)
  const [mouvModal, setMouvModal] = useState(null) // item pour mouvement
  const [recherche, setRecherche] = useState('')
  const [filtreCat, setFiltreCat] = useState('tous')
  const [msg, setMsg] = useState(null)

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('stock_materiel').select('*').eq('actif', true).order('nom')
    setItems(data || [])
    setLoading(false)
  }

  // Prix TTC calculé
  const prixTTC = (it) => it.prix_est_ht ? (it.prix_unitaire || 0) * (1 + (it.tva_taux || 0) / 100) : (it.prix_unitaire || 0)
  const prixHT  = (it) => it.prix_est_ht ? (it.prix_unitaire || 0) : (it.prix_unitaire || 0) / (1 + (it.tva_taux || 0) / 100)

  // État du stock
  function etatStock(it) {
    if ((it.quantite || 0) <= 0) return { label: 'Rupture', color: '#C8435A', bg: '#FCEBEB' }
    if ((it.quantite || 0) <= (it.stock_minimal || 0)) return { label: 'Stock bas', color: '#BA7517', bg: '#FAEEDA' }
    return { label: 'OK', color: '#3B6D11', bg: '#EAF3DE' }
  }
  // Péremption
  function etatPeremption(it) {
    if (!it.date_peremption) return null
    const j = Math.ceil((new Date(it.date_peremption) - new Date()) / 86400000)
    if (j < 0) return { label: 'Périmé', color: '#C8435A', bg: '#FCEBEB' }
    if (j <= 30) return { label: `Périme dans ${j}j`, color: '#BA7517', bg: '#FAEEDA' }
    return null
  }

  const filtres = items.filter(it => {
    if (filtreCat !== 'tous' && it.categorie !== filtreCat) return false
    if (recherche && !`${it.nom} ${it.fournisseur || ''}`.toLowerCase().includes(recherche.toLowerCase())) return false
    return true
  })

  const alertes = items.filter(it => (it.quantite || 0) <= (it.stock_minimal || 0))
  const perimes = items.filter(it => it.date_peremption && new Date(it.date_peremption) < new Date())
  const valeurTotale = items.reduce((s, it) => s + prixHT(it) * (it.quantite || 0), 0)

  async function sauver(form) {
    const payload = {
      nom: form.nom, categorie: form.categorie || null, fournisseur: form.fournisseur || null,
      quantite: parseFloat(form.quantite) || 0, stock_minimal: parseFloat(form.stock_minimal) || 0,
      unite: form.unite || 'pièce', prix_unitaire: parseFloat(form.prix_unitaire) || 0,
      prix_est_ht: form.prix_est_ht !== false, tva_taux: parseFloat(form.tva_taux) || 0,
      date_achat: form.date_achat || null, date_peremption: form.date_peremption || null,
      emplacement: form.emplacement || null, notes: form.notes || null,
      updated_at: new Date().toISOString(),
    }
    let res
    if (form.id) res = await supabase.from('stock_materiel').update(payload).eq('id', form.id)
    else res = await supabase.from('stock_materiel').insert({ ...payload, alerte_envoyee: false })
    if (res.error) { setMsg({ type: 'error', text: 'Erreur d\'enregistrement.' }); return }
    setModal(null)
    setMsg({ type: 'success', text: 'Matériel enregistré.' })
    setTimeout(() => setMsg(null), 2500)
    load()
  }

  async function supprimer(it) {
    if (!confirm(`Retirer « ${it.nom} » de l'inventaire ?`)) return
    await supabase.from('stock_materiel').update({ actif: false }).eq('id', it.id)
    load()
  }

  // Enregistrer un mouvement (entrée/sortie) → met à jour la quantité + alerte si seuil
  async function enregistrerMouvement(it, type, quantite, motif) {
    const q = parseFloat(quantite) || 0
    if (q <= 0) return
    const delta = type === 'sortie' ? -q : q
    const nouvelleQte = Math.max(0, (it.quantite || 0) + delta)

    await supabase.from('stock_mouvements').insert({
      materiel_id: it.id, type, quantite: q, motif: motif || null, par: profile?.id,
    })
    // Mise à jour quantité + reset alerte si on repasse au-dessus du seuil
    const repasseAuDessus = nouvelleQte > (it.stock_minimal || 0)
    await supabase.from('stock_materiel').update({
      quantite: nouvelleQte,
      alerte_envoyee: repasseAuDessus ? false : it.alerte_envoyee,
      updated_at: new Date().toISOString(),
    }).eq('id', it.id)

    // Déclencher l'alerte si seuil atteint et pas encore notifié
    if (nouvelleQte <= (it.stock_minimal || 0) && !it.alerte_envoyee) {
      await notifStockMinimal({ ...it, quantite: nouvelleQte })
      await supabase.from('stock_materiel').update({ alerte_envoyee: true }).eq('id', it.id)
      setMsg({ type: 'success', text: `Mouvement enregistré — seuil atteint, coordinateur logistique notifié.` })
    } else {
      setMsg({ type: 'success', text: 'Mouvement enregistré.' })
    }
    setMouvModal(null)
    setTimeout(() => setMsg(null), 3500)
    load()
  }

  return (
    <div style={{ padding: '28px 24px', fontFamily: "'DM Sans',sans-serif", maxWidth: 1150 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: '1.8rem', fontWeight: 500, color: '#1A1514' }}>Stock — Matériel médical</h1>
          <p style={{ fontSize: 13, color: '#7A7470' }}>Inventaire, seuils d'alerte et mouvements.</p>
        </div>
        {peutGerer && (
          <button onClick={() => setModal({ prix_est_ht: true, tva_taux: 21, unite: 'pièce', categorie: 'consommable' })}
            style={{ padding: '9px 18px', background: '#1BB0CE', color: 'white', border: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
            + Ajouter du matériel
          </button>
        )}
      </div>

      {msg && (
        <div style={{ background: msg.type === 'success' ? '#F0FAF0' : '#FEF2F2', border: `1px solid ${msg.type === 'success' ? '#C3E6C3' : '#FCD5D5'}`, borderRadius: 9, padding: '10px 14px', fontSize: 13.5, color: msg.type === 'success' ? '#1E5C1E' : '#991B1B', marginBottom: 16 }}>{msg.text}</div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Références', val: items.length, color: '#0E7A93', bg: '#E6F7FA' },
          { label: 'Stock bas / rupture', val: alertes.length, color: '#BA7517', bg: '#FAEEDA' },
          { label: 'Périmés', val: perimes.length, color: '#C8435A', bg: '#FCEBEB' },
          { label: 'Valeur stock (HT)', val: valeurTotale.toFixed(2) + ' €', color: '#3B6D11', bg: '#EAF3DE' },
        ].map((k, i) => (
          <div key={i} style={{ background: k.bg, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: k.color }}>{k.val}</div>
            <div style={{ fontSize: 12, color: '#7A7470', marginTop: 3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Recherche + filtre catégorie */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher (nom, fournisseur)…"
          style={{ flex: 1, minWidth: 200, padding: '9px 14px', border: '1px solid rgba(27,176,206,.2)', borderRadius: 9, fontSize: 13.5, fontFamily: "'DM Sans',sans-serif" }} />
        <select value={filtreCat} onChange={e => setFiltreCat(e.target.value)}
          style={{ padding: '9px 12px', border: '1px solid rgba(27,176,206,.2)', borderRadius: 9, fontSize: 13.5, fontFamily: "'DM Sans',sans-serif" }}>
          <option value="tous">Toutes catégories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? <p style={{ color: '#7A7470' }}>Chargement…</p> : filtres.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#7A7470' }}><div style={{ fontSize: '2rem', marginBottom: 10 }}>📦</div>Aucun matériel.</div>
      ) : (
        <div style={{ background: 'white', border: '1px solid rgba(27,176,206,.09)', borderRadius: 14, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead><tr style={{ background: '#FDFAF6' }}>{['Matériel', 'Stock', 'État', 'Péremption', 'Prix unit.', 'Fournisseur', ''].map(h => <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: '#7A7470', whiteSpace: 'nowrap' }}>{h}</th>)}</tr></thead>
            <tbody>
              {filtres.map(it => {
                const es = etatStock(it), ep = etatPeremption(it)
                return (
                  <tr key={it.id} style={{ borderTop: '1px solid rgba(27,176,206,.05)' }}>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#1A1514' }}>{it.nom}</div>
                      <div style={{ fontSize: 11.5, color: '#7A7470' }}>{it.categorie}{it.emplacement ? ` · ${it.emplacement}` : ''}</div>
                    </td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 700, color: '#1A1514' }}>{it.quantite}</span> <span style={{ fontSize: 11.5, color: '#7A7470' }}>{it.unite}</span>
                      <div style={{ fontSize: 11, color: '#A8A39D' }}>min. {it.stock_minimal}</div>
                    </td>
                    <td style={{ padding: '9px 12px' }}><span style={{ background: es.bg, color: es.color, padding: '2px 9px', borderRadius: 99, fontSize: 11.5, fontWeight: 600 }}>{es.label}</span></td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                      {it.date_peremption ? new Date(it.date_peremption).toLocaleDateString('fr-BE') : '—'}
                      {ep && <div><span style={{ background: ep.bg, color: ep.color, padding: '1px 7px', borderRadius: 99, fontSize: 10.5, fontWeight: 600 }}>{ep.label}</span></div>}
                    </td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600 }}>{prixTTC(it).toFixed(2)} € <span style={{ fontSize: 10.5, color: '#7A7470' }}>TTC</span></div>
                      <div style={{ fontSize: 11, color: '#7A7470' }}>{prixHT(it).toFixed(2)} € HT · TVA {it.tva_taux}%</div>
                    </td>
                    <td style={{ padding: '9px 12px', color: '#4A4340' }}>{it.fournisseur || '—'}</td>
                    <td style={{ padding: '9px 12px' }}>
                      {peutGerer && (
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => setMouvModal(it)} title="Entrée / sortie" style={{ padding: '4px 9px', background: '#E6F7FA', color: '#0E7A93', border: 'none', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>± Mouvement</button>
                          <button onClick={() => setModal(it)} title="Modifier" style={{ padding: '4px 8px', background: '#F0F9FB', color: '#4A4340', border: 'none', borderRadius: 7, fontSize: 11.5, cursor: 'pointer' }}>✎</button>
                          <button onClick={() => supprimer(it)} title="Retirer" style={{ padding: '4px 8px', background: '#FCEBEB', color: '#C8435A', border: 'none', borderRadius: 7, fontSize: 11.5, cursor: 'pointer' }}>✕</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && <ModalMateriel item={modal} onClose={() => setModal(null)} onSave={sauver} />}
      {mouvModal && <ModalMouvement item={mouvModal} onClose={() => setMouvModal(null)} onSave={enregistrerMouvement} />}
    </div>
  )
}

// ── Modal création / édition ──────────────────────────────────────────────────
function ModalMateriel({ item, onClose, onSave }) {
  const [form, setForm] = useState(item)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const prixTTC = (form.prix_est_ht !== false ? (parseFloat(form.prix_unitaire) || 0) * (1 + (parseFloat(form.tva_taux) || 0) / 100) : (parseFloat(form.prix_unitaire) || 0)).toFixed(2)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflow: 'auto' }}>
      <div style={{ background: 'white', borderRadius: 18, padding: 24, width: '100%', maxWidth: 540, margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{form.id ? 'Modifier' : 'Ajouter'} du matériel</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Champ label="Nom *" val={form.nom} set={v => set('nom', v)} placeholder="Ex: Gants nitrile taille M" />
          <G2>
            <div><L>Catégorie</L><Sel val={form.categorie} set={v => set('categorie', v)} options={CATEGORIES} /></div>
            <Champ label="Fournisseur" val={form.fournisseur} set={v => set('fournisseur', v)} />
          </G2>
          <G2>
            <Champ label="Quantité en stock" val={form.quantite} set={v => set('quantite', v)} type="number" />
            <Champ label="Unité" val={form.unite} set={v => set('unite', v)} placeholder="pièce, boîte…" />
          </G2>
          <div style={{ background: '#FAEEDA', borderRadius: 10, padding: '12px 14px' }}>
            <Champ label="⚠️ Stock minimal (seuil d'alerte)" val={form.stock_minimal} set={v => set('stock_minimal', v)} type="number" />
            <div style={{ fontSize: 11.5, color: '#7A5512', marginTop: 6 }}>Le coordinateur logistique et son adjoint seront notifiés quand le stock atteint ce seuil.</div>
          </div>

          {/* Prix + TVA */}
          <div style={{ background: '#F0F9FB', borderRadius: 10, padding: '12px 14px' }}>
            <G2>
              <Champ label="Prix unitaire" val={form.prix_unitaire} set={v => set('prix_unitaire', v)} type="number" />
              <div><L>TVA</L><select value={form.tva_taux} onChange={e => set('tva_taux', e.target.value)} style={INP}>{TVA_TAUX.map(t => <option key={t} value={t}>{t}%</option>)}</select></div>
            </G2>
            <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="radio" checked={form.prix_est_ht !== false} onChange={() => set('prix_est_ht', true)} /> Prix HT
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                <input type="radio" checked={form.prix_est_ht === false} onChange={() => set('prix_est_ht', false)} /> Prix TTC
              </label>
              <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 600, color: '#0E7A93' }}>= {prixTTC} € TTC</span>
            </div>
          </div>

          <G2>
            <Champ label="Date d'achat" val={form.date_achat} set={v => set('date_achat', v)} type="date" />
            <Champ label="Date de péremption" val={form.date_peremption} set={v => set('date_peremption', v)} type="date" />
          </G2>
          <Champ label="Emplacement" val={form.emplacement} set={v => set('emplacement', v)} placeholder="Local, armoire, étagère…" />
          <Champ label="Notes" val={form.notes} set={v => set('notes', v)} />

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, padding: 11, background: 'none', border: '1px solid rgba(0,0,0,.12)', borderRadius: 9, fontSize: 13.5, color: '#7A7470', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Annuler</button>
            <button onClick={() => form.nom ? onSave(form) : null} style={{ flex: 2, padding: 11, background: '#1BB0CE', color: 'white', border: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Enregistrer</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal mouvement (entrée / sortie) ─────────────────────────────────────────
function ModalMouvement({ item, onClose, onSave }) {
  const [type, setType] = useState('entree')
  const [quantite, setQuantite] = useState('')
  const [motif, setMotif] = useState('')

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: 'white', borderRadius: 18, padding: 24, width: '100%', maxWidth: 420 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Mouvement de stock</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ fontSize: 13, color: '#7A7470', marginBottom: 16 }}>{item.nom} — stock actuel : <strong>{item.quantite} {item.unite}</strong></p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[['entree', '➕ Entrée', '#3B6D11', '#EAF3DE'], ['sortie', '➖ Sortie', '#C8435A', '#FCEBEB']].map(([v, l, col, bg]) => (
            <button key={v} onClick={() => setType(v)} style={{ flex: 1, padding: '10px', borderRadius: 9, border: type === v ? `2px solid ${col}` : '1px solid rgba(0,0,0,.1)', background: type === v ? bg : 'white', color: type === v ? col : '#7A7470', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>{l}</button>
          ))}
        </div>

        <Champ label="Quantité" val={quantite} set={setQuantite} type="number" placeholder="0" />
        <div style={{ marginTop: 10 }}><Champ label="Motif (optionnel)" val={motif} set={setMotif} placeholder="Achat, utilisation mission…" /></div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 11, background: 'none', border: '1px solid rgba(0,0,0,.12)', borderRadius: 9, fontSize: 13.5, color: '#7A7470', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Annuler</button>
          <button onClick={() => onSave(item, type, quantite, motif)} disabled={!quantite} style={{ flex: 2, padding: 11, background: '#1BB0CE', color: 'white', border: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: quantite ? 'pointer' : 'not-allowed', opacity: quantite ? 1 : .5, fontFamily: "'DM Sans',sans-serif" }}>Valider</button>
        </div>
      </div>
    </div>
  )
}

// ── Petits composants ─────────────────────────────────────────────────────────
const INP = { width: '100%', padding: '9px 12px', border: '1px solid rgba(0,0,0,.1)', borderRadius: 8, fontSize: 13.5, fontFamily: "'DM Sans',sans-serif" }
function L({ children }) { return <label style={{ fontSize: 12.5, fontWeight: 500, color: '#7A7470', display: 'block', marginBottom: 5 }}>{children}</label> }
function Champ({ label, val, set, type = 'text', placeholder }) {
  return <div><L>{label}</L><input type={type} value={val || ''} onChange={e => set(e.target.value)} placeholder={placeholder} style={INP} /></div>
}
function Sel({ val, set, options }) {
  return <select value={val || ''} onChange={e => set(e.target.value)} style={INP}>{options.map(o => <option key={o} value={o}>{o}</option>)}</select>
}
function G2({ children }) { return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>{children}</div> }