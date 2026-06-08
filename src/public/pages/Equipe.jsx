import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.jsx'
import { supabase } from '@/lib/supabase'
import { IMG } from '../utils/images.js'
import { SepAuto } from '../components/Decor.jsx'
import { useSiteImage } from '@/lib/siteConfig'

const EQUIPE_STATIC = [
  { prenom:'Ludovic',   nom:'Whenham',  role_fr:'Président · Infirmier en soins palliatifs', categorie:'ca', photo_url: IMG.ludovic },
  { prenom:'Carine',    nom:'Carlier',  role_fr:'Vice-présidente · Secrétaire & Récolteuse de souhaits', categorie:'ca', photo_url: IMG.carine },
  { prenom:'Véronique', nom:'Cloes',    role_fr:'Relation publique & Récolteuse de souhaits', categorie:'ca', photo_url: IMG.veronique },
  { prenom:'Fernand',   nom:'Hanssen',  role_fr:'Responsable logistique', categorie:'ca', photo_url: IMG.fernand },
  { prenom:'Christine', nom:'Laurent',  role_fr:'Responsable logistique adjointe', categorie:'ca', photo_url: IMG.christine },
  { prenom:'Luc',       nom:'Kessel',   role_fr:'Trésorier adjoint', categorie:'ca', photo_url: IMG.luc },
]

export default function Equipe() {
  const { raw } = useI18n()
  const heroImg = useSiteImage('hero_equipe', null)
  const lang = raw?.lang || 'fr'
  const [membres, setMembres] = useState(EQUIPE_STATIC)

  useEffect(() => {
    supabase.from('equipe_membres').select('*').eq('actif', true).order('ordre')
      .then(({ data }) => { if (data?.length) setMembres(data) })
  }, [])

  const ca = membres.filter(m => m.categorie === 'ca')
  const medical = membres.filter(m => m.categorie === 'medical')
  const benevoles = membres.filter(m => m.categorie === 'benevole')

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      {/* Hero */}
      <section className="eq-hero" style={{ '--hero-bg': heroImg ? `url(${heroImg})` : 'none' }}>
        <div className="eq-hero-bg" />
        <div className="eq-hero-inner">
          <div className="eq-tag">👥 Notre équipe</div>
          <h1 className="eq-h1">Les visages de <em>Heart's Angels</em></h1>
          <p className="eq-p">Une équipe de cœur, entièrement bénévole, au service des patients en soins palliatifs depuis 2015.</p>
        </div>
      </section>

      {/* vague hero → contenu */}
      <SepAuto haut="#0E4A5A" bas="#FDFAF6" />

      {/* Conseil d'administration */}
      <section style={{ padding:'64px 20px', background:'#FDFAF6' }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <div style={{ marginBottom:36 }}>
            <div className="eq-tag-blue">Conseil d'administration</div>
            <h2 className="eq-h2">Les fondateurs & dirigeants</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:18 }}>
            {ca.map((m, i) => <MemberCard key={i} m={m} lang={lang} featured />)}
          </div>
        </div>
      </section>

      {/* Équipe médicale */}
      {medical.length > 0 && (
        <section style={{ padding:'0 20px 64px', background:'#FDFAF6' }}>
          <div style={{ maxWidth:1280, margin:'0 auto' }}>
            <div style={{ marginBottom:28 }}>
              <div className="eq-tag-blue" style={{ background:'#EAF3DE', color:'#3B6D11' }}>🏥 Équipe médicale</div>
              <h2 className="eq-h2">Nos bénévoles médicaux</h2>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:14 }}>
              {medical.map((m, i) => <MemberCard key={i} m={m} lang={lang} />)}
            </div>
          </div>
        </section>
      )}

      {/* Bénévoles */}
      {benevoles.length > 0 && (
        <section style={{ padding:'0 20px 64px', background:'#FDFAF6' }}>
          <div style={{ maxWidth:1280, margin:'0 auto' }}>
            <div style={{ marginBottom:28 }}>
              <div className="eq-tag-blue" style={{ background:'#FAEEDA', color:'#BA7517' }}>🤝 Bénévoles</div>
              <h2 className="eq-h2">Notre équipe de soutien</h2>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:14 }}>
              {benevoles.map((m, i) => <MemberCard key={i} m={m} lang={lang} />)}
            </div>
          </div>
        </section>
      )}

      {/* CTA rejoindre */}
      {/* vague → CTA */}
      <SepAuto haut="#FDFAF6" bas="#0A1E2D" />
      <section style={{ background:'linear-gradient(135deg,#0A1E2D,#0E4A5A)', padding:'64px 20px', textAlign:'center' }}>
        <div style={{ maxWidth:560, margin:'0 auto' }}>
          <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'clamp(1.7rem,3vw,2.4rem)', fontWeight:500, color:'white', marginBottom:14 }}>
            Rejoindre l'aventure
          </h2>
          <p style={{ fontSize:15, color:'rgba(255,255,255,.7)', marginBottom:28, lineHeight:1.75 }}>
            Médecin, infirmier, kiné, logisticien, communicant — toutes les vocations trouvent leur place chez Heart's Angels.
          </p>
          <Link to="/devenir-benevole" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 26px', background:'white', color:'#0A1E2D', borderRadius:9, textDecoration:'none', fontSize:14, fontWeight:700, boxShadow:'0 4px 16px rgba(0,0,0,.15)' }}>
            🙋 Devenir bénévole
          </Link>
        </div>
      </section>
    </div>
  )
}

