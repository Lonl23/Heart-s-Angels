import { useState, useEffect, useCallback } from 'react'
import { supabase, uploadFile, logAccess } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { notifyHierarchy } from '@/hooks/useNotifications'

const PHOTO_MAX = 10

const PHOTO_TYPES = [
  { value: 'vehicule_avant',   label: 'Avant' },
  { value: 'vehicule_arriere', label: 'Arrière' },
  { value: 'vehicule_gauche',  label: 'Gauche' },
  { value: 'vehicule_droite',  label: 'Droite' },
  { value: 'interieur',        label: 'Intérieur' },
  { value: 'degat',            label: 'Dégât constaté' },
  { value: 'equipement',       label: 'Équipement' },
  { value: 'autre',            label: 'Autre' },
]

export default function ChecklistForm({ souhait, type, onClose, onSubmitted }) {
  const { profile } = useAuth()
  const [items, setItems]           = useState([])
  const [reponses, setReponses]     = useState({})
  const [kmDepart, setKmDepart]     = useState('')
  const [kmRetour, setKmRetour]     = useState('')
  const [observations, setObs]      = useState('')
  const [degats, setDegats]         = useState(false)
  const [degatsDesc, setDegatsDesc] = useState('')
  const [photos, setPhotos]         = useState([])  // { file, preview, type, description }
  const [freeItems, setFreeItems]   = useState([])  // items libres ajoutés
  const [newFreeItem, setNewFreeItem] = useState('')
  const [loading, setLoading]       = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [errors, setErrors]         = useState({})

  // Charger les items de check-list
  useEffect(() => {
    supabase.from('checklist_items')
      .select('*')
      .eq('actif', true)
      .order('categorie').order('ordre')
      .then(({ data }) => {
        setItems(data || [])
        // Initialiser les réponses (obligatoires = false par défaut)
        const init = {}
        ;(data || []).forEach(i => { init[i.id] = { valeur: false, commentaire: '' } })
        setReponses(init)
      })
  }, [])

  // Vérification : l'utilisateur est bien assigné au souhait
  useEffect(() => {
    if (!souhait?.id || !profile?.id) return
    logAccess('READ', 'checklists', souhait.id)
  }, [souhait?.id, profile?.id])

  const categories = [...new Set(items.map(i => i.categorie))]

  function toggleItem(id) {
    setReponses(prev => ({
      ...prev,
      [id]: { ...prev[id], valeur: !prev[id]?.valeur }
    }))
  }

  function setComment(id, text) {
    setReponses(prev => ({
      ...prev,
      [id]: { ...prev[id], commentaire: text }
    }))
  }

  function addFreeItem() {
    const label = newFreeItem.trim()
    if (!label) return
    setFreeItems(prev => [...prev, { id: 'free_' + Date.now(), label, valeur: false, commentaire: '' }])
    setNewFreeItem('')
  }

  function toggleFreeItem(id) {
    setFreeItems(prev => prev.map(i => i.id === id ? { ...i, valeur: !i.valeur } : i))
  }

  function removeFreeItem(id) {
    setFreeItems(prev => prev.filter(i => i.id !== id))
  }

  // Gestion photos
  function handlePhotoAdd(e) {
    const files = Array.from(e.target.files)
    const remaining = PHOTO_MAX - photos.length
    if (files.length > remaining) {
      alert(`Maximum ${PHOTO_MAX} photos. Vous pouvez encore en ajouter ${remaining}.`)
    }
    files.slice(0, remaining).forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        setPhotos(prev => [...prev, {
          file,
          preview: ev.target.result,
          type: 'autre',
          description: ''
        }])
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  function removePhoto(idx) {
    setPhotos(prev => prev.filter((_, i) => i !== idx))
  }

  function updatePhoto(idx, field, value) {
    setPhotos(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  // Validation avant soumission
  function validate() {
    const errs = {}
    if (type === 'depart' && !kmDepart) errs.kmDepart = 'Km départ obligatoire'
    if (type === 'retour' && !kmRetour) errs.kmRetour = 'Km retour obligatoire'
    if (degats && !degatsDesc.trim()) errs.degats = 'Décrivez les dégâts constatés'
    // Vérifier items obligatoires
    const obligatoires = items.filter(i => i.obligatoire)
    const manquants = obligatoires.filter(i => !reponses[i.id]?.valeur)
    if (manquants.length > 0) {
      errs.obligatoires = `${manquants.length} item(s) obligatoire(s) non cochés : ${manquants.map(i => i.libelle).join(', ')}`
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setLoading(true)
    try {
      // 1. Créer la checklist
      const { data: cl, error: clErr } = await supabase
        .from('checklists')
        .insert({
          souhait_id:   souhait.id,
          user_id:      profile.id,
          type,
          km_depart:    kmDepart ? parseFloat(kmDepart) : null,
          km_retour:    kmRetour ? parseFloat(kmRetour) : null,
          observations,
          degats_constates: degats,
          degats_description: degats ? degatsDesc : null,
        })
        .select().single()
      if (clErr) throw clErr

      // 2. Sauvegarder les réponses aux items fixes
      const reponsesInsert = items.map(item => ({
        checklist_id: cl.id,
        item_id:      item.id,
        valeur:       reponses[item.id]?.valeur ?? false,
        commentaire:  reponses[item.id]?.commentaire || null,
      }))

      // 3. Ajouter les items libres
      freeItems.forEach(fi => {
        reponsesInsert.push({
          checklist_id: cl.id,
          item_id:      null,
          item_libre:   fi.label,
          valeur:       fi.valeur,
          commentaire:  fi.commentaire || null,
        })
      })

      await supabase.from('checklist_reponses').insert(reponsesInsert)

      // 4. Upload des photos
      if (photos.length > 0) {
        setUploading(true)
        const photoInserts = []
        for (let idx = 0; idx < photos.length; idx++) {
          const p = photos[idx]
          const ext  = p.file.name.split('.').pop()
          const path = `souhaits/${souhait.id}/checklists/${cl.id}/photo_${idx + 1}.${ext}`
          const url  = await uploadFile('checklist-photos', path, p.file, {
            contentType: p.file.type,
          })
          photoInserts.push({
            checklist_id: cl.id,
            storage_path: path,
            url,
            type_photo:   p.type,
            description:  p.description || null,
            ordre:        idx + 1,
          })
        }
        await supabase.from('checklist_photos').insert(photoInserts)
        setUploading(false)
      }

      // 5. Audit log
      await logAccess('CREATE', 'checklists', cl.id)

      // 6. Notification N+1 et N+2
      const kmInfo = type === 'retour' && kmDepart && kmRetour
        ? ` · ${(parseFloat(kmRetour) - parseFloat(kmDepart)).toFixed(1)} km parcourus`
        : ''
      await notifyHierarchy(
        'checklist_soumise',
        `Check-list ${type} soumise — ${souhait.beneficiaire_prenom} ${souhait.beneficiaire_nom}`,
        `${profile.prenom} ${profile.nom} a soumis la check-list de ${type}${kmInfo}${degats ? ' · ⚠️ DÉGÂTS CONSTATÉS' : ''}`,
        `/souhaits/${souhait.id}`,
        profile.id,
        souhait.id
      )

      onSubmitted?.(cl)
      onClose?.()
    } catch (err) {
      console.error(err)
      alert('Erreur lors de la soumission : ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const catLabels = {
    vehicule: '🚐 Véhicule',
    medical:  '🏥 Médical',
    hygiene:  '🧤 Hygiène',
    materiel: '♿ Matériel',
  }

  return (
    <div className="checklist-form">
      <div className="cf-header">
        <h2>Check-list de {type === 'depart' ? 'départ' : 'retour'}</h2>
        <p className="cf-sub">
          {souhait.beneficiaire_prenom} {souhait.beneficiaire_nom} — {souhait.localisation}
        </p>
      </div>

      {/* KM */}
      <section className="cf-section">
        <h3>📍 Kilométrage</h3>
        <div className="cf-row-2">
          <div className="cf-field">
            <label>Km départ {type === 'depart' && <span className="req">*</span>}</label>
            <input type="number" value={kmDepart} onChange={e => setKmDepart(e.target.value)}
              placeholder="Ex: 54320" min="0" step="0.1" />
            {errors.kmDepart && <span className="err">{errors.kmDepart}</span>}
          </div>
          <div className="cf-field">
            <label>Km retour {type === 'retour' && <span className="req">*</span>}</label>
            <input type="number" value={kmRetour} onChange={e => setKmRetour(e.target.value)}
              placeholder="Ex: 54520" min="0" step="0.1" />
            {errors.kmRetour && <span className="err">{errors.kmRetour}</span>}
          </div>
        </div>
        {kmDepart && kmRetour && (
          <div className="km-total">
            Total : <strong>{(parseFloat(kmRetour) - parseFloat(kmDepart)).toFixed(1)} km</strong>
            <span> — Défraiement estimé : <strong>{((parseFloat(kmRetour) - parseFloat(kmDepart)) * 0.4201).toFixed(2)} €</strong></span>
          </div>
        )}
      </section>

      {/* ITEMS PAR CATÉGORIE */}
      {errors.obligatoires && (
        <div className="cf-error-banner">⚠️ {errors.obligatoires}</div>
      )}

      {categories.map(cat => (
        <section className="cf-section" key={cat}>
          <h3>{catLabels[cat] || cat}</h3>
          {items.filter(i => i.categorie === cat).map(item => (
            <div className={`cf-item ${reponses[item.id]?.valeur ? 'checked' : ''}`} key={item.id}>
              <label className="cf-check-label">
                <input
                  type="checkbox"
                  checked={reponses[item.id]?.valeur ?? false}
                  onChange={() => toggleItem(item.id)}
                />
                <span className="cf-check-text">
                  {item.libelle}
                  {item.obligatoire && <span className="req" title="Obligatoire"> *</span>}
                </span>
              </label>
              {reponses[item.id]?.valeur && (
                <input
                  className="cf-comment"
                  type="text"
                  placeholder="Commentaire (optionnel)"
                  value={reponses[item.id]?.commentaire}
                  onChange={e => setComment(item.id, e.target.value)}
                />
              )}
            </div>
          ))}
        </section>
      ))}

      {/* ITEMS LIBRES */}
      <section className="cf-section">
        <h3>➕ Items supplémentaires</h3>
        {freeItems.map(fi => (
          <div className={`cf-item ${fi.valeur ? 'checked' : ''}`} key={fi.id}>
            <label className="cf-check-label">
              <input type="checkbox" checked={fi.valeur} onChange={() => toggleFreeItem(fi.id)} />
              <span className="cf-check-text">{fi.label}</span>
            </label>
            <button className="cf-remove-btn" onClick={() => removeFreeItem(fi.id)}>✕</button>
          </div>
        ))}
        <div className="cf-add-free">
          <input
            type="text"
            value={newFreeItem}
            onChange={e => setNewFreeItem(e.target.value)}
            placeholder="Ajouter un item..."
            onKeyDown={e => e.key === 'Enter' && addFreeItem()}
          />
          <button onClick={addFreeItem} disabled={!newFreeItem.trim()}>Ajouter</button>
        </div>
      </section>

      {/* DÉGÂTS */}
      <section className="cf-section">
        <h3>⚠️ Dégâts constatés</h3>
        <label className="cf-check-label">
          <input type="checkbox" checked={degats} onChange={e => setDegats(e.target.checked)} />
          <span className="cf-check-text">Des dégâts ont été constatés sur le véhicule</span>
        </label>
        {degats && (
          <div className="cf-field" style={{ marginTop: 8 }}>
            <textarea
              value={degatsDesc}
              onChange={e => setDegatsDesc(e.target.value)}
              placeholder="Décrivez les dégâts constatés (localisation, nature, gravité)..."
              rows={3}
            />
            {errors.degats && <span className="err">{errors.degats}</span>}
          </div>
        )}
      </section>

      {/* PHOTOS */}
      <section className="cf-section">
        <h3>📷 Photos ({photos.length}/{PHOTO_MAX})</h3>
        <p className="cf-hint">Photos du véhicule avant/après, dégâts, équipements. Maximum {PHOTO_MAX} photos.</p>

        {photos.length < PHOTO_MAX && (
          <label className="cf-upload-btn">
            <input type="file" accept="image/*" multiple onChange={handlePhotoAdd} style={{ display: 'none' }} />
            📷 Ajouter des photos
          </label>
        )}

        {photos.length > 0 && (
          <div className="cf-photos-grid">
            {photos.map((p, idx) => (
              <div className="cf-photo-card" key={idx}>
                <img src={p.preview} alt={`Photo ${idx + 1}`} />
                <div className="cf-photo-meta">
                  <select value={p.type} onChange={e => updatePhoto(idx, 'type', e.target.value)}>
                    {PHOTO_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Description..."
                    value={p.description}
                    onChange={e => updatePhoto(idx, 'description', e.target.value)}
                  />
                </div>
                <button className="cf-photo-remove" onClick={() => removePhoto(idx)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* OBSERVATIONS */}
      <section className="cf-section">
        <h3>📝 Observations générales</h3>
        <textarea
          value={observations}
          onChange={e => setObs(e.target.value)}
          placeholder="Observations, incidents, remarques particulières..."
          rows={4}
        />
      </section>

      {/* ACTIONS */}
      <div className="cf-footer">
        <button className="btn-secondary" onClick={onClose} disabled={loading}>Annuler</button>
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={loading || uploading}
        >
          {loading ? 'Enregistrement...' : uploading ? 'Upload photos...' : '✓ Soumettre la check-list'}
        </button>
      </div>
    </div>
  )
}

// ── Composant lecture seule d'une check-list soumise ─────────────────────────
export function ChecklistView({ checklistId }) {
  const [checklist, setChecklist] = useState(null)
  const [reponses, setReponses]   = useState([])
  const [photos, setPhotos]       = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: cl }, { data: rep }, { data: ph }] = await Promise.all([
        supabase.from('checklists').select('*, profiles(prenom,nom,role)').eq('id', checklistId).single(),
        supabase.from('checklist_reponses').select('*, checklist_items(libelle,categorie,obligatoire)')
          .eq('checklist_id', checklistId).order('checklist_items(ordre)'),
        supabase.from('checklist_photos').select('*').eq('checklist_id', checklistId).order('ordre'),
      ])
      setChecklist(cl)
      setReponses(rep || [])
      setPhotos(ph || [])
      setLoading(false)
      await logAccess('READ', 'checklists', checklistId)
    }
    load()
  }, [checklistId])

  if (loading) return <div className="loading">Chargement...</div>
  if (!checklist) return <div>Introuvable</div>

  const categories = [...new Set(reponses.map(r => r.checklist_items?.categorie).filter(Boolean))]

  return (
    <div className="checklist-view">
      <div className="cv-header">
        <h3>Check-list de {checklist.type} — {new Date(checklist.soumis_a).toLocaleString('fr-BE')}</h3>
        <p>Par {checklist.profiles?.prenom} {checklist.profiles?.nom}</p>
        {checklist.km_total && (
          <div className="cv-km">
            {checklist.km_depart} km → {checklist.km_retour} km
            = <strong>{checklist.km_total} km</strong>
          </div>
        )}
      </div>

      {categories.map(cat => {
        const catRep = reponses.filter(r => r.checklist_items?.categorie === cat)
        return (
          <div className="cv-section" key={cat}>
            <h4>{cat}</h4>
            {catRep.map(r => (
              <div className={`cv-item ${r.valeur ? 'ok' : 'ko'}`} key={r.id}>
                <span>{r.valeur ? '✓' : '✗'}</span>
                <span>{r.checklist_items?.libelle || r.item_libre}</span>
                {r.commentaire && <span className="cv-comment">{r.commentaire}</span>}
              </div>
            ))}
          </div>
        )
      })}

      {checklist.degats_constates && (
        <div className="cv-degats">
          <h4>⚠️ Dégâts constatés</h4>
          <p>{checklist.degats_description}</p>
        </div>
      )}

      {photos.length > 0 && (
        <div className="cv-photos">
          <h4>Photos ({photos.length})</h4>
          <div className="cv-photos-grid">
            {photos.map(p => (
              <div className="cv-photo" key={p.id}>
                <a href={p.url} target="_blank" rel="noopener noreferrer">
                  <img src={p.url} alt={p.description || p.type_photo} />
                </a>
                <span>{p.type_photo}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {checklist.observations && (
        <div className="cv-obs">
          <h4>Observations</h4>
          <p>{checklist.observations}</p>
        </div>
      )}
    </div>
  )
}
