import { useRef } from 'react'
import { Card, Btn, F, Sel, PhoneF } from '@/components/ui'
import {
  ROLES_PLURI, lblRolePluri, equipePluri, personnePluriRemplie,
} from './missionSchema'

function nid() {
  return (crypto.randomUUID && crypto.randomUUID()) || ('p-' + Math.random().toString(36).slice(2, 10))
}

function vide(role) {
  return { id: nid(), role: role || 'medecin', prenom: '', nom: '', tel: '', organisme: '' }
}

export default function EquipePluriForm({ m, setM }) {
  const defauts = useRef(ROLES_PLURI.map(r => vide(r.v)))
  const raw = equipePluri(m)
  const lignes = raw.length ? raw : defauts.current
  const medSansTel = lignes.some(r => r.role === 'medecin' && personnePluriRemplie(r) && !(r.tel || '').trim())

  function poser(rows) {
    setM(o => ({ ...o, equipe_pluri: rows }))
  }
  function maj(i, patch) {
    poser(lignes.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }
  function ajouter() {
    poser([...lignes, vide('infirmier')])
  }
  function retirer(i) {
    const next = lignes.filter((_, j) => j !== i)
    poser(next.length ? next : ROLES_PLURI.map(r => vide(r.v)))
  }

  return (
    <Card style={{ marginTop: 16 }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading)', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        Équipe pluridisciplinaire
      </div>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 14px' }}>
        Médecin, infirmier, aide-soignant, psychologue, kiné autour du patient (institution ou domicile). Le n° du médecin s’affiche en permanence pendant la mission.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {lignes.map((r, i) => (
          <div key={r.id || i} className="ha-pluri-row">
            <Sel label="Rôle" value={r.role || 'medecin'} set={v => maj(i, { role: v })} options={ROLES_PLURI} />
            <F label="Prénom" value={r.prenom} set={v => maj(i, { prenom: v })} />
            <F label="Nom" value={r.nom} set={v => maj(i, { nom: v })} />
            <PhoneF label="Téléphone" value={r.tel} set={v => maj(i, { tel: v })} />
            <F label="Service / organisme" value={r.organisme} set={v => maj(i, { organisme: v })} placeholder="ex. maison de repos, cabinet…" />
            {personnePluriRemplie(r) && (
              <Btn kind="danger" onClick={() => retirer(i)} style={{ padding: '8px 10px', alignSelf: 'end', marginBottom: 10 }}>Retirer</Btn>
            )}
          </div>
        ))}
      </div>
      <Btn kind="soft" onClick={ajouter} style={{ marginTop: 8 }}>+ Une personne</Btn>
      {medSansTel && (
        <p style={{ fontSize: 13, color: '#A32D2D', fontWeight: 600, margin: '10px 0 0' }}>
          Indiquez le n° du médecin : il restera affiché pendant toute la mission.
        </p>
      )}
    </Card>
  )
}

export function BandeauMedecin({ tel, nom }) {
  if (!tel) return null
  return (
    <div className="ha-medecin-sticky">
      <div className="ha-medecin-k">Médecin</div>
      <a href={`tel:${String(tel).replace(/\s/g, '')}`} className="ha-medecin-tel">📞 {tel}</a>
      {nom ? <span className="ha-medecin-nom">{nom}</span> : null}
    </div>
  )
}

export function LignesPluri({ rows }) {
  const list = (rows || []).filter(personnePluriRemplie)
  if (!list.length) return <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Aucune personne encodée.</div>
  return (
    <div>
      {list.map((r, i) => (
        <div key={r.id || i} style={{ fontSize: 13.5, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 600 }}>{lblRolePluri(r.role)}</div>
          <div>{[r.prenom, r.nom].filter(Boolean).join(' ') || '—'}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
            {[r.tel, r.organisme].filter(Boolean).join(' · ') || 'Pas de numéro'}
          </div>
        </div>
      ))}
    </div>
  )
}
