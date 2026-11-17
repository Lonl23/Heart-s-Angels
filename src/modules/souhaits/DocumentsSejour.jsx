import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, Btn, F, Sel, TA, AddressFields, Flash, fmtAdresse, Modal } from '@/components/ui'
import { TYPES_LIEU_ANNEXE, lblTypeLieu, lieuxAnnexes } from './missionSchema'
import { uploadDocSejour, signedDocSejour, supprimerFichierSejour, TAILLE_MAX_DOC_SEJOUR } from './sejour'

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'l' + Date.now() + Math.random().toString(16).slice(2))

function fmtTaille(n) {
  const x = Number(n) || 0
  if (x < 1024) return `${x} o`
  if (x < 1024 * 1024) return `${Math.round(x / 1024)} ko`
  return `${(x / (1024 * 1024)).toFixed(1)} Mo`
}

function adresseDepuisLieu(src) {
  if (!src) return { pays: 'Belgique' }
  if (src.adresse && typeof src.adresse === 'object') {
    return {
      rue: src.adresse.rue || '',
      numero: src.adresse.numero || '',
      cp: src.adresse.cp || '',
      localite: src.adresse.localite || '',
      pays: src.adresse.pays || 'Belgique',
    }
  }
  return {
    rue: src.rue || '',
    numero: src.numero || '',
    cp: src.cp || '',
    localite: src.localite || '',
    pays: src.pays || 'Belgique',
  }
}

function docsDepuisLieu(src) {
  if (Array.isArray(src?.documents)) return src.documents
  if (Array.isArray(src?.data?.documents)) return src.data.documents
  return []
}

