import { Link } from 'react-router-dom'
import { SepAuto } from '../components/Decor.jsx'

const SECTIONS = [
  {
    id: 'brochures',
    icon: '📘',
    titre: 'Brochures & présentations',
    color: '#E6F7FA', tc: '#1BB0CE',
    fichiers: [
      { titre:'Brochure 2025', desc:'Notre brochure officielle de présentation de l\'ASBL Heart\'s Angels.', taille:'9.63 MB', date:'Décembre 2024', dl:216, url:'https://www.heartsangels.be/shared-files/12732/?Brochure-2025.pdf', ext:'PDF' },
      { titre:'Brochure 2025 — Pour impression', desc:'Version haute résolution pour impression professionnelle.', taille:'11.80 MB', date:'Décembre 2024', dl:89, url:'https://www.heartsangels.be/shared-files/12733/?Brochure-2025-impression.pdf', ext:'PDF' },
    ],
  },
  {
    id: 'partenariat',
    icon: '🤝',
    titre: 'Partenariat & RSE',
    color: '#FAEEDA', tc: '#BA7517',
    fichiers: [
      { titre:'Dossier de Partenariat Stratégique — Ambulance', desc:'Dossier complet pour les entreprises souhaitant soutenir l\'acquisition de notre ambulance. Associez votre image à une action humaniste.', taille:'~2 MB', date:'2024', dl:null, url:'https://www.heartsangels.be/shared-files/12728/?Dossier-de-Partenariat-Strategique.pdf', ext:'PDF', featured:true },
    ],
  },
  {
    id: 'presse',
    icon: '📰',
    titre: 'Presse',
    color: '#FBEAF0', tc: '#C8435A',
    fichiers: [
      { titre:'Dossier de presse officiel', desc:'Dossier de presse de l\'ASBL Heart\'s Angels. N\'hésitez pas à le diffuser.', taille:'~1 MB', date:'2024', dl:null, url:'https://www.heartsangels.be/Documents/Dossier-Presse.pdf', ext:'PDF' },
    ],
  },
  {
    id: 'fiches',
    icon: '📋',
    titre: 'Fiches de fonction — Bénévoles',
    color: '#EAF3DE', tc: '#3B6D11',
    fichiers: [
      { titre:'Fiche de fonction : Bénévole de soutien', desc:'Description complète du rôle de bénévole non-médical (logistique, communication, événements…)', taille:'230.54 KB', date:'17 juin 2025', dl:133, url:'https://www.heartsangels.be/shared-files/?fiche-benevole-soutien.pdf', ext:'PDF' },
      { titre:'Fiche de fonction : Chargé(e) de développement et partenariats', desc:'Description du rôle de responsable développement et partenariats au sein de l\'ASBL.', taille:'210.08 KB', date:'17 juin 2025', dl:83, url:'https://www.heartsangels.be/shared-files/?fiche-developpement-partenariats.pdf', ext:'PDF' },
    ],
  },
  {
    id: 'professionnels',
    icon: '🏥',
    titre: 'Documents pour professionnels de santé',
    color: '#EEEAF7', tc: '#534AB7',
    fichiers: [
      { titre:'Courrier aux professionnels de santé', desc:'Courrier explicatif invitant les médecins, infirmiers, kinés, aides-soignants et assistants sociaux à connaître et rejoindre l\'ASBL.', taille:'266.21 KB', date:'18 mars 2025', dl:157, url:'https://www.heartsangels.be/shared-files/?courrier-professionnels-sante.pdf', ext:'PDF' },
    ],
  },
  {
    id: 'gpx',
    icon: '🗺️',
    titre: 'Parcours GPS — Marche ADEPS & Balade motos',
    color: '#EAF3DE', tc: '#3B6D11',
    note: 'Téléchargez les fichiers GPX pour suivre nos parcours sur votre GPS, montre connectée ou smartphone (Komoot, Strava, Garmin…)',
    fichiers: [
      { titre:'Marche ADEPS — Parcours 5 km', desc:'Parcours familial accessible à tous. Départ et arrivée : Rue des Awirs 222, Flémalle.', taille:'~50 KB', date:'2026', dl:null, url:'#gpx-5km', ext:'GPX', disabled:true, note:'Disponible prochainement' },
      { titre:'Marche ADEPS — Parcours 10 km', desc:'Parcours intermédiaire. Belles vues sur la Meuse et les environs de Flémalle.', taille:'~80 KB', date:'2026', dl:null, url:'#gpx-10km', ext:'GPX', disabled:true, note:'Disponible prochainement' },
      { titre:'Marche ADEPS — Parcours 15 km', desc:'Parcours sportif avec dénivelé. Pour marcheurs entraînés.', taille:'~100 KB', date:'2026', dl:null, url:'#gpx-15km', ext:'GPX', disabled:true, note:'Disponible prochainement' },
      { titre:'Marche ADEPS — Parcours 20 km', desc:'Parcours longue distance. Prévoir de bonnes chaussures et de l\'eau.', taille:'~130 KB', date:'2026', dl:null, url:'#gpx-20km', ext:'GPX', disabled:true, note:'Disponible prochainement' },
      { titre:'Balade motos — Parcours 2026', desc:'Itinéraire de la 9° balade motos sécurisée. Départ : Rue des Awirs 222, Flémalle.', taille:'~90 KB', date:'Juin 2026', dl:null, url:'#gpx-moto', ext:'GPX', disabled:true, note:'Disponible à partir du 28/06/2026' },
    ],
  },
]

