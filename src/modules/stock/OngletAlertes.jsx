import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, Btn, F, Sel, TA, Loading } from '@/components/ui'
import { resteLabel, lblCommande } from './stockSchema'
import { PhotoArticle } from './photoStock'

export default function OngletAlertes({ cats, fournisseurs, onOk, onErr, onPerime, onCommander }) {
  const [a, setA] = useState(null)
  const [cmds, setCmds] = useState([])
  const [edit, setEdit] = useState(null)

  async function load() {
    const [{ data }, c] = await Promise.all([
      supabase.rpc('stock_alertes'),
      supabase.from('stock_commandes').select('*, stock_catalogue(nom,photo_path,mode), stock_fournisseurs(nom)')
        .order('date_rappel', { ascending: true, nullsFirst: false }).limit(200),
    ])
    setA(data)
    setCmds((c.data || []).map(x => ({
      ...x,
      article: x.stock_catalogue?.nom,
      photo_path: x.stock_catalogue?.photo_path,
      fournisseur_nom: x.stock_fournisseurs?.nom,
    })))
  }
  useEffect(() => { load() }, [])

  async function statutCmd(cmd, statut) {
    const patch = { statut }
    if (statut === 'commandee' && !cmd.date_commande) patch.date_commande = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('stock_commandes').update(patch).eq('id', cmd.id)
    if (error) { onErr?.(error.message); return }
    onOk?.(statut === 'recue' ? 'Commande reçue — faites une réception pour créer les QR.' : 'Commande mise à jour.')
    load()
  }

  if (!a) return <Loading />
  const ouvertes = cmds.filter(c => c.statut === 'a_commander' || c.statut === 'commandee')
  const blocs = [
    { k:'commandes', t:'Rappels de commande', c:'#185FA5', rows: a.commandes || [] },
    { k:'perimes', t:'Périmés (à retirer)', c:'#A32D2D' },
    { k:'o2_basse', t:'Oxygène ≤ 50 bar', c:'#A32D2D' },
    { k:'proches', t:'Péremption ≤ 90 jours', c:'#BA7517' },
    { k:'vides', t:'Vides / presque vides', c:'#185FA5' },
    { k:'bas', t:'Sous le seuil — à commander', c:'#A32D2D' },
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap', marginBottom:8 }}>
          <div style={{ fontWeight:700, color:'var(--heading)' }}>Commandes ({ouvertes.length} ouvertes)</div>
          <Btn onClick={() => setEdit({ catalogue_id: cats[0]?.id || '', fournisseur_id:'', quantite:'1', date_rappel:'', notes:'', statut:'a_commander' })}>+ Rappel / commande</Btn>
        </div>
        {edit && (
          <FormCommande item={edit} cats={cats} fournisseurs={fournisseurs}
            onDone={() => { setEdit(null); load() }} onOk={onOk} onErr={onErr} />
        )}
        {cmds.length === 0 ? <div style={{ fontSize:13, color:'var(--text-muted)' }}>Aucune commande enregistrée.</div> : cmds.map(cmd => (
          <Card key={cmd.id} style={{ padding:'10px 14px', marginBottom:6, opacity: cmd.statut === 'annulee' || cmd.statut === 'recue' ? 0.65 : 1 }}>
            <div className="ha-stock-row">
              <PhotoArticle path={cmd.photo_path} size={44} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:8, flexWrap:'wrap' }}>
                  <strong>{cmd.article}</strong>
                  <span style={{ fontSize:12.5, fontWeight:700 }}>{lblCommande(cmd.statut)}</span>
                </div>
                <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>
                  Qté {Number(cmd.quantite)}
                  {cmd.fournisseur_nom ? ` · ${cmd.fournisseur_nom}` : ''}
                  {cmd.date_rappel ? ` · rappel ${cmd.date_rappel}` : ''}
                  {cmd.date_commande ? ` · commandé le ${cmd.date_commande}` : ''}
                </div>
                {cmd.notes && <div style={{ fontSize:12.5, color:'var(--text-2)' }}>{cmd.notes}</div>}
              </div>
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
              {cmd.statut === 'a_commander' && <Btn kind="soft" onClick={() => statutCmd(cmd, 'commandee')} style={{ padding:'5px 10px' }}>Marquer commandée</Btn>}
              {(cmd.statut === 'a_commander' || cmd.statut === 'commandee') && (
                <Btn onClick={() => { statutCmd(cmd, 'recue'); onCommander?.(cmd) }} style={{ padding:'5px 10px' }}>Reçue → réception</Btn>
              )}
              {cmd.statut !== 'annulee' && cmd.statut !== 'recue' && (
                <Btn kind="danger" onClick={() => statutCmd(cmd, 'annulee')} style={{ padding:'5px 10px' }}>Annuler</Btn>
              )}
            </div>
          </Card>
        ))}
      </div>

      {blocs.map(b => {
        if (b.k === 'commandes') return null
        const rows = a[b.k] || []
        return (
          <div key={b.k}>
            <div style={{ fontWeight:700, color: b.c, marginBottom:8 }}>{b.t} ({rows.length})</div>
            {rows.length === 0 ? <div style={{ fontSize:13, color:'var(--text-muted)' }}>Rien.</div> : rows.map((u, i) => (
              <Card key={u.id || i} style={{ padding:'10px 14px', marginBottom:6 }}>
                <div className="ha-stock-row">
                  <PhotoArticle path={u.photo_path} size={44} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600 }}>{u.nom}</div>
                    <div style={{ fontSize:12.5, color:'var(--text-muted)' }}>
                      {u.reste != null ? `Reste total ${u.reste} / seuil ${u.stock_minimal}` : `${resteLabel(u)}${u.lieu_nom ? ' · ' + u.lieu_nom : ''}${u.date_peremption ? ' · DLC ' + u.date_peremption : ''}`}
                      {u.fournisseur_nom ? ` · ${u.fournisseur_nom}` : ''}
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
                  {b.k === 'perimes' && (
                    <Btn kind="danger" onClick={async () => { await onPerime?.(u); load() }} style={{ padding:'5px 10px' }}>Retirer du stock</Btn>
                  )}
                  {b.k === 'bas' && (
                    <Btn onClick={() => setEdit({
                      catalogue_id: u.id,
                      fournisseur_id: u.fournisseur_id || '',
                      quantite: String(Math.max(Number(u.stock_minimal) - Number(u.reste) || 1, 1)),
                      date_rappel: new Date().toISOString().slice(0, 10),
                      notes: u.ref_fournisseur ? `Réf. ${u.ref_fournisseur}` : '',
                      statut: 'a_commander',
                    })} style={{ padding:'5px 10px' }}>Créer un rappel de commande</Btn>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function FormCommande({ item, cats, fournisseurs, onDone, onOk, onErr }) {
  const [f, setF] = useState({ ...item })
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!f.catalogue_id) { onErr?.('Choisissez un article.'); return }
    if (!(Number(f.quantite) > 0)) { onErr?.('Quantité invalide.'); return }
    setSaving(true)
    const { data: auth } = await supabase.auth.getUser()
    const payload = {
      catalogue_id: f.catalogue_id,
      fournisseur_id: f.fournisseur_id || (cats.find(c => c.id === f.catalogue_id)?.fournisseur_id) || null,
      quantite: Number(f.quantite),
      statut: f.statut || 'a_commander',
      date_rappel: f.date_rappel || null,
      notes: f.notes?.trim() || null,
      par: auth?.user?.id || null,
    }
    const { error } = await supabase.from('stock_commandes').insert(payload)
    setSaving(false)
    if (error) { onErr?.(error.message); return }
    onOk?.('Rappel de commande enregistré.')
    onDone()
  }
  const optsCat = (cats || []).map(c => ({ v:c.id, l:c.nom }))
  const optsF = [{ v:'', l:'— Fournisseur de l’article —' }, ...(fournisseurs || []).filter(x => x.actif !== false).map(x => ({ v:x.id, l:x.nom }))]
  return (
    <Card style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
        <strong>Nouveau rappel de commande</strong>
        <Btn kind="soft" onClick={onDone}>Annuler</Btn>
      </div>
      <Sel label="Article" value={f.catalogue_id} set={v=>setF(s=>({ ...s, catalogue_id:v }))} options={optsCat} />
      <Sel label="Fournisseur" value={f.fournisseur_id || ''} set={v=>setF(s=>({ ...s, fournisseur_id:v }))} options={optsF} />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <F label="Quantité" type="number" value={f.quantite} set={v=>setF(s=>({ ...s, quantite:v }))} required />
        <F label="Date de rappel" type="date" value={f.date_rappel} set={v=>setF(s=>({ ...s, date_rappel:v }))} />
      </div>
      <TA label="Notes" value={f.notes} set={v=>setF(s=>({ ...s, notes:v }))} rows={2} placeholder="N° de commande, conditionnement…" />
      <Btn onClick={save} disabled={saving} style={{ width:'100%' }}>{saving ? '…' : 'Enregistrer'}</Btn>
    </Card>
  )
}
