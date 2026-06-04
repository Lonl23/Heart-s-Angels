import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.jsx'
import { supabase } from '@/lib/supabase'
import { SepAuto } from '../components/Decor.jsx'

const ARTICLES_STATIC = [
  { id:'regards', slug:'regards-croises-premiere-mission', titre_fr:'[REGARDS CROISÉS] Une première mission inoubliable', resume_fr:"Ce samedi 28 mars restera gravé dans le cœur de l'équipe. Deux nouveaux bénévoles nous accompagnaient pour leur toute première réalisation de souhait.", image_url:'https://www.heartsangels.be/wp-content/uploads/2026/04/DSC_0975-scaled.jpg', categorie:'association', publie_le:'2026-03-28' },
  { id:'francine', slug:'lengagement-decouvrez-francine', titre_fr:"L'engagement au cœur de l'action : Découvrez Francine", resume_fr:"Maman de 4 enfants et bientôt 7 fois grand-mère, Francine incarne parfaitement l'esprit de Heart's Angels ASBL.", image_url:'https://www.heartsangels.be/wp-content/uploads/2023/06/carine_carlier-1.jpg', categorie:'association', publie_le:'2026-04-27' },
  { id:'ambulanciers', slug:'journee-nationale-des-ambulanciers', titre_fr:'Journée Nationale des Ambulanciers', resume_fr:"Le 8 avril 2026, journée nationale des ambulanciers. Merci à nos bénévoles et à Solumob.", image_url:'https://www.heartsangels.be/wp-content/uploads/2026/04/DSC_0975-scaled.jpg', categorie:'association', publie_le:'2026-04-08' },
  { id:'souhait-roche', slug:'souhait-la-roche-en-ardenne', titre_fr:'Souhait : La Roche-en-Ardenne', resume_fr:"Un tout grand merci à nos précieux partenaires sans qui cela ne serait pas possible : Solumob, Air Liquide, TotalEnergies.", image_url:'https://www.heartsangels.be/wp-content/uploads/2024/02/423194226_775502387943890_4753465545900779820_n.jpg', categorie:'souhaits_realises', publie_le:'2025-03-08' },
  { id:'souhait-banneux', slug:'souhait-banneux', titre_fr:'Souhait : Banneux', resume_fr:"Réalisation d'un souhait à Banneux. Un moment rempli d'émotions et de bienveillance.", image_url:'https://www.heartsangels.be/wp-content/uploads/2023/08/67619839_1166249026894459_8802576039118110720_n.jpg', categorie:'souhaits_realises', publie_le:'2024-09-15' },
  { id:'pallia', slug:'journee-mondiale-soins-palliatifs', titre_fr:"Journée mondiale des soins palliatifs et réalisation d'un souhait", resume_fr:"À l'occasion de la Journée mondiale des soins palliatifs, Heart's Angels a réalisé un souhait particulièrement émouvant.", image_url:'https://www.heartsangels.be/wp-content/uploads/2024/06/448340450_848408590653269_3974634456659016404_n.jpg', categorie:'association', publie_le:'2024-10-12' },
  { id:'lunettes', slug:'don-lunettes-rouges', titre_fr:"Don de Lunettes Rouges ASBL", resume_fr:"Heart's Angels a reçu un généreux don de l'ASBL Lunettes Rouges. Merci pour ce soutien précieux !", image_url:'https://www.heartsangels.be/wp-content/uploads/2026/04/DSC_0975-scaled.jpg', categorie:'partenariats', publie_le:'2025-01-20' },
  { id:'nouveaux-partenaires', slug:'nouveaux-partenaires', titre_fr:'Nouveaux partenaires', resume_fr:"Heart's Angels est heureux d'accueillir de nouveaux partenaires dans son aventure humaniste.", image_url:'https://www.heartsangels.be/wp-content/uploads/2026/04/DSC_0975-scaled.jpg', categorie:'partenariats', publie_le:'2024-11-05' },
]

const CATS_FR = { tous:'Tous', souhaits_realises:'❤️ Souhaits réalisés', evenements:'🎪 Événements', association:'🏛️ Association', partenariats:'🤝 Partenariats', temoignages:'💬 Témoignages' }

