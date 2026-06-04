import { useState, useEffect } from 'react'
import { useI18n } from '../i18n/index.jsx'
import { supabase } from '@/lib/supabase'
import { SepAuto } from '../components/Decor.jsx'

// Articles statiques Heart's Angels (remplacent Odoo)
const ARTICLES_STATIC = [
  { id:'a1', nom_fr:'Cuberdons Heart\'s Angels', nom_nl:'Heart\'s Angels cuberdons', nom_en:'Heart\'s Angels cuberdons', nom_de:'Heart\'s Angels Cuberdons', desc_fr:'Nos délicieux cuberdons artisanaux, disponibles dans nos événements ou sur commande.', prix_ttc:5.00, image_url:'https://www.heartsangels.be/wp-content/uploads/2024/01/cuberdons.jpg', categorie:'friandises', actif:true },
  { id:'a2', nom_fr:'Chiques artisanales', nom_nl:'Ambachtelijke snoepjes', nom_en:'Handcrafted sweets', nom_de:'Handgemachte Süßigkeiten', desc_fr:'Chiques artisanales fabriquées localement. Disponibles lors de nos ventes.', prix_ttc:4.00, image_url:'https://www.heartsangels.be/wp-content/uploads/2024/01/chiques.jpg', categorie:'friandises', actif:true },
  { id:'a3', nom_fr:'T-shirt Heart\'s Angels', nom_nl:'Heart\'s Angels T-shirt', nom_en:'Heart\'s Angels T-shirt', nom_de:'Heart\'s Angels T-Shirt', desc_fr:'T-shirt officiel de l\'ASBL. Arborez nos couleurs et soutenez notre mission.', prix_ttc:15.00, image_url:null, categorie:'vêtements', actif:true, variantes:[{taille:'S'},{taille:'M'},{taille:'L'},{taille:'XL'}] },
  { id:'a4', nom_fr:'Tote bag Heart\'s Angels', nom_nl:'Heart\'s Angels draagtas', nom_en:'Heart\'s Angels tote bag', nom_de:'Heart\'s Angels Tragetasche', desc_fr:'Sac en toile réutilisable aux couleurs de Heart\'s Angels.', prix_ttc:8.00, image_url:null, categorie:'accessoires', actif:true },
  { id:'a5', nom_fr:'Badge magnétique', nom_nl:'Magneetbadge', nom_en:'Magnetic badge', nom_de:'Magnetabzeichen', desc_fr:'Badge magnétique Heart\'s Angels. Parfait pour afficher votre soutien.', prix_ttc:3.00, image_url:null, categorie:'accessoires', actif:true },
]