function MemberCard({ m, lang, featured }) {
  const role = m[`role_${lang}`] || m.role_fr || ''
  return (
    <div className={`eq-card ${featured ? 'eq-card-featured' : ''}`}>
      {m.photo_url
        ? <img src={m.photo_url} alt={`${m.prenom} ${m.nom}`} className="eq-img" loading="lazy" />
        : <div className="eq-img-placeholder">{(m.prenom||'?')[0]}{(m.nom||'?')[0]}</div>
      }
      <div className="eq-name">{m.prenom} {m.nom}</div>
      <div className="eq-role">{role}</div>
    </div>
  )
}

const CSS = `
.eq-hero{background:linear-gradient(135deg,#0A1E2D,#0E4A5A);padding:72px 20px;position:relative;overflow:hidden;}
.eq-hero-bg{position:absolute;inset:0;background:var(--hero-bg) center/cover;opacity:.15;transition:opacity .5s ease;}
.eq-hero-bg::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(10,30,45,.9),rgba(14,74,90,.7));}
.eq-hero-inner{position:relative;z-index:1;max-width:1280px;margin:0 auto;}
.eq-tag{display:inline-flex;background:rgba(27,176,206,.25);border:1px solid rgba(27,176,206,.4);border-radius:99px;padding:5px 14px;font-size:11.5px;font-weight:500;color:#7DE4F5;letter-spacing:.04em;text-transform:uppercase;margin-bottom:18px;}
.eq-tag-blue{display:inline-flex;background:#E6F7FA;color:#1BB0CE;border-radius:99px;padding:4px 12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px;}
.eq-h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(2.4rem,5vw,3.8rem);font-weight:500;color:white;line-height:1.15;margin-bottom:14px;}
.eq-h1 em{font-style:italic;color:#7DE4F5;}
.eq-p{font-size:15px;color:rgba(255,255,255,.7);max-width:560px;line-height:1.75;}
.eq-h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(1.6rem,2.8vw,2.2rem);font-weight:500;color:#1A1514;}
.eq-card{background:white;border:1px solid rgba(27,176,206,.1);border-radius:14px;padding:18px 14px;text-align:center;box-shadow:0 1px 6px rgba(27,176,206,.05);transition:transform .12s,box-shadow .12s;}
.eq-card:hover{transform:translateY(-3px);box-shadow:0 6px 20px rgba(27,176,206,.1);}
.eq-card-featured{border-color:rgba(27,176,206,.2);}
.eq-img{width:80px;height:80px;border-radius:50%;object-fit:cover;margin:0 auto 12px;display:block;border:3px solid #E6F7FA;}
.eq-card-featured .eq-img{width:90px;height:90px;border-color:#1BB0CE;}
.eq-img-placeholder{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#E6F7FA,#B5E8F5);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;font-weight:600;color:#1BB0CE;border:3px solid #E6F7FA;}
.eq-name{font-size:13.5px;font-weight:600;color:#1A1514;margin-bottom:5px;}
.eq-role{font-size:11.5px;color:#7A7470;line-height:1.4;}
`