import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.jsx'
import { SepAuto } from '../components/Decor.jsx'

export default function Mission() {
  const { raw } = useI18n()
  const a = raw?.about || {}

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      {/* Hero */}
      <section className="mi-hero">
        <div className="mi-hero-inner">
          <div className="tag">À propos</div>
          <h1 className="h1">{a.title || "Réaliser l'impossible"}</h1>
          <p className="p-hero">{a.mission?.p || "Notre ASBL a une vocation unique : offrir gratuitement un accompagnement médical et logistique pour concrétiser les derniers souhaits de patients en soins palliatifs."}</p>
        </div>
      </section>

      {/* vague hero → contenu */}
      <SepAuto haut="#0E4A5A" bas="#FDFAF6" />

      {/* Mission */}
      <section className="mi-section">
        <div className="mi-inner">
          <div className="mi-grid">
            <div>
              <div className="mi-tag">{a.mission?.title || 'Notre Mission'}</div>
              <h2 className="h2">{a.mission?.title || 'Notre Mission'}</h2>
              <p className="mi-p">{a.mission?.p || "Notre ASBL offre aux patients en soins palliatifs la réalisation gratuite d'un souhait, leur permettant de vivre une expérience tant espérée accompagnés de leurs familles."}</p>
            </div>
            <div style={{ background:'linear-gradient(135deg,#E6F7FA,#B5E8F5)', borderRadius:18, padding:'2rem', textAlign:'center' }}>
              <div style={{ fontSize:'4rem', marginBottom:12 }}>💝</div>
              <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.4rem', fontWeight:500, color:'#0E4A5A' }}>Toujours gratuit</div>
              <p style={{ fontSize:13, color:'#0E7A93', marginTop:8, lineHeight:1.6 }}>Tous nos services sont offerts gratuitement aux bénéficiaires et à leur famille.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Impact */}
      <section className="mi-section mi-alt">
        <div className="mi-inner">
          <h2 className="h2" style={{ textAlign:'center', marginBottom:36 }}>{a.human?.impact || 'Un impact positif pour tous'}</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
            {[
              { icon:'🏥', title:'Pour le patient', text: a.human?.i1 || 'Une réduction de la souffrance et de l\'anxiété, et le sentiment réconfortant d\'être entendu et respecté jusqu\'au bout.' },
              { icon:'👨‍👩‍👧', title:'Pour les proches', text: a.human?.i2 || 'L\'opportunité de renforcer les liens familiaux et de partager des moments significatifs.' },
              { icon:'🩺', title:'Pour les soignants', text: a.human?.i3 || 'Une humanisation des soins et la satisfaction de contribuer activement au bien-être global du patient.' },
            ].map((c,i) => (
              <div key={i} style={{ background:'white', border:'1px solid rgba(27,176,206,.1)', borderRadius:14, padding:'22px', boxShadow:'0 2px 12px rgba(27,176,206,.06)' }}>
                <div style={{ fontSize:'2rem', marginBottom:10 }}>{c.icon}</div>
                <div style={{ fontSize:14.5, fontWeight:600, color:'#1A1514', marginBottom:8 }}>{c.title}</div>
                <p style={{ fontSize:13.5, color:'#7A7470', lineHeight:1.65 }}>{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Équipe */}
      <section className="mi-section">
        <div className="mi-inner">
          <div className="mi-grid">
            <div style={{ background:'linear-gradient(135deg,#E6F7FA,#B5E8F5)', borderRadius:18, padding:'2rem', textAlign:'center' }}>
              <div style={{ fontSize:'4rem', marginBottom:12 }}>🤝</div>
              <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.4rem', fontWeight:500, color:'#0E4A5A' }}>{a.team?.title || 'Une équipe unie'}</div>
            </div>
            <div>
              <h2 className="h2">{a.team?.title || 'Soignants et Soutiens'}</h2>
              <p className="mi-p">{a.team?.p || "Notre force réside dans la complémentarité de nos équipes. Tout au long de l'année, ils organisent des événements variés pour récolter les fonds nécessaires."}</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:20 }}>
                {['Comité Médical','Comité Accompagnants','Comité Logistique','Comité Soutien'].map((c,i) => (
                  <div key={i} style={{ background:'#E6F7FA', borderRadius:10, padding:'12px 14px', fontSize:13.5, color:'#0E4A5A', fontWeight:500 }}>✓ {c}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      {/* vague → CTA */}
      <SepAuto haut="#F0F9FB" bas="#0A1E2D" />
      <section style={{ background:'linear-gradient(135deg,#0A1E2D,#0E4A5A)', padding:'64px 20px', textAlign:'center' }}>
        <div style={{ maxWidth:560, margin:'0 auto' }}>
          <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'clamp(1.7rem,3vw,2.4rem)', fontWeight:500, color:'white', marginBottom:14 }}>
            Rejoindre l'aventure
          </h2>
          <p style={{ fontSize:15, color:'rgba(255,255,255,.7)', marginBottom:28, lineHeight:1.75 }}>
            Bénévole, partenaire ou donateur — chaque soutien compte.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <Link to="/devenir-benevole" style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'11px 22px', background:'#1BB0CE', color:'white', borderRadius:8, textDecoration:'none', fontSize:14, fontWeight:600 }}>🙋 Devenir bénévole</Link>
            <Link to="/demande-de-souhait" style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'11px 20px', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.25)', color:'white', borderRadius:8, textDecoration:'none', fontSize:14 }}>❤️ Formulaire souhait</Link>
          </div>
        </div>
      </section>
    </div>
  )
}

const CSS = `
.mi-hero{background:linear-gradient(135deg,#0A1E2D,#0E4A5A);padding:72px 20px;position:relative;overflow:hidden;}
.mi-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 60% at 80% 50%,rgba(27,176,206,.15),transparent);pointer-events:none;}
.mi-hero-inner{position:relative;z-index:1;max-width:1280px;margin:0 auto;}
.tag{display:inline-flex;background:rgba(27,176,206,.25);border:1px solid rgba(27,176,206,.4);border-radius:99px;padding:5px 14px;font-size:11.5px;font-weight:500;color:#7DE4F5;letter-spacing:.04em;text-transform:uppercase;margin-bottom:18px;}
.h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(2.4rem,5vw,3.8rem);font-weight:500;color:white;line-height:1.15;margin-bottom:14px;}
.p-hero{font-size:15px;color:rgba(255,255,255,.7);max-width:600px;line-height:1.75;}
.mi-section{padding:64px 20px;background:#FDFAF6;}
.mi-alt{background:#F0F9FB;}
.mi-inner{max-width:1280px;margin:0 auto;}
.mi-grid{display:grid;grid-template-columns:1fr 1fr;gap:52px;align-items:center;}
.mi-tag{display:inline-flex;background:#E6F7FA;color:#1BB0CE;border-radius:99px;padding:4px 12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;}
.h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(1.7rem,3vw,2.4rem);font-weight:500;line-height:1.2;letter-spacing:-.02em;color:#1A1514;margin-bottom:14px;}
.mi-p{font-size:15px;color:#4A4340;line-height:1.8;}
@media(max-width:900px){.mi-section{padding:44px 14px;}.mi-grid{grid-template-columns:1fr !important;gap:28px;}[style*='grid-template-columns: repeat(3,1fr)']{grid-template-columns:1fr !important;}}
`