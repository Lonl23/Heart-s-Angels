import { Link } from 'react-router-dom'
import { SepAuto } from '../components/Decor.jsx'
import { useSiteImage } from '@/lib/siteConfig'

const ACTIVITES = [
  {
    titre: 'Balade motos sécurisée',
    edition: '9° édition — 28 juin 2026',
    desc: "Notre événement phare ! Des centaines de motards réunis chaque année pour soutenir Heart's Angels. Petit-déjeuner, balade en région liégeoise, repas convivial à l'arrivée.",
    icon: '🏍️',
    color: '#E6F7FA',
    tc: '#1BB0CE',
    image: 'https://www.heartsangels.be/wp-content/uploads/2019/07/DSC_0043-1024x683.jpg',
    lien: '/evenements',
  },
  {
    titre: 'Marche ADEPS',
    edition: '8° édition — 1er novembre 2026',
    desc: "Participez à notre marche ADEPS annuelle avec 4 parcours de 5 à 20 km. Participation gratuite ! Restauration sur place pour soutenir l'ASBL.",
    icon: '🥾',
    color: '#EAF3DE',
    tc: '#3B6D11',
    image: 'https://www.heartsangels.be/wp-content/uploads/2022/11/marche.jpg',
    lien: '/evenements',
  },
  {
    titre: 'Opération Lingots de chiques',
    edition: 'Vente annuelle',
    desc: "Nos fameuses chiques artisanales ! Cette opération de vente de sucreries locales est l'une de nos principales sources de financement.",
    icon: '🍬',
    color: '#FAEEDA',
    tc: '#BA7517',
    image: 'https://www.heartsangels.be/wp-content/uploads/2026/03/OPERATION-LINGOT-DE-CHIQUES.png',
    lien: '/boutique',
  },
  {
    titre: 'Marché de Noël du Château d\'Aigremont',
    edition: 'Décembre — chaque année',
    desc: "Heart's Angels tient un stand au Marché de Noël du Château d'Aigremont. Venez nous rendre visite et contribuer à notre mission.",
    icon: '🎄',
    color: '#FBEAF0',
    tc: '#C8435A',
    image: 'https://www.heartsangels.be/wp-content/uploads/2026/04/DSC_0975-scaled.jpg',
    lien: '/evenements',
  },
  {
    titre: 'Pâques au Château',
    edition: 'Éditions passées',
    desc: "Un événement festif au Château d'Aigremont pour célébrer Pâques tout en soutenant Heart's Angels. Animations, restauration et convivialité.",
    icon: '🐣',
    color: '#EAF3DE',
    tc: '#3B6D11',
    image: 'https://www.heartsangels.be/wp-content/uploads/2026/04/DSC_0975-scaled.jpg',
    lien: '/evenements',
  },
  {
    titre: 'Vide-greniers',
    edition: 'Éditions passées',
    desc: "Des vide-greniers organisés au profit de l'ASBL. Une occasion de faire de bonnes affaires tout en soutenant notre cause.",
    icon: '🛍️',
    color: '#EEEAF7',
    tc: '#534AB7',
    image: 'https://www.heartsangels.be/wp-content/uploads/2026/04/DSC_0975-scaled.jpg',
    lien: '/evenements',
  },
  {
    titre: 'Challenge Run pour la Fondation contre le Cancer',
    edition: 'Mai — 24h de marche',
    desc: "Heart's Angels participe aux 24h de marche au profit de la Fondation contre le Cancer. 10€/marcheur. Stands de restauration tenus par nos bénévoles.",
    icon: '🏃',
    color: '#E6F7FA',
    tc: '#1BB0CE',
    image: 'https://www.heartsangels.be/wp-content/uploads/2026/04/DSC_0975-scaled.jpg',
    lien: '/evenements',
  },
]

