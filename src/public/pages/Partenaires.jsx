import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.jsx'
import { supabase } from '@/lib/supabase'
import { SepAuto } from '../components/Decor.jsx'

const PARTENAIRES_FALLBACK = [
  // Médicaux / Hospitaliers
  { cat:'medical', nom:'CHC Liège', logo:'https://www.chc.be/sites/default/files/chc_logo_0.png', url:'https://www.chc.be', desc:'Centre Hospitalier Chrétien' },
  { cat:'medical', nom:'GHDC', logo:'https://www.ghdc.be/sites/all/themes/ghdc/logo.png', url:'https://www.ghdc.be', desc:'Grand Hôpital de Charleroi' },
  { cat:'medical', nom:'Solumob', logo:null, url:'https://www.solumob.be', desc:'Transport médical & ambulances', initiales:'SM' },
  { cat:'medical', nom:'Air Liquide', logo:'https://www.airliquide.com/sites/airliquide.com/files/2020/09/08/AL_logo_web_version_blue_1.png', url:'https://www.airliquide.com', desc:'Gaz médicaux' },
  { cat:'medical', nom:'Premium Care', logo:null, url:'https://premium-care.be', desc:'Soins à domicile', initiales:'PC' },
  { cat:'medical', nom:'Medipost', logo:null, url:'https://www.medipost.shop', desc:'Fournitures médicales', initiales:'MP' },
  // Institutionnels / Publics
  { cat:'institutionnel', nom:'Province de Liège', logo:'https://www.provincedeliege.be/sites/default/files/media/22726/logo_province_de_liege.jpg', url:'https://www.provincedeliege.be', desc:'Province de Liège' },
  { cat:'institutionnel', nom:'Commune de Flémalle', logo:null, url:'https://www.flemalle.be', desc:'Commune de Flémalle', initiales:'FL' },
  { cat:'institutionnel', nom:'Fédération W-B', logo:'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Logo_FWB.svg/320px-Logo_FWB.svg.png', url:'https://www.federation-wallonie-bruxelles.be', desc:'Fédération Wallonie-Bruxelles' },
  { cat:'institutionnel', nom:'Loterie Nationale', logo:'https://www.loterie-nationale.be/themes/custom/lotnat/images/logo-loterie-nationale.svg', url:'https://www.loterie-nationale.be', desc:'Loterie Nationale' },
  { cat:'institutionnel', nom:'PalliaLiège', logo:null, url:'https://www.pallialiege.be', desc:'Plateforme des Soins Palliatifs', initiales:'PL' },
  { cat:'institutionnel', nom:'Interseniors', logo:null, url:'https://interseniors.be', desc:'Interseniors ASBL', initiales:'IS' },
  // Privés / Entreprises
  { cat:'prive', nom:'TotalEnergies Foundation', logo:'https://fondation.totalenergies.com/sites/g/files/wompnd1501/files/styles/hd/public/2022-12/Logo_Total_Energies_Fondation.png', url:'https://fondation.totalenergies.com', desc:'Fondation TotalEnergies' },
  { cat:'prive', nom:'Fondation G. Louviaux', logo:null, url:'https://www.fondationginettelouviaux.be', desc:'Fondation Ginette Louviaux', initiales:'GL' },
  { cat:'prive', nom:'Fondation contre le Cancer', logo:'https://cancer.be/sites/default/files/2020-10/logo-fondation-cancer.svg', url:'https://cancer.be', desc:'Fondation contre le Cancer' },
  { cat:'prive', nom:'Sonia Chapelle', logo:null, url:'https://www.soniachapelle.be', desc:'Sonia Chapelle', initiales:'SC' },
]

const CAT_LABELS = {
  medical:        { label:'Partenaires médicaux',          icon:'🏥', color:'#E6F7FA', tc:'#0E7A93' },
  institutionnel: { label:'Partenaires institutionnels',   icon:'🏛️', color:'#EAF3DE', tc:'#3B6D11' },
  prive:          { label:'Partenaires privés & fondations',icon:'🏢', color:'#FAEEDA', tc:'#BA7517' },
}

