import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Page, Card, Btn, F, TA, Tabs, AddressFields, fmtAdresse, PhoneF } from '@/components/ui'

const ONGLETS = [
  { v: 'bases', l: 'Bases de départ' },
  { v: 'institutions', l: 'Institutions' },
  { v: 'materiel', l: 'Matériel à emporter' },
  { v: 'plaques', l: 'Plaques' },
  { v: 'destinations', l: 'Destinations' },
  { v: 'allergies', l: 'Allergies' },
]

function adr(row) {
  return {
    rue: row?.rue || '',
    numero: row?.numero || '',
    cp: row?.cp || '',
    localite: row?.localite || '',
    pays: row?.pays || 'Belgique',
  }
}

export default function ConfigurationSouhaits() {
  const [tab, setTab] = useState('bases')
  return (
    <Page title="Configuration souhaits">
      <Tabs value={tab} onChange={setTab} items={ONGLETS} />
      {tab === 'bases' && <Bases />}
      {tab === 'institutions' && <Institutions />}
      {tab === 'materiel' && <Libelles table="materiel_emporter" champ="libelle" />}
      {tab === 'plaques' && <Plaques />}
      {tab === 'destinations' && <Destinations />}
      {tab === 'allergies' && <Libelles table="allergies_referentiel" champ="libelle" />}
    </Page>
  )
}

function useRows(table, ordre = 'ordre') {
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')
  async function load() {
    const { data, error } = await supabase.from(table).select('*').order(ordre)
    if (error) setErr(error.message)
    else setRows(data || [])
  }
  useEffect(() => { load() }, [table])
  return { rows, err, load, setErr }
}

function Bases() {
  const { rows, err, load, setErr } = useRows('bases_depart')
  const [edit, setEdit] = useState(null)
  async function sauver() {
    const row = {
      nom: (edit.nom || '').trim(),
      rue: edit.rue || '',
      numero: edit.numero || '',
      cp: edit.cp || '',
      localite: edit.localite || '',
      pays: edit.pays || 'Belgique',
      protocole: edit.protocole || '',
      ordre: Number(edit.ordre) || 0,
      actif: edit.actif !== false,
    }
    if (!row.nom) return
    const q = edit.id
      ? supabase.from('bases_depart').update(row).eq('id', edit.id)
      : supabase.from('bases_depart').insert(row)
    const { error } = await q
    if (error) { setErr(error.message); return }
    setEdit(null)
    load()
  }
  return (
    <Bloc err={err} onAdd={() => setEdit({ nom: '', protocole: '', ordre: (rows.length + 1) * 10, actif: true, pays: 'Belgique' })}>
      {rows.map(r => (
        <Ligne key={r.id} titre={r.nom} sous={`${fmtAdresse(adr(r))}${r.actif ? '' : ' · inactif'}`} onEdit={() => setEdit({ ...r, ...adr(r) })} />
      ))}
      {edit && (
        <Card style={{ marginTop: 12 }}>
          <F label="Nom" value={edit.nom || ''} set={v => setEdit(s => ({ ...s, nom: v }))} />
          <AddressFields value={adr(edit)} set={a => setEdit(s => ({ ...s, ...a }))} />
          <TA label="Protocole de mission" value={edit.protocole || ''} set={v => setEdit(s => ({ ...s, protocole: v }))} rows={5} />
          <F label="Ordre" type="number" value={String(edit.ordre ?? 0)} set={v => setEdit(s => ({ ...s, ordre: v }))} />
          <label style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
            <input type="checkbox" checked={edit.actif !== false} onChange={e => setEdit(s => ({ ...s, actif: e.target.checked }))} />
            Active
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={sauver}>Enregistrer</Btn>
            <Btn kind="soft" onClick={() => setEdit(null)}>Annuler</Btn>
            {edit.id && <Btn kind="danger" onClick={async () => { await supabase.from('bases_depart').delete().eq('id', edit.id); setEdit(null); load() }}>Supprimer</Btn>}
          </div>
        </Card>
      )}
    </Bloc>
  )
}