export default function Activites() {
  const heroImg = useSiteImage('hero_activites', null)
  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      <section className="ac-hero" style={{ '--hero-bg': heroImg ? `url(${heroImg})` : 'none' }}>
        <div className="ac-inner">
          <div className="ac-tag">🎪 Activités</div>
          <h1 className="ac-h1">Nos <em>activités & événements</em></h1>
          <p className="ac-p">Heart's Angels organise tout au long de l'année des événements de soutien. Participez et aidez-nous à réaliser de nouveaux souhaits !</p>
        </div>
      </section>

      {/* vague hero → contenu */}
      <SepAuto haut="#0E4A5A" bas="#FDFAF6" />

      <section style={{ padding:'64px 20px', background:'#FDFAF6' }}>
        <div className="ac-inner" style={{ position:'relative', zIndex:1 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:20 }}>
            {ACTIVITES.map((a, i) => (
              <div key={i} style={{ background:'white', border:'1px solid rgba(27,176,206,.1)', borderRadius:18, overflow:'hidden', boxShadow:'0 2px 12px rgba(27,176,206,.06)', transition:'transform .15s,box-shadow .15s' }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 10px 30px rgba(27,176,206,.14)'}}
                onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 2px 12px rgba(27,176,206,.06)'}}>
                <div style={{ position:'relative', height:200 }}>
                  <img src={a.image} alt={a.titre} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} loading="lazy"
                    onError={e=>{ e.target.style.display='none'; e.target.nextSibling.style.display='flex' }}/>
                  <div style={{ display:'none', height:200, background:`linear-gradient(135deg,${a.color},white)`, alignItems:'center', justifyContent:'center', fontSize:'4rem' }}>{a.icon}</div>
                  <div style={{ position:'absolute', top:12, left:12, background:a.color, color:a.tc, padding:'4px 12px', borderRadius:99, fontSize:12, fontWeight:600 }}>
                    {a.icon} {a.titre}
                  </div>
                </div>
                <div style={{ padding:'20px' }}>
                  <div style={{ fontSize:12, color:a.tc, fontWeight:600, marginBottom:6 }}>📅 {a.edition}</div>
                  <p style={{ fontSize:14, color:'#4A4340', lineHeight:1.7, marginBottom:16 }}>{a.desc}</p>
                  <Link to={a.lien} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'9px 18px', background:a.tc, color:'white', borderRadius:8, textDecoration:'none', fontSize:13, fontWeight:600, transition:'opacity .12s' }}
                    onMouseEnter={e=>e.currentTarget.style.opacity='.85'}
                    onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                    En savoir plus →
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* CTA soutien */}
          <div style={{ marginTop:52, background:'linear-gradient(135deg,#0A1E2D,#0E4A5A)', borderRadius:20, padding:'2.5rem', display:'grid', gridTemplateColumns:'1fr auto', gap:32, alignItems:'center' }}>
            <div>
              <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.8rem', fontWeight:500, color:'white', marginBottom:10 }}>
                Participer à nos activités
              </h2>
              <p style={{ fontSize:14.5, color:'rgba(255,255,255,.75)', lineHeight:1.75 }}>
                En participant à nos événements, vous soutenez directement la réalisation de souhaits pour des patients en soins palliatifs. Chaque euro récolté y est dédié à 100%.
              </p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10, flexShrink:0 }}>
              <Link to="/evenements" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'11px 22px', background:'white', color:'#0A1E2D', borderRadius:9, textDecoration:'none', fontSize:14, fontWeight:700, whiteSpace:'nowrap' }}>
                📅 Voir les événements
              </Link>
              <Link to="/nous-soutenir" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'11px 20px', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.2)', color:'white', borderRadius:9, textDecoration:'none', fontSize:14, whiteSpace:'nowrap' }}>
                💝 Nous soutenir
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

const CSS = `
.ac-hero{background:linear-gradient(135deg,#0A1E2D,#0E4A5A);padding:72px 20px;position:relative;overflow:hidden;}
.ac-hero::before{content:'';position:absolute;inset:0;background:var(--hero-bg) center/cover;opacity:.15;transition:opacity .5s ease;}
.ac-hero::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(10,30,45,.9),rgba(14,74,90,.7));}
.ac-inner{position:relative;z-index:1;max-width:1280px;margin:0 auto;}
.ac-tag{display:inline-flex;background:rgba(27,176,206,.25);border:1px solid rgba(27,176,206,.4);border-radius:99px;padding:5px 14px;font-size:11.5px;font-weight:500;color:#7DE4F5;letter-spacing:.04em;text-transform:uppercase;margin-bottom:18px;}
.ac-h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(2.4rem,5vw,3.8rem);font-weight:500;color:white;line-height:1.15;margin-bottom:14px;}
.ac-h1 em{font-style:italic;color:#7DE4F5;}
.ac-p{font-size:15px;color:rgba(255,255,255,.75);max-width:580px;line-height:1.75;}
@media(max-width:900px){[style*='grid-template-columns: 1fr auto']{grid-template-columns:1fr !important;}}
@media(max-width:600px){.ac-hero{padding:52px 14px;}}
`