import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, Btn, F, Sel, Empty, Loading, inp } from '@/components/ui'
import {
  CLES_DOTATION, TAILLES_VETEMENT, lblCleDotation, estVetementCle,
  parentsDotation, variantesDe, articlesAttribuables, libelleArticleDotation, fmtDateBe,
} from './dotationIndividuelle'

export default function OngletDotationPersonnel({ cats, onReloadCats, onOk, onErr, gerer }) {
  const [profils, setProfils] = useState([])
  const [lignes, setLignes] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [filtre, setFiltre] = useState('')
  const [form, setForm] = useState(null)
  const [varianteForm, setVarianteForm] = useState(null)
  const [busy, setBusy] = useState(false)

  const parents = useMemo(() => parentsDotation(cats), [cats])

  async function charger() {
    setLoading(true)
    const [p, d] = await Promise.all([
      supabase.from('profiles').select('id,prenom,nom,email,actif,fiche').eq('actif', true).order('nom'),
      supabase.from('stock_dotation_individuelle')
        .select('id,user_id,catalogue_id,qte,notes,attribue_le,rendu_le,actif, stock_catalogue(nom,variante,cle_dotation,parent_id)')
        .eq('actif', true)
        .order('attribue_le', { ascending: false }),
    ])
    if (p.error) onErr?.(p.error.message)
    if (d.error) onErr?.(d.error.message)
    setProfils(p.data || [])
    const byId = Object.fromEntries((cats || []).map(c => [c.id, c]))
    setLignes((d.data || []).map(row => {
      const c = row.stock_catalogue || byId[row.catalogue_id] || {}
      const parent = c.parent_id ? byId[c.parent_id] : null
      return {
        ...row,
        article: c.nom,
        variante: c.variante,
        cle_dotation: c.cle_dotation || parent?.cle_dotation,
        parent_nom: parent?.nom,
      }
    }))
    setLoading(false)
  }

  useEffect(() => { charger() }, [cats])

  const profilById = useMemo(
    () => Object.fromEntries((profils || []).map(p => [p.id, p])),
    [profils],
  )

  const liste = useMemo(() => {
    const qq = q.trim().toLowerCase()
    return (lignes || []).filter(l => {
      if (filtre && l.cle_dotation !== filtre) return false
      if (!qq) return true
      const p = profilById[l.user_id]
      const hay = [
        p?.prenom, p?.nom, p?.email,
        l.article, l.variante, l.parent_nom, lblCleDotation(l.cle_dotation),
      ].join(' ').toLowerCase()
      return hay.includes(qq)
    })
  }, [lignes, q, filtre, profilById])

  async function attribuer(e) {
    e.preventDefault()
    if (!gerer || !form) return
    if (!form.user_id || !form.catalogue_id) {
      onErr?.('Choisissez le volontaire et l’article.')
      return
    }
    setBusy(true)
    const { data: moi } = await supabase.auth.getUser()
    const { error } = await supabase.from('stock_dotation_individuelle').insert({
      user_id: form.user_id,
      catalogue_id: form.catalogue_id,
      qte: Math.max(1, Number(form.qte) || 1),
      notes: form.notes?.trim() || null,
      attribue_le: form.attribue_le || new Date().toISOString().slice(0, 10),
      attribue_par: moi?.user?.id || null,
      actif: true,
    })
    setBusy(false)
    if (error) { onErr?.(error.message); return }
    onOk?.('Dotation enregistrée.')
    setForm(null)
    charger()
  }

  async function marquerRendu(row) {
    if (!gerer) return
    setBusy(true)
    const { error } = await supabase.from('stock_dotation_individuelle').update({
      actif: false,
      rendu_le: new Date().toISOString().slice(0, 10),
    }).eq('id', row.id)
    setBusy(false)
    if (error) { onErr?.(error.message); return }
    onOk?.('Article marqué comme rendu.')
    charger()
  }

  async function ajouterVariante(e) {
    e.preventDefault()
    if (!gerer || !varianteForm?.parent_id) return
    const label = String(varianteForm.variante || '').trim()
    if (!label) { onErr?.('Indiquez la variante (ex. S, M, bleu).'); return }
    const parent = (cats || []).find(c => c.id === varianteForm.parent_id)
    if (!parent) return
    setBusy(true)
    const { error } = await supabase.from('stock_catalogue').insert({
      nom: `${parent.nom} — ${label}`,
      categorie: parent.categorie || 'vêtement',
      mode: 'durable',
      nature: 'materiel',
      unite: 'pièce',
      stock_minimal: 0,
      gestion_lot: false,
      gestion_dlc: false,
      gestion_qr: false,
      parent_id: parent.id,
      variante: label,
      dotation_personnel: true,
      cle_dotation: parent.cle_dotation,
      actif: true,
    })
    setBusy(false)
    if (error) { onErr?.(error.message); return }
    onOk?.(`Variante « ${label} » ajoutée.`)
    setVarianteForm(null)
    onReloadCats?.()
  }

  if (loading) return <Loading />

  return (
    <div>
      <p style={{ color: 'var(--text-muted)', marginTop: 0, lineHeight: 1.45 }}>
        Dotation individuelle : polos, t-shirts, chemises, vestes et badges (ASBL, CHC, Solumob).
        Les tailles sont des variantes d’article. La fiche personnelle lit ces attributions.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
        <input
          type="search"
          placeholder="Rechercher un volontaire ou un article"
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ ...inp, flex: '1 1 220px', margin: 0 }}
        />
        <select value={filtre} onChange={e => setFiltre(e.target.value)} style={{ ...inp, width: 'auto', margin: 0 }}>
          <option value="">Toutes les familles</option>
          {CLES_DOTATION.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}
        </select>
        {gerer && (
          <Btn onClick={() => setForm({
            user_id: '',
            parent_id: parents[0]?.id || '',
            catalogue_id: '',
            qte: 1,
            notes: '',
            attribue_le: new Date().toISOString().slice(0, 10),
          })}>+ Attribuer</Btn>
        )}
        {gerer && (
          <Btn kind="soft" onClick={() => setVarianteForm({
            parent_id: parents.find(p => estVetementCle(p.cle_dotation))?.id || parents[0]?.id || '',
            variante: '',
          })}>+ Variante</Btn>
        )}
      </div>

      {form && (
        <Card style={{ marginBottom: 14 }}>
          <strong style={{ display: 'block', marginBottom: 10 }}>Attribuer un article</strong>
          <form onSubmit={attribuer}>
            <Sel
              label="Volontaire"
              value={form.user_id}
              set={v => setForm(s => ({ ...s, user_id: v }))}
              options={[
                { v: '', l: '—' },
                ...profils.map(p => ({
                  v: p.id,
                  l: `${(p.nom || '').toUpperCase()} ${p.prenom || ''}`.trim() || p.email || p.id,
                })),
              ]}
              required
            />
            <Sel
              label="Famille / article"
              value={form.parent_id}
              set={v => setForm(s => ({ ...s, parent_id: v, catalogue_id: '' }))}
              options={parents.map(p => ({
                v: p.id,
                l: `${lblCleDotation(p.cle_dotation)} — ${p.nom}`,
              }))}
              required
            />
            <Sel
              label="Variante / taille"
              value={form.catalogue_id}
              set={v => setForm(s => ({ ...s, catalogue_id: v }))}
              options={[
                { v: '', l: '—' },
                ...articlesAttribuables(cats, form.parent_id).map(a => ({
                  v: a.id,
                  l: a.variante || a.nom,
                })),
              ]}
              required
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '0 12px' }}>
              <F label="Quantité" type="number" value={form.qte} set={v => setForm(s => ({ ...s, qte: v }))} />
              <F label="Attribué le" type="date" value={form.attribue_le} set={v => setForm(s => ({ ...s, attribue_le: v }))} />
            </div>
            <F label="Notes" value={form.notes} set={v => setForm(s => ({ ...s, notes: v }))} placeholder="Taille essayée, n° de badge…" />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <Btn type="submit" disabled={busy}>{busy ? '…' : 'Enregistrer'}</Btn>
              <Btn kind="soft" type="button" onClick={() => setForm(null)}>Annuler</Btn>
            </div>
          </form>
        </Card>
      )}

      {varianteForm && (
        <Card style={{ marginBottom: 14 }}>
          <strong style={{ display: 'block', marginBottom: 10 }}>Ajouter une variante</strong>
          <form onSubmit={ajouterVariante}>
            <Sel
              label="Article parent"
              value={varianteForm.parent_id}
              set={v => setVarianteForm(s => ({ ...s, parent_id: v }))}
              options={parents.map(p => ({ v: p.id, l: p.nom }))}
              required
            />
            <F
              label="Variante"
              value={varianteForm.variante}
              set={v => setVarianteForm(s => ({ ...s, variante: v }))}
              placeholder="Ex. S, M, L, XL, bleu marine…"
              required
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '6px 0 10px' }}>
              {TAILLES_VETEMENT.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setVarianteForm(s => ({ ...s, variante: t }))}
                  style={{
                    border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px',
                    background: varianteForm.variante === t ? 'var(--accent)' : 'var(--bg-alt)',
                    color: varianteForm.variante === t ? '#fff' : 'var(--text)',
                    cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  }}
                >{t}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn type="submit" disabled={busy}>{busy ? '…' : 'Créer la variante'}</Btn>
              <Btn kind="soft" type="button" onClick={() => setVarianteForm(null)}>Annuler</Btn>
            </div>
          </form>
          {varianteForm.parent_id && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 0 }}>
              Déjà présentes : {variantesDe(cats, varianteForm.parent_id).map(v => v.variante || v.nom).join(', ') || 'aucune'}
            </p>
          )}
        </Card>
      )}

      <Card style={{ marginBottom: 14 }}>
        <strong style={{ display: 'block', marginBottom: 8 }}>Catalogue dotation</strong>
        <div style={{ display: 'grid', gap: 8 }}>
          {parents.map(p => {
            const vars = variantesDe(cats, p.id)
            return (
              <div key={p.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <div style={{ fontWeight: 700 }}>{lblCleDotation(p.cle_dotation)} · {p.nom}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {vars.length
                    ? `Variantes : ${vars.map(v => v.variante || v.nom).join(', ')}`
                    : 'Pas de variante (attributable tel quel).'}
                </div>
              </div>
            )
          })}
          {parents.length === 0 && (
            <Empty title="Aucun article de dotation" hint="Les articles polo / badges seront créés par le script d’installation." />
          )}
        </div>
      </Card>

      {liste.length === 0 ? (
        <Empty title="Aucune attribution" hint="Attribuez un polo, un badge ou une veste à un volontaire." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {liste.map(row => {
            const p = profilById[row.user_id]
            const qui = p ? `${(p.nom || '').toUpperCase()} ${p.prenom || ''}`.trim() : 'Volontaire'
            return (
              <Card key={row.id} style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 800, color: 'var(--heading)' }}>{qui}</div>
                    <div style={{ fontSize: 14, marginTop: 2 }}>{libelleArticleDotation(row)}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
                      {lblCleDotation(row.cle_dotation)} · qté {Number(row.qte) || 1}
                      {' · '}attribué le {fmtDateBe(row.attribue_le)}
                      {row.notes ? ` · ${row.notes}` : ''}
                    </div>
                  </div>
                  {gerer && (
                    <Btn kind="soft" disabled={busy} onClick={() => marquerRendu(row)}>Marquer rendu</Btn>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
