import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Page, Card, Btn, F, TA, Empty, Loading } from '@/components/ui'
import { compressImage } from '@/modules/souhaits/TerrainPhotos'
import { sanitizeHtml } from '@/lib/sanitizeHtml'
import { blocVide, chapoCourt, normaliserBlocs } from './blocs'
import { chapoDepuisHtml, htmlDepuisPressePapier } from './htmlWord'
import { CarteActualite, Couverture, fmtPublie, urlActu } from './Vignettes'

const BUCKET = 'actualites-images'
const SELECT = 'id,titre,chapo,vignette_path,vignette_html,blocs,format,html,statut,publie_le,created_at,updated_at'

function tri(rows) {
  return (rows || []).slice().sort((a, b) => {
    const da = a.publie_le || a.updated_at || a.created_at || ''
    const db = b.publie_le || b.updated_at || b.created_at || ''
    return String(db).localeCompare(String(da))
  })
}

export function Article({ row }) {
  const blocs = normaliserBlocs(row?.blocs)
  const pageHtml = row?.format === 'html' ? sanitizeHtml(row.html) : ''
  if (pageHtml) {
    return (
      <article className="ha-actu-article">
        <div className="ha-actu-article-corps">
          {fmtPublie(row.publie_le || row.created_at) && <div className="ha-actu-date">{fmtPublie(row.publie_le || row.created_at)}</div>}
          <HtmlCorps html={row.html} />
        </div>
      </article>
    )
  }
  return (
    <article className="ha-actu-article">
      <Couverture path={row.vignette_path} titre={row.titre} hero />
      <div className="ha-actu-article-corps">
        <h1>{row.titre}</h1>
        {fmtPublie(row.publie_le || row.created_at) && <div className="ha-actu-date">{fmtPublie(row.publie_le || row.created_at)}</div>}
        {row.chapo && <p className="ha-actu-chapo">{row.chapo}</p>}
        {blocs.map(b => {
          if (b.type === 'intertitre') return <h2 key={b.id}>{b.texte}</h2>
          if (b.type === 'citation') {
            return (
              <blockquote key={b.id} className="ha-actu-citation">
                <p>{b.texte}</p>
                {b.source && <footer>{b.source}</footer>}
              </blockquote>
            )
          }
          if (b.type === 'photo') {
            return (
              <figure key={b.id} className="ha-actu-figure">
                <img src={urlActu(b.path)} alt={b.legende || ''} />
                {b.legende && <figcaption>{b.legende}</figcaption>}
              </figure>
            )
          }
          return <p key={b.id}>{b.texte}</p>
        })}
      </div>
    </article>
  )
}

function HtmlCorps({ html }) {
  const clean = sanitizeHtml(html)
  if (!clean) return null
  return <div className="ha-actu-html" dangerouslySetInnerHTML={{ __html: clean }} />
}

