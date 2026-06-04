import { Link } from 'react-router-dom'
import { SepAuto } from '../components/Decor.jsx'

const TV = [
  { titre:'Souhait – Reportage JT RTL-TVI', date:'30-04-2023', url:'https://youtu.be/MybiG7GsTFQ', chaine:'RTL-TVI', icon:'📺' },
  { titre:"Spectacle d'Olivier Laurent à l'IPES de Waremme", date:'12-11-2022', url:'https://youtu.be/SI0qhdKVBAI', chaine:'TV Wallonie', icon:'📺' },
  { titre:'Vews @RTBF', date:'02-11-2021', url:'https://youtu.be/LSTT7fx2f6E', chaine:'RTBF', icon:'📺' },
  { titre:'Reportage JT RTL-TVI', date:'15-11-2019', url:'https://youtu.be/LYrNuTSOZow', chaine:'RTL-TVI', icon:'📺' },
]

const RADIO = [
  { titre:'Max Event – Balade motos', date:'17-05-2023', chaine:'Maximum FM', icon:'🎙️', url:'https://www.heartsangels.be/wp-content/uploads/2023/05/646748c454a825.23857999.mp3' },
  { titre:'Max Event – Pâques au Château', date:'31-03-2023', chaine:'Maximum FM', icon:'🎙️', url:'https://www.heartsangels.be/wp-content/uploads/2023/05/6422b13a6cf373.20851120.mp3' },
  { titre:'100 minutes pour changer le Monde', date:'2018', chaine:'Nostalgie', icon:'🎙️', url:null },
  { titre:'Capsule Bel-RTL', date:'09-12-2021', chaine:'Bel-RTL', icon:'🎙️', url:null },
  { titre:'Podcast Men at Work', date:'30-10-2017', chaine:'Classic 21', icon:'🎙️', url:null },
  { titre:'RCF Sud-Belgique – 2ème Vide-Greniers', date:'11-09-2016', chaine:'RCF Sud-Belgique', icon:'🎙️', url:null },
  { titre:'Wake-Up', date:'24-10-2015', chaine:'EquinoxeFM', icon:'🎙️', url:null },
]

const ECRITE = [
  { titre:'Article VLAN', date:'19-08-2020', media:'VLAN', icon:'📰' },
  { titre:'Article La Meuse', date:'2020', media:'La Meuse', icon:'📰' },
  { titre:'Article Le Soir', date:'2019', media:'Le Soir', icon:'📰' },
  { titre:'Article sudinfo.be', date:'2019', media:'sudinfo.be', icon:'📰' },
]

export default function Presse() {
  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      {/* Hero */}
      <section className="pr-hero">
        <div className="pr-hero-inner">
          <div className="pr-tag">📰 Presse</div>
          <h1 className="pr-h1">Heart's Angels <em>dans les médias</em></h1>
          <p className="pr-p">Retrouvez ici nos passages à la télévision, à la radio et dans la presse écrite depuis notre création en 2015.</p>
        </div>
      </section>

      {/* vague hero → contenu */}
      <SepAuto haut="#0E4A5A" bas="#FDFAF6" />

      {/* Dossier de presse */}
      <section style={{ background:'white', borderBottom:'1px solid rgba(27,176,206,.08)', padding:'36px 20px' }}>
        <div style={{ maxWidth:1280, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:20 }}>
          <div>
            <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.5rem', fontWeight:500, color:'#1A1514', marginBottom:6 }}>Dossier de presse</h2>
            <p style={{ fontSize:14, color:'#7A7470', margin:0 }}>Voici le dossier de presse de l'ASBL, n'hésitez pas à le diffuser.</p>
          </div>
          <a href="https://www.heartsangels.be/Documents/Dossier-Presse.pdf" target="_blank" rel="noopener"
            style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'11px 22px', background:'#1BB0CE', color:'white', borderRadius:9, textDecoration:'none', fontSize:14, fontWeight:600, boxShadow:'0 3px 12px rgba(27,176,206,.3)', whiteSpace:'nowrap' }}>
            📄 Télécharger le dossier de presse
          </a>
        </div>
      </section>

      {/* À la TV */}
      <section className="pr-section">
        <div className="pr-inner">
          <div className="pr-cat-header">
            <div className="pr-cat-icon">📺</div>
            <h2 className="pr-h2">À la télévision</h2>
          </div>
          <div className="pr-grid">
            {TV.map((item, i) => (
              <a key={i} href={item.url} target="_blank" rel="noopener" className="pr-card pr-card-tv">
                <div className="pr-card-top">
                  <span className="pr-badge pr-badge-tv">{item.chaine}</span>
                  <span className="pr-date">{item.date}</span>
                </div>
                <div className="pr-card-title">{item.titre}</div>
                <div className="pr-card-action">▶ Voir la vidéo</div>
              </a>
            ))}
          </div>

          {/* Embed YouTube du plus récent */}
          <div style={{ marginTop:32, borderRadius:16, overflow:'hidden', boxShadow:'0 4px 24px rgba(27,176,206,.1)', aspectRatio:'16/9', maxWidth:720, margin:'32px auto 0' }}>
            <iframe
              src="https://www.youtube.com/embed/MybiG7GsTFQ"
              title="Reportage JT RTL-TVI — Heart's Angels"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width:'100%', height:'100%', display:'block' }}
            />
          </div>
        </div>
      </section>

      {/* À la radio */}
      <section className="pr-section pr-alt">
        <div className="pr-inner">
          <div className="pr-cat-header">
            <div className="pr-cat-icon">🎙️</div>
            <h2 className="pr-h2">À la radio</h2>
          </div>
          <div className="pr-grid">
            {RADIO.map((item, i) => (
              <div key={i} className="pr-card pr-card-radio">
                <div className="pr-card-top">
                  <span className="pr-badge pr-badge-radio">{item.chaine}</span>
                  <span className="pr-date">{item.date}</span>
                </div>
                <div className="pr-card-title">{item.titre}</div>
                {item.url
                  ? <audio controls src={item.url} style={{ width:'100%', marginTop:10, height:32 }} />
                  : <div className="pr-card-action" style={{ color:'#7A7470', cursor:'default' }}>🎵 Archive audio</div>
                }
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Presse écrite */}
      <section className="pr-section">
        <div className="pr-inner">
          <div className="pr-cat-header">
            <div className="pr-cat-icon">📰</div>
            <h2 className="pr-h2">Presse écrite</h2>
          </div>
          <div className="pr-grid">
            {ECRITE.map((item, i) => (
              <div key={i} className="pr-card pr-card-ecrit">
                <div className="pr-card-top">
                  <span className="pr-badge pr-badge-ecrit">{item.media}</span>
                  <span className="pr-date">{item.date}</span>
                </div>
                <div className="pr-card-title">{item.titre}</div>
                <div className="pr-card-action" style={{ color:'#7A7470', cursor:'default' }}>📄 Archive presse</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact presse */}
      {/* vague → CTA */}
      <SepAuto haut="#FDFAF6" bas="#0A1E2D" />
      <section style={{ background:'linear-gradient(135deg,#0A1E2D,#0E4A5A)', padding:'56px 20px', textAlign:'center' }}>
        <div style={{ maxWidth:560, margin:'0 auto' }}>
          <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'clamp(1.6rem,3vw,2.2rem)', fontWeight:500, color:'white', marginBottom:12 }}>
            Contact presse
          </h2>
          <p style={{ fontSize:14.5, color:'rgba(255,255,255,.75)', marginBottom:24, lineHeight:1.75 }}>
            Vous souhaitez nous contacter pour un reportage, une interview ou un article ? Nous sommes disponibles.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <a href="mailto:info@heartsangels.be" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'11px 22px', background:'white', color:'#0A1E2D', borderRadius:9, textDecoration:'none', fontSize:14, fontWeight:700 }}>
              ✉️ info@heartsangels.be
            </a>
            <Link to="/contact" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'11px 20px', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.25)', color:'white', borderRadius:9, textDecoration:'none', fontSize:14 }}>
              Formulaire de contact →
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

