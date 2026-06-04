import { useState, useEffect } from 'react'
import { useI18n } from '../i18n/index.jsx'
import { supabase } from '@/lib/supabase'
import { ALBUMS_STATIC } from '../utils/images.js'
import { SepAuto } from '../components/Decor.jsx'

export default function Galerie() {
  const { raw } = useI18n()
  const lang = raw?.lang || 'fr'
  const [albums, setAlbums]   = useState(ALBUMS_STATIC)
  const [catSel, setCatSel]   = useState('tous')
  const [lightbox, setLightbox] = useState(null)  // { src, caption }

  useEffect(() => {
    supabase.from('galerie_albums').select('*, galerie_photos(*)').eq('publie', true).order('ordre')
      .then(({ data }) => { if (data?.length) setAlbums([...ALBUMS_STATIC, ...data]) })
  }, [])

  const cats = ['tous', 'souhaits', 'evenements']
  const displayed = catSel === 'tous' ? albums : albums.filter(a => a.categorie === catSel)

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      {/* Hero avec vraie photo */}
      <section className="ga-hero">
        <div className="ga-hero-bg" />
        <div className="ga-hero-inner">
          <div className="ga-tag">📸 Galerie photos</div>
          <h1 className="ga-h1">Nos <em>moments précieux</em></h1>
          <p className="ga-p-hero">Découvrez les souhaits réalisés, nos événements de soutien et les moments forts de Heart's Angels ASBL.</p>
        </div>
      </section>

      {/* vague hero → contenu */}
      <SepAuto haut="#0E4A5A" bas="#FDFAF6" />

      {/* Filtres */}
      <section style={{ padding:'44px 20px 0', background:'#FDFAF6' }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {[['tous','🗂️ Tous'],['souhaits','❤️ Souhaits réalisés'],['evenements','🎪 Événements']].map(([v,l])=>(
              <button key={v} onClick={()=>setCatSel(v)} className={`ga-cat-btn ${catSel===v?'active':''}`}>{l}</button>
            ))}
          </div>
        </div>
      </section>

      {/* Grille albums */}
      <section style={{ padding:'32px 20px 64px', background:'#FDFAF6' }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <div className="ga-grid">
            {displayed.map((al, i) => (
              <AlbumCard key={al.id||i} album={al} lang={lang} onClick={() => setLightbox(al)} />
            ))}
          </div>
          {displayed.length === 0 && (
            <div style={{ textAlign:'center', padding:'56px', color:'#7A7470', fontSize:15 }}>
              <div style={{ fontSize:'3rem', marginBottom:12 }}>📷</div>
              Aucun album dans cette catégorie.
            </div>
          )}
        </div>
      </section>

      {/* Section souhaits marquants */}
      {/* vague → CTA */}
      <SepAuto haut="#FDFAF6" bas="#0A1E2D" />
      <section style={{ background:'linear-gradient(135deg,#0A1E2D,#0E4A5A)', padding:'64px 20px' }}>
        <div style={{ maxWidth:1280, margin:'0 auto', textAlign:'center' }}>
          <div className="ga-tag ga-tag-light">❤️ Témoignages en images</div>
          <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'clamp(1.8rem,3vw,2.6rem)', fontWeight:500, color:'white', marginBottom:14 }}>
            Chaque photo raconte une histoire
          </h2>
          <p style={{ fontSize:15, color:'rgba(255,255,255,.7)', marginBottom:32, maxWidth:560, margin:'0 auto 32px' }}>
            Depuis 2017, nous avons réalisé des dizaines de souhaits. Chaque sortie est immortalisée avec le consentement des familles.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:8, marginBottom:28 }}>
            {[
              'https://www.heartsangels.be/wp-content/uploads/2026/04/DSC_0975-scaled.jpg',
              'https://www.heartsangels.be/wp-content/uploads/2024/06/448340450_848408590653269_3974634456659016404_n.jpg',
              'https://www.heartsangels.be/wp-content/uploads/2024/02/423194226_775502387943890_4753465545900779820_n.jpg',
              'https://www.heartsangels.be/wp-content/uploads/2019/07/DSC_0043-1024x683.jpg',
              'https://www.heartsangels.be/wp-content/uploads/2022/11/marche.jpg',
              'https://www.heartsangels.be/wp-content/uploads/2023/08/67619839_1166249026894459_8802576039118110720_n.jpg',
            ].map((src, i) => (
              <img key={i} src={src} alt="" loading="lazy"
                style={{ width:'100%', height:160, objectFit:'cover', borderRadius:10, cursor:'pointer', transition:'transform .15s', opacity:.9 }}
                onMouseEnter={e=>{e.target.style.transform='scale(1.04)';e.target.style.opacity='1'}}
                onMouseLeave={e=>{e.target.style.transform='';e.target.style.opacity='.9'}}
                onClick={()=>setLightbox({ thumb:src, titre_fr:'' })}
              />
            ))}
          </div>
          <a href="https://www.heartsangels.be/photos/" target="_blank" rel="noopener"
            style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 26px', background:'white', color:'#0A1E2D', borderRadius:9, textDecoration:'none', fontSize:14, fontWeight:700, boxShadow:'0 4px 16px rgba(0,0,0,.15)' }}>
            📸 Voir toutes les photos sur le site officiel
          </a>
        </div>
      </section>

      {/* Lightbox album */}
      {lightbox && (
        <div className="ga-lightbox-bg" onClick={()=>setLightbox(null)}>
          <div className="ga-lightbox" onClick={e=>e.stopPropagation()}>
            <button onClick={()=>setLightbox(null)} className="ga-lb-close">✕</button>
            <img src={lightbox.thumb} alt={lightbox.titre_fr} className="ga-lb-img" />
            <div className="ga-lb-caption">
              {lightbox[`titre_${lang}`] || lightbox.titre_fr}
              {lightbox.lien_externe && (
                <a href={lightbox.lien_externe} target="_blank" rel="noopener" style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:12, padding:'8px 16px', background:'#1BB0CE', color:'white', borderRadius:7, textDecoration:'none', fontSize:13, fontWeight:600 }}>
                  Voir l'album complet →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AlbumCard({ album, lang, onClick }) {
  const titre = album[`titre_${lang}`] || album.titre_fr
  const thumb = album.thumb || album.image_url
  const catColor = album.categorie === 'souhaits' ? { bg:'#FBEAF0', color:'#C8435A', label:'❤️ Souhait' } : { bg:'#E6F7FA', color:'#1BB0CE', label:'🎪 Événement' }

  return (
    <div className="ga-album-card" onClick={onClick}>
      {thumb
        ? <img src={thumb} alt={titre} className="ga-album-img" loading="lazy" />
        : <div className="ga-album-placeholder">📸</div>
      }
      <div className="ga-album-overlay">
        <div className="ga-album-play">▶</div>
      </div>
      <div className="ga-album-body">
        <span className="ga-album-cat" style={{ background:catColor.bg, color:catColor.color }}>{catColor.label}</span>
        <div className="ga-album-title">{titre}</div>
      </div>
    </div>
  )
}

const CSS = `
.ga-hero{background:linear-gradient(135deg,#0A1E2D,#0E4A5A);padding:72px 20px;position:relative;overflow:hidden;}
.ga-hero-bg{position:absolute;inset:0;background:url('https://www.heartsangels.be/wp-content/uploads/photo-gallery/imported_from_media_libray/thumb/476831437_1096540589279038_8483905148748547052_n.jpg') center/cover;opacity:.18;}
.ga-hero-bg::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(10,30,45,.9),rgba(14,74,90,.75));}
.ga-hero-inner{position:relative;z-index:1;max-width:1280px;margin:0 auto;}
.ga-tag{display:inline-flex;background:rgba(27,176,206,.25);border:1px solid rgba(27,176,206,.4);border-radius:99px;padding:5px 14px;font-size:11.5px;font-weight:500;color:#7DE4F5;letter-spacing:.04em;text-transform:uppercase;margin-bottom:18px;}
.ga-tag-light{display:inline-flex;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:99px;padding:4px 12px;font-size:11px;font-weight:500;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.04em;margin-bottom:14px;}
.ga-h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(2.4rem,5vw,3.8rem);font-weight:500;color:white;line-height:1.15;margin-bottom:14px;}
.ga-h1 em{font-style:italic;color:#7DE4F5;}
.ga-p-hero{font-size:15px;color:rgba(255,255,255,.7);max-width:560px;line-height:1.75;}
/* Filtres */
.ga-cat-btn{padding:7px 16px;border-radius:99px;border:1px solid rgba(27,176,206,.2);background:white;color:#7A7470;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .12s;}
.ga-cat-btn.active{background:#1BB0CE;color:white;border-color:#1BB0CE;font-weight:600;}
/* Grille albums */
.ga-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;}
.ga-album-card{background:white;border:1px solid rgba(27,176,206,.1);border-radius:14px;overflow:hidden;cursor:pointer;box-shadow:0 2px 12px rgba(27,176,206,.06);transition:transform .15s,box-shadow .15s;position:relative;}
.ga-album-card:hover{transform:translateY(-4px);box-shadow:0 10px 30px rgba(27,176,206,.14);}
.ga-album-card:hover .ga-album-overlay{opacity:1;}
.ga-album-img{width:100%;height:190px;object-fit:cover;display:block;}
.ga-album-placeholder{height:140px;background:linear-gradient(135deg,#E6F7FA,#B5E8F5);display:flex;align-items:center;justify-content:center;font-size:3rem;}
.ga-album-overlay{position:absolute;top:0;left:0;right:0;height:190px;background:rgba(10,30,45,.4);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s;}
.ga-album-play{width:52px;height:52px;border-radius:50%;background:rgba(27,176,206,.9);display:flex;align-items:center;justify-content:center;font-size:20px;color:white;}
.ga-album-body{padding:14px 16px;}
.ga-album-cat{display:inline-flex;align-items:center;padding:2px 9px;border-radius:99px;font-size:11.5px;font-weight:600;margin-bottom:7px;}
.ga-album-title{font-size:13.5px;font-weight:600;color:#1A1514;line-height:1.35;}
/* Lightbox */
.ga-lightbox-bg{position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:300;display:flex;align-items:center;justify-content:center;padding:20px;}
.ga-lightbox{background:white;border-radius:16px;max-width:640px;width:100%;overflow:hidden;position:relative;}
.ga-lb-close{position:absolute;top:12px;right:12px;background:rgba(0,0,0,.4);border:none;width:32px;height:32px;border-radius:50%;cursor:pointer;color:white;font-size:16px;display:flex;align-items:center;justify-content:center;z-index:1;}
.ga-lb-img{width:100%;max-height:420px;object-fit:cover;display:block;}
.ga-lb-caption{padding:18px 20px;font-size:14px;font-weight:600;color:#1A1514;display:flex;flex-direction:column;align-items:flex-start;}
@media(max-width:600px){.ga-grid{grid-template-columns:1fr 1fr;gap:10px;}}
`