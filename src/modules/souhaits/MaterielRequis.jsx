import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, Btn, F, Sel, Empty, Modal } from '@/components/ui'
import { VOLUMES_O2, nomTypeO2 } from '@/modules/stock/stockSchema'
import { nid, libelleRequis } from '@/modules/stock/materielRequis'
import { CHECKLISTS, extrasChecklist } from './missionSchema'

const SECTIONS_CL = [
  { v:'base',        l:'Départ (base)' },
  { v:'pec',         l:'Prise en charge' },
  { v:'retour_pec',  l:'Retour patient' },
  { v:'retour_base', l:'Retour base' },
]

export default function MaterielRequis({ m, setM, lecture=false }) {
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
      row.libelle = nomTypeO2(row.volume_l)
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

  const [popup, setPopup] = useState(false)
  const [catalogue, setCatalogue] = useState([])
  useEffect(() => {
    supabase.from('materiel_emporter').select('libelle').eq('actif', true).order('ordre')
      .then(({ data }) => setCatalogue((data || []).map(r => r.libelle)))
  }, [])

  return (
    <div>
      <Card style={{ marginBottom:14 }}>
        <div style={{ fontWeight:700, color:'var(--heading)', marginBottom:10 }}>Matériel à emporter</div>
        {!lecture && <Btn onClick={() => setPopup(true)}>Choisir</Btn>}
        {popup && (
          <PopupMateriel
            options={catalogue.length ? catalogue : ['Kit supplémentaire', 'Sac intervention', 'Sac paramédic', 'Sac confort', 'Chaise roulante', 'Coussin demi-lune', 'Baffle', 'O2 B2', 'O2 B5', 'O2 B10']}
            deja={list.map(r => r.libelle)}
            onClose={() => setPopup(false)}
            onValider={libs => {
              const rows = libs.filter(l => !list.some(r => r.libelle === l)).map(versRequis)
              setList([...list, ...rows])
              setPopup(false)
            }}
          />
        )}
      </Card>

      {list.length === 0 ? (
        <Empty title="Rien de prévu" />
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
                {!lecture && <Btn kind="danger" onClick={() => setList(list.filter(x => x.id !== r.id))} style={{ padding:'5px 10px' }}>Retirer</Btn>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <ChecklistExtras m={m} setM={setM} lecture={lecture} />
    </div>
  )
}

function versRequis(libelle) {
  const id = nid()
  const vol = String(libelle).match(/\bB\s*(\d+)\b/i)
  if (/o2|oxyg/i.test(libelle) && vol) return { id, kind: 'o2', volume_l: Number(vol[1]), qte: 1, libelle }
  if (/sac/i.test(libelle)) return { id, kind: 'sac', qte: 1, libelle }
  return { id, kind: 'libre', qte: 1, libelle }
}

function PopupMateriel({ options, deja, onClose, onValider }) {
  const [cur, setCur] = useState(deja.filter(Boolean))
  const [libre, setLibre] = useState('')
  const tous = [...new Set([...options, ...cur])]
  function toggle(opt) {
    setCur(list => list.includes(opt) ? list.filter(x => x !== opt) : [...list, opt])
  }
  return (
    <Modal title="Matériel à emporter" onClose={onClose} wide footer={
      <><Btn kind="soft" onClick={onClose}>Annuler</Btn><Btn onClick={() => onValider(cur)}>Valider</Btn></>
    }>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {tous.map(opt => {
          const on = cur.includes(opt)
          return (
            <button key={opt} type="button" onClick={() => toggle(opt)} style={{
              padding: '8px 12px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
              border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
              background: on ? 'var(--accent)' : 'var(--card)', color: on ? '#fff' : 'var(--text)',
            }}>{on ? '✓ ' : ''}{opt}</button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 12 }}>
        <div style={{ flex: 1 }}><F label="Autre" value={libre} set={setLibre} /></div>
        <Btn kind="soft" onClick={() => { const t = libre.trim(); if (t) { setCur(list => list.includes(t) ? list : [...list, t]); setLibre('') } }} style={{ marginBottom: 10 }}>Ajouter</Btn>
      </div>
    </Modal>
  )
}

function ChecklistExtras({ m, setM, lecture }) {
  const [add, setAdd] = useState({ section:'base', libelle:'', medical:false })
  const extras = m?.checklist_extras || {}
  function setExtras(next) { setM(o => ({ ...o, checklist_extras: next })) }
  function ajouter() {
    const libelle = add.libelle.trim()
    if (!libelle) { alert('Indiquez le matériel ou l’élément à cocher.'); return }
    const deja = extrasChecklist(m, add.section)
    if (deja.some(x => x.libelle.toLowerCase() === libelle.toLowerCase()) || (CHECKLISTS[add.section]?.items || []).includes(libelle)) {
      alert('Cet élément est déjà dans la checklist.'); return
    }
    const medical = add.section === 'pec' || (add.section === 'retour_pec' && add.medical)
    setExtras({ ...extras, [add.section]: [...deja, { id: nid(), libelle, medical }] })
    setAdd(a => ({ ...a, libelle:'' }))
  }
  function retirer(section, id) {
    setExtras({ ...extras, [section]: extrasChecklist(m, section).filter(x => x.id !== id) })
  }
  return (
    <Card style={{ marginTop:14 }}>
      <div style={{ fontWeight:700, color:'var(--heading)', marginBottom:10 }}>À cocher sur le terrain</div>
      {!lecture && (
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:10, alignItems:'end' }}>
        <Sel label="Checklist" value={add.section} set={v=>setAdd(a=>({ ...a, section:v, medical: v==='pec' }))} options={SECTIONS_CL} />
        <F label="Matériel / élément" value={add.libelle} set={v=>setAdd(a=>({ ...a, libelle:v }))} placeholder="Coussin, brancard, couverture…" />
        {add.section === 'retour_pec' && (
          <Sel label="Qui coche" value={add.medical ? 'medical' : 'logistique'} set={v=>setAdd(a=>({ ...a, medical: v==='medical' }))}
            options={[{ v:'logistique', l:'Tout l’équipage' }, { v:'medical', l:'Médical seulement' }]} />
        )}
        <Btn onClick={ajouter}>+ Ajouter à la checklist</Btn>
      </div>
      )}
      {SECTIONS_CL.map(s => {
        const extra = extrasChecklist(m, s.v)
        if (!extra.length) return null
        return (
          <div key={s.v} style={{ marginTop:14 }}>
            <div style={{ fontSize:12.5, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:.4, marginBottom:6 }}>{s.l}</div>
            {extra.map(x => (
              <div key={x.id} style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight:600 }}>{x.libelle}</div>
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>{x.medical || s.v === 'pec' ? 'Coché par le médical' : 'Coché par l’équipage'}</div>
                </div>
                {!lecture && <Btn kind="danger" onClick={() => retirer(s.v, x.id)} style={{ padding:'5px 10px' }}>Retirer</Btn>}
              </div>
            ))}
          </div>
        )
      })}
    </Card>
  )
}
