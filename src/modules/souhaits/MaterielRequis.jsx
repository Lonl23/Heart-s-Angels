import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, Btn, F, Sel, Empty } from '@/components/ui'
import { VOLUMES_O2 } from '@/modules/stock/stockSchema'
import { nid, libelleRequis } from '@/modules/stock/materielRequis'

export default function MaterielRequis({ m, setM }) {
  const list = Array.isArray(m?.materiel_requis) ? m.materiel_requis : []
  const setList = rows => setM(o => ({ ...o, materiel_requis: rows }))
  const [cats, setCats] = useState([])
  const [sacs, setSacs] = useState([])
  const [add, setAdd] = useState({ kind:'o2', volume_l:'5', qte:'1', catalogue_id:'', lieu_id:'', libelle:'' })

  useEffect(() => {
    supabase.from('stock_catalogue').select('id,nom,mode,volume_l').eq('actif', true).order('nom')
      .then(({ data }) => setCats(data || []))
    supabase.from('stock_lieux').select('id,nom,type').eq('actif', true).in('type', ['sac','pochette']).order('nom')
      .then(({ data }) => setSacs(data || []))
  }, [])

  function ajouter() {
    let row = { id: nid(), kind: add.kind, qte: Math.max(1, Number(add.qte) || 1) }
    if (add.kind === 'o2') {
      row.volume_l = Number(add.volume_l) || 5
      row.libelle = `Oxygène ${row.volume_l} L`
    } else if (add.kind === 'sac') {
      const s = sacs.find(x => x.id === add.lieu_id)
      if (!s && !add.libelle.trim()) { alert('Choisissez un sac ou tapez son nom.'); return }
      row.lieu_id = s?.id || null
      row.libelle = s?.nom || add.libelle.trim()
    } else if (add.kind === 'catalogue') {
      const c = cats.find(x => x.id === add.catalogue_id)
      if (!c) { alert('Choisissez un type d’article.'); return }
      row.catalogue_id = c.id
      row.libelle = c.nom
      if (c.mode === 'oxygene') { row.kind = 'o2'; row.volume_l = Number(c.volume_l) || row.volume_l }
    } else {
      if (!add.libelle.trim()) { alert('Indiquez le matériel.'); return }
      row.libelle = add.libelle.trim()
    }
    setList([...list, row])
    setAdd(a => ({ ...a, libelle:'', qte:'1' }))
  }

  const optsCat = [{ v:'', l:'— Type —' }, ...cats.map(c => ({ v:c.id, l:c.nom }))]
  const optsSac = [{ v:'', l:'— Sac du stock —' }, ...sacs.map(s => ({ v:s.id, l:s.nom }))]

  return (
    <div>
      <Card style={{ marginBottom:14 }}>
        <div style={{ fontWeight:700, color:'var(--heading)', marginBottom:6 }}>Matériel à emporter</div>
        <p style={{ margin:'0 0 12px', fontSize:13.5, color:'var(--text-muted)' }}>
          L’équipage scannera au départ chaque bouteille d’O₂ et chaque sac. Ajoutez ici ce qui est nécessaire pour ce souhait.
        </p>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
          {VOLUMES_O2.map(v => (
            <Btn key={v.v} kind="soft" onClick={() => setList([...list, { id: nid(), kind:'o2', volume_l: Number(v.v), qte:1, libelle:`Oxygène ${v.v} L` }])}>
              + O₂ {v.l}
            </Btn>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10, alignItems:'end' }}>
          <Sel label="Ajouter" value={add.kind} set={v=>setAdd(a=>({ ...a, kind:v }))}
            options={[{ v:'o2', l:'Bouteille O₂' }, { v:'sac', l:'Sac' }, { v:'catalogue', l:'Type d’article' }, { v:'libre', l:'Autre (sans QR)' }]} />
          {add.kind === 'o2' && <Sel label="Volume" value={String(add.volume_l)} set={v=>setAdd(a=>({ ...a, volume_l:v }))} options={VOLUMES_O2} />}
          {add.kind === 'sac' && <Sel label="Sac" value={add.lieu_id} set={v=>setAdd(a=>({ ...a, lieu_id:v }))} options={optsSac} />}
          {add.kind === 'catalogue' && <Sel label="Article" value={add.catalogue_id} set={v=>setAdd(a=>({ ...a, catalogue_id:v }))} options={optsCat} />}
          {(add.kind === 'libre' || (add.kind === 'sac' && !add.lieu_id)) && (
            <F label="Libellé" value={add.libelle} set={v=>setAdd(a=>({ ...a, libelle:v }))} placeholder="Sac confort, brancard…" />
          )}
          {add.kind !== 'libre' && add.kind !== 'sac' && (
            <F label="Quantité" type="number" value={add.qte} set={v=>setAdd(a=>({ ...a, qte:v }))} />
          )}
          <Btn onClick={ajouter}>+ Ajouter</Btn>
        </div>
      </Card>

      {list.length === 0 ? (
        <Empty title="Rien de prévu" hint="Au minimum, l’équipage scannera les O₂ et sacs qu’il emporte. Ajoutez les volumes et sacs obligatoires ici." />
      ) : (
        <Card>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {list.map(r => (
              <div key={r.id} style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight:600 }}>{libelleRequis(r)}</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                    {r.kind === 'o2' ? 'Scanner la bouteille au départ' : r.kind === 'sac' ? 'Scanner le QR du sac' : r.kind === 'catalogue' ? 'Scanner l’article' : 'À cocher (pas de QR)'}
                  </div>
                </div>
                <Btn kind="danger" onClick={() => setList(list.filter(x => x.id !== r.id))} style={{ padding:'5px 10px' }}>Retirer</Btn>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
