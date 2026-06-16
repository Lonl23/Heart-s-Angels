import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { statutInfo } from '@/lib/souhaitStatuts'

const ARCHIVE = ['realise', 'non_realise', 'renseignements']
const QUALIF_MED = ['ambulancier', 'infirmier', 'medecin', 'kinesitherapeute', 'aide_soignant', 'psychologue', 'volontaire_medical']
const ymd = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }

export default function Dashboard() {
  const { profile, can, souhaitsAccess } = useAuth()
  const nav = useNavigate()
  const [souhaits, setSouhaits] = useState([])
  const [mesSouhaitIds, setMesSouhaitIds] = useState([])   // souhaits où je suis affecté
  const [datesSouhaits, setDatesSouhaits] = useState([])  // souhait_dates
  const [rapports, setRapports] = useState([])           // souhait_id des rapports existants
  const [mesDispos, setMesDispos] = useState(0)
  const [defraiements, setDefraiements] = useState(0)
  const [stockBas, setStockBas] = useState(0)
  const [joursDecouverts, setJoursDecouverts] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const aujourdhui = ymd(new Date())

      // Souhaits (actifs + récents) avec leurs rapports
      const { data: s } = await supabase
        .from('souhaits')
        .select('id,patient_prenom,patient_nom,statut,date_souhait,sur_plusieurs_jours,date_fin,souhait_description,souhait_lieu,urgence,created_at')
        .order('date_souhait', { ascending: true, nullsFirst: false })
        .limit(300)
      setSouhaits(s || [])

      // Dates proposées/confirmées (le champ souhait.date_souhait n'est pas toujours rempli)
      const { data: sdAll } = await supabase.from('souhait_dates')
        .select('souhait_id,date_proposee,date_fin_proposee,plusieurs_jours,confirmee')
      setDatesSouhaits(sdAll || [])

      const { data: r } = await supabase.from('souhait_rapports').select('souhait_id')
      setRapports((r || []).map(x => x.souhait_id))

      // Souhaits où je suis affecté (pour le filtrage des volontaires non-coordinateurs)
      if (profile?.id) {
        const { data: sp } = await supabase.from('souhait_personnel').select('souhait_id').eq('user_id', profile.id)
        setMesSouhaitIds((sp || []).map(x => x.souhait_id))
      }

      // Mes disponibilités à venir
      if (profile?.id) {
        const { count } = await supabase.from('disponibilites')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id).gte('date_fin', aujourdhui + 'T00:00:00')
        setMesDispos(count || 0)
      }

      // Défraiements à valider
      if (can('defraiements.validate')) {
        const { count } = await supabase.from('defraiements')
          .select('id', { count: 'exact', head: true }).eq('statut', 'soumis')
        setDefraiements(count || 0)
      }

      // Stock bas
      if (can('nav.stock')) {
        const { data: st } = await supabase.from('stock_materiel').select('quantite,stock_minimal').eq('actif', true)
        setStockBas((st || []).filter(it => (it.quantite || 0) <= (it.stock_minimal || 0)).length)
      }

      // Jours de souhaits sans qualification (coordinateurs)
      if (can('dispo.viewall') || can('souhaits.logistique')) {
        try {
          const fin = ymd(new Date(Date.now() + 60 * 864e5))
          const [{ data: sd }, { data: dp }, { data: pr }] = await Promise.all([
            supabase.from('souhait_dates').select('date_proposee,date_fin_proposee,plusieurs_jours,souhaits!inner(statut)').gte('date_proposee', aujourdhui).lte('date_proposee', fin),
            supabase.from('disponibilites').select('user_id,date_debut,date_fin'),
            supabase.from('profiles').select('id,role,roles_supplementaires,selection_medicale'),
          ])
          const hasRole = (p, ro) => p?.role === ro || (p?.roles_supplementaires || []).includes(ro)
          const amb = (p) => hasRole(p, 'ambulancier') && !!p?.selection_medicale
          const inf = (p) => hasRole(p, 'infirmier') || hasRole(p, 'medecin')
          const byUser = new Map()
          for (const d of (dp || [])) {
            const dd = d.date_debut ? String(d.date_debut).slice(0, 10) : null
            const df = d.date_fin ? String(d.date_fin).slice(0, 10) : dd
            if (!dd) continue
            const p = (pr || []).find(x => x.id === d.user_id)
            if (!byUser.has(d.user_id)) byUser.set(d.user_id, { p, ranges: [] })
            byUser.get(d.user_id).ranges.push({ dd, df: df || dd })
          }
          const jours = new Set()
          for (const row of (sd || [])) {
            if (ARCHIVE.includes(row.souhaits?.statut)) continue
            const deb = row.date_proposee
            const fn = (row.plusieurs_jours && row.date_fin_proposee) ? row.date_fin_proposee : deb
            const a = new Date(deb + 'T00:00:00'), b = new Date(fn + 'T00:00:00')
            for (let t = new Date(a); t <= b; t.setDate(t.getDate() + 1)) jours.add(ymd(t))
          }
          let nonCouverts = 0
          for (const j of jours) {
            let a2 = 0, i2 = 0
            for (const { p, ranges } of byUser.values()) {
              if (!ranges.some(r => r.dd <= j && r.df >= j)) continue
              if (amb(p)) a2++; if (inf(p)) i2++
            }
            if (!(a2 >= 1 && i2 >= 1)) nonCouverts++
          }
          setJoursDecouverts(nonCouverts)
        } catch { setJoursDecouverts(null) }
      }

      setLoading(false)
    })()
  }, [profile?.id])

  // ── Dérivés ─────────────────────────────────────────────────────────────────
  const today = ymd(new Date())
  const setRapports_ = useMemo(() => new Set(rapports), [rapports])

  // date effective d'un souhait : champ direct, sinon date confirmée, sinon plus proche date proposée
  const datesParSouhait = useMemo(() => {
    const m = new Map()
    for (const d of datesSouhaits) {
      if (!m.has(d.souhait_id)) m.set(d.souhait_id, [])
      m.get(d.souhait_id).push(d)
    }
    return m
  }, [datesSouhaits])
  const dateEff = (s) => {
    if (s.date_souhait) return ymd(s.date_souhait)
    const ds = datesParSouhait.get(s.id) || []
    if (!ds.length) return null
    const conf = ds.find(d => d.confirmee)
    const chosen = conf || [...ds].sort((a, b) => String(a.date_proposee).localeCompare(String(b.date_proposee)))[0]
    return chosen?.date_proposee ? ymd(chosen.date_proposee) : null
  }

  const acces = (typeof souhaitsAccess === 'function' ? souhaitsAccess() : 'all')
  const mesIds = useMemo(() => new Set(mesSouhaitIds), [mesSouhaitIds])
  // Accès « tous » (coordinateurs/responsables) → tout ; sinon uniquement les souhaits affectés (prêt/en cours)
  const souhaitsVisibles = useMemo(() => {
    if (acces === 'all') return souhaits
    return souhaits.filter(s => mesIds.has(s.id) && ['pret', 'en_cours'].includes(s.statut))
  }, [souhaits, acces, mesIds])

  const actifs = useMemo(() => souhaitsVisibles.filter(s => !ARCHIVE.includes(s.statut)), [souhaitsVisibles])
  const aVenir = useMemo(() => actifs
    .map(s => ({ ...s, _date: dateEff(s) }))
    .filter(s => s._date && s._date >= today)
    .sort((a, b) => a._date.localeCompare(b._date)), [actifs, today, datesParSouhait])
  const prochain = aVenir[0] || null
  const aVenir7 = aVenir.filter(s => s._date <= ymd(new Date(Date.now() + 7 * 864e5))).length
  const rapportsManquants = useMemo(
    () => souhaitsVisibles.filter(s => s.statut === 'realise' && !setRapports_.has(s.id)).length,
    [souhaitsVisibles, setRapports_])

  const prenom = profile?.prenom || ''
  const heure = new Date().getHours()
  const salut = heure < 12 ? 'Bonjour' : heure < 18 ? 'Bon après-midi' : 'Bonsoir'
  const dateLongue = new Date().toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const fmtDate = (d) => new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' })
  const joursAvant = (d) => Math.round((new Date(ymd(d) + 'T00:00:00') - new Date(today + 'T00:00:00')) / 864e5)
  const compteJours = (n) => n === 0 ? "aujourd'hui" : n === 1 ? 'demain' : `dans ${n} jours`
  const nomP = (s) => `${s.patient_prenom || ''} ${s.patient_nom || ''}`.trim() || 'Bénéficiaire'

  // Tuiles (filtrées par permission)
  const tuiles = [
    { show: can('souhaits.read'), label: 'Souhaits actifs', value: actifs.length, sub: 'en cours de réalisation', color: C.rose, bg: '#FBEAF0', icon: '❤️', to: '/app/souhaits' },
    { show: can('souhaits.read'), label: 'À venir', value: aVenir7, sub: 'dans les 7 jours', color: C.teal, bg: '#E6F7FA', icon: '📅', to: '/app/souhaits' },
    { show: can('souhaits.logistique') || can('annuaire.medical'), label: 'Rapports à compléter', value: rapportsManquants, sub: 'souhaits réalisés', color: C.ambre, bg: '#FAEEDA', icon: '📝', to: '/app/souhaits' },
    { show: (can('dispo.viewall') || can('souhaits.logistique')) && joursDecouverts != null, label: 'Jours à couvrir', value: joursDecouverts, sub: 'équipage qualifié manquant', color: C.rouge, bg: '#FCEBEB', icon: '⚠️', to: '/app/disponibilites' },
    { show: can('defraiements.validate'), label: 'Défraiements', value: defraiements, sub: 'en attente de validation', color: C.bleuP, bg: '#E6F1FB', icon: '🧾', to: '/app/defraiements/validation' },
    { show: can('nav.stock'), label: 'Stock bas', value: stockBas, sub: 'à réapprovisionner', color: C.ambre, bg: '#FAEEDA', icon: '📦', to: '/app/stock' },
  ].filter(t => t.show)

  // À faire (items actionnables non nuls)
  const aFaire = [
    rapportsManquants > 0 && (can('souhaits.logistique') || can('annuaire.medical')) && { n: rapportsManquants, txt: `rapport${rapportsManquants > 1 ? 's' : ''} de réalisation à compléter`, to: '/app/souhaits', icon: '📝', color: C.ambre },
    joursDecouverts > 0 && (can('dispo.viewall') || can('souhaits.logistique')) && { n: joursDecouverts, txt: `jour${joursDecouverts > 1 ? 's' : ''} de souhait sans équipage qualifié`, to: '/app/disponibilites', icon: '⚠️', color: C.rouge },
    defraiements > 0 && can('defraiements.validate') && { n: defraiements, txt: `défraiement${defraiements > 1 ? 's' : ''} en attente de validation`, to: '/app/defraiements/validation', icon: '🧾', color: C.bleuP },
    stockBas > 0 && can('nav.stock') && { n: stockBas, txt: `matériel${stockBas > 1 ? 's' : ''} en stock bas`, to: '/app/stock', icon: '📦', color: C.ambre },
  ].filter(Boolean)

  const raccourcis = [
    can('souhaits.create') && { label: 'Nouveau souhait', to: '/app/souhaits/nouveau', icon: '➕', primary: true },
    { label: 'Mes disponibilités', to: '/app/disponibilites', icon: '📅' },
    can('nav.annuaire') && { label: 'Annuaire', to: '/app/annuaire', icon: '📒' },
    { label: 'Encoder un défraiement', to: '/app/defraiements', icon: '🧾' },
  ].filter(Boolean)

  return (
    <div style={{ padding: 'clamp(16px,3vw,30px)', maxWidth: 1100, margin: '0 auto', fontFamily: "'DM Sans',sans-serif" }}>
      <style>{`
        @keyframes haRise { from { opacity:0; transform: translateY(10px) } to { opacity:1; transform:none } }
        .ha-rise { animation: haRise .5s cubic-bezier(.2,.7,.2,1) both }
        .ha-tile { transition: transform .15s ease, box-shadow .15s ease; }
        .ha-tile:hover { transform: translateY(-3px); box-shadow: 0 10px 26px rgba(10,74,90,.12); }
        .ha-link { transition: background .15s ease; }
        .ha-link:hover { background: #F5F0EB !important; }
        @media (prefers-reduced-motion: reduce){ .ha-rise{ animation:none } .ha-tile:hover{ transform:none } }
      `}</style>

      {/* ── Héros : accueil + prochain souhait ── */}
      <div className="ha-rise" style={{ background: 'linear-gradient(135deg,#0A4A5A 0%,#0E7A93 55%,#1BB0CE 120%)', borderRadius: 20, padding: 'clamp(20px,3vw,30px)', color: 'white', position: 'relative', overflow: 'hidden', marginBottom: 22 }}>
        <div style={{ position: 'absolute', right: -40, top: -40, fontSize: 220, opacity: .07, lineHeight: 1, userSelect: 'none' }}>❤</div>
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 13, opacity: .85, textTransform: 'capitalize' }}>{dateLongue}</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 'clamp(28px,5vw,40px)', fontWeight: 600, margin: '2px 0 4px' }}>
            {salut}{prenom ? `, ${prenom}` : ''} <span style={{ fontSize: '.7em' }}>👋</span>
          </h1>
          <p style={{ fontSize: 14.5, opacity: .9, margin: 0, maxWidth: 520 }}>
            Chaque souhait réalisé, c'est un moment de bonheur offert. Voici où en est l'équipe aujourd'hui.
          </p>

          {prochain ? (
            <div onClick={() => nav(`/app/souhaits/${prochain.id}`)} role="button" tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && nav(`/app/souhaits/${prochain.id}`)}
              style={{ marginTop: 18, background: 'rgba(255,255,255,.14)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,.25)', borderRadius: 14, padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: .8, opacity: .85, fontWeight: 600 }}>Prochain souhait à réaliser</div>
                <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 600, lineHeight: 1.15, margin: '2px 0' }}>{nomP(prochain)}</div>
                {prochain.souhait_description && <div style={{ fontSize: 13, opacity: .9, fontStyle: 'italic' }}>« {prochain.souhait_description.slice(0, 90)}{prochain.souhait_description.length > 90 ? '…' : ''} »</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{compteJours(joursAvant(prochain._date))}</div>
                <div style={{ fontSize: 12.5, opacity: .85, textTransform: 'capitalize' }}>{fmtDate(prochain._date)}</div>
                {prochain.urgence && <div style={{ display: 'inline-block', marginTop: 5, background: '#fff', color: C.rouge, fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '2px 9px' }}>⚠️ Urgent</div>}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 18, background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)', borderRadius: 14, padding: '14px 16px', fontSize: 14 }}>
              Aucun souhait daté à venir pour l'instant. {can('souhaits.create') && <span onClick={() => nav('/app/souhaits/nouveau')} style={{ textDecoration: 'underline', cursor: 'pointer', fontWeight: 600 }}>Créer un souhait</span>}
            </div>
          )}
        </div>
      </div>

      {/* ── Tuiles ── */}
      {tuiles.length > 0 && (
        <div className="ha-rise" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 12, marginBottom: 24, animationDelay: '.05s' }}>
          {tuiles.map((t, i) => (
            <div key={i} className="ha-tile" onClick={() => nav(t.to)}
              style={{ background: 'white', border: '1px solid rgba(0,0,0,.06)', borderRadius: 16, padding: '16px 16px 14px', cursor: 'pointer' }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, marginBottom: 10 }}>{t.icon}</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: t.color, lineHeight: 1 }}>{t.value}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.texte, marginTop: 4 }}>{t.label}</div>
              <div style={{ fontSize: 11.5, color: C.gris }}>{t.sub}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 22, alignItems: 'start' }}>
        {/* ── À faire ── */}
        <section className="ha-rise" style={{ animationDelay: '.1s' }}>
          <h2 style={titreSection}>À faire</h2>
          {aFaire.length === 0 ? (
            <div style={{ background: '#F6FBF1', border: '1px solid rgba(59,109,17,.2)', borderRadius: 14, padding: '18px 16px', color: '#3B6D11', fontSize: 14, fontWeight: 600 }}>
              ✓ Tout est à jour. Rien ne vous attend pour le moment.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {aFaire.map((a, i) => (
                <div key={i} className="ha-link" onClick={() => nav(a.to)}
                  style={{ background: 'white', border: '1px solid rgba(0,0,0,.06)', borderRadius: 12, padding: '13px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 13 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, background: a.color + '1A', color: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{a.icon}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, color: a.color, fontSize: 16 }}>{a.n}</span>
                    <span style={{ color: C.texte, fontSize: 13.5 }}> {a.txt}</span>
                  </div>
                  <span style={{ color: C.gris2, fontSize: 18 }}>›</span>
                </div>
              ))}
            </div>
          )}

          {/* Raccourcis */}
          <h2 style={{ ...titreSection, marginTop: 24 }}>Raccourcis</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {raccourcis.map((r, i) => (
              <button key={i} onClick={() => nav(r.to)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 10, border: r.primary ? 'none' : '1px solid rgba(0,0,0,.12)', background: r.primary ? C.rose : 'white', color: r.primary ? 'white' : C.fonce, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
                <span>{r.icon}</span>{r.label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Prochains souhaits ── */}
        <section className="ha-rise" style={{ animationDelay: '.15s' }}>
          <h2 style={titreSection}>Prochains souhaits</h2>
          {loading ? (
            <div style={{ color: C.gris, fontSize: 14 }}>Chargement…</div>
          ) : aVenir.length === 0 ? (
            <div style={{ background: 'white', border: '1px solid rgba(0,0,0,.06)', borderRadius: 14, padding: '18px 16px', color: C.gris, fontSize: 14 }}>
              Aucun souhait daté à venir.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {aVenir.slice(0, 6).map(s => {
                const info = statutInfo(s.statut)
                const n = joursAvant(s._date)
                return (
                  <div key={s.id} className="ha-link" onClick={() => nav(`/app/souhaits/${s.id}`)}
                    style={{ background: 'white', border: '1px solid rgba(0,0,0,.06)', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 13 }}>
                    <div style={{ textAlign: 'center', flexShrink: 0, width: 50 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: C.teal, lineHeight: 1 }}>{new Date(s._date + 'T00:00:00').getDate()}</div>
                      <div style={{ fontSize: 10.5, color: C.gris, textTransform: 'uppercase' }}>{new Date(s._date + 'T00:00:00').toLocaleDateString('fr-BE', { month: 'short' })}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: C.texte, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomP(s)} {s.urgence && '⚠️'}</div>
                      <div style={{ fontSize: 12, color: C.gris }}>{compteJours(n)}{s.souhait_lieu ? ` · ${s.souhait_lieu}` : ''}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: info.color, background: info.bg, borderRadius: 99, padding: '3px 9px', flexShrink: 0 }}>{info.court}</span>
                  </div>
                )
              })}
              {aVenir.length > 6 && (
                <button onClick={() => nav('/app/souhaits')} style={{ background: 'none', border: 'none', color: C.teal, fontWeight: 600, fontSize: 13, cursor: 'pointer', padding: '6px 0', textAlign: 'left', fontFamily: "'DM Sans',sans-serif" }}>
                  Voir les {aVenir.length} souhaits à venir →
                </button>
              )}
            </div>
          )}

          {mesDispos === 0 && (
            <div style={{ marginTop: 14, background: '#FFFBF3', border: '1px solid rgba(186,117,23,.25)', borderRadius: 12, padding: '13px 15px' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#8A560F' }}>📅 Vous n'avez aucune disponibilité encodée à venir.</div>
              <button onClick={() => nav('/app/disponibilites')} style={{ marginTop: 8, background: C.ambre, color: 'white', border: 'none', borderRadius: 9, padding: '7px 14px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>Encoder mes disponibilités</button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

const C = {
  fonce: '#0A4A5A', teal: '#0E7A93', bleu: '#1BB0CE', bleuP: '#185FA5',
  rose: '#C8435A', rouge: '#A32D2D', ambre: '#BA7517', vert: '#3B6D11',
  texte: '#1A1514', gris: '#7A7470', gris2: '#A8A39D',
}
const titreSection = { fontFamily: "'Cormorant Garamond',serif", fontSize: 22, fontWeight: 600, color: C.fonce, margin: '0 0 12px' }