export default function Telechargement() {
  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      <section className="dl-hero">
        <div className="dl-inner">
          <div className="dl-tag">📥 Téléchargements</div>
          <h1 className="dl-h1">Nos <em>documents & fichiers</em></h1>
          <p className="dl-p">Brochures, dossiers de presse, fiches de fonction, courriers et parcours GPS — tous les documents de Heart's Angels en libre téléchargement.</p>
        </div>
      </section>

      {/* vague hero → contenu */}
      <SepAuto haut="#0E4A5A" bas="#FDFAF6" />

      <section style={{ padding:'56px 20px 80px', background:'#FDFAF6' }}>
        <div className="dl-inner" style={{ position:'relative', zIndex:1 }}>
          {SECTIONS.map((sec, si) => (
            <div key={si} style={{ marginBottom:44 }}>
              {/* En-tête section */}
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
                <div style={{ width:46, height:46, borderRadius:12, background:sec.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>{sec.icon}</div>
                <div>
                  <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.5rem', fontWeight:500, color:'#1A1514', margin:0 }}>{sec.titre}</h2>
                  {sec.note && <p style={{ fontSize:13, color:'#7A7470', margin:'3px 0 0', lineHeight:1.5 }}>{sec.note}</p>}
                </div>
              </div>

              {/* Fichiers */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
                {sec.fichiers.map((f, fi) => (
                  <div key={fi} style={{ background:'white', border:`1.5px solid ${f.featured ? sec.tc+'55' : 'rgba(27,176,206,.1)'}`, borderRadius:14, padding:'18px', boxShadow: f.featured ? `0 3px 16px ${sec.tc}15` : '0 1px 6px rgba(27,176,206,.04)', opacity:f.disabled?.8:1 }}>
                    <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:12 }}>
                      <div style={{ width:42, height:42, borderRadius:10, background:sec.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <span style={{ fontSize:11.5, fontWeight:700, color:sec.tc }}>{f.ext}</span>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:600, color:'#1A1514', lineHeight:1.3, marginBottom:4 }}>{f.titre}</div>
                        <div style={{ fontSize:12.5, color:'#7A7470', lineHeight:1.5 }}>{f.desc}</div>
                      </div>
                    </div>

                    <div style={{ display:'flex', gap:10, flexWrap:'wrap', fontSize:11.5, color:'#A8A39D', marginBottom:12 }}>
                      {f.taille && <span>📄 {f.taille}</span>}
                      {f.date   && <span>🗓 {f.date}</span>}
                      {f.dl     && <span>⬇ {f.dl} téléchargements</span>}
                    </div>

                    {f.note && (
                      <div style={{ background:'#FDF6E3', border:'1px solid rgba(186,117,23,.15)', borderRadius:7, padding:'6px 10px', fontSize:12, color:'#BA7517', marginBottom:10 }}>
                        ⏳ {f.note}
                      </div>
                    )}

                    {f.disabled
                      ? <div style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 14px', background:'#F0EFED', borderRadius:8, fontSize:13, color:'#A8A39D', fontWeight:500 }}>
                          📥 Bientôt disponible
                        </div>
                      : <a href={f.url} target="_blank" rel="noopener"
                          style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 16px', background:sec.tc, color:'white', borderRadius:9, textDecoration:'none', fontSize:13, fontWeight:600, transition:'opacity .12s' }}
                          onMouseEnter={e=>e.currentTarget.style.opacity='.85'}
                          onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                          📥 Télécharger
                        </a>
                    }
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Ajouter un GPX */}
          <div style={{ background:'#F0F9FB', border:'1px solid rgba(27,176,206,.15)', borderRadius:14, padding:'20px 22px', display:'flex', gap:16, alignItems:'center', flexWrap:'wrap', marginTop:8 }}>
            <div style={{ fontSize:'2rem' }}>📤</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#0E4A5A', marginBottom:4 }}>Vous avez un fichier GPX ?</div>
              <p style={{ fontSize:13, color:'#7A7470', margin:0, lineHeight:1.6 }}>
                Si vous souhaitez nous transmettre un parcours GPX ou signaler un lien cassé, contactez-nous.
              </p>
            </div>
            <Link to="/contact" style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'9px 18px', background:'#1BB0CE', color:'white', borderRadius:9, textDecoration:'none', fontSize:13.5, fontWeight:600, flexShrink:0 }}>
              ✉️ Nous contacter
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}

const CSS = `
.dl-hero{background:linear-gradient(135deg,#0A1E2D,#0E4A5A);padding:72px 20px;position:relative;overflow:hidden;}
.dl-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 60% at 80% 50%,rgba(27,176,206,.15),transparent);pointer-events:none;}
.dl-inner{position:relative;z-index:1;max-width:1280px;margin:0 auto;}
.dl-tag{display:inline-flex;background:rgba(27,176,206,.25);border:1px solid rgba(27,176,206,.4);border-radius:99px;padding:5px 14px;font-size:11.5px;font-weight:500;color:#7DE4F5;letter-spacing:.04em;text-transform:uppercase;margin-bottom:18px;}
.dl-h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(2.4rem,5vw,3.8rem);font-weight:500;color:white;line-height:1.15;margin-bottom:14px;}
.dl-h1 em{font-style:italic;color:#7DE4F5;}
.dl-p{font-size:15px;color:rgba(255,255,255,.7);max-width:580px;line-height:1.75;}
@media(max-width:600px){.dl-hero{padding:52px 14px;}}
`