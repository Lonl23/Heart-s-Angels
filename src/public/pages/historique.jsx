import { useI18n } from '../i18n/index.jsx'
import { SepAuto } from '../components/Decor.jsx'

const TIMELINE = [
  { year: 'Avril 2015', color:'#1BB0CE', items: [
    'Constitution de l\'ASBL "Heart\'s Angels - Ambulance"',
    'Rencontres avec les premiers partenaires & Autorités',
    'Premières récoltes de fonds',
    'Dérogation de l\'agrément pour le transport TMS par le SPW',
  ]},
  { year: '2016', color:'#0E7A93', items: [
    'Première demande reçue mais non réalisée',
    'Concrétisation des partenariats et adhésion à la Plateforme des Soins Palliatifs de la Province de Liège',
    'Achat du matériel médical et réception de don par l\'asbl VOLONT\'R',
    'Parrainage par Steve Darcis, joueur international de tennis',
  ]},
  { year: '2017', color:'#1BB0CE', items: [
    'Première convention avec le Centre Hospitalier Chrétien Liégeois (CHC)',
    'Juillet : Réalisation du 1er souhait puis du 2ème en octobre',
    'Participation au Colloque Wallon des Soins Palliatifs',
  ]},
  { year: '2018', color:'#0E7A93', items: [
    'Réalisation de 2 souhaits sur 4 demandes reçues',
    'Achat d\'une ambulance d\'occasion (arnaque)',
    'Don d\'un container de stockage',
    'Convention avec le Grand Hôpital de Charleroi (GHdC)',
    'Entente avec la Wonschkutsch asbl (Luxembourg)',
    'Parrainage par Olivier Schoonejans (RTL-TVI)',
    'Spot Radio "100 minutes pour changer le Monde" 2019',
  ]},
  { year: '2019', color:'#1BB0CE', items: [
    '8 souhaits réalisés sur 12 demandes reçues',
    'Événements partenaires de soutien',
    'Parrainage par Steve Darcis renouvelé',
  ]},
  { year: '2020', color:'#0E7A93', items: [
    'Adaptation du nom de l\'asbl en "Heart\'s Angels"',
    '5 souhaits réalisés sur 8 demandes',
    'Événements en pause suite au COVID-19',
    'Développement de la présence sur les réseaux sociaux',
  ]},
  { year: '2021', color:'#1BB0CE', items: [
    '6 souhaits réalisés sur 8 demandes',
    'Partenariat avec la Wonschkutsch asbl (Luxembourg)',
    'Reprise progressive des événements',
  ]},
  { year: '2022', color:'#0E7A93', items: [
    'Croissance de l\'équipe de bénévoles',
    'Nouvelles conventions hospitalières',
    'Événements de récolte de fonds repris pleinement',
  ]},
  { year: '2023', color:'#1BB0CE', items: [
    'Partenariats avec TotalEnergies Foundation et Fondation contre le Cancer',
    'Nouvelle brochure officielle',
    'Inauguration du nouveau site web',
    'Participation au Marché de Noël du Château d\'Aigremont',
  ]},
  { year: '2024', color:'#0E7A93', items: [
    'Lancement du projet d\'acquisition d\'une ambulance dédiée',
    'Extension des partenariats médicaux',
    'Renforcement de l\'équipe avec de nouveaux profils médicaux',
    'Dossier de partenariat RSE ambulance',
  ]},
  { year: '2025', color:'#1BB0CE', items: [
    '7ème édition de la Marche ADEPS',
    '8ème édition de la Balade Motos',
    'Partenariat avec Air Liquide pour les gaz médicaux',
    'Don de Lunettes Rouges ASBL',
  ]},
  { year: '2026', color:'#0E7A93', items: [
    'Journée Nationale des Ambulanciers — Merci à Solumob',
    'Nouveau site web et application interne',
    '9ème Balade Motos prévue le 28 juin',
    '8ème Marche ADEPS prévue le 1er novembre',
  ]},
]

