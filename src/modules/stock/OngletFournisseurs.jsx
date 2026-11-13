import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, Btn, F, Sel, TA, PhoneF, Empty } from '@/components/ui'

function nomContact(c) {
  return [c.prenom, c.nom].filter(Boolean).join(' ') || 'Contact'
}

export default function OngletFournisseurs({ fournisseurs, cats, onChange, onRefresh, onOk, onErr }) {
  const [edit, setEdit] = useState(null)
  async function supprimer(f) {
    const n = (cats || []).filter(c => c.fournisseur_id === f.id).length
    if (!confirm(n
      ? `Retirer « ${f.nom} » ? ${n} type(s) d’article y restent liés (le lien sera enlevé).`
      : `Supprimer le fournisseur « ${f.nom} » ?`)) return
    const { error } = await supabase.from('stock_fournisseurs').update({ actif: false }).eq('id', f.id)
    if (error) { onErr?.(error.message); return }
    onOk?.('Fournisseur retiré.')
    onChange()
  }
  const liste = (fournisseurs || []).filter(f => f.actif !== false)
  return (
    <div>
      <Btn onClick={() => setEdit({ nom: '', adresse: '', notes: '' })} style={{ marginBottom: 12 }}>+ Fournisseur</Btn>
      {edit && (
        <FicheFournisseur
          item={edit}
          cats={cats}
          onClose={() => setEdit(null)}
          onRefresh={onRefresh || onChange}
          onOk={onOk}
          onErr={onErr}
        />
      )}
      {liste.length === 0 ? <Empty title="Aucun fournisseur" hint="Enregistrez les sociétés chez qui vous commandez, leurs contacts et leurs sites." /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {liste.map(f => {
            const articles = (cats || []).filter(c => c.fournisseur_id === f.id)
            const contacts = f.stock_fournisseur_contacts || []
            const premier = contacts[0]
            return (
              <Card key={f.id} style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{f.nom}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                      {premier
                        ? [nomContact(premier), premier.telephone, premier.email].filter(Boolean).join(' · ')
                        : ([f.contact, f.telephone, f.email].filter(Boolean).join(' · ') || 'Pas de contact')}
                      {contacts.length > 1 ? ` · ${contacts.length} contacts` : ''}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>
                      {articles.length ? `${articles.length} article${articles.length > 1 ? 's' : ''}` : 'Aucun article lié'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn kind="soft" onClick={() => setEdit(f)} style={{ padding: '5px 10px' }}>Ouvrir</Btn>
                    <Btn kind="danger" onClick={() => supprimer(f)} style={{ padding: '5px 10px' }}>Supprimer</Btn>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FicheFournisseur({ item, cats, onClose, onRefresh, onOk, onErr }) {
  const [f, setF] = useState({ ...item })
  const [saving, setSaving] = useState(false)
  const [contacts, setContacts] = useState(item.stock_fournisseur_contacts || [])
  const [acces, setAcces] = useState([])
  const [contactEdit, setContactEdit] = useState(null)
  const [accesEdit, setAccesEdit] = useState(null)
  const [articleId, setArticleId] = useState('')

  useEffect(() => {
    if (!f.id) return
    supabase.from('stock_fournisseur_contacts').select('*').eq('fournisseur_id', f.id).order('ordre').order('created_at')
      .then(({ data, error }) => { if (!error) setContacts(data || []) })
    supabase.from('stock_fournisseur_acces').select('*').eq('fournisseur_id', f.id).order('libelle')
      .then(({ data, error }) => { if (!error && data) setAcces(data) })
  }, [f.id])

  async function sauverSociete() {
    if (!f.nom?.trim()) { onErr?.('Nom du fournisseur requis.'); return }
    setSaving(true)
    const payload = {
      nom: f.nom.trim(),
      adresse: f.adresse?.trim() || null,
      notes: f.notes?.trim() || null,
      actif: true,
    }
    const q = f.id
      ? await supabase.from('stock_fournisseurs').update(payload).eq('id', f.id).select('id').single()
      : await supabase.from('stock_fournisseurs').insert(payload).select('id').single()
    setSaving(false)
    if (q.error) { onErr?.(q.error.message); return }
    if (!f.id) setF(s => ({ ...s, id: q.data.id }))
    onOk?.('Fournisseur enregistré.')
    onRefresh?.()
  }

  async function recopierPremier(liste) {
    const c = liste[0] || {}
    await supabase.from('stock_fournisseurs').update({
      contact: [c.prenom, c.nom].filter(Boolean).join(' ') || null,
      telephone: c.telephone || null,
      email: c.email || null,
    }).eq('id', f.id)
  }

  async function sauverContact(c) {
    if (![c.prenom, c.nom, c.telephone, c.email].some(x => (x || '').trim())) {
      onErr?.('Indiquez au moins un nom, un téléphone ou un e-mail.')
      return
    }
    const payload = {
      fournisseur_id: f.id,
      prenom: c.prenom?.trim() || null,
      nom: c.nom?.trim() || null,
      telephone: c.telephone?.trim() || null,
      email: c.email?.trim() || null,
      ordre: Number(c.ordre) || contacts.length,
    }
    const q = c.id
      ? await supabase.from('stock_fournisseur_contacts').update(payload).eq('id', c.id).select('*').single()
      : await supabase.from('stock_fournisseur_contacts').insert(payload).select('*').single()
    if (q.error) { onErr?.(q.error.message); return }
    const liste = c.id ? contacts.map(x => x.id === c.id ? q.data : x) : [...contacts, q.data]
    setContacts(liste)
    setContactEdit(null)
    await recopierPremier(liste)
    onOk?.('Contact enregistré.')
    onRefresh?.()
  }

  async function retirerContact(c) {
    if (!confirm(`Retirer ${nomContact(c)} ?`)) return
    const { error } = await supabase.from('stock_fournisseur_contacts').delete().eq('id', c.id)
    if (error) { onErr?.(error.message); return }
    const liste = contacts.filter(x => x.id !== c.id)
    setContacts(liste)
    await recopierPremier(liste)
    onRefresh?.()
  }

  async function sauverAcces(a) {
    if (!a.libelle?.trim()) { onErr?.('Nom du site requis.'); return }
    const payload = {
      fournisseur_id: f.id,
      libelle: a.libelle.trim(),
      url: a.url?.trim() || null,
      identifiant: a.identifiant?.trim() || null,
      mot_de_passe: a.mot_de_passe || null,
      notes: a.notes?.trim() || null,
    }
    const q = a.id
      ? await supabase.from('stock_fournisseur_acces').update(payload).eq('id', a.id).select('*').single()
      : await supabase.from('stock_fournisseur_acces').insert(payload).select('*').single()
    if (q.error) { onErr?.(q.error.message); return }
    setAcces(a.id ? acces.map(x => x.id === a.id ? q.data : x) : [...acces, q.data])
    setAccesEdit(null)
    onOk?.('Site enregistré.')
  }

  async function retirerAcces(a) {
    if (!confirm(`Retirer le site « ${a.libelle} » ?`)) return
    const { error } = await supabase.from('stock_fournisseur_acces').delete().eq('id', a.id)
    if (error) { onErr?.(error.message); return }
    setAcces(acces.filter(x => x.id !== a.id))
  }

  async function lierArticle() {
    if (!articleId) return
    const art = (cats || []).find(c => c.id === articleId)
    if (art?.fournisseur_id && art.fournisseur_id !== f.id) {
      if (!confirm(`« ${art.nom} » est déjà lié à un autre fournisseur. Le déplacer vers ${f.nom} ?`)) return
    }
    const { error } = await supabase.from('stock_catalogue').update({ fournisseur_id: f.id }).eq('id', articleId)
    if (error) { onErr?.(error.message); return }
    setArticleId('')
    onOk?.('Article associé.')
    onRefresh?.()
  }

  async function delierArticle(c) {
    const { error } = await supabase.from('stock_catalogue').update({ fournisseur_id: null }).eq('id', c.id)
    if (error) { onErr?.(error.message); return }
    onOk?.('Article retiré de ce fournisseur.')
    onRefresh?.()
  }

  const lies = (cats || []).filter(c => c.fournisseur_id === f.id)
  const autres = (cats || []).filter(c => c.fournisseur_id !== f.id)

  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
        <strong>{f.id ? f.nom || 'Fournisseur' : 'Nouveau fournisseur'}</strong>
        <Btn kind="soft" onClick={onClose}>Fermer</Btn>
      </div>

      <F label="Nom de la société" value={f.nom} set={v => setF(s => ({ ...s, nom: v }))} required />
      <F label="Adresse" value={f.adresse || ''} set={v => setF(s => ({ ...s, adresse: v }))} />
      <TA label="Notes (délais, conditions, n° client…)" value={f.notes || ''} set={v => setF(s => ({ ...s, notes: v }))} rows={2} />
      <Btn onClick={sauverSociete} disabled={saving} style={{ width: '100%', marginBottom: 16 }}>{saving ? '…' : 'Enregistrer la société'}</Btn>

      {!f.id && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Enregistrez la société pour ajouter les contacts, les sites et les articles.</p>}

      {f.id && (
        <>
          <Bloc titre="Contacts">
            {contacts.length === 0 && <Vide>Aucun contact.</Vide>}
            {contacts.map(c => (
              <Ligne key={c.id} titre={nomContact(c)} detail={[c.telephone, c.email].filter(Boolean).join(' · ')}>
                <Btn kind="soft" onClick={() => setContactEdit(c)} style={{ padding: '4px 10px' }}>Modifier</Btn>
                <Btn kind="danger" onClick={() => retirerContact(c)} style={{ padding: '4px 10px' }}>Retirer</Btn>
              </Ligne>
            ))}
            {contactEdit && (
              <FormContact
                item={contactEdit}
                onSave={sauverContact}
                onCancel={() => setContactEdit(null)}
              />
            )}
            {!contactEdit && <Btn kind="soft" onClick={() => setContactEdit({ prenom: '', nom: '', telephone: '', email: '' })}>+ Contact</Btn>}
          </Bloc>

          <Bloc titre="Sites de commande">
            <p style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--text-muted)' }}>
              Adresse du site, identifiant et mot de passe. Visibles par l’équipe logistique, masqués tant qu’on ne les affiche pas. Ils ne partent pas dans l’Excel.
            </p>
            {acces.length === 0 && <Vide>Aucun site.</Vide>}
            {acces.map(a => (
              <div key={a.id} style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{a.libelle}</div>
                    {a.url && <a href={a.url.startsWith('http') ? a.url : `https://${a.url}`} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>{a.url}</a>}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn kind="soft" onClick={() => setAccesEdit(a)} style={{ padding: '4px 10px' }}>Modifier</Btn>
                    <Btn kind="danger" onClick={() => retirerAcces(a)} style={{ padding: '4px 10px' }}>Retirer</Btn>
                  </div>
                </div>
                <Secret label="Identifiant" value={a.identifiant} />
                <Secret label="Mot de passe" value={a.mot_de_passe} />
                {a.notes && <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{a.notes}</div>}
              </div>
            ))}
            {accesEdit && <FormAcces item={accesEdit} onSave={sauverAcces} onCancel={() => setAccesEdit(null)} />}
            {!accesEdit && <Btn kind="soft" onClick={() => setAccesEdit({ libelle: '', url: '', identifiant: '', mot_de_passe: '', notes: '' })}>+ Site</Btn>}
          </Bloc>

          <Bloc titre="Articles de ce fournisseur">
            {lies.length === 0 && <Vide>Aucun article associé.</Vide>}
            {lies.map(c => (
              <Ligne key={c.id} titre={c.nom} detail={c.ref_fournisseur ? `réf. ${c.ref_fournisseur}` : ''}>
                <Btn kind="soft" onClick={() => delierArticle(c)} style={{ padding: '4px 10px' }}>Retirer</Btn>
              </Ligne>
            ))}
            {autres.length > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: 8 }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <Sel label="Associer un article" value={articleId} set={setArticleId} options={[{ v: '', l: '—' }, ...autres.map(c => ({ v: c.id, l: c.nom }))]} />
                </div>
                <Btn kind="soft" onClick={lierArticle} style={{ marginBottom: 10 }}>Associer</Btn>
              </div>
            )}
          </Bloc>
        </>
      )}
    </Card>
  )
}

function FormContact({ item, onSave, onCancel }) {
  const [c, setC] = useState({ ...item })
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, margin: '8px 0' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <F label="Prénom" value={c.prenom || ''} set={v => setC(s => ({ ...s, prenom: v }))} />
        <F label="Nom" value={c.nom || ''} set={v => setC(s => ({ ...s, nom: v }))} />
      </div>
      <PhoneF label="Téléphone" value={c.telephone || ''} set={v => setC(s => ({ ...s, telephone: v }))} />
      <F label="E-mail" type="email" value={c.email || ''} set={v => setC(s => ({ ...s, email: v }))} />
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn onClick={() => onSave(c)}>Enregistrer le contact</Btn>
        <Btn kind="soft" onClick={onCancel}>Annuler</Btn>
      </div>
    </div>
  )
}

function FormAcces({ item, onSave, onCancel }) {
  const [a, setA] = useState({ ...item })
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, margin: '8px 0' }}>
      <F label="Nom du site" value={a.libelle || ''} set={v => setA(s => ({ ...s, libelle: v }))} required placeholder="Portail commandes" />
      <F label="Adresse du site" value={a.url || ''} set={v => setA(s => ({ ...s, url: v }))} placeholder="https://" />
      <F label="Identifiant" value={a.identifiant || ''} set={v => setA(s => ({ ...s, identifiant: v }))} />
      <F label="Mot de passe" type="password" value={a.mot_de_passe || ''} set={v => setA(s => ({ ...s, mot_de_passe: v }))} />
      <TA label="Notes" value={a.notes || ''} set={v => setA(s => ({ ...s, notes: v }))} rows={2} />
      <div style={{ display: 'flex', gap: 8 }}>
        <Btn onClick={() => onSave(a)}>Enregistrer le site</Btn>
        <Btn kind="soft" onClick={onCancel}>Annuler</Btn>
      </div>
    </div>
  )
}