const CSS = `
.pr-hero{background:linear-gradient(135deg,#0A1E2D,#0E4A5A);padding:72px 20px;position:relative;overflow:hidden;}
.pr-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 60% at 80% 50%,rgba(27,176,206,.15),transparent);pointer-events:none;}
.pr-hero-inner{position:relative;z-index:1;max-width:1280px;margin:0 auto;}
.pr-tag{display:inline-flex;background:rgba(27,176,206,.25);border:1px solid rgba(27,176,206,.4);border-radius:99px;padding:5px 14px;font-size:11.5px;font-weight:500;color:#7DE4F5;letter-spacing:.04em;text-transform:uppercase;margin-bottom:18px;}
.pr-h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(2.4rem,5vw,3.8rem);font-weight:500;color:white;line-height:1.15;margin-bottom:14px;}
.pr-h1 em{font-style:italic;color:#7DE4F5;}
.pr-p{font-size:15px;color:rgba(255,255,255,.7);max-width:580px;line-height:1.75;}
.pr-section{padding:64px 20px;background:#FDFAF6;}
.pr-alt{background:#F0F9FB;}
.pr-inner{max-width:1280px;margin:0 auto;}
.pr-cat-header{display:flex;align-items:center;gap:14px;margin-bottom:28px;}
.pr-cat-icon{width:48px;height:48px;border-radius:12px;background:var(--blue-light,#E6F7FA);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;}
.pr-h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(1.6rem,2.8vw,2.2rem);font-weight:500;color:#1A1514;}
.pr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}
.pr-card{background:white;border:1px solid rgba(27,176,206,.1);border-radius:14px;padding:18px;box-shadow:0 1px 6px rgba(27,176,206,.05);transition:transform .12s,box-shadow .12s;}
.pr-card:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(27,176,206,.1);}
.pr-card-tv{text-decoration:none;color:inherit;display:block;}
.pr-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
.pr-badge{padding:2px 9px;border-radius:99px;font-size:11.5px;font-weight:600;}
.pr-badge-tv{background:#FEF0F0;color:#C8435A;}
.pr-badge-radio{background:#EAF3DE;color:#3B6D11;}
.pr-badge-ecrit{background:#FAEEDA;color:#BA7517;}
.pr-date{font-size:11.5px;color:#A8A39D;}
.pr-card-title{font-size:14px;font-weight:600;color:#1A1514;line-height:1.4;margin-bottom:10px;}
.pr-card-action{font-size:12.5px;color:#1BB0CE;font-weight:600;}
@media(max-width:600px){.pr-section{padding:44px 14px;}}
`