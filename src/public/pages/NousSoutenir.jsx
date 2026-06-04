import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.jsx'
import { SepAuto } from '../components/Decor.jsx'

export default function NousSoutenir() {
  const { raw } = useI18n()
  const d = raw?.donations || {}
  const [amount, setAmount] = useState('')
  const [custom, setCustom] = useState('')

  async function handleDon() {
    const amt = amount === 'custom' ? parseFloat(custom) : parseFloat(amount)
    if (!amt || amt < 1) { alert('Veuillez indiquer un montant valide (minimum 1 €)'); return }
    alert(`Redirection vers le système de paiement pour un don de ${amt} €.\n\nConfigurez votre clé Stripe dans .env.local`)
  }

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      {/* Hero avec photo */}
      <section className="ns-hero">
        <div className="ns-hero-bg" />
        <div className="ns-hero-inner">
          <div className="ns-tag">💝 Nous soutenir</div>
          <h1 className="ns-h1">En nous aidant, <em>vous les aidez</em></h1>
          <p className="ns-p-hero">Heart's Angels réalise gratuitement des souhaits grâce à votre générosité. Chaque don, quel que soit son montant, nous rapproche d'un nouveau sourire.</p>
        </div>
      </section>

      {/* vague hero → contenu */}
      <SepAuto haut="#0E4A5A" bas="#FDFAF6" />

      {/* 3 façons de soutenir */}
      <section className="ns-section">
        <div className="ns-inner">
          <div style={{ textAlign:'center', marginBottom:44 }}>
            <div className="ns-tag-blue">Comment nous aider</div>
            <h2 className="ns-h2">Votre soutien <em>fait la différence</em></h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}>
            {[
              { icon:'💶', title:'Faire un don', desc:'Virement ou paiement en ligne. Chaque euro est entièrement dédié à la réalisation de souhaits.', color:'#E6F7FA', tc:'#1BB0CE', to:'#don-form' },
              { icon:'🎪', title:'Nos événements', desc:'Participez à notre balade motos, marche ADEPS, marchés… et contribuez tout en vous amusant.', color:'#EAF3DE', tc:'#3B6D11', to:'/evenements' },
              { icon:'🙋', title:'Devenir bénévole', desc:'Rejoignez notre équipe médicale ou non-médicale et offrez votre temps et vos compétences.', color:'#FAEEDA', tc:'#BA7517', to:'/devenir-benevole' },
            ].map((c,i)=>(
              <a key={i} href={c.to} className="ns-card" style={{ background:c.color }}>
                <div style={{ fontSize:'2.5rem', marginBottom:14 }}>{c.icon}</div>
                <div style={{ fontSize:15, fontWeight:600, color:c.tc, marginBottom:8 }}>{c.title}</div>
                <p style={{ fontSize:13.5, color:'#4A4340', lineHeight:1.65, marginBottom:14 }}>{c.desc}</p>
                <div style={{ fontSize:13, color:c.tc, fontWeight:600 }}>En savoir plus →</div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Formulaire don */}
      <section id="don-form" className="ns-section ns-alt">
        <div className="ns-inner">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:56, alignItems:'center' }}>
            <div>
              <div className="ns-tag-blue">Faire un don</div>
              <h2 className="ns-h2">Soutenez <em>notre mission</em></h2>
              <p style={{ fontSize:15, color:'#4A4340', lineHeight:1.8, marginBottom:16 }}>
                Heart's Angels est une ASBL animée par une conviction forte : réaliser des souhaits ne devrait jamais avoir de coût pour ceux qui en rêvent.
              </p>
              <p style={{ fontSize:15, color:'#4A4340', lineHeight:1.8, marginBottom:20 }}>
                En toute transparence : vos dons soutiennent intégralement la cause de Heart's Angels. Chaque euro versé est entièrement dédié à la réalisation de notre mission.
              </p>
              <div style={{ background:'#E6F7FA', border:'1px solid rgba(27,176,206,.2)', borderRadius:12, padding:'14px 16px', fontSize:13.5, color:'#0E4A5A' }}>
                <strong>🏦 Virement bancaire direct :</strong><br/>
                IBAN : <strong>BE45 0689 3611 4489</strong><br/>
                BIC : GKCCBEBB<br/>
                Bénéficiaire : Heart's Angels ASBL
              </div>
            </div>
            {/* Widget don */}
            <div style={{ background:'white', border:'1px solid rgba(27,176,206,.15)', borderRadius:18, padding:'28px', boxShadow:'0 4px 24px rgba(27,176,206,.09)' }}>
              <h3 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.4rem', fontWeight:500, color:'#1A1514', marginBottom:6 }}>Faire un don</h3>
              <div style={{ fontSize:12, color:'#7A7470', marginBottom:20 }}>Paiement sécurisé</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
                {['10','25','50','100','200'].map(v=>(
                  <button key={v} onClick={()=>setAmount(v)} style={{ padding:'10px 4px', borderRadius:9, border:`1.5px solid ${amount===v?'#1BB0CE':'rgba(0,0,0,.1)'}`, background:amount===v?'#E6F7FA':'white', color:amount===v?'#1BB0CE':'#1A1514', fontSize:14, fontWeight:amount===v?700:400, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                    {v} €
                  </button>
                ))}
                <button onClick={()=>setAmount('custom')} style={{ padding:'10px 4px', borderRadius:9, border:`1.5px solid ${amount==='custom'?'#1BB0CE':'rgba(0,0,0,.1)'}`, background:amount==='custom'?'#E6F7FA':'white', color:amount==='custom'?'#1BB0CE':'#7A7470', fontSize:13, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
                  Autre
                </button>
              </div>
              {amount==='custom' && (
                <div style={{ display:'flex', alignItems:'center', marginBottom:14, border:'1.5px solid #1BB0CE', borderRadius:9, overflow:'hidden' }}>
                  <input type="number" min="1" placeholder="Montant" value={custom} onChange={e=>setCustom(e.target.value)} style={{ flex:1, padding:'10px 14px', border:'none', fontSize:14, fontFamily:"'DM Sans',sans-serif", outline:'none' }} />
                  <div style={{ padding:'0 14px', fontSize:14, color:'#7A7470', background:'#F8FCFD' }}>€</div>
                </div>
              )}
              <button onClick={handleDon} disabled={!amount} style={{ width:'100%', padding:13, background: !amount?'#B5E8F5':'#1BB0CE', color:'white', border:'none', borderRadius:10, fontSize:15, fontWeight:700, cursor: !amount?'not-allowed':'pointer', fontFamily:"'DM Sans',sans-serif", boxShadow:'0 3px 12px rgba(27,176,206,.3)', transition:'all .15s' }}>
                💝 Faire un don {amount&&amount!=='custom'?`de ${amount} €`:amount==='custom'&&custom?`de ${custom} €`:''}
              </button>
              <div style={{ fontSize:11.5, color:'#7A7470', textAlign:'center', marginTop:10 }}>
                Ou via PayPal · IBAN direct accepté
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Projet ambulance */}
      <section className="ns-section">
        <div className="ns-inner">
          <div style={{ background:'linear-gradient(135deg,#0A1E2D,#0E4A5A)', borderRadius:20, padding:'2.5rem', display:'grid', gridTemplateColumns:'1fr auto', gap:40, alignItems:'center' }}>
            <div>
              <div style={{ display:'inline-flex', background:'rgba(27,176,206,.2)', border:'1px solid rgba(27,176,206,.3)', borderRadius:99, padding:'4px 12px', fontSize:11, fontWeight:500, color:'#7DE4F5', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:14 }}>Partenariat RSE</div>
              <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'clamp(1.5rem,2.5vw,2rem)', fontWeight:500, color:'white', lineHeight:1.3, marginBottom:12 }}>
                Soutenez l'acquisition de notre ambulance
              </h2>
              <p style={{ fontSize:14, color:'rgba(255,255,255,.75)', lineHeight:1.8, marginBottom:20 }}>
                L'acquisition d'une ambulance marque un tournant décisif dans notre mission. En devenant partenaire financier, vous associez votre image à une action humaniste et concrétisez vos engagements RSE.
              </p>
              <a href="https://www.heartsangels.be/shared-files/12728/?Dossier-de-Partenariat-Strategique.pdf" target="_blank" rel="noopener"
                style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'11px 22px', background:'#1BB0CE', color:'white', borderRadius:9, textDecoration:'none', fontSize:14, fontWeight:600 }}>
                📄 Télécharger le dossier de partenariat
              </a>
            </div>
            <div style={{ textAlign:'center', background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)', borderRadius:16, padding:'2rem', minWidth:160 }}>
              <div style={{ fontSize:'5rem', marginBottom:8 }}>🚑</div>
              <div style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.1rem', color:'white', fontWeight:500 }}>Notre ambulance</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

const CSS = `
.ns-hero{background:linear-gradient(135deg,#0A1E2D,#0E4A5A);padding:80px 20px;position:relative;overflow:hidden;}
.ns-hero-bg{position:absolute;inset:0;background:url('https://www.heartsangels.be/wp-content/uploads/2026/04/DSC_0975-scaled.jpg') center/cover;opacity:.2;}
.ns-hero-bg::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(10,30,45,.88),rgba(14,74,90,.7));}
.ns-hero-inner{position:relative;z-index:1;max-width:1280px;margin:0 auto;}
.ns-tag{display:inline-flex;background:rgba(27,176,206,.25);border:1px solid rgba(27,176,206,.4);border-radius:99px;padding:5px 14px;font-size:11.5px;font-weight:500;color:#7DE4F5;letter-spacing:.04em;text-transform:uppercase;margin-bottom:18px;}
.ns-tag-blue{display:inline-flex;background:#E6F7FA;color:#1BB0CE;border-radius:99px;padding:4px 12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:12px;}
.ns-h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(2.4rem,5vw,3.8rem);font-weight:500;color:white;line-height:1.15;margin-bottom:14px;}
.ns-h1 em{font-style:italic;color:#7DE4F5;}
.ns-p-hero{font-size:15px;color:rgba(255,255,255,.75);max-width:580px;line-height:1.75;}
.ns-h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(1.7rem,3vw,2.4rem);font-weight:500;line-height:1.2;color:#1A1514;margin-bottom:14px;}
.ns-h2 em{font-style:italic;color:#1BB0CE;}
.ns-section{padding:72px 20px;background:#FDFAF6;}
.ns-alt{background:#F0F9FB;}
.ns-inner{max-width:1280px;margin:0 auto;}
.ns-card{display:flex;flex-direction:column;border-radius:16px;padding:24px;text-decoration:none;transition:transform .15s,box-shadow .15s;}
.ns-card:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(27,176,206,.12);}
@media(max-width:900px){.ns-section{padding:48px 14px;}[style*='grid-template-columns: repeat(3,1fr)']{grid-template-columns:1fr !important;}[style*='grid-template-columns: 1fr 1fr']{grid-template-columns:1fr !important;}[style*='grid-template-columns: 1fr auto']{grid-template-columns:1fr !important;}}
`