function Institutions() {
  const { rows, err, load, setErr } = useRows('referentiel_institutions')
  const [services, setServices] = useState([])
  const [edit, setEdit] = useState(null)
  const [svc, setSvc] = useState('')
  useEffect(() => {
    supabase.from('referentiel_services').select('*').order('ordre').then(({ data }) => setServices(data || []))
  }, [rows])
  async function sauver() {
    const row = {
      nom: (edit.nom || '').trim(),
      telephone: edit.telephone || '',
      email: edit.email || '',
      rue: edit.rue || '', numero: edit.numero || '', cp: edit.cp || '', localite: edit.localite || '', pays: edit.pays || 'Belgique',
      ordre: Number(edit.ordre) || 0,
      actif: edit.actif !== false,
    }
    if (!row.nom) return
    const q = edit.id
      ? supabase.from('referentiel_institutions').update(row).eq('id', edit.id).select('id').single()
      : supabase.from('referentiel_institutions').insert(row).select('id').single()
    const { data, error } = await q
    if (error) { setErr(error.message); return }
    setEdit(s => ({ ...s, id: data.id }))
    load()
  }
  async function ajouterService() {
    const nom = svc.trim()
    if (!nom || !edit?.id) return
    const { error } = await supabase.from('referentiel_services').insert({
      institution_id: edit.id, nom, ordre: (services.filter(s => s.institution_id === edit.id).length + 1) * 10,
    })
    if (error) { setErr(error.message); return }
    setSvc('')
    const { data } = await supabase.from('referentiel_services').select('*').order('ordre')
    setServices(data || [])
  }
  return (
    <Bloc err={err} onAdd={() => setEdit({ nom: '', pays: 'Belgique', ordre: (rows.length + 1) * 10, actif: true })}>
      {rows.map(r => (
        <Ligne key={r.id} titre={r.nom} sous={services.filter(s => s.institution_id === r.id).map(s => s.nom).join(' · ')} onEdit={() => setEdit({ ...r, ...adr(r) })} />
      ))}
      {edit && (
        <Card style={{ marginTop: 12 }}>
          <F label="Nom" value={edit.nom || ''} set={v => setEdit(s => ({ ...s, nom: v }))} />
          <PhoneF label="Téléphone" value={edit.telephone || ''} set={v => setEdit(s => ({ ...s, telephone: v }))} />
          <F label="E-mail" value={edit.email || ''} set={v => setEdit(s => ({ ...s, email: v }))} />
          <AddressFields value={adr(edit)} set={a => setEdit(s => ({ ...s, ...a }))} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Btn onClick={sauver}>Enregistrer</Btn>
            <Btn kind="soft" onClick={() => setEdit(null)}>Fermer</Btn>
          </div>
          {edit.id && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Services</div>
              {services.filter(s => s.institution_id === edit.id).map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span>{s.nom}{s.telephone ? ` · ${s.telephone}` : ''}</span>
                  <Btn kind="danger" onClick={async () => {
                    await supabase.from('referentiel_services').delete().eq('id', s.id)
                    setServices(list => list.filter(x => x.id !== s.id))
                  }} style={{ padding: '4px 8px' }}>Retirer</Btn>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
                <div style={{ flex: 1 }}><F label="Service" value={svc} set={setSvc} /></div>
                <Btn kind="soft" onClick={ajouterService} style={{ marginBottom: 10 }}>Ajouter</Btn>
              </div>
            </div>
          )}
        </Card>
      )}
    </Bloc>
  )
}

function Libelles({ table }) {
  const { rows, err, load, setErr } = useRows(table)
  const [nom, setNom] = useState('')
  async function ajouter() {
    const libelle = nom.trim()
    if (!libelle) return
    const { error } = await supabase.from(table).insert({ libelle, ordre: (rows.length + 1) * 10 })
    if (error) { setErr(error.message); return }
    setNom('')
    load()
  }
  return (
    <Bloc err={err}>
      {rows.map(r => (
        <Ligne key={r.id} titre={r.libelle} onEdit={null} extra={
          <Btn kind="danger" style={{ padding: '4px 8px' }} onClick={async () => { await supabase.from(table).delete().eq('id', r.id); load() }}>Retirer</Btn>
        } />
      ))}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 12 }}>
        <div style={{ flex: 1 }}><F label="Ajouter" value={nom} set={setNom} /></div>
        <Btn onClick={ajouter} style={{ marginBottom: 10 }}>Ajouter</Btn>
      </div>
    </Bloc>
  )
}

