import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, TA, Sel, Pill, inp, lbl, Empty, Loading } from '@/components/ui'

export default function Stock() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(null)   // objet matériel (ou {} pour nouveau)
  const [mouv, setMouv] = useState(null)   // matériel pour lequel on saisit un mouvement

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('stock_materiel').select('*').eq('actif', true).order('nom')
    setItems(data || []); setLoading(false)
  }

  return (
    <Page title="Stock" subtitle="Matériel, seuils d'alerte et mouvements."
      action={<Btn onClick={()=>setEdit({})}>+ Nouveau matériel</Btn>}>
      {edit && <FormMateriel item={edit} onDone={()=>{ setEdit(null); load() }} />}
      {mouv && <FormMouvement item={mouv} onDone={()=>{ setMouv(null); load() }} />}

      {loading ? <Loading />
        : items.length === 0 ? <Empty title="Aucun matériel encodé" hint="Ajoutez un article pour suivre les quantités et les péremptions." action={<Btn onClick={()=>setEdit({})}>+ Nouveau matériel</Btn>} />
        : (
          <Card style={{ padding:0, overflow:'auto' }}>
            <table style={{ width:'100%', minWidth:640, borderCollapse:'collapse', fontSize:13.5 }}>
              <thead><tr style={{ background:'var(--bg-alt)' }}>
                {['Matériel','Catégorie','Quantité','Seuil','Actions'].map(h => <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:600, color:'var(--text-muted)', whiteSpace:'nowrap' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {items.map(m => {
                  const bas = Number(m.quantite) <= Number(m.stock_minimal)
                  return (
                    <tr key={m.id} style={{ borderTop:'1px solid var(--border)' }}>
                      <td style={{ padding:'10px 14px', color:'var(--text)', fontWeight:500 }}>{m.nom}{m.emplacement && <div style={{ fontSize:11.5, color:'var(--text-faint)' }}>{m.emplacement}</div>}</td>
                      <td style={{ padding:'10px 14px', color:'var(--text-muted)' }}>{m.categorie || '—'}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ fontWeight:600, color: bas ? '#A32D2D' : 'var(--text)' }}>{Number(m.quantite)}</span> <span style={{ color:'var(--text-muted)', fontSize:12 }}>{m.unite}</span>
                        {bas && <div style={{ marginTop:2 }}><Pill color="#A32D2D" bg="#FCEBEB">Stock bas</Pill></div>}
                      </td>
                      <td style={{ padding:'10px 14px', color:'var(--text-muted)' }}>{Number(m.stock_minimal)}</td>
                      <td style={{ padding:'10px 14px', display:'flex', gap:6, flexWrap:'wrap' }}>
                        <Btn kind="soft" onClick={()=>setMouv(m)} style={{ padding:'5px 10px' }}>± Mouvement</Btn>
                        <Btn kind="soft" onClick={()=>setEdit(m)} style={{ padding:'5px 10px' }}>Modifier</Btn>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        )}
    </Page>
  )
}

function FormMateriel({ item, onDone }) {
  const [f, setF] = useState({ unite:'pièce', tva_taux:21, prix_est_ht:true, quantite:0, stock_minimal:0, ...item })
  const set = (k,v) => setF(s => ({ ...s, [k]:v }))
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!f.nom) { alert('Le nom est requis.'); return }
    setSaving(true)
    const payload = {
      nom:f.nom, categorie:f.categorie||null, fournisseur:f.fournisseur||null,
      quantite:Number(f.quantite)||0, stock_minimal:Number(f.stock_minimal)||0,
      unite:f.unite||'pièce', prix_unitaire:Number(f.prix_unitaire)||0,
      emplacement:f.emplacement||null, notes:f.notes||null,
    }
    if (f.id) await supabase.from('stock_materiel').update(payload).eq('id', f.id)
    else await supabase.from('stock_materiel').insert(payload)
    setSaving(false); onDone()
  }
  return (
    <Card style={{ marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ fontWeight:600, color:'var(--text)' }}>{f.id ? 'Modifier le matériel' : 'Nouveau matériel'}</div>
        <Btn kind="soft" onClick={onDone}>Annuler</Btn>
      </div>
      <F label="Nom" value={f.nom} set={v=>set('nom',v)} required />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <F label="Catégorie" value={f.categorie} set={v=>set('categorie',v)} placeholder="consommable, oxygène…" />
        <F label="Fournisseur" value={f.fournisseur} set={v=>set('fournisseur',v)} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
        <F label="Quantité" type="number" value={f.quantite} set={v=>set('quantite',v)} />
        <F label="Seuil d'alerte" type="number" value={f.stock_minimal} set={v=>set('stock_minimal',v)} />
        <F label="Unité" value={f.unite} set={v=>set('unite',v)} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <F label="Prix unitaire (€)" type="number" value={f.prix_unitaire} set={v=>set('prix_unitaire',v)} />
        <F label="Emplacement" value={f.emplacement} set={v=>set('emplacement',v)} />
      </div>
      <TA label="Notes" value={f.notes} set={v=>set('notes',v)} rows={2} />
      <Btn onClick={save} disabled={saving} style={{ width:'100%', marginTop:4 }}>{saving?'Enregistrement…':'✓ Enregistrer'}</Btn>
    </Card>
  )
}

function FormMouvement({ item, onDone }) {
  const { profile } = useAuth()
  const [type, setType] = useState('entree')
  const [qte, setQte] = useState('')
  const [motif, setMotif] = useState('')
  const [saving, setSaving] = useState(false)
  async function save() {
    const q = Number(qte)
    if (!q || q <= 0) { alert('Quantité invalide.'); return }
    setSaving(true)
    // 1) journalise le mouvement
    await supabase.from('stock_mouvements').insert({ materiel_id:item.id, type, quantite:q, motif:motif||null, par:profile?.id })
    // 2) met à jour la quantité (le module gère la quantité lui-même)
    const nouvelle = type === 'entree' ? Number(item.quantite) + q
      : type === 'sortie' ? Number(item.quantite) - q
      : q  // ajustement = nouvelle valeur absolue
    await supabase.from('stock_materiel').update({ quantite: nouvelle }).eq('id', item.id)
    setSaving(false); onDone()
  }
  return (
    <Card style={{ marginBottom:14 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ fontWeight:600, color:'var(--text)' }}>Mouvement — {item.nom} <span style={{ color:'var(--text-muted)', fontWeight:400 }}>(stock : {Number(item.quantite)} {item.unite})</span></div>
        <Btn kind="soft" onClick={onDone}>Annuler</Btn>
      </div>
      <Sel label="Type" value={type} set={setType} options={[{v:'entree',l:'Entrée (+)'},{v:'sortie',l:'Sortie (−)'},{v:'ajustement',l:'Ajustement (=)'}]} />
      <F label={type==='ajustement'?'Nouvelle quantité':'Quantité'} type="number" value={qte} set={setQte} />
      <F label="Motif" value={motif} set={setMotif} placeholder="Réassort, utilisation événement…" />
      <Btn onClick={save} disabled={saving} style={{ width:'100%', marginTop:4 }}>{saving?'Enregistrement…':'✓ Valider le mouvement'}</Btn>
    </Card>
  )
}
