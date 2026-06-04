import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.jsx'
import { supabase } from '@/lib/supabase'
import { SepAuto } from '../components/Decor.jsx'

export default function Contact() {
  const { raw } = useI18n()
  const c = raw?.contact || {}
  const [form, setForm] = useState({ nom:'', email:'', telephone:'', sujet:'', message:'' })
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nom || !form.email || !form.message) { setError('Veuillez remplir tous les champs obligatoires.'); return }
    setSending(true); setError('')
    const { error:err } = await supabase.from('contacts').insert(form)
    if (err) { setError('Erreur lors de l\'envoi. Veuillez réessayer.'); setSending(false); return }
    setSent(true); setSending(false)
  }

  const infos = [
    { icon:'📍', label:'Adresse', val:'Rue des Awirs 249, 4400 Flémalle', href:null },
    { icon:'✉️', label:'Email', val:'info@heartsangels.be', href:'mailto:info@heartsangels.be' },
    { icon:'📞', label:'Téléphone', val:'+32 493 19 14 78', href:'tel:+32493191478' },
    { icon:'🕐', label:'Disponibilité', val:'Lun–Ven 9h–17h (bénévoles)', href:null },
    { icon:'🏦', label:'IBAN', val:'BE45 0689 3611 4489', href:null },
    { icon:'📋', label:'BCE', val:'0537.416.028', href:null },
  ]

  const sujets = ['Demande d\'information', 'Partenariat', 'Don', 'Bénévolat', 'Presse', 'Autre']

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      {/* Hero */}
      <section className="ct-hero">
        <div className="ct-hero-inner">
          <div className="ct-tag">📞 Contact</div>
          <h1 className="ct-h1">Contactez <em>Heart's Angels</em></h1>
          <p className="ct-p-hero">Une question, un projet, une demande de souhait ? Nous vous répondrons dans les plus brefs délais.</p>
        </div>
      </section>

      {/* vague hero → contenu */}
      <SepAuto haut="#0E4A5A" bas="#FDFAF6" />

      {/* Contenu */}
      <section className="ct-section">
        <div className="ct-inner">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1.5fr', gap:56, alignItems:'start' }}>
            {/* Infos */}
            <div>
              <h2 className="ct-h2">Nos coordonnées</h2>
              <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:28 }}>
                {infos.map((info,i)=>(
                  <div key={i} style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
                    <div style={{ width:44, height:44, borderRadius:11, background:'#E6F7FA', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>{info.icon}</div>
                    <div>
                      <div style={{ fontSize:11.5, fontWeight:600, color:'#7A7470', textTransform:'uppercase', letterSpacing:'.04em', marginBottom:3 }}>{info.label}</div>
                      {info.href
                        ? <a href={info.href} style={{ fontSize:15, color:'#1BB0CE', fontWeight:500, textDecoration:'none' }}>{info.val}</a>
                        : <div style={{ fontSize:15, color:'#1A1514', fontWeight:500 }}>{info.val}</div>
                      }
                    </div>
                  </div>
                ))}
              </div>

              {/* Réseaux sociaux */}
              <div style={{ display:'flex', gap:10 }}>
                {[
                  { href:'https://www.facebook.com/heartsangels', label:'Facebook', color:'#1877F2', icon:'f' },
                  { href:'https://www.instagram.com/heartsangels/', label:'Instagram', color:'#E1306C', icon:'📸' },
                ].map((s,i)=>(
                  <a key={i} href={s.href} target="_blank" rel="noopener"
                    style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'9px 16px', background:'white', border:'1px solid rgba(27,176,206,.15)', borderRadius:9, color:s.color, fontSize:13.5, fontWeight:600, textDecoration:'none', transition:'all .12s' }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=s.color}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(27,176,206,.15)'}}>
                    {s.icon} {s.label}
                  </a>
                ))}
              </div>

              {/* Note souhait */}
              <div style={{ marginTop:24, background:'#E6F7FA', border:'1px solid rgba(27,176,206,.2)', borderRadius:12, padding:'16px 18px', fontSize:13.5, color:'#0E4A5A', lineHeight:1.65 }}>
                <strong>❤️ Pour une demande de souhait</strong><br/>
                Veuillez utiliser notre{' '}
                <Link to="/demande-de-souhait" style={{ color:'#1BB0CE', fontWeight:600 }}>formulaire dédié</Link>
                {' '}pour que nous puissions traiter votre demande dans les meilleures conditions.
              </div>
            </div>

            {/* Formulaire */}
            <div style={{ background:'white', border:'1px solid rgba(27,176,206,.12)', borderRadius:18, padding:'2rem', boxShadow:'0 4px 24px rgba(27,176,206,.08)' }}>
              {sent ? (
                <div style={{ textAlign:'center', padding:'2rem 0' }}>
                  <div style={{ fontSize:'3rem', marginBottom:14 }}>✅</div>
                  <h3 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.5rem', color:'#1E5C1E', marginBottom:8 }}>Message envoyé !</h3>
                  <p style={{ fontSize:13.5, color:'#4A4340', lineHeight:1.7 }}>Nous vous répondrons dans les plus brefs délais.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <h3 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.4rem', fontWeight:500, color:'#1A1514', marginBottom:4 }}>Envoyer un message</h3>
                  <F label="Nom et prénom *" val={form.nom} set={v=>set('nom',v)} />
                  <F label="Email *" val={form.email} set={v=>set('email',v)} type="email" />
                  <F label="Téléphone" val={form.telephone} set={v=>set('telephone',v)} type="tel" />
                  <div>
                    <label style={{ fontSize:12.5, fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }}>Sujet</label>
                    <select value={form.sujet} onChange={e=>set('sujet',e.target.value)} style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif" }}>
                      <option value="">— Sélectionnez un sujet</option>
                      {sujets.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize:12.5, fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }}>Message *</label>
                    <textarea value={form.message} onChange={e=>set('message',e.target.value)} rows={5}
                      style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", resize:'vertical' }} />
                  </div>
                  {error && <div style={{ background:'#FEF2F2', border:'1px solid #FCD5D5', borderRadius:8, padding:'9px 12px', fontSize:13, color:'#991B1B' }}>{error}</div>}
                  <button type="submit" disabled={sending}
                    style={{ padding:13, background:sending?'rgba(27,176,206,.4)':'#1BB0CE', color:'white', border:'none', borderRadius:10, fontSize:14.5, fontWeight:600, cursor:sending?'wait':'pointer', fontFamily:"'DM Sans',sans-serif", boxShadow:'0 3px 14px rgba(27,176,206,.3)' }}>
                    {sending ? '⏳ Envoi…' : '📨 Envoyer le message'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function F({ label, val, set, type='text' }) {
  return (
    <div>
      <label style={{ fontSize:12.5, fontWeight:500, color:'#7A7470', display:'block', marginBottom:5 }}>{label}</label>
      <input type={type} value={val} onChange={e=>set(e.target.value)} style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", transition:'border-color .12s' }}
        onFocus={e=>e.target.style.borderColor='#1BB0CE'} onBlur={e=>e.target.style.borderColor='rgba(0,0,0,.1)'} />
    </div>
  )
}

const CSS = `
.ct-hero{background:linear-gradient(135deg,#0A1E2D,#0E4A5A);padding:72px 20px;position:relative;overflow:hidden;}
.ct-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse 60% 60% at 80% 50%,rgba(27,176,206,.15),transparent);pointer-events:none;}
.ct-hero-inner{position:relative;z-index:1;max-width:1280px;margin:0 auto;}
.ct-tag{display:inline-flex;background:rgba(27,176,206,.25);border:1px solid rgba(27,176,206,.4);border-radius:99px;padding:5px 14px;font-size:11.5px;font-weight:500;color:#7DE4F5;letter-spacing:.04em;text-transform:uppercase;margin-bottom:18px;}
.ct-h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(2.4rem,5vw,3.8rem);font-weight:500;color:white;line-height:1.15;margin-bottom:14px;}
.ct-h1 em{font-style:italic;color:#7DE4F5;}
.ct-p-hero{font-size:15px;color:rgba(255,255,255,.7);max-width:560px;line-height:1.75;}
.ct-section{padding:72px 20px;background:#FDFAF6;}
.ct-inner{max-width:1280px;margin:0 auto;}
.ct-h2{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(1.6rem,2.8vw,2.2rem);font-weight:500;color:#1A1514;margin-bottom:20px;}
@media(max-width:900px){.ct-section{padding:48px 14px;}[style*='grid-template-columns: 1fr 1.5fr']{grid-template-columns:1fr !important;gap:32px !important;}}
`