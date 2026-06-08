import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.jsx'
import { SepAuto } from '../components/Decor.jsx'
import { useSiteImage } from '@/lib/siteConfig'

export default function LesSouhaits() {
  const { raw } = useI18n()
  const heroImg = useSiteImage('hero_souhaits', null)
  const s = raw?.wishes || {}

  const STEPS = [
    { num:'01', icon:'📋', title: s.s1?.title || 'Public cible', text: s.s1?.p || "Toute personne en phase terminale d'une maladie, adultes, personnes âgées ou enfants qui aimeraient réaliser quelque chose qui leur tient à cœur.", color:'#E6F7FA', tc:'#1BB0CE' },
    { num:'02', icon:'🤝', title: s.s2?.title || 'Prise de contact', text: s.s2?.p || "Heart's Angels travaille avec les équipes de soins palliatifs en charge des patients, attentives aux souffrances médicales, psychologiques et spirituelles.", color:'#EAF3DE', tc:'#3B6D11' },
    { num:'03', icon:'✅', title: s.s3?.title || 'Sélection du souhait', text: s.s3?.p || "La réalisation est soumise à des critères médicaux, logistiques et divers établissant la faisabilité du souhait.", color:'#FAEEDA', tc:'#BA7517' },
    { num:'04', icon:'❤️', title: 'Réalisation', text: "Le jour J, une équipe médicale complète accompagne le patient pour la réalisation de son souhait, dans les meilleures conditions de sécurité et de confort.", color:'#FBEAF0', tc:'#C8435A' },
  ]

  const EXEMPLES = [
    { icon:'🌊', text:'Passer une dernière journée à la mer' },
    { icon:'🏡', text:'Revoir sa maison de vacances' },
    { icon:'💍', text:'Assister au mariage de son enfant' },
    { icon:'🎡', text:'Visiter Pairi Daiza ou Disneyland' },
    { icon:'🏎️', text:'Rouler sur le circuit de Spa-Francorchamps' },
    { icon:'✈️', text:'Prendre un vol en hélicoptère' },
    { icon:'⛪', text:'Faire un pèlerinage à Banneux' },
    { icon:'🌿', text:'Planter des arbres dans sa forêt' },
    { icon:'🎵', text:'Assister à un concert ou spectacle' },
    { icon:'👨‍👩‍👧‍👦', text:'Réunir toute sa famille autour de soi' },
    { icon:'🎄', text:'Célébrer Noël une dernière fois chez soi' },
    { icon:'🌅', text:'Voir le lever du soleil en montagne' },
  ]

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      {/* Hero avec vraie photo de souhait */}
      <section className="ls-hero" style={{ '--hero-bg': heroImg ? `url(${heroImg})` : 'none' }}>
        <div className="ls-hero-bg" />
        <div className="ls-hero-inner">
          <div className="ls-tag">❤️ Les souhaits</div>
          <h1 className="ls-h1">Le souhait <em>du cœur</em></h1>
          <p className="ls-p-hero">Lorsqu'une personne entre dans sa dernière phase de vie, elle souhaite réaliser quelques dernières actions pour partir sereinement. Heart's Angels est là pour l'aider.</p>
        </div>
      </section>

      {/* vague hero → contenu */}
      <SepAuto haut="#0E4A5A" bas="#FDFAF6" />

      {/* Citation du vrai site */}
      <section style={{ background:'white', padding:'48px 20px', borderBottom:'1px solid rgba(27,176,206,.08)' }}>
        <div style={{ maxWidth:800, margin:'0 auto', textAlign:'center' }}>
          <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'clamp(1.2rem,2vw,1.6rem)', fontStyle:'italic', color:'#0E4A5A', lineHeight:1.7 }}>
            « Lorsque la personne entre dans sa dernière phase de deuil qu'est la phase d'acceptation, celle-ci fait le point sur sa vie passée. Elle souhaite alors réaliser quelques dernières actions, quelques projets afin de partir sereinement et paisiblement. »
          </div>
        </div>
      </section>

      {/* 4 étapes */}
      <section className="ls-section">
        <div className="ls-inner">
          <div style={{ textAlign:'center', marginBottom:44 }}>
            <div className="ls-tag-blue">Comment ça fonctionne</div>
            <h2 className="ls-h2">Le processus <em>de réalisation</em></h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
            {STEPS.map((st,i)=>(
              <div key={i} style={{ background:st.color, borderRadius:16, padding:'22px 18px', position:'relative' }}>
                <div style={{ fontSize:11, fontWeight:700, color:st.tc, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:8, opacity:.7 }}>ÉTAPE {st.num}</div>
                <div style={{ fontSize:'2rem', marginBottom:12 }}>{st.icon}</div>
                <div style={{ fontSize:14.5, fontWeight:600, color:st.tc, marginBottom:8 }}>{st.title}</div>
                <p style={{ fontSize:13, color:'#4A4340', lineHeight:1.65 }}>{st.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Exemples de souhaits */}
      <section className="ls-section ls-alt">
        <div className="ls-inner">
          <div style={{ textAlign:'center', marginBottom:36 }}>
            <div className="ls-tag-blue">Exemples</div>
            <h2 className="ls-h2">Des souhaits <em>réels réalisés</em></h2>
            <p style={{ fontSize:15, color:'#7A7470', maxWidth:560, margin:'0 auto', lineHeight:1.7 }}>
              Voici quelques exemples des souhaits que nous avons eu le privilège de réaliser depuis 2017.
            </p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:12 }}>
            {EXEMPLES.map((ex,i)=>(
              <div key={i} style={{ background:'white', border:'1px solid rgba(27,176,206,.1)', borderRadius:12, padding:'16px 14px', display:'flex', alignItems:'center', gap:12, boxShadow:'0 1px 6px rgba(27,176,206,.04)', transition:'all .12s' }}
                onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(27,176,206,.3)';e.currentTarget.style.transform='translateX(4px)'}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(27,176,206,.1)';e.currentTarget.style.transform=''}}>
                <span style={{ fontSize:24, flexShrink:0 }}>{ex.icon}</span>
                <span style={{ fontSize:14, color:'#1A1514', fontWeight:500, lineHeight:1.4 }}>{ex.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4 comités + transport */}
      <section className="ls-section">
        <div className="ls-inner">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:52 }}>
            <div>
              <div className="ls-tag-blue">Fonctionnement</div>
              <h2 className="ls-h2">Nos <em>4 comités</em></h2>
              <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:8 }}>
                {[
                  { title:'Comité Médical', desc:'Médecins, infirmiers, ambulanciers, psychologues, kinésithérapeutes — conseils sur la faisabilité médicale.', color:'#E6F7FA', tc:'#1BB0CE' },
                  { title:'Comité Accompagnants', desc:'Personnes qui accompagneront les bénéficiaires lors de la réalisation de leurs souhaits.', color:'#EAF3DE', tc:'#3B6D11' },
                  { title:'Comité Logistique', desc:'Membres préparant la réalisation des souhaits et gérant le matériel adapté.', color:'#FAEEDA', tc:'#BA7517' },
                  { title:'Comité Soutien', desc:'Membres soutenant l\'association et participant à la promotion de celle-ci.', color:'#FBEAF0', tc:'#C8435A' },
                ].map((c,i)=>(
                  <div key={i} style={{ background:c.color, borderRadius:12, padding:'14px 16px', display:'flex', gap:12, alignItems:'flex-start' }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:c.tc, flexShrink:0, marginTop:6 }}/>
                    <div>
                      <div style={{ fontSize:13.5, fontWeight:600, color:c.tc, marginBottom:3 }}>{c.title}</div>
                      <div style={{ fontSize:12.5, color:'#4A4340', lineHeight:1.55 }}>{c.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="ls-tag-blue">Transport</div>
              <h2 className="ls-h2">Moyen de <em>transport</em></h2>
              <p style={{ fontSize:15, color:'#4A4340', lineHeight:1.8, marginBottom:20 }}>
                À l'heure actuelle, Heart's Angels fonctionne en partenariat avec <strong>SOLUMOB</strong> afin de bénéficier d'une ambulance et d'un véhicule TPMR.
              </p>
              <p style={{ fontSize:15, color:'#4A4340', lineHeight:1.8, marginBottom:24 }}>
                Notre objectif est d'acquérir nos propres moyens de transport pour plus d'autonomie et un accompagnement encore plus adapté.
              </p>
              <div style={{ background:'linear-gradient(135deg,#E6F7FA,#B5E8F5)', borderRadius:16, padding:'1.5rem', textAlign:'center', marginBottom:20 }}>
                <div style={{ fontSize:'3rem', marginBottom:8 }}>🚑</div>
                <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.2rem', color:'#0E4A5A', fontWeight:500 }}>Projet ambulance Heart's Angels</div>
                <Link to="/nous-soutenir" style={{ display:'inline-flex', marginTop:12, padding:'9px 18px', background:'#1BB0CE', color:'white', borderRadius:8, textDecoration:'none', fontSize:13, fontWeight:600 }}>
                  Soutenir le projet →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA formulaire */}
      {/* vague → CTA */}
      <SepAuto haut="#FDFAF6" bas="#0A1E2D" />
      <section style={{ background:'linear-gradient(135deg,#0A1E2D,#0E4A5A)', padding:'64px 20px', textAlign:'center' }}>
        <div style={{ maxWidth:600, margin:'0 auto' }}>
          <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'clamp(1.8rem,3.5vw,2.8rem)', fontWeight:500, color:'white', marginBottom:14 }}>
            Un souhait à réaliser ?
          </h2>
          <p style={{ fontSize:15, color:'rgba(255,255,255,.7)', marginBottom:28, lineHeight:1.75 }}>
            Si vous souhaitez nous contacter pour réaliser le vœu d'une personne en soins palliatifs, remplissez notre formulaire.
          </p>
          <Link to="/demande-de-souhait"
            style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'13px 28px', background:'white', color:'#0A1E2D', borderRadius:10, textDecoration:'none', fontSize:15, fontWeight:700, boxShadow:'0 4px 16px rgba(0,0,0,.15)' }}>
            ❤️ Formulaire de demande de souhait
          </Link>
        </div>
      </section>
    </div>
  )
}

