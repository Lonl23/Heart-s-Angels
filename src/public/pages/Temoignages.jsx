import { useState, useEffect } from 'react'
import { useI18n } from '../i18n/index.jsx'
import { supabase } from '@/lib/supabase'
import { TEMOS_STATIC } from '../utils/images.js'
import { SepAuto } from '../components/Decor.jsx'

export default function Temoignages() {
  const { raw } = useI18n()
  const lang = raw?.lang || 'fr'
  const [temos, setTemos] = useState(TEMOS_STATIC)
  const [sel, setSel] = useState(0)

  useEffect(() => {
    supabase.from('temoignages_publics').select('*').eq('publie', true).order('ordre')
      .then(({ data }) => { if (data?.length) setTemos([...TEMOS_STATIC, ...data]) })
  }, [])

  const t = temos[sel]

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      {/* Hero */}
      <section className="te-hero">
        <div className="te-hero-inner">
          <div className="te-tag">💬 Témoignages</div>
          <h1 className="te-h1">Ce que disent <em>les familles</em></h1>
          <p className="te-p">Ces mots viennent du cœur des patients et de leurs proches. Ils sont notre plus belle récompense.</p>
        </div>
      </section>

      {/* vague hero → contenu */}
      <SepAuto haut="#0E4A5A" bas="#FDFAF6" />

      {/* Témoignage principal */}
      <section style={{ padding:'64px 20px', background:'#FDFAF6' }}>
        <div style={{ maxWidth:860, margin:'0 auto' }}>
          <div className="te-featured">
            <div className="te-quote-mark">"</div>
            <p className="te-featured-text">
              {t[`texte_${lang}`] || t.texte_fr}
            </p>
            <div className="te-featured-author">
              {(t.photo_url || t.img) && (
                <img src={t.photo_url || t.img} alt={t.auteur_nom || t.nom} className="te-featured-img" />
              )}
              <div>
                <div className="te-featured-name">{t.auteur_nom || t.nom}</div>
                <div className="te-featured-role">{t[`auteur_role_${lang}`] || t[`role_${lang}`] || t.role_fr || t.auteur_role_fr}</div>
              </div>
            </div>
          </div>

          {/* Sélecteur */}
          <div style={{ display:'flex', gap:10, justifyContent:'center', marginTop:28, flexWrap:'wrap' }}>
            {temos.map((tm, i) => (
              <button key={i} onClick={() => setSel(i)}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:99, border:`1.5px solid ${sel===i?'#1BB0CE':'rgba(27,176,206,.2)'}`, background: sel===i ? '#E6F7FA' : 'white', cursor:'pointer', transition:'all .15s', fontFamily:"'DM Sans',sans-serif" }}>
                {(tm.photo_url || tm.img) && <img src={tm.photo_url || tm.img} alt="" style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover' }} />}
                <span style={{ fontSize:13, fontWeight: sel===i ? 600 : 400, color: sel===i ? '#1BB0CE' : '#7A7470' }}>
                  {tm.auteur_nom || tm.nom}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Grille tous les témoignages */}
      <section style={{ padding:'0 20px 72px', background:'#FDFAF6' }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:18 }}>
            {temos.map((tm, i) => (
              <div key={i} className="te-card" onClick={()=>setSel(i)} style={{ cursor:'pointer', opacity: sel===i ? 1 : .85, border:`1px solid ${sel===i?'#1BB0CE':'rgba(27,176,206,.1)'}` }}>
                <div className="te-card-quote">"</div>
                <p className="te-card-text">{(tm[`texte_${lang}`] || tm.texte_fr || '').slice(0,160)}…</p>
                <div className="te-card-author">
                  {(tm.photo_url || tm.img) && <img src={tm.photo_url || tm.img} alt="" className="te-card-img" />}
                  <div>
                    <div className="te-card-name">{tm.auteur_nom || tm.nom}</div>
                    <div className="te-card-role">{tm[`auteur_role_${lang}`] || tm[`role_${lang}`] || tm.auteur_role_fr || tm.role_fr}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      {/* vague → CTA */}
      <SepAuto haut="#FDFAF6" bas="#0A1E2D" />
      <section style={{ background:'linear-gradient(135deg,#0A1E2D,#0E4A5A)', padding:'64px 20px', textAlign:'center' }}>
        <div style={{ maxWidth:560, margin:'0 auto' }}>
          <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'clamp(1.7rem,3vw,2.4rem)', fontWeight:500, color:'white', marginBottom:14 }}>
            Votre histoire peut aussi changer une vie
          </h2>
          <p style={{ fontSize:15, color:'rgba(255,255,255,.7)', marginBottom:28, lineHeight:1.75 }}>
            Vous avez vécu un souhait avec nous ? Partagez votre témoignage pour inspirer d'autres familles.
          </p>
          <a href="/contact" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 26px', background:'white', color:'#0A1E2D', borderRadius:9, textDecoration:'none', fontSize:14, fontWeight:700, boxShadow:'0 4px 16px rgba(0,0,0,.15)' }}>
            ✉️ Partager mon témoignage
          </a>
        </div>
      </section>
    </div>
  )
}

