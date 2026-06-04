import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.jsx'
import { supabase } from '@/lib/supabase'
import { SepAuto } from '../components/Decor.jsx'

const ARTICLES_STATIC = [
  { id:'regards', slug:'regards-croises-une-premiere-mission-inoubliable', titre_fr:"[REGARDS CROISÉS] : Une première mission inoubliable", resume_fr:"Ce samedi 28 mars restera gravé dans le cœur de l'équipe Heart's Angels ASBL. Deux nouveaux bénévoles nous accompagnaient pour leur toute première réalisation de souhait.", image_url:'https://www.heartsangels.be/wp-content/uploads/2026/04/DSC_0975-scaled.jpg', categorie:'association', publie_le:'2026-03-28', publie:true },
  { id:'francine', slug:'lengagement-au-coeur-de-laction-decouvrez-francine', titre_fr:"L'engagement au cœur de l'action : Découvrez Francine", resume_fr:"Maman de 4 enfants et bientôt 7 fois grand-mère, Francine incarne parfaitement l'esprit de Heart's Angels ASBL : la solidarité, l'esprit d'équipe et la douceur.", image_url:'https://www.heartsangels.be/wp-content/uploads/2023/06/carine_carlier-1.jpg', categorie:'association', publie_le:'2026-04-27', publie:true },
  { id:'ambulanciers', slug:'journee-nationale-des-ambulanciers', titre_fr:"Journée Nationale des Ambulanciers", resume_fr:"Le 8 avril 2026, journée nationale des ambulanciers. Merci à nos bénévoles et à Solumob sans qui rien ne serait possible.", image_url:'https://www.heartsangels.be/wp-content/uploads/2026/04/DSC_0975-scaled.jpg', categorie:'association', publie_le:'2026-04-08', publie:true },
  { id:'roche', slug:'souhait-la-roche-en-ardenne', titre_fr:"Souhait : La Roche-en-Ardenne", resume_fr:"Un tout grand merci à nos précieux partenaires sans qui cela ne serait pas possible : Solumob, Air Liquide, TotalEnergies.", image_url:'https://www.heartsangels.be/wp-content/uploads/2024/02/423194226_775502387943890_4753465545900779820_n.jpg', categorie:'souhaits_realises', publie_le:'2025-03-08', publie:true },
]

const CATS = {
  fr: { tous:'Tous', souhaits_realises:'Souhaits réalisés', evenements:'Événements', association:'Association', partenariats:'Partenariats', temoignages:'Témoignages' },
  nl: { tous:'Alle', souhaits_realises:'Wensen', evenements:'Evenementen', association:'Vereniging', partenariats:'Partnerships', temoignages:'Getuigenissen' },
  en: { tous:'All', souhaits_realises:'Wishes fulfilled', evenements:'Events', association:'Association', partenariats:'Partnerships', temoignages:'Testimonials' },
  de: { tous:'Alle', souhaits_realises:'Wünsche erfüllt', evenements:'Veranstaltungen', association:'Verein', partenariats:'Partnerschaften', temoignages:'Zeugnisse' },
}