const PARRAINS = [
  { nom: 'Steve Darcis', titre: 'Joueur international de tennis', year: '2016', img: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Steve_Darcis_%282013%29.jpg/220px-Steve_Darcis_%282013%29.jpg' },
  { nom: 'Olivier Schoonejans', titre: 'Journaliste & présentateur RTL-TVI', year: '2018', img: 'https://www.heartsangels.be/wp-content/uploads/2019/12/Olivier-Schoonejans.jpg' },
]

export default function Historique() {
  const { raw } = useI18n()

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      {/* Hero */}
      <section className="hi-hero">
        <div className="hi-hero-inner">
          <div className="tag">📅 Historique</div>
          <h1 className="h1">Notre <em>histoire</em></h1>
          <p className="p-hero">Depuis 2015, Heart's Angels écrit chaque jour de nouvelles pages d'humanité. Découvrez les étapes clés de notre engagement.</p>
        </div>
      </section>

      {/* vague hero → contenu */}
      <SepAuto haut="#0E4A5A" bas="#FDFAF6" />

      {/* Stats */}
      <section style={{ background:'white', padding:'40px 20px', borderBottom:'1px solid rgba(27,176,206,.1)' }}>
        <div style={{ maxWidth:1280, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:20 }}>
          {[
            { n:'2015', l:'Année de fondation', icon:'🏛️' },
            { n:'10+', l:'Années d\'engagement', icon:'📅' },
            { n:'CHC + GHdC', l:'Partenaires hospitaliers', icon:'🏥' },
            { n:'100%', l:'Gratuit pour les patients', icon:'💝' },
          ].map((s,i) => (
            <div key={i} style={{ textAlign:'center', padding:'16px', background:'#F0F9FB', borderRadius:14 }}>
              <div style={{ fontSize:'2rem', marginBottom:6 }}>{s.icon}</div>
              <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.6rem', fontWeight:600, color:'#1BB0CE', lineHeight:1 }}>{s.n}</div>
              <div style={{ fontSize:12, color:'#7A7470', marginTop:4 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section style={{ padding:'64px 20px', background:'#FDFAF6' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'clamp(1.7rem,3vw,2.4rem)', fontWeight:500, color:'#1A1514', marginBottom:44, textAlign:'center' }}>
            Chronologie de l'ASBL
          </h2>
          <div className="timeline">
            {TIMELINE.map((entry, i) => (
              <div key={i} className="tl-row">
                <div className="tl-year" style={{ color:entry.color }}>
                  <div className="tl-dot" style={{ background:entry.color }} />
                  {entry.year}
                </div>
                <div className="tl-card">
                  {entry.items.map((item, j) => (
                    <div key={j} className="tl-item">
                      <span className="tl-bullet" style={{ color:entry.color }}>▸</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Parrains */}
      <section style={{ padding:'56px 20px', background:'#F0F9FB' }}>
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.8rem', fontWeight:500, color:'#1A1514', marginBottom:28, textAlign:'center' }}>
            Nos parrains
          </h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            {PARRAINS.map((p, i) => (
              <div key={i} style={{ background:'white', border:'1px solid rgba(27,176,206,.1)', borderRadius:16, padding:'24px', display:'flex', alignItems:'center', gap:20, boxShadow:'0 2px 12px rgba(27,176,206,.06)' }}>
                <img src={p.img} alt={p.nom} style={{ width:72, height:72, borderRadius:'50%', objectFit:'cover', flexShrink:0, border:'3px solid #E6F7FA' }} />
                <div>
                  <div style={{ fontSize:15, fontWeight:600, color:'#1A1514', marginBottom:4 }}>{p.nom}</div>
                  <div style={{ fontSize:13, color:'#7A7470', marginBottom:4 }}>{p.titre}</div>
                  <div style={{ fontSize:12, color:'#1BB0CE', fontWeight:600 }}>Parrain depuis {p.year}</div>
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
            Écrire la suite avec nous
          </h2>
          <p style={{ fontSize:15, color:'rgba(255,255,255,.7)', marginBottom:28, lineHeight:1.75 }}>
            Chaque bénévole, chaque partenaire et chaque donateur contribue à notre histoire commune.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' }}>
            <a href="/devenir-benevole" style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'11px 22px', background:'#1BB0CE', color:'white', borderRadius:8, textDecoration:'none', fontSize:14, fontWeight:600 }}>🙋 Devenir bénévole</a>
            <a href="/nous-soutenir" style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'11px 20px', background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.25)', color:'white', borderRadius:8, textDecoration:'none', fontSize:14 }}>💝 Nous soutenir</a>
          </div>
        </div>
      </section>
    </div>
  )
}

const CSS = `
.hi-hero{background:linear-gradient(135deg,#0A1E2D,#0E4A5A);padding:72px 20px;position:relative;overflow:hidden;}
.hi-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 60% at 80% 50%,rgba(27,176,206,.15),transparent);pointer-events:none;}
.hi-hero-inner{position:relative;z-index:1;max-width:1280px;margin:0 auto;}
.tag{display:inline-flex;background:rgba(27,176,206,.25);border:1px solid rgba(27,176,206,.4);border-radius:99px;padding:5px 14px;font-size:11.5px;font-weight:500;color:#7DE4F5;letter-spacing:.04em;text-transform:uppercase;margin-bottom:18px;}
.h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(2.4rem,5vw,3.8rem);font-weight:500;color:white;line-height:1.15;margin-bottom:14px;}
.h1 em{font-style:italic;color:#7DE4F5;}
.p-hero{font-size:15px;color:rgba(255,255,255,.7);max-width:560px;line-height:1.75;}
/* Timeline */
.timeline{display:flex;flex-direction:column;gap:0;position:relative;}
.timeline::before{content:'';position:absolute;left:90px;top:0;bottom:0;width:2px;background:linear-gradient(to bottom,#1BB0CE,rgba(27,176,206,.1));}
.tl-row{display:flex;gap:24px;position:relative;padding-bottom:32px;}
.tl-year{min-width:90px;font-family:'Cormorant Garamond',Georgia,serif;font-size:1.1rem;font-weight:600;text-align:right;padding-top:3px;position:relative;flex-shrink:0;}
.tl-dot{width:14px;height:14px;border-radius:50%;position:absolute;right:-31px;top:7px;border:2px solid white;box-shadow:0 0 0 2px currentColor;}
.tl-card{background:white;border:1px solid rgba(27,176,206,.1);border-radius:12px;padding:16px 18px;flex:1;box-shadow:0 1px 8px rgba(27,176,206,.05);}
.tl-item{display:flex;gap:8px;font-size:13.5px;color:#4A4340;line-height:1.6;margin-bottom:6px;}
.tl-item:last-child{margin-bottom:0;}
.tl-bullet{flex-shrink:0;font-size:12px;margin-top:2px;}
@media(max-width:600px){.timeline::before{left:60px;}.tl-year{min-width:60px;font-size:.9rem;}.tl-dot{right:-28px;} [style*='grid-template-columns: 1fr 1fr']{grid-template-columns:1fr !important;}}
`