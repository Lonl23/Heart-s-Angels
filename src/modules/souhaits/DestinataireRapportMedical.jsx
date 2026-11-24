import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { F, inp } from '@/components/ui'
import { chercherContactsPluri, upsertContactMedical, telFicheAnnuaire } from '@/modules/annuaire/annuaireApi'

function emailAnnuaire(r) {
  return String(r?.email || r?.data?.email || '').trim()
}

function nomContact(c) {
  return [c?.prenom, c?.nom].filter(Boolean).join(' ').trim() || c?.libelle || 'Contact'
}

/**
 * Destinataire : 1) contacts médicaux du souhait, 2) annuaire, 3) nouveau
 * (enregistrement facultatif dans l’annuaire).
 *
 * `value` = { prenom, nom, email, telephone?, annuaire_id?, source?, sauverAnnuaire? }
 */
export default function DestinataireRapportMedical({
  souhaitId,
  souhait,
  value,
  onChange,
  disabled,
}) {
  const [contactsSouhait, setContactsSouhait] = useState([])
  const [mode, setMode] = useState('souhait')
  const [q, setQ] = useState('')
  const [hits, setHits] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const form = value || { prenom: '', nom: '', email: '', sauverAnnuaire: true }

  useEffect(() => {
    let stop = false
    ;(async () => {
      const out = []
      const { data: extras } = await supabase
        .from('souhait_contacts_extra')
        .select('id, libelle, nom, email, telephone')
        .eq('souhait_id', souhaitId)
      for (const e of extras || []) {
        const email = String(e.email || '').trim()
        if (!email.includes('@')) continue
        const parts = String(e.nom || '').trim().split(/\s+/)
        out.push({
          cle: `extra-${e.id}`,
          source: 'souhait',
          prenom: parts[0] || e.libelle || '',
          nom: parts.slice(1).join(' ') || (parts[0] ? '' : e.libelle || ''),
          email,
          telephone: e.telephone || '',
          label: e.libelle || e.nom || email,
        })
      }
      const pluri = souhait?.mission?.equipe_pluri || []
      const ids = pluri.map(p => p.annuaire_id).filter(Boolean)
      let emailParId = {}
      if (ids.length) {
        const { data: rows } = await supabase.from('annuaire').select('id, data').in('id', ids)
        for (const r of rows || []) {
          const em = String(r?.data?.email || '').trim()
          if (em.includes('@')) emailParId[r.id] = em
        }
      }
      for (const p of pluri) {
        const email = String(p.email || emailParId[p.annuaire_id] || '').trim()
        if (!email.includes('@')) continue
        out.push({
          cle: `pluri-${p.annuaire_id || `${p.prenom}-${p.nom}-${email}`}`,
          source: 'souhait',
          prenom: p.prenom || '',
          nom: p.nom || '',
          email,
          telephone: p.tel || p.telephone || '',
          annuaire_id: p.annuaire_id || null,
          label: [p.prenom, p.nom, p.organisme || p.role].filter(Boolean).join(' '),
        })
      }
      const seen = new Set()
      const uniq = []
      for (const c of out) {
        const k = c.email.toLowerCase()
        if (seen.has(k)) continue
        seen.add(k)
        uniq.push(c)
      }
      if (!stop) {
        setContactsSouhait(uniq)
        if (uniq.length === 0) setMode(m => (m === 'souhait' ? 'annuaire' : m))
      }
    })()
    return () => { stop = true }
  }, [souhaitId, souhait?.mission?.equipe_pluri])

  useEffect(() => {
    if (mode !== 'annuaire') return
    let stop = false
    setBusy(true)
    const t = setTimeout(() => {
      chercherContactsPluri(q).then(rows => {
        if (stop) return
        setHits((rows || []).map(r => ({
          cle: `ann-${r.id}`,
          source: 'annuaire',
          prenom: r.prenom || '',
          nom: r.nom || '',
          email: emailAnnuaire(r),
          telephone: telFicheAnnuaire(r),
          annuaire_id: r.id,
          label: [r.prenom, r.nom, r.type_lib, r.organisme].filter(Boolean).join(' '),
        })))
        setBusy(false)
      }).catch(e => {
        if (!stop) { setErr(e.message || String(e)); setBusy(false) }
      })
    }, q ? 280 : 0)
    return () => { stop = true; clearTimeout(t) }
  }, [mode, q])

  function choisir(c) {
    onChange({
      prenom: c.prenom || '',
      nom: c.nom || '',
      email: c.email || '',
      telephone: c.telephone || '',
      annuaire_id: c.annuaire_id || null,
      source: c.source,
      sauverAnnuaire: false,
    })
    setErr(null)
  }

  const avecEmail = useMemo(
    () => (hits || []).filter(h => String(h.email || '').includes('@')),
    [hits],
  )

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {[
          { v: 'souhait', l: 'Contacts du souhait' },
          { v: 'annuaire', l: 'Annuaire médical' },
          { v: 'nouveau', l: 'Nouveau destinataire' },
        ].map(o => (
          <button
            key={o.v}
            type="button"
            className={'ha-tab' + (mode === o.v ? ' is-on' : '')}
            onClick={() => {
              setMode(o.v)
              if (o.v === 'nouveau') {
                onChange({
                  prenom: '', nom: '', email: '', telephone: '',
                  source: 'nouveau', sauverAnnuaire: true,
                })
              }
            }}
            disabled={disabled}
            style={{ fontSize: 13 }}
          >{o.l}</button>
        ))}
      </div>

      {err && <p style={{ color: '#A32D2D', fontSize: 13 }}>{err}</p>}

      {mode === 'souhait' && (
        contactsSouhait.length === 0 ? (
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
            Aucun contact médical avec e-mail sur ce souhait. Choisissez l’annuaire ou un nouveau destinataire.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {contactsSouhait.map(c => {
              const on = form.email?.toLowerCase() === c.email.toLowerCase()
              return (
                <button
                  key={c.cle}
                  type="button"
                  disabled={disabled}
                  onClick={() => choisir(c)}
                  style={{
                    textAlign: 'left', border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                    background: on ? 'var(--bg-alt)' : 'var(--card)', borderRadius: 12, padding: '10px 12px', cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{c.label || nomContact(c)}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{c.email}{c.telephone ? ` · ${c.telephone}` : ''}</div>
                </button>
              )
            })}
          </div>
        )
      )}

      {mode === 'annuaire' && (
        <div style={{ marginBottom: 12 }}>
          <input
            className="ha-search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Nom, prénom ou numéro…"
            disabled={disabled}
            style={{ width: '100%', marginBottom: 8 }}
          />
          {busy && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Recherche…</p>}
          {!busy && avecEmail.length === 0 && (
            <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
              {q ? 'Aucun contact médical avec e-mail pour cette recherche.' : 'Saisissez un nom pour chercher dans l’annuaire.'}
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {avecEmail.map(c => {
              const on = form.email?.toLowerCase() === c.email.toLowerCase()
              return (
                <button
                  key={c.cle}
                  type="button"
                  disabled={disabled}
                  onClick={() => choisir(c)}
                  style={{
                    textAlign: 'left', border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                    background: on ? 'var(--bg-alt)' : 'var(--card)', borderRadius: 12, padding: '10px 12px', cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{c.label || nomContact(c)}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{c.email}{c.telephone ? ` · ${c.telephone}` : ''}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {mode === 'nouveau' && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
            <F label="Prénom" value={form.prenom} set={v => onChange({ ...form, prenom: v, source: 'nouveau' })} required disabled={disabled} />
            <F label="Nom" value={form.nom} set={v => onChange({ ...form, nom: v, source: 'nouveau' })} required disabled={disabled} />
          </div>
          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>Adresse e-mail</label>
          <input
            type="email"
            required
            disabled={disabled}
            value={form.email || ''}
            onChange={e => onChange({ ...form, email: e.target.value, source: 'nouveau' })}
            placeholder="ex. medecin@hopital.be"
            style={{ ...inp, margin: '6px 0 10px' }}
          />
          <F
            label="Téléphone (optionnel)"
            value={form.telephone || ''}
            set={v => onChange({ ...form, telephone: v, source: 'nouveau' })}
            disabled={disabled}
          />
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5, marginTop: 8 }}>
            <input
              type="checkbox"
              checked={form.sauverAnnuaire !== false}
              onChange={e => onChange({ ...form, sauverAnnuaire: e.target.checked, source: 'nouveau' })}
              disabled={disabled}
            />
            Enregistrer aussi dans l’annuaire médical
          </label>
        </div>
      )}

      {(mode === 'souhait' || mode === 'annuaire') && form.email && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 0 }}>
          Destinataire sélectionné : <strong>{nomContact(form)}</strong> ({form.email})
        </p>
      )}
    </div>
  )
}

/** Sauvegarde annuaire si nouveau + option cochée. */
export async function preparerDestinataireAvantEnvoi(form) {
  const prenom = String(form?.prenom || '').trim()
  const nom = String(form?.nom || '').trim()
  const email = String(form?.email || '').trim()
  if (!prenom || !nom) return { ok: false, error: 'Indiquez le prénom et le nom du destinataire.' }
  if (!email.includes('@')) return { ok: false, error: 'Adresse e-mail manquante ou invalide.' }
  if (form?.source === 'nouveau' && form?.sauverAnnuaire !== false) {
    try {
      const id = await upsertContactMedical({
        prenom, nom, tel: form.telephone, email, role: 'medecin',
      })
      return { ok: true, form: { ...form, prenom, nom, email, annuaire_id: id } }
    } catch (e) {
      return { ok: false, error: e.message || String(e) }
    }
  }
  return { ok: true, form: { ...form, prenom, nom, email } }
}