function Plaques() {
  const { rows, err, load, setErr } = useRows('plaques_vehicules', 'plaque')
  const [plaque, setPlaque] = useState('')
  const [libelle, setLibelle] = useState('')
  async function ajouter() {
    const p = plaque.trim()
    if (!p) return
    const { error } = await supabase.from('plaques_vehicules').insert({ plaque: p, libelle: libelle.trim() || null })
    if (error) { setErr(error.message); return }
    setPlaque(''); setLibelle(''); load()
  }
  return (
    <Bloc err={err}>
      {rows.map(r => (
        <Ligne key={r.id} titre={r.plaque} sous={r.libelle || ''} extra={
          <Btn kind="danger" style={{ padding: '4px 8px' }} onClick={async () => { await supabase.from('plaques_vehicules').delete().eq('id', r.id); load() }}>Retirer</Btn>
        } />
      ))}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'flex-end', marginTop: 12 }}>
        <F label="Plaque" value={plaque} set={setPlaque} />
        <F label="Véhicule" value={libelle} set={setLibelle} />
        <Btn onClick={ajouter} style={{ marginBottom: 10 }}>Ajouter</Btn>
      </div>
    </Bloc>
  )
}

function Destinations() {
  const { rows, err, load, setErr } = useRows('destinations_frequentes', 'nom')
  const [edit, setEdit] = useState(null)
  async function sauver() {
    const row = {
      nom: (edit.nom || '').trim(),
      rue: edit.rue || '', numero: edit.numero || '', cp: edit.cp || '', localite: edit.localite || '', pays: edit.pays || 'Belgique',
      telephone: edit.telephone || '',
      notes: edit.notes || '',
      actif: true,
    }
    if (!row.nom) return
    const q = edit.id
      ? supabase.from('destinations_frequentes').update(row).eq('id', edit.id)
      : supabase.from('destinations_frequentes').insert(row)
    const { error } = await q
    if (error) { setErr(error.message); return }
    setEdit(null); load()
  }
  return (
    <Bloc err={err} onAdd={() => setEdit({ nom: '', pays: 'Belgique' })}>
      {rows.map(r => (
        <Ligne key={r.id} titre={r.nom} sous={[fmtAdresse(adr(r)), r.telephone].filter(Boolean).join(' · ')} onEdit={() => setEdit({ ...r, ...adr(r) })} extra={
          <Btn kind="danger" style={{ padding: '4px 8px' }} onClick={async () => { await supabase.from('destinations_frequentes').delete().eq('id', r.id); load() }}>Retirer</Btn>
        } />
      ))}
      {edit && (
        <Card style={{ marginTop: 12 }}>
          <F label="Nom" value={edit.nom || ''} set={v => setEdit(s => ({ ...s, nom: v }))} />
          <AddressFields value={adr(edit)} set={a => setEdit(s => ({ ...s, ...a }))} />
          <PhoneF label="Téléphone" value={edit.telephone || ''} set={v => setEdit(s => ({ ...s, telephone: v }))} />
          <TA label="Notes" value={edit.notes || ''} set={v => setEdit(s => ({ ...s, notes: v }))} rows={2} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={sauver}>Enregistrer</Btn>
            <Btn kind="soft" onClick={() => setEdit(null)}>Annuler</Btn>
          </div>
        </Card>
      )}
    </Bloc>
  )
}

function Bloc({ children, err, onAdd }) {
  return (
    <div style={{ marginTop: 14 }}>
      {err && <div style={{ color: '#A32D2D', marginBottom: 8 }}>{err}</div>}
      {onAdd && <Btn onClick={onAdd} style={{ marginBottom: 12 }}>+ Ajouter</Btn>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  )
}

function Ligne({ titre, sous, onEdit, extra }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', background: 'var(--card)' }}>
      <div>
        <div style={{ fontWeight: 700 }}>{titre}</div>
        {sous ? <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{sous}</div> : null}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {onEdit && <Btn kind="soft" onClick={onEdit} style={{ padding: '4px 8px' }}>Modifier</Btn>}
        {extra}
      </div>
    </div>
  )
}