export default function Actualites() {
  const { id } = useParams()
  const loc = useLocation()
  const nav = useNavigate()
  const { profile, peutPublierActualites } = useAuth()
  const publier = peutPublierActualites()
  const path = String(loc.pathname || '').replace(/\/+$/, '')
  const redaction = path.includes('/it/actualites')
  const estNouveau = path.endsWith('/actualites/nouveau') || id === 'nouveau'
  const estEditer = path.endsWith('/editer')
  const edition = estNouveau || estEditer
  const retourRedaction = '/app/it/actualites'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)

  useEffect(() => { charger() }, [publier])

  async function charger() {
    setLoading(true)
    setErr(null)
    const { data, error } = await supabase.from('actualites').select(SELECT)
    if (error) setErr(error.message)
    setItems(tri(data))
    setLoading(false)
  }

  if (edition) {
    if (!publier) {
      return <Page title="Actualités"><Empty title="Réservé à la publication" hint="L’informatique, les relations publiques et la présidence rédigent les actualités." /></Page>
    }
    return (
      <FormActualite
        profile={profile}
        editId={estEditer && id && id !== 'nouveau' ? id : null}
        onDone={cible => nav(cible || retourRedaction)}
      />
    )
  }

  if (id && id !== 'nouveau') {
    const row = items.find(a => a.id === id)
    if (loading && !row) return <Page title="Actualités"><Loading /></Page>
    if (!row) return <Page title="Actualités"><Empty title="Article introuvable" action={<Btn kind="soft" onClick={() => nav('/app/actualites')}>Retour</Btn>} /></Page>
    return (
      <Page title="" action={(
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {publier && <Btn kind="soft" onClick={() => nav(`/app/it/actualites/${row.id}/editer`)}>Modifier</Btn>}
          <Btn kind="soft" onClick={() => nav('/app/actualites')}>Toutes les actualités</Btn>
        </div>
      )}>
        <Article row={row} />
      </Page>
    )
  }

  if (redaction) {
    return (
      <Page
        title="Rédaction des actualités"
        subtitle="L’écriture se fait ici. La lecture, pour tout le monde, est dans Gestion RH."
        action={<Btn onClick={() => nav('/app/it/actualites/nouveau')}>+ Actualité</Btn>}
      >
        {err && <div className="ha-flash ha-flash-err">{err}</div>}
        {loading ? <Loading /> : items.length === 0 ? (
          <Empty title="Aucune actualité" hint="Rédigez un article, puis choisissez une date de parution." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(a => (
              <button key={a.id} type="button" className="ha-actu-ligne" onClick={() => nav(`/app/it/actualites/${a.id}/editer`)}>
                <strong>{a.titre}</strong>
                <span>{libelleParution(a)}</span>
              </button>
            ))}
          </div>
        )}
      </Page>
    )
  }
  const visibles = items.filter(a => visibleAuPublic(a))
  return (
    <Page
      title="Actualités"
      subtitle="Les nouvelles de l’ASBL."
    >
      {err && <div className="ha-flash ha-flash-err">{err}</div>}
      {loading ? <Loading />
        : visibles.length === 0 ? (
          <Empty
            title="Aucune actualité"
            hint="Quand une nouvelle sera publiée, elle apparaîtra ici et sur l’accueil."
          />
        ) : (
          <div className="ha-actu-grid">
            {visibles.map(a => (
              <CarteActualite key={a.id} row={a} onOpen={() => nav(`/app/actualites/${a.id}`)} />
            ))}
          </div>
        )}
    </Page>
  )
}

function dateValide(valeur) {
  if (valeur instanceof Date) return Number.isNaN(valeur.getTime()) ? null : valeur
  if (valeur == null || valeur === '') return null
  const d = new Date(valeur)
  return Number.isNaN(d.getTime()) ? null : d
}

function visibleAuPublic(a, maintenant = new Date()) {
  if (a?.statut !== 'publie') return false
  const d = dateValide(a.publie_le)
  if (!d) return !a?.publie_le
  const ref = maintenant instanceof Date && !Number.isNaN(maintenant.getTime()) ? maintenant : new Date()
  return d.getTime() <= ref.getTime()
}

function libelleParution(a) {
  if (a.statut !== 'publie') return 'Brouillon'
  const d = dateValide(a.publie_le)
  if (!d) return 'Publié'
  const quand = fmtPublie(a.publie_le)
  if (d.getTime() > Date.now()) return `À paraître le ${quand}`
  return `Paru le ${quand}`
}

function versChampDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function FormActualite({ profile, editId, onDone }) {
  const [form, setForm] = useState({
    titre: '', chapo: '', vignette_path: '', vignette_html: '', format: 'html', html: '', blocs: [blocVide('texte')], statut: 'brouillon', publie_le: null,
    parution: 'immediat', parution_le: '',
  })
  const [loaded, setLoaded] = useState(!editId)
  const [saving, setSaving] = useState(false)
  const [apercu, setApercu] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!editId) { setLoaded(true); return }
    let on = true
    supabase.from('actualites').select(SELECT).eq('id', editId).maybeSingle()
      .then(({ data, error }) => {
        if (!on) return
        if (error) setErr(error.message)
        if (data) {
          const blocs = Array.isArray(data.blocs) ? data.blocs : []
          setForm({
            id: data.id,
            titre: data.titre || '',
            chapo: data.chapo || '',
            vignette_path: data.vignette_path || '',
            vignette_html: data.vignette_html || '',
            format: data.format === 'html' || (data.html && data.format !== 'blocs') ? 'html' : 'blocs',
            html: data.html || '',
            blocs: blocs.length ? blocs : [blocVide('texte')],
            statut: data.statut || 'brouillon',
            publie_le: data.publie_le || null,
            parution: data.publie_le ? 'date' : 'immediat',
            parution_le: versChampDate(data.publie_le),
          })
        }
        setLoaded(true)
      })
      .catch(e => { if (on) { setErr(e?.message || 'Chargement impossible.'); setLoaded(true) } })
    return () => { on = false }
  }, [editId])

  async function envoyerImage(file) {
    if (!file) return ''
    if (!file.type.startsWith('image/')) { alert('Choisissez une image (JPG, PNG, WebP).'); return '' }
    const blob = await compressImage(file)
    const uid = crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
    const path = `${profile?.id || 'actu'}/${uid}.jpg`
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    if (error) throw error
    return path
  }

  async function couverture(file) {
    setSaving(true)
    try {
      const path = await envoyerImage(file)
      if (path) {
        if (form.vignette_path) await supabase.storage.from(BUCKET).remove([form.vignette_path]).catch(() => {})
        setForm(s => ({ ...s, vignette_path: path }))
      }
    } catch (e) {
      alert(e.message || 'Envoi impossible.')
    }
    setSaving(false)
  }

  async function photoBloc(id, file) {
    setSaving(true)
    try {
      const path = await envoyerImage(file)
      if (path) setForm(s => ({ ...s, blocs: s.blocs.map(b => b.id === id ? { ...b, path } : b) }))
    } catch (e) {
      alert(e.message || 'Envoi impossible.')
    }
    setSaving(false)
  }

  function majBloc(id, patch) {
    setForm(s => ({ ...s, blocs: s.blocs.map(b => b.id === id ? { ...b, ...patch } : b) }))
  }
  function deplacer(id, sens) {
    setForm(s => {
      const i = s.blocs.findIndex(b => b.id === id)
      const j = i + sens
      if (i < 0 || j < 0 || j >= s.blocs.length) return s
      const blocs = s.blocs.slice()
      const [x] = blocs.splice(i, 1)
      blocs.splice(j, 0, x)
      return { ...s, blocs }
    })
  }
  function retirer(id) {
    setForm(s => ({ ...s, blocs: s.blocs.filter(b => b.id !== id) }))
  }

  async function enregistrer(publier) {
    const titre = String(form.titre || '').trim()
    if (!titre) { alert('Indiquez un titre.'); return }
    const enHtml = form.format === 'html'
    const html = enHtml ? sanitizeHtml(form.html) : ''
    const blocs = normaliserBlocs(form.blocs)
    if (publier && enHtml && !html && !chapoCourt(form.chapo)) {
      alert('Collez le texte ou écrivez le HTML avant de publier.')
      return
    }
    if (publier && !enHtml && !blocs.length && !chapoCourt(form.chapo)) {
      alert('Ajoutez un chapô ou un paragraphe avant de publier.')
      return
    }
    let publieLe = null
    if (publier || form.statut === 'publie') {
      if (form.parution === 'date') {
        if (!form.parution_le) { alert('Indiquez la date de parution.'); return }
        const d = new Date(form.parution_le)
        if (Number.isNaN(d.getTime())) { alert('Date de parution invalide.'); return }
        publieLe = d.toISOString()
      } else {
        publieLe = new Date().toISOString()
      }
    }
    setSaving(true)
    const restePublie = publier || form.statut === 'publie'
    const payload = {
      titre,
      chapo: chapoCourt(form.chapo) || (enHtml ? chapoCourt(chapoDepuisHtml(html)) : null) || null,
      vignette_path: form.vignette_path || null,
      vignette_html: sanitizeHtml(form.vignette_html) || null,
      format: enHtml ? 'html' : 'blocs',
      html: html || null,
      blocs,
      statut: restePublie ? 'publie' : 'brouillon',
      publie_le: publieLe,
    }
    try {
      let error
      let nouveauId = form.id
      if (form.id) {
        ({ error } = await supabase.from('actualites').update(payload).eq('id', form.id))
      } else {
        const ins = await supabase.from('actualites').insert({ ...payload, created_by: profile?.id || null }).select('id').single()
        error = ins.error
        nouveauId = ins.data?.id
      }
      setSaving(false)
      if (error) { alert(error.message); return }
      onDone('/app/it/actualites')
    } catch (e) {
      setSaving(false)
      alert(e?.message || 'Enregistrement impossible.')
    }
  }

  async function supprimer() {
    if (!form.id) { onDone(); return }
    if (!confirm('Retirer cette actualité ?')) return
    setSaving(true)
    const { error } = await supabase.from('actualites').delete().eq('id', form.id)
    setSaving(false)
    if (error) { alert(error.message); return }
    onDone('/app/it/actualites')
  }

  if (!loaded) return <Page title="Actualité"><Loading /></Page>
  const apercuRow = {
    titre: form.titre || 'Titre de l’actualité',
    chapo: form.chapo,
    vignette_path: form.vignette_path,
    vignette_html: form.vignette_html,
    blocs: form.blocs,
    format: form.format,
    html: form.html,
    publie_le: form.publie_le || new Date().toISOString(),
  }

  return (
    <Page
      title={form.id ? 'Modifier l’actualité' : 'Nouvelle actualité'}
      subtitle="Le HTML de la page et celui de la vignette peuvent contenir l’image, le titre et le chapô."
      action={<Btn kind="soft" onClick={() => onDone('/app/it/actualites')}>Annuler</Btn>}
    >
      {err && <div className="ha-flash ha-flash-err">{err}</div>}
      <div className="ha-tabs" style={{ marginBottom: 12 }}>
        <button type="button" className={'ha-tab' + (!apercu ? ' is-on' : '')} onClick={() => setApercu(false)}>Rédaction</button>
        <button type="button" className={'ha-tab' + (apercu ? ' is-on' : '')} onClick={() => setApercu(true)}>Aperçu</button>
      </div>
      {apercu ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--heading)', marginBottom: 8 }}>Vignette</div>
            <div className="ha-actu-grid" style={{ maxWidth: 280 }}>
              <CarteActualite row={apercuRow} onOpen={() => {}} />
            </div>
          </div>
          <Article row={apercuRow} />
        </div>
      ) : (
        <>
          <F label="Titre" value={form.titre} set={v => setForm(s => ({ ...s, titre: v }))} required />
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '-4px 0 12px' }}>
            Nom de l’actualité. En mode HTML, la page affiche le code : le titre, le chapô et l’image s’y mettent, ils ne sont pas répétés au-dessus.
          </p>
          <TA label="Chapô" value={form.chapo} set={v => setForm(s => ({ ...s, chapo: v }))} rows={3}
            placeholder="Deux ou trois phrases. Elles s’affichent sur la vignette, sauf si la vignette a son propre HTML." />
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>Photo de couverture</div>
            {form.vignette_path && <img src={urlActu(form.vignette_path)} alt="" className="ha-actu-apercu-img" />}
            <label className="ha-stock-photo-btn" style={{ marginTop: 8 }}>
              {form.vignette_path ? 'Changer la photo' : 'Choisir une photo'}
              <input type="file" accept="image/*" onChange={e => { couverture(e.target.files?.[0]); e.target.value = '' }} />
            </label>
            {form.vignette_path && (
              <button type="button" className="ha-stock-photo-del" style={{ marginLeft: 10 }}
                onClick={() => setForm(s => ({ ...s, vignette_path: '' }))}>Retirer</button>
            )}
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--heading)', marginBottom: 8 }}>Date de parution</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <button type="button" className={'ha-tab' + (form.parution !== 'date' ? ' is-on' : '')} onClick={() => setForm(s => ({ ...s, parution: 'immediat' }))}>Immédiatement</button>
              <button type="button" className={'ha-tab' + (form.parution === 'date' ? ' is-on' : '')} onClick={() => setForm(s => ({ ...s, parution: 'date' }))}>Choisir une date</button>
            </div>
            {form.parution === 'date' && (
              <>
                <input type="datetime-local" value={form.parution_le} onChange={e => setForm(s => ({ ...s, parution_le: e.target.value }))} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)' }} />
                <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '6px 0 0' }}>
                  Une date dans le passé fait paraître l’article à cette date. Une date dans le futur le garde invisible jusqu’à ce moment-là.
                </p>
              </>
            )}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--heading)', margin: '4px 0 8px' }}>Vignette en HTML</div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 8px' }}>
            Facultatif. S’il est rempli, ce code remplace la photo, le titre et le chapô sur la vignette. Il peut contenir une image, un titre et un chapô.
          </p>
          <EditeurHtml
            html={form.vignette_html}
            setHtml={v => setForm(s => ({ ...s, vignette_html: v }))}
            depart="code"
            rows={8}
            aide="Collez le HTML de la vignette. Une image en https, un titre et un court texte suffisent. Les scripts sont retirés."
            placeholder={'<img src="https://…" alt="">\n<h2>Titre de la vignette</h2>\n<p>Le chapô, en deux lignes.</p>'}
          />
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--heading)', marginBottom: 8 }}>Corps de l’article</div>
          <div className="ha-tabs" style={{ marginBottom: 12 }}>
            <button type="button" className={'ha-tab' + (form.format === 'html' ? ' is-on' : '')} onClick={() => setForm(s => ({ ...s, format: 'html' }))}>HTML</button>
            <button type="button" className={'ha-tab' + (form.format !== 'html' ? ' is-on' : '')} onClick={() => setForm(s => ({ ...s, format: 'blocs' }))}>Blocs</button>
          </div>
          {form.format === 'html' ? (
            <EditeurHtml html={form.html} setHtml={v => setForm(s => ({ ...s, html: v }))} />
          ) : (
          <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {form.blocs.map((b, i) => (
              <Card key={b.id} style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-muted)' }}>
                    {b.type === 'intertitre' ? 'Intertitre' : b.type === 'photo' ? 'Photo' : b.type === 'citation' ? 'Citation' : 'Paragraphe'}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn kind="soft" onClick={() => deplacer(b.id, -1)} disabled={i === 0} style={{ padding: '4px 8px' }}>↑</Btn>
                    <Btn kind="soft" onClick={() => deplacer(b.id, 1)} disabled={i === form.blocs.length - 1} style={{ padding: '4px 8px' }}>↓</Btn>
                    <Btn kind="danger" onClick={() => retirer(b.id)} style={{ padding: '4px 8px' }}>Retirer</Btn>
                  </div>
                </div>
                {b.type === 'photo' ? (
                  <>
                    {b.path && <img src={urlActu(b.path)} alt="" className="ha-actu-apercu-img" />}
                    <label className="ha-stock-photo-btn">
                      {b.path ? 'Changer la photo' : 'Choisir une photo'}
                      <input type="file" accept="image/*" onChange={e => { photoBloc(b.id, e.target.files?.[0]); e.target.value = '' }} />
                    </label>
                    <div style={{ marginTop: 8 }}>
                      <F label="Légende" value={b.legende || ''} set={v => majBloc(b.id, { legende: v })} />
                    </div>
                  </>
                ) : b.type === 'citation' ? (
                  <>
                    <TA label="Citation" value={b.texte || ''} set={v => majBloc(b.id, { texte: v })} rows={3} />
                    <F label="Source (facultatif)" value={b.source || ''} set={v => majBloc(b.id, { source: v })} />
                  </>
                ) : (
                  <TA label={b.type === 'intertitre' ? 'Intertitre' : 'Texte'} value={b.texte || ''} set={v => majBloc(b.id, { texte: v })}
                    rows={b.type === 'intertitre' ? 2 : 4} />
                )}
              </Card>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0 18px' }}>
            <Btn kind="soft" onClick={() => setForm(s => ({ ...s, blocs: [...s.blocs, blocVide('texte')] }))}>+ Paragraphe</Btn>
            <Btn kind="soft" onClick={() => setForm(s => ({ ...s, blocs: [...s.blocs, blocVide('intertitre')] }))}>+ Intertitre</Btn>
            <Btn kind="soft" onClick={() => setForm(s => ({ ...s, blocs: [...s.blocs, blocVide('photo')] }))}>+ Photo</Btn>
            <Btn kind="soft" onClick={() => setForm(s => ({ ...s, blocs: [...s.blocs, blocVide('citation')] }))}>+ Citation</Btn>
          </div>
          </>
          )}
        </>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <Btn onClick={() => enregistrer(true)} disabled={saving}>{saving ? '…' : (form.statut === 'publie' ? 'Mettre à jour' : 'Publier')}</Btn>
        {form.statut !== 'publie' && <Btn kind="soft" onClick={() => enregistrer(false)} disabled={saving}>Enregistrer le brouillon</Btn>}
        {form.id && <Btn kind="danger" onClick={supprimer} disabled={saving}>Supprimer</Btn>}
      </div>
    </Page>
  )
}