const CSS = `
.ls-hero{background:linear-gradient(135deg,#0A1E2D,#0E4A5A);padding:80px 20px;position:relative;overflow:hidden;}
.ls-hero-bg{position:absolute;inset:0;background:var(--hero-bg) center/cover;opacity:.2;transition:opacity .5s ease;}
.ls-hero-bg::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(10,30,45,.88),rgba(14,74,90,.65));}
.ls-hero-inner{position:relative;z-index:1;max-width:1280px;margin:0 auto;}
.ls-tag{display:inline-flex;background:rgba(27,176,206,.25);border:1px solid rgba(27,176,206,.4);border-radius:99px;padding:5px 14px;font-size:11.5px;font-weight:500;color:#7DE4F5;letter-spacing:.04em;text-transform:uppercase;margin-bottom:18px;}
.ls-tag-blue{display:inline-flex;background:#E6F7FA;color:#1BB0CE;border-radius:99px;padding:4px 12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;}
.ls-h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(2.4rem,5vw,3.8rem);font-weight:500;color:white;line-height:1.15;margin-bottom:14px;}
.ls-h1 em{font-style:italic;color:#7DE4F5;}
.ls-p-hero{font-size:15px;color:rgba(255,255,255,.75);max-width:580px;line-height:1.75;}
.ls-h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(1.7rem,3vw,2.4rem);font-weight:500;line-height:1.2;color:#1A1514;margin-bottom:14px;}
.ls-h2 em{font-style:italic;color:#1BB0CE;}
.ls-section{padding:72px 20px;background:#FDFAF6;}
.ls-alt{background:#F0F9FB;}
.ls-inner{max-width:1280px;margin:0 auto;}
@media(max-width:900px){.ls-section{padding:48px 14px;}[style*='repeat(4,1fr)']{grid-template-columns:repeat(2,1fr) !important;}[style*='grid-template-columns: 1fr 1fr']{grid-template-columns:1fr !important;gap:32px !important;}}
@media(max-width:600px){[style*='repeat(4,1fr)']{grid-template-columns:1fr !important;}}
`