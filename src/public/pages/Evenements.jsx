import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.jsx'
import { supabase } from '@/lib/supabase'
import { SepAuto } from '../components/Decor.jsx'
import { useSiteImage } from '@/lib/siteConfig'

export default function Evenements() {
  const { raw } = useI18n()
  const heroImg = useSiteImage('hero_evenements', null)
  const lang = raw?.lang || 'fr'
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState(null)

  useEffect(() => {
    supabase.from('evenements_publics').select('*').eq('publie', true)
      .order('date_debut').then(({ data }) => {
        setEvents(data || [])
        setLoading(false)
      })
  }, [])

  const upcoming = events.filter(e => new Date(e.date_debut) >= new Date())
  const past     = events.filter(e => new Date(e.date_debut) < new Date())

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      {/* Hero */}
      <section className="ev-hero" style={{ '--hero-bg': heroImg ? `url(${heroImg})` : 'none' }}>
        <div className="ev-hero-overlay" />
        <div className="ev-hero-inner">
          <div className="tag-hero">Agenda</div>
          <h1 className="h1-hero">Nos <em>événements</em></h1>
          <p className="p-hero">Retrouvez tous nos événements à venir et passés. Chaque participation contribue à la réalisation de nouveaux souhaits.</p>
        </div>
      </section>

      {/* vague hero → contenu */}
      <SepAuto haut="#0E4A5A" bas="#FDFAF6" />

      {/* À venir */}
      <section className="ev-section">
        <div className="ev-inner">
          <h2 className="h2-section">📅 Prochains événements</h2>
          <div className="ev-grid">
            {upcoming.map((ev, i) => (
              <EventCard key={ev.id || i} ev={ev} lang={lang} onClick={() => setSel(ev)} />
            ))}
          </div>
          {!loading && upcoming.length === 0 && (
            <p style={{ color:'#7A7470', fontSize:14.5, textAlign:'center', padding:'24px 0' }}>
              Aucun événement à venir pour le moment. Revenez bientôt !
            </p>
          )}
        </div>
      </section>

      {/* Passés */}
      {past.length > 0 && (
        <section className="ev-section ev-section-alt">
          <div className="ev-inner">
            <h2 className="h2-section" style={{ opacity:.7 }}>🕐 Événements passés</h2>
            <div className="ev-grid">
              {past.slice(0,4).map((ev, i) => (
                <EventCard key={ev.id || i} ev={ev} lang={lang} onClick={() => setSel(ev)} past />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Modal détail */}
      {sel && (
        <div className="ev-modal-bg" onClick={() => setSel(null)}>
          <div className="ev-modal" onClick={e => e.stopPropagation()}>
            <button className="ev-modal-close" onClick={() => setSel(null)}>✕</button>
            {sel.image_url && <img src={sel.image_url} alt="" className="ev-modal-img" />}
            <div className="ev-modal-body">
              <div className="ev-modal-date">
                📅 {new Date(sel.date_debut).toLocaleDateString('fr-BE', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
                {sel.heure && ` · 🕐 ${sel.heure}`}
              </div>
              <h2 className="ev-modal-title">{sel[`titre_${lang}`] || sel.titre_fr}</h2>
              {sel.lieu && <div className="ev-modal-lieu">📍 {sel.lieu}</div>}
              <div className="ev-modal-desc" dangerouslySetInnerHTML={{ __html: sel[`desc_${lang}`] || sel.desc_fr || '' }} />
              <div className="ev-modal-footer">
                {sel.gratuit
                  ? <span className="ev-badge-green">✓ Gratuit</span>
                  : sel.prix_adulte > 0 && <span className="ev-badge-blue">Adulte : {sel.prix_adulte} €</span>
                }
                <Link 
                  to={`/evenements/${sel.slug || sel.id}/inscription`}
                  className="ev-btn-inscr"
                >
                  📝 S'inscrire →
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EventCard({ ev, lang, onClick, past }) {
  const titre = ev[`titre_${lang}`] || ev.titre_fr
  const desc  = ev[`desc_${lang}`]  || ev.desc_fr || ''
  const d     = new Date(ev.date_debut)
  return (
    <div className={`ev-card ${past ? 'ev-card-past' : ''}`} onClick={onClick}>
      {ev.image_url
        ? <img src={ev.image_url} alt={titre} className="ev-card-img" loading="lazy" />
        : <div className="ev-card-img-placeholder">🎪</div>
      }
      <div className="ev-card-banner" />
      <div className="ev-card-body">
        <div className="ev-card-date">
          📅 {d.toLocaleDateString('fr-BE', { day:'numeric', month:'long', year:'numeric' })}
        </div>
        <h3 className="ev-card-title">{titre}</h3>
        <p className="ev-card-desc">{desc.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim().slice(0,100)}…</p>
        <div className="ev-card-meta">
          {ev.lieu && <span>📍 {ev.lieu.split(',')[0]}</span>}
          {ev.heure && <span>🕐 {ev.heure}</span>}
          {ev.gratuit && <span className="ev-badge-green">Gratuit</span>}
        </div>
        <div className="ev-card-more">Voir les détails →</div>
      </div>
    </div>
  )
}

const CSS = `
.ev-hero{background:linear-gradient(135deg,#0A1E2D,#0E4A5A);padding:80px 20px 72px;position:relative;overflow:hidden;}
.ev-hero::before{content:'';position:absolute;inset:0;background:var(--hero-bg) center/cover;opacity:.15;transition:opacity .5s ease;}
.ev-hero-overlay{position:absolute;inset:0;background:linear-gradient(135deg,rgba(10,30,45,.9),rgba(14,74,90,.7));}
.ev-hero-inner{position:relative;z-index:1;max-width:1280px;margin:0 auto;}
.tag-hero{display:inline-flex;background:rgba(27,176,206,.25);border:1px solid rgba(27,176,206,.4);border-radius:99px;padding:5px 14px;font-size:11.5px;font-weight:500;color:#7DE4F5;letter-spacing:.04em;text-transform:uppercase;margin-bottom:18px;}
.h1-hero{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(2.4rem,5vw,3.8rem);font-weight:500;color:white;line-height:1.15;margin-bottom:14px;}
.h1-hero em{font-style:italic;color:#7DE4F5;}
.p-hero{font-size:15px;color:rgba(255,255,255,.7);max-width:560px;line-height:1.75;}
.ev-section{padding:64px 20px;background:#FDFAF6;}
.ev-section-alt{background:#F0F9FB;}
.ev-inner{max-width:1280px;margin:0 auto;}
.h2-section{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.9rem;font-weight:500;color:#1A1514;margin-bottom:28px;}
.ev-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;}
.ev-card{background:white;border:1px solid rgba(27,176,206,.12);border-radius:16px;overflow:hidden;cursor:pointer;transition:transform .15s,box-shadow .15s;box-shadow:0 2px 12px rgba(27,176,206,.06);}
.ev-card:hover{transform:translateY(-4px);box-shadow:0 10px 30px rgba(27,176,206,.14);}
.ev-card-past{opacity:.7;}
.ev-card-img{width:100%;height:180px;object-fit:cover;display:block;}
.ev-card-img-placeholder{height:100px;background:linear-gradient(135deg,#E6F7FA,#B5E8F5);display:flex;align-items:center;justify-content:center;font-size:3rem;}
.ev-card-banner{height:4px;background:linear-gradient(90deg,#1BB0CE,#5DD0E8);}
.ev-card-body{padding:18px;}
.ev-card-date{font-size:11px;font-weight:600;color:#1BB0CE;background:#E6F7FA;display:inline-block;padding:3px 10px;border-radius:99px;margin-bottom:10px;}
.ev-card-title{font-size:15.5px;font-weight:600;color:#1A1514;margin-bottom:7px;line-height:1.3;}
.ev-card-desc{font-size:12.5px;color:#7A7470;line-height:1.6;margin-bottom:10px;}
.ev-card-meta{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:#7A7470;margin-bottom:10px;}
.ev-badge-green{background:#EAF3DE;color:#3B6D11;padding:2px 8px;border-radius:99px;font-size:11.5px;font-weight:600;}
.ev-badge-blue{background:#E6F7FA;color:#1BB0CE;padding:2px 8px;border-radius:99px;font-size:11.5px;font-weight:600;}
.ev-card-more{font-size:12.5px;color:#1BB0CE;font-weight:600;}
/* Modal */
.ev-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;}
.ev-modal{background:white;border-radius:18px;max-width:580px;width:100%;max-height:90vh;overflow-y:auto;position:relative;box-shadow:0 20px 60px rgba(0,0,0,.25);}
.ev-modal-close{position:absolute;top:14px;right:14px;background:rgba(0,0,0,.1);border:none;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;z-index:1;}
.ev-modal-img{width:100%;height:220px;object-fit:cover;border-radius:18px 18px 0 0;display:block;}
.ev-modal-body{padding:24px;}
.ev-modal-date{font-size:12px;color:#1BB0CE;font-weight:600;margin-bottom:10px;}
.ev-modal-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.6rem;font-weight:500;color:#1A1514;margin-bottom:8px;}
.ev-modal-lieu{font-size:13.5px;color:#7A7470;margin-bottom:14px;}
.ev-modal-desc{font-size:14px;color:#4A4340;line-height:1.8;margin-bottom:20px;}
.ev-modal-footer{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding-top:16px;border-top:1px solid rgba(27,176,206,.1);}
.ev-btn-inscr{display:inline-flex;align-items:center;gap:7px;padding:10px 20px;background:#1BB0CE;color:white;border-radius:8px;text-decoration:none;font-size:13.5px;font-weight:600;transition:all .15s;}
.ev-btn-inscr:hover{background:#0E7A93;}
@media(max-width:600px){.ev-section{padding:44px 14px;}}
`