export default function Actualites() {
  const { raw } = useI18n()
  const lang = raw?.lang || 'fr'
  const cats = CATS[lang] || CATS.fr
  const [articles, setArticles] = useState(ARTICLES_STATIC)
  const [cat, setCat] = useState('tous')

  useEffect(() => {
    supabase.from('articles').select('id,slug,titre_fr,titre_nl,titre_en,titre_de,resume_fr,resume_nl,image_url,categorie,publie_le').eq('publie', true).order('publie_le', { ascending:false })
      .then(({ data }) => { if (data?.length) setArticles([...ARTICLES_STATIC, ...data]) })
  }, [])

  const displayed = cat === 'tous' ? articles : articles.filter(a => a.categorie === cat)

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      {/* Hero */}
      <section className="ac-hero">
        <div className="ac-hero-inner">
          <div className="ac-tag">📰 Actualités</div>
          <h1 className="ac-h1">Notre <em>blog & activités</em></h1>
          <p className="ac-p">Suivez les dernières nouvelles de Heart's Angels, nos souhaits réalisés et nos événements de soutien.</p>
        </div>
      </section>

      {/* vague hero → contenu */}
      <SepAuto haut="#0E4A5A" bas="#FDFAF6" />

      <section style={{ padding:'48px 20px 64px', background:'#FDFAF6' }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>

          {/* Filtres */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:32 }}>
            {Object.entries(cats).map(([k,v]) => (
              <button key={k} onClick={() => setCat(k)} style={{ padding:'7px 16px', borderRadius:99, border:`1px solid ${cat===k?'#1BB0CE':'rgba(27,176,206,.2)'}`, background:cat===k?'#1BB0CE':'white', color:cat===k?'white':'#7A7470', fontSize:13, cursor:'pointer', fontFamily:"'DM Sans',sans-serif', fontWeight:cat===k?600:400, transition:'all .12s" }}>
                {v}
              </button>
            ))}
          </div>

          {/* Grille */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:20 }}>
            {displayed.map((art, i) => {
              const titre = art[`titre_${lang}`] || art.titre_fr
              const resume = art[`resume_${lang}`] || art.resume_fr || ''
              const date = art.publie_le ? new Date(art.publie_le).toLocaleDateString('fr-BE', { day:'numeric', month:'long', year:'numeric' }) : ''
              return (
                <Link key={art.id||i} to={`/actualites/${art.slug}`} className="ac-card">
                  {art.image_url
                    ? <img src={art.image_url} alt={titre} className="ac-img" loading="lazy" />
                    : <div className="ac-img-ph">📰</div>
                  }
                  <div className="ac-body">
                    <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap' }}>
                      {art.categorie && <span className="ac-cat">{cats[art.categorie] || art.categorie}</span>}
                      {date && <span className="ac-date">📅 {date}</span>}
                    </div>
                    <h3 className="ac-title">{titre}</h3>
                    <p className="ac-resume">{resume.slice(0,120)}{resume.length>120?'…':''}</p>
                    <div className="ac-more">Lire l'article →</div>
                  </div>
                </Link>
              )
            })}
          </div>

          {displayed.length === 0 && (
            <div style={{ textAlign:'center', padding:'56px', color:'#7A7470' }}>Aucun article dans cette catégorie.</div>
          )}
        </div>
      </section>
    </div>
  )
}

const CSS = `
.ac-hero{background:linear-gradient(135deg,#0A1E2D,#0E4A5A);padding:72px 20px;position:relative;overflow:hidden;}
.ac-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 60% at 80% 50%,rgba(27,176,206,.15),transparent);pointer-events:none;}
.ac-hero-inner{position:relative;z-index:1;max-width:1280px;margin:0 auto;}
.ac-tag{display:inline-flex;background:rgba(27,176,206,.25);border:1px solid rgba(27,176,206,.4);border-radius:99px;padding:5px 14px;font-size:11.5px;font-weight:500;color:#7DE4F5;letter-spacing:.04em;text-transform:uppercase;margin-bottom:18px;}
.ac-h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(2.4rem,5vw,3.8rem);font-weight:500;color:white;line-height:1.15;margin-bottom:14px;}
.ac-h1 em{font-style:italic;color:#7DE4F5;}
.ac-p{font-size:15px;color:rgba(255,255,255,.7);max-width:560px;line-height:1.75;}
.ac-card{display:block;background:white;border:1px solid rgba(27,176,206,.1);border-radius:16px;overflow:hidden;text-decoration:none;color:inherit;box-shadow:0 2px 12px rgba(27,176,206,.06);transition:transform .15s,box-shadow .15s;}
.ac-card:hover{transform:translateY(-4px);box-shadow:0 10px 30px rgba(27,176,206,.14);}
.ac-img{width:100%;height:190px;object-fit:cover;display:block;}
.ac-img-ph{height:100px;background:linear-gradient(135deg,#E6F7FA,#B5E8F5);display:flex;align-items:center;justify-content:center;font-size:3rem;}
.ac-body{padding:18px;}
.ac-cat{background:#E6F7FA;color:#1BB0CE;padding:2px 9px;border-radius:99px;font-size:11.5px;font-weight:600;}
.ac-date{color:#7A7470;font-size:11.5px;}
.ac-title{font-size:15.5px;font-weight:600;color:#1A1514;margin-bottom:8px;line-height:1.3;}
.ac-resume{font-size:13px;color:#7A7470;line-height:1.6;margin-bottom:12px;}
.ac-more{font-size:13px;color:#1BB0CE;font-weight:600;}
`