function Secret({ label, value }) {
  const [voir, setVoir] = useState(false)
  async function copier() {
    if (!value || !navigator.clipboard) return
    try { await navigator.clipboard.writeText(value) } catch { /* le presse-papiers peut refuser */ }
  }
  return (
    <div style={{ fontSize: 13, marginTop: 2 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label} : </span>
      <span style={{ fontFamily: 'ui-monospace, monospace' }}>{value ? (voir ? value : '••••••••') : '—'}</span>
      {value && (
        <>
          <button type="button" onClick={() => setVoir(v => !v)} style={lien}>{voir ? 'Masquer' : 'Afficher'}</button>
          <button type="button" onClick={copier} style={lien}>Copier</button>
        </>
      )}
    </div>
  )
}

function Bloc({ titre, children }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 700, color: 'var(--heading)', marginBottom: 8 }}>{titre}</div>
      {children}
    </div>
  )
}
function Vide({ children }) {
  return <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{children}</div>
}
function Ligne({ titre, detail, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 14 }}>{titre}</div>
        {detail && <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{detail}</div>}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>{children}</div>
    </div>
  )
}

const lien = { background: 'none', border: 'none', color: 'var(--accent)', fontWeight: 700, fontSize: 12.5, cursor: 'pointer', marginLeft: 8 }