export default function Partenaires() {
  const { raw } = useI18n()
  const [partenaires, setPartenaires] = useState(null)
  const [heroImg, setHeroImg] = useState(null)

  useEffect(() => {
    supabase.from('site_images').select('image_url').eq('cle','hero_partenaires').maybeSingle()
      .then(({ data }) => { if (data?.image_url) setHeroImg(data.image_url) })

    supabase.from('partenaires').select('*')
      .eq('actif', true).order('categorie').order('ordre')
      .then(({ data, error }) => {
        if (error || !data || data.length === 0) {
          // Fallback sur la liste en dur si la base est vide ou inaccessible
          setPartenaires(PARTENAIRES_FALLBACK)
        } else {
          // Mapper les colonnes de la table vers le format d'affichage
          setPartenaires(data.map(p => ({
            cat: p.categorie || 'prive',
            nom: p.nom,
            logo: p.logo_url || null,
            url: p.site_url || '#',
            desc: p.description || '',
            initiales: p.initiales || null,
          })))
        }
      })
  }, [])

  const liste = partenaires || []
  const grouped = Object.entries(CAT_LABELS).map(([key, meta]) => ({
    key, ...meta,
    items: liste.filter(p => p.cat === key),
  }))
  const sections = grouped.filter(cat => cat.items.length > 0)
  const bgSection = (i) => i % 2 === 0 ? '#FDFAF6' : '#F0F9FB'

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      {/* Hero */}
      <section className="pa-hero" style={heroImg ? { backgroundImage:`linear-gradient(135deg,rgba(10,30,45,.82),rgba(14,74,90,.78)),url(${heroImg})`, backgroundSize:'cover', backgroundPosition:'center' } : undefined}>
        <div className="pa-hero-inner">
          <div className="tag">🤝 Partenaires</div>
          <h1 className="h1">Ils nous <em>font confiance</em></h1>
          <p className="p-hero">Heart's Angels ASBL remercie chaleureusement tous ses partenaires médicaux, institutionnels et privés sans qui la réalisation des souhaits ne serait pas possible.</p>
        </div>
      </section>

      {/* Vague de transition hero → première catégorie */}
      {sections.length > 0 && <SepAuto haut="#0E4A5A" bas={bgSection(0)} />}

      {/* Sections par catégorie, séparées par des vagues */}
      {sections.map((cat, ci) => (
        <div key={cat.key}>
          <section style={{ padding:'48px 20px 56px', background: bgSection(ci) }}>
            <div style={{ maxWidth:1280, margin:'0 auto' }}>
              <div className="cat-header">
                <div style={{ width:52, height:52, borderRadius:16, background:cat.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26 }}>{cat.icon}</div>
                <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.9rem', fontWeight:500, color:'#1A1514' }}>{cat.label}</h2>
              </div>
              <div className="logo-grid">
                {cat.items.map((p, i) => (
                  <a key={i} href={p.url} target="_blank" rel="noopener" className="logo-card" title={p.desc}>
                    {p.logo ? (
                      <img
                        src={p.logo} alt={p.nom}
                        className="logo-img"
                        onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }}
                      />
                    ) : null}
                    <div className="logo-fallback" style={{ display: p.logo ? 'none' : 'flex', background:cat.color, color:cat.tc }}>
                      <div style={{ fontSize:18, fontWeight:700 }}>{p.initiales || p.nom.slice(0,2).toUpperCase()}</div>
                      <div style={{ fontSize:11, marginTop:2, textAlign:'center', lineHeight:1.3 }}>{p.nom}</div>
                    </div>
                    <div className="logo-name">{p.nom}</div>
                  </a>
                ))}
              </div>
            </div>
          </section>
          {/* Vague vers la section suivante (ou vers le bloc sombre final) */}
          {ci < sections.length - 1
            ? <SepAuto haut={bgSection(ci)} bas={bgSection(ci+1)} />
            : <SepAuto haut={bgSection(ci)} bas="#0A1E2D" />}
        </div>
      ))}

      {/* Devenir partenaire */}
      <section style={{ background:'linear-gradient(135deg,#0A1E2D,#0E4A5A)', padding:'64px 20px' }}>
        <div style={{ maxWidth:1000, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:48, alignItems:'center' }}>
          <div>
            <div className="tag-light">Partenariat RSE</div>
            <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'clamp(1.6rem,3vw,2.4rem)', fontWeight:500, color:'white', marginBottom:14, lineHeight:1.2 }}>
              Soutenez l'acquisition de notre ambulance
            </h2>
            <p style={{ fontSize:14, color:'rgba(255,255,255,.7)', lineHeight:1.8, marginBottom:14 }}>
              L'acquisition d'une ambulance marque un tournant décisif dans notre mission. En devenant partenaire financier, vous associez durablement votre image à une action humaniste et concrétisez vos engagements RSE.
            </p>
            <p style={{ fontSize:14, color:'rgba(255,255,255,.7)', lineHeight:1.8, marginBottom:24 }}>
              Nous sommes également toujours à la recherche de partenaires fournisseurs pour limiter nos frais opérationnels.
            </p>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
              <a href="https://www.heartsangels.be/shared-files/12728/?Dossier-de-Partenariat-Strategique.pdf" target="_blank" rel="noopener" className="btn-white">
                📄 Dossier de partenariat
              </a>
              <Link to="/contact" className="btn-outline-white">Nous contacter →</Link>
            </div>
          </div>
          <div style={{ textAlign:'center', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)', borderRadius:20, padding:'2rem' }}>
            <div style={{ fontSize:'5rem', marginBottom:12 }}>🚑</div>
            <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.3rem', fontWeight:500, color:'white', marginBottom:8 }}>Notre propre ambulance</div>
            <p style={{ fontSize:13, color:'rgba(255,255,255,.55)', lineHeight:1.65 }}>
              Ce véhicule est bien plus qu'un moyen de transport : c'est l'outil fondamental qui nous permettra d'accompagner plus de patients en fin de vie.
            </p>
          </div>
        </div>
      </section>
      <style>{`@media(max-width:800px){[style*='grid-template-columns: 1fr 1fr']{grid-template-columns:1fr !important;}}`}</style>
    </div>
  )
}


