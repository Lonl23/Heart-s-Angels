import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, Btn, inp } from '@/components/ui'

const TYPES = [
  { v: 'message', l: 'Message' },
  { v: 'note', l: 'Note' },
  { v: 'appel', l: 'Appel' },
  { v: 'visite', l: 'Visite' },
  { v: 'rencontre_beneficiaire', l: 'Rencontre bénéficiaire' },
  { v: 'validation', l: 'Validation' },
]

function libelleType(t) {
  if (t === 'statut' || t === 'modification') return 'Statut'
  return TYPES.find(x => x.v === t)?.l || t
}

function nomAuteur(n) {
  const prenom = (n.auteur_prenom || n.profiles?.prenom || '').trim()
  const nom = (n.auteur_nom || n.profiles?.nom || '').trim()
  return `${prenom} ${nom}`.trim()
}

export default function Suivi({ souhaitId }) {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [type, setType] = useState('message')
  const [contenu, setContenu] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { load() }, [souhaitId])
  async function load() {
    const { data } = await supabase
      .from('souhait_suivi')
      .select('*, profiles(prenom,nom)')
      .eq('souhait_id', souhaitId)
      .order('date_contact', { ascending: false })
    setRows(data || [])
  }
  async function ajouter() {
    const texte = contenu.trim()
    if (!texte || saving) return
    setSaving(true)
    await supabase.from('souhait_suivi').insert({
      souhait_id: souhaitId,
      profile_id: profile?.id,
      type_contact: type,
      contenu: texte,
      auteur_prenom: profile?.prenom || '',
      auteur_nom: profile?.nom || '',
    })
    setContenu('')
    setSaving(false)
    load()
  }
  return (
    <div>
      <Card style={{ marginBottom:14 }}>
        <div style={{ fontSize:12.5, color:'var(--text-muted)', marginBottom:8 }}>
          Les déplacements de colonne et les changements de statut de préparation sont notés automatiquement (qui, de quel statut à quel statut). Les messages portent le prénom et le nom de l’auteur.
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <select value={type} onChange={e=>setType(e.target.value)} style={{ ...inp, width:'auto' }}>
            {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
          <input
            value={contenu}
            onChange={e=>setContenu(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') ajouter() }}
            placeholder="Message à transmettre…"
            style={{ ...inp, flex:1, minWidth:160 }}
          />
          <Btn onClick={ajouter} disabled={saving}>{saving ? '…' : 'Ajouter'}</Btn>
        </div>
      </Card>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {rows.map(n => {
          const qui = nomAuteur(n)
          const quand = n.date_contact ? new Date(n.date_contact).toLocaleString('fr-BE') : ''
          return (
            <div key={n.id} style={{ borderLeft:'3px solid var(--accent)', padding:'6px 0 6px 12px' }}>
              <div style={{ fontSize:13.5, color:'var(--text)', whiteSpace:'pre-wrap' }}>{n.contenu}</div>
              <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:2 }}>
                {qui ? <strong style={{ color:'var(--text-2)', fontWeight:600 }}>{qui}</strong> : null}
                {qui ? ' · ' : ''}
                {libelleType(n.type_contact)}
                {quand ? ` · ${quand}` : ''}
              </div>
            </div>
          )
        })}
        {rows.length===0 && <Card>Aucune note de suivi.</Card>}
      </div>
    </div>
  )
}