export default function Blog() {
  const { raw } = useI18n()
  const lang = raw?.lang || 'fr'
  const [articles, setArticles] = useState(ARTICLES_STATIC)
  const [cat, setCat] = useState('tous')

  useEffect(() => {
    supabase.from('articles').select('id,slug,titre_fr,titre_nl,titre_en,resume_fr,image_url,categorie,publie_le')
      .eq('publie', true).order('publie_le', { ascending: false })
      .then(({ data }) => { if (data?.length) setArticles([...ARTICLES_STATIC, ...data]) })
  }, [])

  const displayed = cat === 'tous' ? articles : articles.filter(a => a.categorie === cat)

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>
      <section className="bl-hero">
        <div className="bl-inner">
          <div className="bl-tag">📝 Blog & Actualités</div>
          <h1 className="bl-h1">Nos <em>dernières nouvelles</em></h1>
          <p className="bl-p">Suivez la vie de l'ASBL : souhaits réalisés, témoignages, partenariats et moments forts.</p>
        </div>
      </section>

      {/* vague hero → contenu */}
      <SepAuto haut="#0E4A5A" bas="#FDFAF6" />

      <section style={{ padding:'48px 20px 72px', background:'#FDFAF6' }}>
        <div className="bl-inner">
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:32 }}>
            {Object.entries(CATS_FR).map(([k,v]) => (
              <button key={k} onClick={() => setCat(k)} style={{ padding:'7px 16px', borderRadius:99, border:`1px solid ${cat===k?'#1BB0CE':'rgba(27,176,206,.2)'}`, background:cat===k?'#1BB0CE':'white', color:cat===k?'white':'#7A7470', fontSize:13, cursor:'pointer', fontFamily:"'DM Sans',sans-serif", fontWeight:cat===k?600:400, transition:'all .12s' }}>
                {v}
              </button>
            ))}
          </div>

          {/* Article à la une */}
          {cat === 'tous' && displayed[0] && (
            <Link to={`/actualites/${displayed[0].slug}`} className="bl-featured">
              <div className="bl-featured-img" style={{ backgroundImage:`url(${displayed[0].image_url})` }}/>
              <div className="bl-featured-body">
                <span className="bl-badge">{CATS_FR[displayed[0].categorie] || displayed[0].categorie}</span>
                <h2 className="bl-featured-title">{displayed[0][`titre_${lang}`] || displayed[0].titre_fr}</h2>
                <p className="bl-featured-resume">{displayed[0][`resume_${lang}`] || displayed[0].resume_fr}</p>
                <span className="bl-more">Lire l'article →</span>
              </div>
            </Link>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))', gap:18, marginTop:20 }}>
            {(cat === 'tous' ? displayed.slice(1) : displayed).map((art, i) => (
              <Link key={i} to={`/actualites/${art.slug}`} className="bl-card">
                <img src={art.image_url} alt="" className="bl-card-img" loading="lazy"
                  onError={e=>{ e.target.style.display='none'; e.target.nextSibling.style.display='flex' }}/>
                <div className="bl-card-img-ph" style={{ display:'none' }}>📰</div>
                <div className="bl-card-body">
                  <div style={{ display:'flex', gap:8, marginBottom:8, flexWrap:'wrap' }}>
                    <span className="bl-badge">{CATS_FR[art.categorie] || art.categorie}</span>
                    {art.publie_le && <span style={{ fontSize:11.5, color:'#A8A39D' }}>📅 {new Date(art.publie_le).toLocaleDateString('fr-BE',{day:'numeric',month:'long',year:'numeric'})}</span>}
                  </div>
                  <h3 className="bl-card-title">{art[`titre_${lang}`] || art.titre_fr}</h3>
                  <p className="bl-card-resume">{(art[`resume_${lang}`] || art.resume_fr || '').slice(0,120)}…</p>
                  <span className="bl-more">Lire l'article →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

const CSS = `
.bl-hero{background:linear-gradient(135deg,#0A1E2D,#0E4A5A);padding:72px 20px;position:relative;overflow:hidden;}
.bl-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 60% at 80% 50%,rgba(27,176,206,.15),transparent);pointer-events:none;}
.bl-inner{position:relative;z-index:1;max-width:1280px;margin:0 auto;}
.bl-tag{display:inline-flex;background:rgba(27,176,206,.25);border:1px solid rgba(27,176,206,.4);border-radius:99px;padding:5px 14px;font-size:11.5px;font-weight:500;color:#7DE4F5;letter-spacing:.04em;text-transform:uppercase;margin-bottom:18px;}
.bl-h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(2.4rem,5vw,3.8rem);font-weight:500;color:white;line-height:1.15;margin-bottom:14px;}
.bl-h1 em{font-style:italic;color:#7DE4F5;}
.bl-p{font-size:15px;color:rgba(255,255,255,.7);max-width:580px;line-height:1.75;}
.bl-featured{display:grid;grid-template-columns:1.4fr 1fr;background:white;border:1px solid rgba(27,176,206,.1);border-radius:18px;overflow:hidden;text-decoration:none;color:inherit;box-shadow:0 3px 18px rgba(27,176,206,.08);transition:transform .15s,box-shadow .15s;}
.bl-featured:hover{transform:translateY(-3px);box-shadow:0 10px 32px rgba(27,176,206,.14);}
.bl-featured-img{background-size:cover;background-position:center;min-height:280px;}
.bl-featured-body{padding:28px 24px;display:flex;flex-direction:column;justify-content:center;gap:10px;}
.bl-featured-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.5rem;font-weight:500;color:#1A1514;line-height:1.3;}
.bl-featured-resume{font-size:14px;color:#7A7470;line-height:1.7;}
.bl-badge{background:#E6F7FA;color:#1BB0CE;padding:2px 10px;border-radius:99px;font-size:11.5px;font-weight:600;display:inline-block;}
.bl-more{font-size:13px;color:#1BB0CE;font-weight:600;margin-top:auto;}
.bl-card{display:block;background:white;border:1px solid rgba(27,176,206,.1);border-radius:14px;overflow:hidden;text-decoration:none;color:inherit;box-shadow:0 2px 10px rgba(27,176,206,.05);transition:transform .15s,box-shadow .15s;}
.bl-card:hover{transform:translateY(-3px);box-shadow:0 8px 26px rgba(27,176,206,.12);}
.bl-card-img{width:100%;height:180px;object-fit:cover;display:block;}
.bl-card-img-ph{height:90px;background:linear-gradient(135deg,#E6F7FA,#B5E8F5);align-items:center;justify-content:center;font-size:2.5rem;}
.bl-card-body{padding:16px;}
.bl-card-title{font-size:15px;font-weight:600;color:#1A1514;margin-bottom:7px;line-height:1.3;}
.bl-card-resume{font-size:13px;color:#7A7470;line-height:1.6;margin-bottom:10px;}
@media(max-width:900px){.bl-featured{grid-template-columns:1fr !important;}.bl-featured-img{min-height:200px;}}
@media(max-width:600px){.bl-hero{padding:52px 14px;}}
`