export default function DocumentsSejour({ souhaitId, m, setM, lecture = false }) {
  const lieux = lieuxAnnexes(m)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(null)
  const [connues, setConnues] = useState([])
  const [picker, setPicker] = useState(false)

  useEffect(() => {
    supabase.from('destinations_frequentes').select('*').eq('actif', true).order('nom')
      .then(({ data }) => setConnues(data || []))
  }, [])

  function setLieux(next) {
    setM(o => ({ ...o, lieux_annexes: next }))
  }
  function patch(id, p) {
    setLieux(lieux.map(l => l.id === id ? { ...l, ...p } : l))
  }
  function ajouter(type, src = null) {
    setErr(null)
    const adresse = src ? adresseDepuisLieu(src) : {}
    const documents = src ? docsDepuisLieu(src) : []
    setLieux([...lieux, {
      id: uid(),
      type: type || 'autre',
      nom: src?.nom || '',
      adresse,
      notes: src?.notes || '',
      documents,
      frequente_id: src?.via === 'Fréquente' || (!src?.categorie && src?.id && !src?.via) ? src.id : null,
      annuaire_id: src?.via === 'Annuaire' || src?.categorie ? src.id : null,
    }])
  }
  function retirer(l) {
    if (!confirm(`Retirer ${l.nom || lblTypeLieu(l.type).toLowerCase()} et ses documents ?`)) return
    ;(l.documents || []).forEach(d => { if (d?.path) supprimerFichierSejour(d.path) })
    setLieux(lieux.filter(x => x.id !== l.id))
  }

  async function memoriser(l) {
    const nom = String(l?.nom || '').trim()
    if (!nom) { alert('Indiquez un nom pour ce lieu.'); return }
    const adresse = l.adresse || {}
    const deja = (connues || []).some(d =>
      String(d.nom || '').trim().toLowerCase() === nom.toLowerCase()
      && String(d.cp || '') === String(adresse?.cp || '')
      && String(d.localite || '').toLowerCase() === String(adresse?.localite || '').toLowerCase()
    )
    if (deja) { alert('Ce lieu est déjà enregistré parmi les lieux connus.'); return }
    const { data, error } = await supabase.from('destinations_frequentes').insert({
      nom,
      rue: adresse?.rue || '',
      numero: adresse?.numero || '',
      cp: adresse?.cp || '',
      localite: adresse?.localite || '',
      pays: adresse?.pays || 'Belgique',
      telephone: '',
      notes: l.notes || '',
      documents: Array.isArray(l.documents) ? l.documents : [],
      annuaire_id: l.annuaire_id || null,
    }).select('*').single()
    if (error) { alert(error.message); return }
    if (data) {
      setConnues(list => [...list, data])
      patch(l.id, { frequente_id: data.id })
    }
    alert('Lieu connu enregistré.')
  }

  async function ajouterFichier(l, file) {
    if (!file) return
    setErr(null)
    setBusy(l.id)
    try {
      const doc = await uploadDocSejour(souhaitId, l.id, file)
      patch(l.id, { documents: [...(l.documents || []), doc] })
    } catch (e) {
      setErr(e.message || 'Envoi impossible.')
    }
    setBusy(null)
  }

  async function ouvrir(d) {
    try {
      const url = await signedDocSejour(d.path)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      setErr(e.message || 'Document inaccessible.')
    }
  }

  async function retirerFichier(l, d) {
    await supprimerFichierSejour(d.path)
    patch(l.id, { documents: (l.documents || []).filter(x => x.id !== d.id) })
  }

  return (
    <div>
      {err && <Flash kind="err">{err}</Flash>}
      {!lecture && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', margin:'12px 0 16px' }}>
          {TYPES_LIEU_ANNEXE.map(t => (
            <Btn key={t.v} kind="soft" onClick={() => ajouter(t.v)}>+ {t.l}</Btn>
          ))}
          <Btn kind="soft" onClick={() => setPicker(true)}>+ Lieu connu</Btn>
        </div>
      )}
      {lieux.length === 0 && (
        <Card>
          <div style={{ fontSize:14, color:'var(--text-muted)' }}>
            Aucun lieu ni document pour le moment. Ajoutez un hôtel, un parking, ou un lieu où vous êtes déjà allés.
          </div>
        </Card>
      )}
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        {lieux.map(l => (
          <Card key={l.id}>
            <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'flex-start', marginBottom:8 }}>
              <div style={{ fontWeight:700, color:'var(--heading)' }}>{lblTypeLieu(l.type)}</div>
              {!lecture && <Btn kind="danger" onClick={() => retirer(l)}>Retirer</Btn>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'0 16px' }}>
              <Sel
                label="Type"
                value={l.type || 'autre'}
                set={v => patch(l.id, { type: v })}
                options={TYPES_LIEU_ANNEXE}
                disabled={lecture}
              />
              <F
                label="Nom"
                value={l.nom || ''}
                set={v => patch(l.id, { nom: v })}
                placeholder={l.type === 'hotel' ? 'Ibis Liège…' : l.type === 'parking' ? 'Parking P2…' : ''}
                readOnly={lecture}
              />
            </div>
            <div style={{ marginTop:4 }}>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:6 }}>Adresse</div>
              {lecture
                ? <div style={{ fontSize:14, color:'var(--text-2)', marginBottom:10 }}>{fmtAdresse(l.adresse) || '—'}</div>
                : <AddressFields value={l.adresse} set={v => patch(l.id, { adresse: v })} />}
            </div>
            <TA
              label="Notes (accès, créneau, n° de réservation…)"
              value={l.notes || ''}
              set={v => lecture ? null : patch(l.id, { notes: v })}
              rows={2}
            />
            {!lecture && (
              <div style={{ marginBottom: 10 }}>
                <Btn kind="soft" onClick={() => memoriser(l)}>Enregistrer comme lieu connu</Btn>
              </div>
            )}
            <div style={{ fontSize:13, fontWeight:700, color:'var(--heading)', margin:'8px 0 8px' }}>Documents</div>
            {(l.documents || []).length === 0 && (
              <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:8 }}>
                Confirmation, QR, plan d’accès… PDF ou photo, {Math.round(TAILLE_MAX_DOC_SEJOUR / (1024 * 1024))} Mo max.
              </div>
            )}
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:10 }}>
              {(l.documents || []).map(d => (
                <div key={d.id} style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'center', border:'1px solid var(--border)', borderRadius:10, padding:'8px 12px' }}>
                  <button type="button" onClick={() => ouvrir(d)} style={{ background:'none', border:'none', textAlign:'left', padding:0, cursor:'pointer', color:'var(--accent)', fontWeight:600, fontSize:13.5 }}>
                    {d.nom || 'Document'}
                    <span style={{ color:'var(--text-muted)', fontWeight:400 }}> · {fmtTaille(d.size)}</span>
                  </button>
                  {!lecture && <Btn kind="soft" onClick={() => retirerFichier(l, d)}>Supprimer</Btn>}
                </div>
              ))}
            </div>
            {!lecture && <AjoutFichier busy={busy === l.id} onFile={f => ajouterFichier(l, f)} />}
          </Card>
        ))}
      </div>
      {picker && (
        <PickerLieuConnu
          connues={connues}
          onClose={() => setPicker(false)}
          onPick={src => {
            ajouter('autre', src)
            setPicker(false)
          }}
        />
      )}
    </div>
  )
}