function EditeurHtml({ html, setHtml, aide, placeholder, rows = 16, depart = 'word' }) {
  const [vue, setVue] = useState(depart)
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="ha-tabs" style={{ marginBottom: 8 }}>
        <button type="button" className={'ha-tab' + (vue === 'word' ? ' is-on' : '')} onClick={() => setVue('word')}>Depuis Word</button>
        <button type="button" className={'ha-tab' + (vue === 'code' ? ' is-on' : '')} onClick={() => setVue('code')}>Code HTML</button>
      </div>
      {vue === 'word' ? (
        <>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 8px' }}>
            Dans Word : tout sélectionner, copier, puis coller ici. Le gras, les titres et les listes sont gardés. La police de Word est retirée pour rester dans le style de l’ASBL.
          </p>
          <ZoneCollage html={html} onChange={setHtml} />
        </>
      ) : (
        <>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 8px' }}>
            {aide || 'Le code peut contenir une image, le titre, le chapô et le texte. Les scripts sont retirés. En mode HTML, ce code est la page : le titre et le chapô des champs au-dessus ne sont pas répétés.'}
          </p>
          <TA label="HTML" value={html} set={setHtml} rows={rows}
            placeholder={placeholder || '<img src="https://…" alt="">\n<h1>Titre</h1>\n<p>Le chapô.</p>\n<p>Le texte.</p>'} />
        </>
      )}
    </div>
  )
}

function ZoneCollage({ html, onChange }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    const propre = sanitizeHtml(html) || ''
    if (el.innerHTML !== propre) el.innerHTML = propre
  }, [html])

  function poser(brut) {
    const clean = sanitizeHtml(brut)
    if (ref.current && ref.current.innerHTML !== clean) ref.current.innerHTML = clean
    onChange(clean)
  }

  function onPaste(e) {
    e.preventDefault()
    const source = htmlDepuisPressePapier(
      e.clipboardData?.getData('text/html'),
      e.clipboardData?.getData('text/plain'),
    )
    poser(source)
  }

  return (
    <div
      ref={ref}
      className="ha-actu-word ha-actu-html"
      contentEditable
      role="textbox"
      aria-multiline="true"
      aria-label="Texte collé depuis Word"
      onPaste={onPaste}
      onBlur={() => poser(ref.current?.innerHTML || '')}
      suppressContentEditableWarning
    />
  )
}