const CSS = `
.te-hero{background:linear-gradient(135deg,#0A1E2D,#0E4A5A);padding:72px 20px;position:relative;overflow:hidden;}
.te-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 60% at 80% 50%,rgba(27,176,206,.15),transparent);pointer-events:none;}
.te-hero-inner{position:relative;z-index:1;max-width:1280px;margin:0 auto;}
.te-tag{display:inline-flex;background:rgba(27,176,206,.25);border:1px solid rgba(27,176,206,.4);border-radius:99px;padding:5px 14px;font-size:11.5px;font-weight:500;color:#7DE4F5;letter-spacing:.04em;text-transform:uppercase;margin-bottom:18px;}
.te-h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(2.4rem,5vw,3.8rem);font-weight:500;color:white;line-height:1.15;margin-bottom:14px;}
.te-h1 em{font-style:italic;color:#7DE4F5;}
.te-p{font-size:15px;color:rgba(255,255,255,.7);max-width:560px;line-height:1.75;}
.te-featured{background:white;border:1px solid rgba(27,176,206,.12);border-radius:20px;padding:40px;position:relative;box-shadow:0 4px 24px rgba(27,176,206,.08);}
.te-quote-mark{font-family:'Cormorant Garamond',Georgia,serif;font-size:6rem;line-height:1;color:#E6F7FA;position:absolute;top:16px;left:24px;}
.te-featured-text{font-size:16px;color:#1A1514;line-height:1.85;font-style:italic;margin-bottom:24px;padding-top:24px;}
.te-featured-author{display:flex;align-items:center;gap:14px;padding-top:20px;border-top:1px solid rgba(27,176,206,.1);}
.te-featured-img{width:56px;height:56px;border-radius:50%;object-fit:cover;border:3px solid #E6F7FA;flex-shrink:0;}
.te-featured-name{font-size:15px;font-weight:600;color:#1A1514;}
.te-featured-role{font-size:13px;color:#7A7470;}
.te-card{background:white;border-radius:16px;padding:22px;position:relative;box-shadow:0 2px 12px rgba(27,176,206,.06);transition:all .15s;}
.te-card:hover{transform:translateY(-3px);box-shadow:0 8px 26px rgba(27,176,206,.12);}
.te-card-quote{font-family:'Cormorant Garamond',Georgia,serif;font-size:3.5rem;line-height:1;color:#E6F7FA;position:absolute;top:10px;left:16px;}
.te-card-text{font-size:13.5px;color:#4A4340;line-height:1.75;margin-bottom:16px;padding-top:16px;font-style:italic;}
.te-card-author{display:flex;align-items:center;gap:10px;padding-top:14px;border-top:1px solid rgba(27,176,206,.08);}
.te-card-img{width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid #E6F7FA;flex-shrink:0;}
.te-card-name{font-size:13px;font-weight:600;color:#1A1514;}
.te-card-role{font-size:11.5px;color:#7A7470;}
`