function PickerLieuConnu({ connues, onClose, onPick }) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function chercher(e) {
    e?.preventDefault?.()
    const needle = q.trim()
    if (needle.length < 2) { setErr('Indiquez au moins 2 lettres.'); return }
    setBusy(true); setErr(null); setHits([])
    const needleLow = needle.toLowerCase()
    const locaux = []
    for (const r of connues || []) {
      if (!String(r.nom || '').toLowerCase().includes(needleLow)) continue
      locaux.push({ ...r, adresse: adresseDepuisLieu(r), documents: docsDepuisLieu(r), via: 'Fréquente' })
    }
    try {
      const { data } = await supabase.from('annuaire')
        .select('id,nom,telephone,data,categorie')
        .in('categorie', ['institution', 'externe_souhait'])
        .ilike('nom', `%${needle}%`)
        .limit(10)
      for (const r of data || []) {
        locaux.push({
          id: r.id,
          nom: r.nom,
          categorie: r.categorie,
          adresse: r.data?.adresse || null,
          documents: Array.isArray(r.data?.documents) ? r.data.documents : [],
          notes: r.data?.notes || '',
          via: 'Annuaire',
        })
      }
    } catch { /* optionnel */ }
    setHits(locaux)
    setBusy(false)
    if (!locaux.length) setErr('Aucun lieu connu. Encodez-le à la main, puis enregistrez-le.')
  }

  return (
    <Modal title="Lieu déjà connu" onClose={onClose} footer={<Btn kind="soft" onClick={onClose}>Fermer</Btn>}>
      <p style={{ margin: '0 0 10px', fontSize: 13.5, color: 'var(--text-muted)' }}>
        Recherchez un endroit où Heart’s Angels est déjà passé (destinations fréquentes + annuaire).
      </p>
      <form onSubmit={chercher} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 220px' }}>
          <F label="Nom du lieu" value={q} set={setQ} />
        </div>
        <Btn onClick={chercher} disabled={busy} style={{ marginBottom: 10 }}>{busy ? '…' : 'Rechercher'}</Btn>
      </form>
      {err && <Flash kind="warn">{err}</Flash>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {hits.map((h, i) => (
          <button
            key={(h.id || h.nom) + i}
            type="button"
            onClick={() => onPick(h)}
            style={{
              textAlign: 'left', border: '1px solid var(--border)', borderRadius: 12,
              padding: '10px 12px', background: 'var(--bg-alt)', cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--heading)' }}>{h.nom}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              {h.via} · {fmtAdresse(h.adresse) || 'Adresse à compléter'}
            </div>
          </button>
        ))}
      </div>
    </Modal>
  )
}

function AjoutFichier({ busy, onFile }) {
  const ref = useRef(null)
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="application/pdf,image/*"
        style={{ display:'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onFile(f)
        }}
      />
      <Btn kind="soft" disabled={busy} onClick={() => ref.current?.click()}>
        {busy ? 'Envoi…' : '+ Joindre un document'}
      </Btn>
    </>
  )
}