export default function Boutique() {
  const { raw } = useI18n()
  const lang = raw?.lang || 'fr'
  const [articles, setArticles]   = useState(ARTICLES_STATIC)
  const [catSel, setCatSel]       = useState('tous')
  const [panier, setPanier]       = useState([])
  const [showPanier, setShowPanier] = useState(false)
  const [checkout, setCheckout]   = useState(false)
  const [form, setForm]           = useState({ prenom:'', nom:'', email:'', telephone:'', adresse:'', ville:'', mode:'livraison', message:'' })
  const [sending, setSending]     = useState(false)
  const [sent, setSent]           = useState(false)

  useEffect(() => {
    supabase.from('boutique_produits').select('*, boutique_variantes(*)')
      .eq('actif', true).order('ordre')
      .then(({ data }) => { if (data?.length) setArticles([...ARTICLES_STATIC, ...data]) })
  }, [])

  const cats = ['tous', ...new Set(articles.map(a => a.categorie).filter(Boolean))]
  const displayed = catSel === 'tous' ? articles : articles.filter(a => a.categorie === catSel)

  function addToCart(art, taille) {
    const key = `${art.id}-${taille||''}`
    setPanier(prev => {
      const ex = prev.find(l => l.key === key)
      if (ex) return prev.map(l => l.key === key ? {...l, qty:l.qty+1} : l)
      return [...prev, { key, id:art.id, nom:art[`nom_${lang}`]||art.nom_fr, taille, prix:art.prix_ttc, qty:1 }]
    })
  }
  const total = panier.reduce((s,l) => s+l.prix*l.qty, 0)
  const qtyTot= panier.reduce((s,l) => s+l.qty, 0)

  async function handleOrder(e) {
    e.preventDefault()
    if (!form.prenom||!form.nom||!form.email) return
    setSending(true)
    await supabase.from('boutique_commandes').insert({
      ...form, montant_ttc:total, statut:'nouvelle',
      lignes: panier,
    })
    setSent(true); setSending(false)
  }

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      {/* Hero */}
      <section className="bo-hero">
        <div className="bo-hero-inner">
          <div className="tag">🛍️ Boutique</div>
          <h1 className="h1">Notre <em>boutique solidaire</em></h1>
          <p className="p-hero">En achetant nos articles, vous soutenez directement la réalisation de souhaits pour des patients en soins palliatifs.</p>
        </div>
      </section>

      {/* vague hero → contenu */}
      <SepAuto haut="#0E4A5A" bas="#FDFAF6" />

      <section style={{ padding:'56px 20px', background:'#FDFAF6' }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          {/* Filtres */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:28 }}>
            {cats.map(c => (
              <button key={c} onClick={() => setCatSel(c)} className={`cat-btn ${catSel===c?'active':''}`}>
                {c === 'tous' ? 'Tout voir' : c.charAt(0).toUpperCase()+c.slice(1)}
              </button>
            ))}
          </div>

          {/* Grille */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:20 }}>
            {displayed.map((art, i) => (
              <ArticleCard key={art.id||i} art={art} lang={lang} onAdd={addToCart} />
            ))}
          </div>

          {/* Note commande */}
          <div style={{ background:'#E6F7FA', border:'1px solid rgba(27,176,206,.2)', borderRadius:12, padding:'16px 20px', marginTop:36, fontSize:14, color:'#0E4A5A', lineHeight:1.7 }}>
            <strong>📦 Commande et livraison</strong><br/>
            Les articles sont disponibles lors de nos événements (balade motos, marche ADEPS…) ou sur commande. Livraison possible en Belgique. Contactez-nous au <strong>+32 493 19 14 78</strong> ou via le formulaire ci-dessous.
          </div>
        </div>
      </section>

      {/* Badge panier */}
      {qtyTot > 0 && !showPanier && (
        <button className="panier-fab" onClick={() => setShowPanier(true)}>
          🛒 {qtyTot} · {total.toFixed(2)} €
        </button>
      )}

      {/* Panneau panier */}
      {showPanier && (
        <>
          <div className="overlay" onClick={() => setShowPanier(false)} />
          <div className="panier-panel">
            <div className="panier-header">
              <span style={{ fontSize:15, fontWeight:600, color:'#1A1514' }}>🛒 Votre panier</span>
              <button onClick={() => setShowPanier(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#7A7470' }}>✕</button>
            </div>

            {sent ? (
              <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, textAlign:'center' }}>
                <div style={{ fontSize:'3rem', marginBottom:14 }}>✅</div>
                <h3 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.4rem', color:'#1E5C1E', marginBottom:8 }}>Commande envoyée !</h3>
                <p style={{ fontSize:13.5, color:'#4A4340', lineHeight:1.7 }}>Nous vous contacterons rapidement pour confirmer votre commande.</p>
                <button onClick={() => { setSent(false); setCheckout(false); setShowPanier(false); setPanier([]) }} style={{ marginTop:16, padding:'9px 20px', background:'#1BB0CE', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontSize:13.5, fontWeight:600 }}>Fermer</button>
              </div>
            ) : checkout ? (
              <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
                <form onSubmit={handleOrder} style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <h4 style={{ fontSize:14, fontWeight:600, color:'#1A1514', margin:'0 0 4px' }}>Vos coordonnées</h4>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <F label="Prénom *" val={form.prenom} set={v=>setForm(f=>({...f,prenom:v}))} />
                    <F label="Nom *" val={form.nom} set={v=>setForm(f=>({...f,nom:v}))} />
                  </div>
                  <F label="Email *" val={form.email} set={v=>setForm(f=>({...f,email:v}))} type="email" />
                  <F label="Téléphone" val={form.telephone} set={v=>setForm(f=>({...f,telephone:v}))} type="tel" />
                  <div style={{ display:'flex', gap:8 }}>
                    {[['livraison','📦 Livraison'],['retrait','🏠 Retrait']].map(([v,l])=>(
                      <label key={v} style={{ flex:1, display:'flex', alignItems:'center', gap:8, padding:'8px 12px', border:`1.5px solid ${form.mode===v?'#1BB0CE':'rgba(0,0,0,.1)'}`, borderRadius:8, cursor:'pointer', background:form.mode===v?'#E6F7FA':'white' }}>
                        <input type="radio" name="mode" value={v} checked={form.mode===v} onChange={()=>setForm(f=>({...f,mode:v}))} style={{accentColor:'#1BB0CE'}}/>
                        <span style={{ fontSize:13, color:form.mode===v?'#1BB0CE':'#4A4340', fontWeight:form.mode===v?600:400 }}>{l}</span>
                      </label>
                    ))}
                  </div>
                  {form.mode==='livraison' && (
                    <>
                      <F label="Adresse" val={form.adresse} set={v=>setForm(f=>({...f,adresse:v}))} />
                      <F label="Ville" val={form.ville} set={v=>setForm(f=>({...f,ville:v}))} />
                    </>
                  )}
                  {form.mode==='retrait' && <div style={{ background:'#F8F3EE', borderRadius:8, padding:'10px 12px', fontSize:12.5, color:'#7A7470' }}>📍 Retrait : Rue des Awirs 249, 4400 Flémalle · Nous vous contacterons pour convenir d'un rendez-vous.</div>}
                  <F label="Message" val={form.message} set={v=>setForm(f=>({...f,message:v}))} />
                  {/* Récap */}
                  <div style={{ background:'#F8F3EE', borderRadius:10, padding:'12px 14px', fontSize:13 }}>
                    {panier.map((l,i)=><div key={i} style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><span>{l.nom} {l.taille&&`(${l.taille})`} ×{l.qty}</span><span style={{ fontWeight:600 }}>{(l.prix*l.qty).toFixed(2)} €</span></div>)}
                    <div style={{ borderTop:'1px solid rgba(27,176,206,.15)', marginTop:8, paddingTop:8, display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:14 }}><span>Total</span><span style={{ color:'#1BB0CE' }}>{total.toFixed(2)} €</span></div>
                  </div>
                  <button type="submit" disabled={sending} style={{ padding:12, background:sending?'rgba(27,176,206,.5)':'#1BB0CE', color:'white', border:'none', borderRadius:9, fontSize:14, fontWeight:600, cursor:sending?'wait':'pointer' }}>
                    {sending?'Envoi…':'✓ Confirmer la commande'}
                  </button>
                  <button type="button" onClick={()=>setCheckout(false)} style={{ padding:9, background:'none', border:'1px solid rgba(27,176,206,.2)', borderRadius:9, fontSize:13, color:'#7A7470', cursor:'pointer' }}>← Retour</button>
                </form>
              </div>
            ) : (
              <>
                <div style={{ flex:1, overflowY:'auto' }}>
                  {panier.length===0
                    ? <div style={{ textAlign:'center', padding:'40px 20px', color:'#7A7470', fontSize:14 }}>Votre panier est vide</div>
                    : panier.map(l=>(
                      <div key={l.key} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px', borderBottom:'1px solid rgba(27,176,206,.07)' }}>
                        <div style={{ flex:1, fontSize:13.5, color:'#1A1514' }}>
                          <div style={{ fontWeight:600 }}>{l.nom}</div>
                          {l.taille && <div style={{ fontSize:12, color:'#7A7470' }}>Taille : {l.taille}</div>}
                          <div style={{ fontSize:13, color:'#1BB0CE', fontWeight:500 }}>{l.prix.toFixed(2)} €</div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <button onClick={()=>setPanier(p=>p.map(x=>x.key===l.key?{...x,qty:Math.max(1,x.qty-1)}:x))} style={QBTN}>−</button>
                          <span style={{ fontWeight:600, minWidth:18, textAlign:'center' }}>{l.qty}</span>
                          <button onClick={()=>setPanier(p=>p.map(x=>x.key===l.key?{...x,qty:x.qty+1}:x))} style={QBTN}>+</button>
                        </div>
                        <div style={{ fontWeight:700, color:'#1A1514', minWidth:54, textAlign:'right' }}>{(l.prix*l.qty).toFixed(2)} €</div>
                        <button onClick={()=>setPanier(p=>p.filter(x=>x.key!==l.key))} style={{ background:'none', border:'none', cursor:'pointer', color:'#C8B0B0', fontSize:16 }}>✕</button>
                      </div>
                    ))
                  }
                </div>
                {panier.length > 0 && (
                  <div style={{ padding:'16px 20px', borderTop:'1px solid rgba(27,176,206,.1)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:15, color:'#1A1514', marginBottom:14 }}>
                      <span>Total</span><span style={{ color:'#1BB0CE' }}>{total.toFixed(2)} €</span>
                    </div>
                    <button onClick={()=>setCheckout(true)} style={{ width:'100%', padding:13, background:'#1BB0CE', color:'white', border:'none', borderRadius:10, fontSize:14, fontWeight:700, cursor:'pointer' }}>
                      Commander →
                    </button>
                    <div style={{ fontSize:11.5, color:'#7A7470', textAlign:'center', marginTop:8 }}>Belgique uniquement · Paiement à la livraison ou au retrait</div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ArticleCard({ art, lang, onAdd }) {
  const nom  = art[`nom_${lang}`]  || art.nom_fr  || ''
  const desc = art[`desc_${lang}`] || art.desc_fr || ''
  const [tailleS, setTailleS] = useState('')
  const variantes = art.boutique_variantes || art.variantes || []
  return (
    <div className="art-card">
      {art.image_url
        ? <img src={art.image_url} alt={nom} className="art-img" loading="lazy" />
        : <div className="art-img-ph">🛍️</div>
      }
      <div className="art-body">
        <div className="art-nom">{nom}</div>
        <div className="art-desc">{desc.slice(0,80)}{desc.length>80?'…':''}</div>
        {variantes.length > 0 && (
          <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:10 }}>
            {variantes.map((v,i) => (
              <button key={i} onClick={()=>setTailleS(v.taille)} style={{ padding:'3px 10px', borderRadius:6, border:`1.5px solid ${tailleS===v.taille?'#1BB0CE':'rgba(0,0,0,.12)'}`, background:tailleS===v.taille?'#E6F7FA':'white', color:tailleS===v.taille?'#1BB0CE':'#4A4340', fontSize:12.5, cursor:'pointer' }}>
                {v.taille}
              </button>
            ))}
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'auto' }}>
          <div style={{ fontSize:17, fontWeight:700, color:'#1A1514' }}>{art.prix_ttc?.toFixed(2)} €</div>
          <button onClick={()=>onAdd(art, tailleS||null)} className="art-btn">
            + Panier
          </button>
        </div>
      </div>
    </div>
  )
}

function F({ label, val, set, type='text' }) {
  return <div><label style={{ fontSize:12, color:'#7A7470', fontWeight:500, display:'block', marginBottom:4 }}>{label}</label><input type={type} value={val} onChange={e=>set(e.target.value)} style={{ width:'100%', padding:'8px 10px', border:'1px solid rgba(0,0,0,.1)', borderRadius:7, fontSize:13, fontFamily:"'DM Sans',sans-serif" }}/></div>
}

const QBTN = { width:26, height:26, borderRadius:6, border:'1px solid rgba(0,0,0,.1)', background:'white', fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }

const CSS = `
.bo-hero{background:linear-gradient(135deg,#0A1E2D,#0E4A5A);padding:72px 20px;position:relative;overflow:hidden;}
.bo-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 60% at 80% 50%,rgba(27,176,206,.15),transparent);pointer-events:none;}
.bo-hero-inner{position:relative;z-index:1;max-width:1280px;margin:0 auto;}
.tag{display:inline-flex;align-items:center;background:rgba(27,176,206,.25);border:1px solid rgba(27,176,206,.4);border-radius:99px;padding:5px 14px;font-size:11.5px;font-weight:500;color:#7DE4F5;letter-spacing:.04em;text-transform:uppercase;margin-bottom:18px;}
.h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(2.4rem,5vw,3.8rem);font-weight:500;color:white;line-height:1.15;margin-bottom:14px;}
.h1 em{font-style:italic;color:#7DE4F5;}
.p-hero{font-size:15px;color:rgba(255,255,255,.7);max-width:560px;line-height:1.75;}
.cat-btn{padding:6px 16px;border-radius:99px;border:1px solid rgba(27,176,206,.2);background:white;color:#7A7470;font-size:13px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .12s;}
.cat-btn.active{background:#1BB0CE;color:white;border-color:#1BB0CE;font-weight:600;}
.art-card{background:white;border:1px solid rgba(27,176,206,.1);border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(27,176,206,.05);transition:transform .15s,box-shadow .15s;display:flex;flex-direction:column;}
.art-card:hover{transform:translateY(-3px);box-shadow:0 8px 26px rgba(27,176,206,.12);}
.art-img{width:100%;height:180px;object-fit:cover;display:block;}
.art-img-ph{height:120px;background:linear-gradient(135deg,#E6F7FA,#B5E8F5);display:flex;align-items:center;justify-content:center;font-size:3rem;}
.art-body{padding:18px;display:flex;flex-direction:column;flex:1;gap:8px;}
.art-nom{font-size:15px;font-weight:600;color:#1A1514;line-height:1.3;}
.art-desc{font-size:12.5px;color:#7A7470;line-height:1.55;flex:1;}
.art-btn{padding:8px 16px;background:#1BB0CE;color:white;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;font-family:'DM Sans',sans-serif;}
.art-btn:hover{background:#0E7A93;}
.panier-fab{position:fixed;bottom:24px;right:24px;background:#1BB0CE;color:white;border:none;border-radius:99px;padding:12px 22px;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 18px rgba(27,176,206,.4);z-index:100;font-family:'DM Sans',sans-serif;}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:200;}
.panier-panel{position:fixed;top:0;right:0;bottom:0;width:min(420px,95vw);background:white;z-index:210;display:flex;flex-direction:column;box-shadow:-8px 0 40px rgba(0,0,0,.15);}
.panier-header{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid rgba(27,176,206,.1);}
`