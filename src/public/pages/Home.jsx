import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../i18n/index.jsx'
import { supabase } from '@/lib/supabase'
import { SepAuto } from '../components/Decor.jsx'
import { useSiteImage } from '@/lib/siteConfig'

const IMG = {
  olivier:  'https://www.heartsangels.be/wp-content/uploads/2019/12/Olivier-Schoonejans.jpg',
  nady:     'https://www.heartsangels.be/wp-content/uploads/2024/06/448340450_848408590653269_3974634456659016404_n.jpg',
  isabelle: 'https://www.heartsangels.be/wp-content/uploads/2023/05/ISABELLESTIERNON.png',
  danielle: 'https://www.heartsangels.be/wp-content/uploads/2023/08/67619839_1166249026894459_8802576039118110720_n.jpg',
  ludovic:  'https://www.heartsangels.be/wp-content/uploads/2023/06/ludovic_whenham-1.jpg',
  carine:   'https://www.heartsangels.be/wp-content/uploads/2023/06/carine_carlier-1.jpg',
  veronique:'https://www.heartsangels.be/wp-content/uploads/2023/06/veronique_cloes-1.jpg',
  fernand:  'https://www.heartsangels.be/wp-content/uploads/2023/06/fernand_hanssen-1.jpg',
  christine:'https://www.heartsangels.be/wp-content/uploads/2023/06/Christine_Laurent-1.jpg',
  luc:      'https://www.heartsangels.be/wp-content/uploads/2023/06/luc_kessel-1.jpg',
}

const PARTNERS_FALLBACK = [
  { nom:'CHC Liège', logo:null }, { nom:'GHDC', logo:null }, { nom:'Interseniors', logo:null },
  { nom:'PalliaLiège', logo:null }, { nom:'Province de Liège', logo:null },
  { nom:'Commune de Flémalle', logo:null }, { nom:'Fédération W-B', logo:null },
  { nom:'Solumob', logo:null }, { nom:'Air Liquide', logo:null }, { nom:'Loterie Nationale', logo:null },
  { nom:'TotalEnergies Foundation', logo:null }, { nom:'Fondation contre le Cancer', logo:null },
  { nom:'Premium Care', logo:null }, { nom:'Sonia Chapelle', logo:null },
]

const EVENTS_FALLBACK = [
  { titre_fr:'Balade motos – 9° édition', date_debut:'2026-06-28T08:00:00', lieu:'Flémalle', heure:'8h–18h', desc_fr:'Pilote 8€ · Accompagnant 4€', lien:'/evenements' },
  { titre_fr:'Marche ADEPS 2026 – 8° édition', date_debut:'2026-11-01T08:00:00', lieu:'Flémalle', heure:'8h–17h', desc_fr:'4 parcours · 5–10–15–20 km · Gratuit', lien:'/evenements' },
]