const CSS = `
.pa-hero{background:linear-gradient(135deg,#0A1E2D,#0E4A5A);padding:72px 20px;position:relative;overflow:hidden;}
.pa-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 60% at 80% 50%,rgba(27,176,206,.15),transparent);pointer-events:none;}
.pa-hero-inner{position:relative;z-index:1;max-width:1280px;margin:0 auto;}
.tag{display:inline-flex;align-items:center;background:rgba(27,176,206,.25);border:1px solid rgba(27,176,206,.4);border-radius:99px;padding:5px 14px;font-size:11.5px;font-weight:500;color:#7DE4F5;letter-spacing:.04em;text-transform:uppercase;margin-bottom:18px;}
.tag-light{display:inline-flex;align-items:center;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:99px;padding:4px 12px;font-size:11px;font-weight:500;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.04em;margin-bottom:14px;}
.h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(2.4rem,5vw,3.8rem);font-weight:500;color:white;line-height:1.15;margin-bottom:14px;}
.h1 em{font-style:italic;color:#7DE4F5;}
.p-hero{font-size:15px;color:rgba(255,255,255,.7);max-width:600px;line-height:1.75;}
/* Logos — mur centré, grands logos, épuré */
.logo-grid{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:36px 44px;max-width:1100px;margin:0 auto;}
.logo-card{display:flex;flex-direction:column;align-items:center;justify-content:center;width:200px;padding:14px;text-decoration:none;background:none;transition:transform .18s ease, opacity .18s ease;gap:14px;}
.logo-card:hover{transform:scale(1.06);}
.logo-img{max-width:170px;max-height:100px;width:auto;height:auto;object-fit:contain;}
.logo-fallback{width:120px;height:90px;border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;}
.logo-name{font-size:13px;color:#4A4340;font-weight:600;text-align:center;line-height:1.35;}
.cat-header{display:flex;flex-direction:column;align-items:center;gap:12px;margin-bottom:40px;text-align:center;}
@media(max-width:560px){.logo-card{width:130px;padding:8px;}.logo-img{max-width:120px;max-height:70px;}}
/* Boutons */
.btn-white{display:inline-flex;align-items:center;gap:7px;padding:11px 22px;background:white;color:#0A1E2D;border-radius:8px;text-decoration:none;font-size:13.5px;font-weight:700;box-shadow:0 3px 12px rgba(0,0,0,.15);transition:all .15s;}
.btn-white:hover{transform:translateY(-2px);}
.btn-outline-white{display:inline-flex;align-items:center;gap:7px;padding:11px 20px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.25);color:white;border-radius:8px;text-decoration:none;font-size:13.5px;font-weight:500;transition:all .15s;}
.btn-outline-white:hover{background:rgba(255,255,255,.15);}
`