export default function Home() {
  const { raw } = useI18n()
  const [events, setEvents] = useState(EVENTS_FALLBACK)
  const [temoIdx, setTemoIdx] = useState(0)
  const [partenaires, setPartenaires] = useState(PARTNERS_FALLBACK)
  const heroImg = useSiteImage('hero_accueil', null)
  const [heroPret, setHeroPret] = useState(false)
  useEffect(() => {
    if (!heroImg) return
    const img = new Image(); img.src = heroImg
    img.onload = () => setHeroPret(true)
    if (img.complete) setHeroPret(true)
  }, [heroImg])

  useEffect(() => {

    supabase.from('evenements_publics').select('*').eq('publie', true)
      .gte('date_debut', new Date().toISOString()).order('date_debut').limit(3)
      .then(({ data }) => { if (data?.length) setEvents(data) })

    supabase.from('partenaires').select('nom, logo_url, site_url, ordre')
      .eq('actif', true).order('ordre')
      .then(({ data }) => {
        if (data?.length) setPartenaires(data.map(p => ({ nom:p.nom, logo:p.logo_url||null, url:p.site_url||null })))
      })
  }, [])

  const r = raw || {}
  const hero    = r.home?.hero    || {}
  const loginC  = r.home?.loginCard || {}
  const about   = r.home?.about   || {}
  const cta     = r.home?.cta     || {}
  const temos   = r.home?.testimonials || {}
  const evtrans = r.home?.events  || {}
  const team    = r.home?.team    || {}
  const partners= r.home?.partners || {}

  const TEMOS = [
    { img: IMG.olivier,  name:'Olivier Schoonejans', role:'Journaliste RTL-TVI', text:"Bravo aux bénévoles qui s'investissent pour le respect et le bien-être des personnes en fin de vie. Les Heart's Angels nous apprennent à avoir du cœur !" },
    { img: IMG.nady,     name:'Nady Marie', role:'Fille du bénéficiaire', text:"Mon papa m'a dit qu'il n'oubliera jamais cette journée. Son souhait a été réalisé. Mille merci à l'asbl et aux bénévoles." },
    { img: IMG.isabelle, name:'Isabelle Stienon', role:"Petite-fille d'une bénéficiaire", text:"Elle a pu une dernière fois apprécier son jardin. C'est important que des gens puissent compter sur des associations comme Heart's Angels." },
    { img: IMG.danielle, name:'Fillée Danielle', role:'Bénéficiaire', text:"Merci d'exister car sans vous, mon dernier souhait n'aurait sans doute jamais pu devenir réel." },
  ]

  const TEAM = [
    { img: IMG.ludovic,   name:'Ludovic Whenham',   role:'Président' },
    { img: IMG.carine,    name:'Carine Carlier',    role:'Vice-présidente' },
    { img: IMG.veronique, name:'Véronique Cloes',   role:'Relations publiques' },
    { img: IMG.fernand,   name:'Fernand Hanssen',   role:'Logistique' },
    { img: IMG.christine, name:'Christine Laurent', role:'Logistique adjointe' },
    { img: IMG.luc,       name:'Luc Kessel',        role:'Trésorier adjoint' },
  ]

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      {/* ── HERO compact ── */}
      <section className="hero">
        <div className="hero-bg" style={{ background:'linear-gradient(135deg,#0A1E2D,#0E4A5A)' }} />
        {heroImg && <div className="hero-bg" style={{ backgroundImage:`url(${heroImg})`, opacity: heroPret ? 1 : 0, transition:'opacity .6s ease' }} />}
        <div className="hero-overlay" />
        <div className="hero-inner">
          <div className="hero-content">
            <div className="badge">{hero.tag}</div>
            <h1 className="hero-h1">{hero.title} <em>{hero.titleEm}</em></h1>
            <p className="hero-p">{hero.desc}</p>
            <div className="hero-btns">
              <Link to="/demande-de-souhait" className="btn-blue">❤️ {hero.cta1}</Link>
              <Link to="/nous-soutenir" className="btn-ghost">{hero.cta2} →</Link>
              <Link to="/app" className="btn-login">
                🔒 {loginC.title}
              </Link>
            </div>
            <div className="hero-stats">
              <div><strong>10+</strong><span>ans d'engagement</span></div>
              <div><strong>100%</strong><span>gratuit</span></div>
              <div><strong>❤️</strong><span>bénévoles dévoués</span></div>
            </div>
          </div>
        </div>
              {/* vague en bas du hero, par-dessus l'image */}
        <div className="vague-hero-overlay" style={{ position:'absolute', bottom:-1, left:0, width:'100%', zIndex:2 }}>
          <SepAuto haut="transparent" bas="#FDFAF6" h={90} />
        </div>
</section>

      {/* ── MISSION en 4 cards horizontales ── */}
      <section className="section">
        <div className="inner">
          <div className="section-header">
            <div className="tag">{about.tag}</div>
            <h2 className="h2">{about.title} <em>{about.titleEm}</em></h2>
            <p className="sub">{about.p1}</p>
          </div>
          <div className="cards-4">
            {[
              ['🚑','#E6F7FA', about.c1t, about.c1d],
              ['💝','#FEF0F0', about.c2t, about.c2d],
              ['🤝','#EAF3DE', about.c3t, about.c3d],
              ['🎓','#FDF6E3', about.c4t, about.c4d],
            ].map(([icon, bg, title, desc], i) => (
              <div key={i} className="card-feat" style={{ background:bg }}>
                <div className="card-feat-icon">{icon}</div>
                <div className="card-feat-title">{title}</div>
                <div className="card-feat-desc">{desc}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign:'center', marginTop:28 }}>
            <Link to="/a-propos" className="btn-blue-outline">En savoir plus →</Link>
          </div>
        </div>
      </section>

      {/* ── TÉMOIGNAGE carousel compact ── */}
      <section className="section section-alt">
        <div className="inner">
          <div className="section-header">
            <div className="tag">{temos.tag}</div>
            <h2 className="h2">{temos.title} <em>{temos.titleEm}</em></h2>
          </div>
          <div className="temo-carousel">
            <div className="temo-card">
              <div className="temo-quote">"</div>
              <p className="temo-text">{TEMOS[temoIdx].text}</p>
              <div className="temo-author">
                <img src={TEMOS[temoIdx].img} alt={TEMOS[temoIdx].name} className="temo-img" />
                <div>
                  <div className="temo-name">{TEMOS[temoIdx].name}</div>
                  <div className="temo-role">{TEMOS[temoIdx].role}</div>
                </div>
              </div>
            </div>
            <div className="temo-dots">
              {TEMOS.map((_, i) => (
                <button key={i} className={`temo-dot ${i === temoIdx ? 'active' : ''}`} onClick={() => setTemoIdx(i)} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ÉVÉNEMENTS + DON côte à côte ── */}
      <section className="section">
        <div className="inner">
          <div className="grid-2-asym">
            {/* Événements */}
            <div>
              <div className="tag">{evtrans.tag}</div>
              <h2 className="h2" style={{ marginBottom:20 }}>{evtrans.title} <em>{evtrans.titleEm}</em></h2>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {events.slice(0,2).map((ev, i) => {
                  const d = new Date(ev.date_debut)
                  const dateStr = d.toLocaleDateString('fr-BE', { day:'numeric', month:'long', year:'numeric' })
                  return (
                    <Link key={i} to={ev.lien || '/evenements'} className="ev-row">
                      <div className="ev-date-box">
                        <div className="ev-day">{d.getDate()}</div>
                        <div className="ev-month">{d.toLocaleDateString('fr-BE',{month:'short'})}</div>
                      </div>
                      <div>
                        <div className="ev-title">{ev.titre_fr || ev.titre}</div>
                        <div className="ev-meta">📍 {ev.lieu} {ev.heure && `· 🕐 ${ev.heure}`}</div>
                      </div>
                      <span className="ev-arrow">→</span>
                    </Link>
                  )
                })}
              </div>
              <Link to="/evenements" className="btn-blue-outline" style={{ marginTop:16, display:'inline-flex' }}>Tous les événements →</Link>
            </div>

            {/* Don */}
            <div className="donate-box">
              <div style={{ fontSize:'2.5rem', marginBottom:10 }}>💝</div>
              <h3 className="donate-title">{cta.title}</h3>
              <p className="donate-desc">{cta.desc}</p>
              <Link to="/dons" className="btn-blue" style={{ display:'flex', justifyContent:'center', marginBottom:10 }}>{cta.btn1}</Link>
              <Link to="/devenir-benevole" className="btn-outline" style={{ display:'flex', justifyContent:'center' }}>{cta.btn2}</Link>
              <div className="donate-iban">{cta.iban}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ÉQUIPE compact ── */}
      <section className="section section-alt">
        <div className="inner">
          <div className="section-header">
            <div className="tag">{team.tag}</div>
            <h2 className="h2">{team.title} <em>{team.titleEm}</em></h2>
          </div>
          <div className="team-grid">
            {TEAM.map((m, i) => (
              <div key={i} className="team-card">
                <img src={m.img} alt={m.name} className="team-img" loading="lazy" />
                <div className="team-name">{m.name}</div>
                <div className="team-role">{m.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PARTENAIRES compact ── */}
      <section className="section">
        <div className="inner">
          <div className="section-header">
            <div className="tag">{partners.tag}</div>
            <h2 className="h2">{partners.title}</h2>
          </div>
          <div className="partners-wrap">
            {partenaires.map((p, i) => (
              p.logo ? (
                <span key={i} className="partner-chip" title={p.nom} style={{ display:'inline-flex', alignItems:'center', padding:'8px 14px' }}>
                  <img src={p.logo} alt={p.nom} style={{ height:28, maxWidth:110, objectFit:'contain' }}
                    onError={e=>{ e.target.style.display='none'; e.target.parentNode.appendChild(Object.assign(document.createElement('span'),{textContent:p.nom})) }}/>
                </span>
              ) : <span key={i} className="partner-chip">{p.nom}</span>
            ))}
          </div>
          <div style={{ textAlign:'center', marginTop:24 }}>
            <Link to="/partenaires" className="btn-blue-outline">Voir tous nos partenaires →</Link>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="cta-final">
        <div className="inner" style={{ textAlign:'center' }}>
          <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'clamp(1.8rem,3.5vw,2.6rem)', fontWeight:500, color:'white', marginBottom:12 }}>
            Un souhait à réaliser ?
          </h2>
          <p style={{ fontSize:15, color:'rgba(255,255,255,.75)', marginBottom:28, maxWidth:500, margin:'0 auto 28px' }}>
            Nous réalisons gratuitement les souhaits de patients en soins palliatifs. Contactez-nous dès aujourd'hui.
          </p>
          <Link to="/demande-de-souhait" className="btn-white">❤️ Formulaire de demande de souhait</Link>
        </div>
      </section>
    </div>
  )
}

const CSS = `
:root{--blue:#1BB0CE;--blue-dark:#0E7A93;--blue-light:#E6F7FA;}
/* Hero */
.hero{position:relative;min-height:92vh;display:flex;align-items:center;overflow:hidden;}
.hero-bg{position:absolute;inset:0;background-size:cover;background-position:center top;}
.hero-overlay{position:absolute;inset:0;background:linear-gradient(135deg,rgba(5,20,35,.88) 0%,rgba(5,20,35,.6) 60%,rgba(5,20,35,.35) 100%);}
.hero-inner{position:relative;z-index:1;max-width:1280px;margin:0 auto;padding:80px 24px;width:100%;}
.hero-content{max-width:700px;}
.badge{display:inline-flex;align-items:center;background:rgba(27,176,206,.25);border:1px solid rgba(27,176,206,.4);border-radius:99px;padding:5px 14px;font-size:11.5px;font-weight:500;color:#7DE4F5;letter-spacing:.04em;text-transform:uppercase;margin-bottom:20px;}
.hero-h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(2.6rem,5.5vw,4.2rem);font-weight:500;line-height:1.1;letter-spacing:-.02em;color:white;margin-bottom:18px;}
.hero-h1 em{font-style:italic;color:#7DE4F5;}
.hero-p{font-size:16px;color:rgba(255,255,255,.75);line-height:1.75;margin-bottom:28px;max-width:560px;}
.hero-btns{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:40px;}
.btn-blue{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:11px 22px;background:var(--blue);color:white;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;transition:all .15s;white-space:nowrap;}
.btn-blue:hover{background:var(--blue-dark);}
.btn-ghost{display:inline-flex;align-items:center;padding:11px 20px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);color:white;border-radius:8px;font-size:14px;font-weight:500;text-decoration:none;transition:all .15s;white-space:nowrap;}
.btn-ghost:hover{background:rgba(255,255,255,.2);}
.btn-login{display:inline-flex;align-items:center;gap:7px;padding:11px 20px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:white;border-radius:8px;font-size:14px;font-weight:500;text-decoration:none;transition:all .15s;white-space:nowrap;}
.btn-login:hover{background:rgba(255,255,255,.22);}
.hero-stats{display:flex;gap:32px;padding-top:28px;border-top:1px solid rgba(255,255,255,.12);}
.hero-stats>div{display:flex;flex-direction:column;gap:3px;}
.hero-stats strong{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.8rem;font-weight:600;color:#7DE4F5;line-height:1;}
.hero-stats span{font-size:11.5px;color:rgba(255,255,255,.5);}
/* Sections */
.section{padding:64px 20px;background:#FDFAF6;}
.section-alt{background:#F0F9FB;}
.inner{max-width:1280px;margin:0 auto;}
.section-header{text-align:center;margin-bottom:36px;}
.tag{display:inline-flex;align-items:center;background:var(--blue-light);color:var(--blue);border-radius:99px;padding:4px 12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;}
.h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(1.7rem,3vw,2.4rem);font-weight:500;line-height:1.2;letter-spacing:-.02em;color:#1A1514;margin-bottom:10px;}
.h2 em{font-style:italic;color:var(--blue);}
.sub{font-size:15px;color:#7A7470;max-width:580px;margin:0 auto;line-height:1.7;}
/* 4 cards */
.cards-4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;}
.card-feat{border-radius:14px;padding:20px 16px;}
.card-feat-icon{font-size:24px;margin-bottom:10px;}
.card-feat-title{font-size:13.5px;font-weight:600;color:#1A1514;margin-bottom:6px;}
.card-feat-desc{font-size:12.5px;color:#7A7470;line-height:1.55;}
.btn-blue-outline{display:inline-flex;align-items:center;gap:6px;padding:9px 20px;background:white;color:var(--blue);border:1.5px solid var(--blue);border-radius:8px;font-size:13.5px;font-weight:600;text-decoration:none;transition:all .15s;}
.btn-blue-outline:hover{background:var(--blue-light);}
/* Témoignage */
.temo-carousel{max-width:680px;margin:0 auto;}
.temo-card{background:white;border:1px solid rgba(27,176,206,.1);border-radius:18px;padding:32px;position:relative;box-shadow:0 2px 16px rgba(27,176,206,.07);}
.temo-quote{font-family:'Cormorant Garamond',Georgia,serif;font-size:4rem;line-height:1;color:var(--blue-light);position:absolute;top:14px;left:20px;}
.temo-text{font-size:15px;color:#4A4340;line-height:1.8;margin-bottom:20px;padding-top:20px;font-style:italic;}
.temo-author{display:flex;align-items:center;gap:12px;padding-top:16px;border-top:1px solid rgba(27,176,206,.1);}
.temo-img{width:46px;height:46px;border-radius:50%;object-fit:cover;border:2px solid var(--blue-light);}
.temo-name{font-size:13.5px;font-weight:600;color:#1A1514;}
.temo-role{font-size:12px;color:#7A7470;}
.temo-dots{display:flex;gap:8px;justify-content:center;margin-top:16px;}
.temo-dot{width:8px;height:8px;border-radius:50%;background:rgba(27,176,206,.2);border:none;cursor:pointer;transition:all .15s;padding:0;}
.temo-dot.active{background:var(--blue);transform:scale(1.3);}
/* Événements */
.grid-2-asym{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start;}
.ev-row{display:flex;align-items:center;gap:14px;padding:14px;background:white;border:1px solid rgba(27,176,206,.1);border-radius:12px;text-decoration:none;color:inherit;transition:all .15s;}
.ev-row:hover{border-color:var(--blue);box-shadow:0 3px 14px rgba(27,176,206,.12);}
.ev-date-box{width:48px;height:48px;border-radius:10px;background:var(--blue-light);display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;}
.ev-day{font-size:18px;font-weight:700;color:var(--blue);line-height:1;}
.ev-month{font-size:10px;font-weight:600;color:var(--blue-dark);text-transform:uppercase;}
.ev-title{font-size:13.5px;font-weight:600;color:#1A1514;margin-bottom:3px;line-height:1.3;}
.ev-meta{font-size:12px;color:#7A7470;}
.ev-arrow{margin-left:auto;color:var(--blue);font-size:16px;flex-shrink:0;}
/* Don */
.donate-box{background:white;border:1px solid rgba(27,176,206,.12);border-radius:18px;padding:28px;box-shadow:0 3px 20px rgba(27,176,206,.08);text-align:center;}
.donate-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.5rem;font-weight:500;color:#1A1514;margin-bottom:10px;}
.donate-desc{font-size:13.5px;color:#7A7470;line-height:1.7;margin-bottom:20px;}
.btn-outline{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 22px;background:white;color:var(--blue);border:1.5px solid var(--blue);border-radius:8px;font-size:13.5px;font-weight:600;text-decoration:none;transition:all .15s;}
.btn-outline:hover{background:var(--blue-light);}
.donate-iban{font-size:11px;color:#A8A39D;margin-top:14px;text-align:center;}
/* Équipe */
.team-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;}
.team-card{text-align:center;}
.team-img{width:72px;height:72px;border-radius:50%;object-fit:cover;margin:0 auto 10px;border:3px solid var(--blue-light);display:block;}
.team-name{font-size:12.5px;font-weight:600;color:#1A1514;margin-bottom:3px;}
.team-role{font-size:11px;color:#7A7470;}
/* Partenaires */
.partners-wrap{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;}
.partner-chip{background:white;border:1px solid rgba(27,176,206,.15);border-radius:8px;padding:6px 14px;font-size:12.5px;color:#4A4340;font-weight:500;}
/* CTA final */
.cta-final{background:linear-gradient(135deg,#0E4A5A,#0E7A93);padding:64px 20px;}
.btn-white{display:inline-flex;align-items:center;gap:8px;padding:13px 28px;background:white;color:#0E4A5A;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;box-shadow:0 4px 16px rgba(0,0,0,.15);transition:all .15s;}
.btn-white:hover{transform:translateY(-2px);}
/* Responsive */
@media(max-width:1100px){.team-grid{grid-template-columns:repeat(3,1fr);}}
@media(max-width:900px){.cards-4{grid-template-columns:repeat(2,1fr);}.grid-2-asym{grid-template-columns:1fr !important;gap:32px;}.hero-stats{gap:20px;}}
@media(max-width:600px){.section{padding:44px 14px;}.hero-inner{padding:60px 16px;}.cards-4{grid-template-columns:1fr !important;}.team-grid{grid-template-columns:repeat(2,1fr);}.hero-btns{flex-direction:column;}.hero-stats{flex-wrap:wrap;gap:16px;}}
`