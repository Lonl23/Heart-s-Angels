import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useI18n } from '../i18n/index.jsx'
import { notifFormulaire } from '@/lib/notifications'
import { supabase as _sb } from '@/lib/supabase'
import { communicationStructuree, baseDepuisInscription, hashCourt } from '@/lib/paiement'

export default function InscriptionEvenement() {
  const { slug } = useParams()
  const { raw } = useI18n()
  const lang = raw?.lang || 'fr'

  const [event, setEvent]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [quantites, setQuantites] = useState({})   // { tarifId: nombre }
  const [contact, setContact]   = useState({ prenom:'', nom:'', email:'', tel:'' })
  const [noms, setNoms]         = useState([])      // [{ prenom, nom, medical, perso:{} }] par place
  const [globaux, setGlobaux]   = useState({})      // réponses aux champs perso globaux
  const [mode, setMode]         = useState('virement')
  const [sending, setSending]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [comm, setComm]         = useState('')
  const [error, setError]       = useState('')
  const setC = (k,v) => setContact(c=>({...c,[k]:v}))

  useEffect(() => {
    // Lecture 100% base. On cherche par slug ; si le paramètre est un UUID, on cherche aussi par id.
    const estUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug)

    async function charger() {
      let ev = null
      // 1) par slug
      const r1 = await supabase.from('evenements_publics').select('*').eq('slug', slug).eq('publie', true).limit(1)
      ev = r1.data?.[0] || null
      // 2) sinon par id (uniquement si UUID valide)
      if (!ev && estUUID) {
        const r2 = await supabase.from('evenements_publics').select('*').eq('id', slug).eq('publie', true).limit(1)
        ev = r2.data?.[0] || null
      }
      if (ev) {
        const tarifs = (ev.tarifs && ev.tarifs.length) ? ev.tarifs
          : (ev.gratuit ? [{ id: 'gratuit', label: 'Gratuit', prix: 0 }] : [])
        setEvent({ ...ev, tarifs })
        if (ev.paiement_virement === false && ev.paiement_payconiq) setMode('payconiq')
      }
      setLoading(false)
    }
    charger()
  }, [slug])

  // ── Participants ──────────────────────────────────────────────────────────
  // Incrémenter / décrémenter la quantité d'un tarif
  // Incrémenter / décrémenter par INDEX du tarif (évite les collisions d'id)
  function inc(idx) {
    setQuantites(q => ({ ...q, [idx]: (q[idx] || 0) + 1 }))
  }
  function dec(idx) {
    setQuantites(q => ({ ...q, [idx]: Math.max(0, (q[idx] || 0) - 1) }))
  }

  const totalPlaces = Object.values(quantites).reduce((s, n) => s + (n || 0), 0)
  const total = (event?.tarifs || []).reduce((sum, t, idx) => sum + (quantites[idx] || 0) * (t.prix || 0), 0)

  // Synchroniser la liste des participants avec le nombre de places
  useEffect(() => {
    setNoms(prev => {
      const arr = [...prev]
      while (arr.length < totalPlaces) arr.push({ prenom: '', nom: '', medical: '', perso: {} })
      return arr.slice(0, totalPlaces)
    })
  }, [totalPlaces])

  function setNom(i, k, v) {
    setNoms(prev => prev.map((n, idx) => idx === i ? { ...n, [k]: v } : n))
  }
  function setNomPerso(i, champId, v) {
    setNoms(prev => prev.map((n, idx) => idx === i ? { ...n, perso: { ...(n.perso||{}), [champId]: v } } : n))
  }

  // Champs personnalisés par portée
  const champsParticipant = (event?.champs_perso || []).filter(c => c.portee === 'participant')
  const champsGlobaux     = (event?.champs_perso || []).filter(c => c.portee === 'global')

  // ── Validation ────────────────────────────────────────────────────────────
  function validate() {
    if (totalPlaces === 0) return false
    if (!contact.prenom.trim() || !contact.nom.trim() || !contact.email.trim()) return false
    if (totalPlaces > 1 && noms.some((n, i) => i > 0 && (!n.prenom.trim() || !n.nom.trim()))) return false
    // Champs perso participant obligatoires
    for (const ch of champsParticipant.filter(c => c.requis)) {
      if (noms.some(n => !n.perso?.[ch.id])) return false
    }
    // Champs perso globaux obligatoires
    for (const ch of champsGlobaux.filter(c => c.requis)) {
      if (!globaux[ch.id]) return false
    }
    return true
  }

  // Construit la liste des participants pour l'enregistrement
  function construireParticipants() {
    const liste = []
    ;(event?.tarifs || []).forEach((t, idx) => {
      const n = quantites[idx] || 0
      for (let k = 0; k < n; k++) liste.push({ tarif: t.id, tarif_label: t.label, prix: t.prix })
    })
    liste.forEach((p, i) => {
      const info = noms[i] || {}
      const estContact = (i === 0)  // le participant 1 est toujours la personne de contact
      liste[i] = {
        ...p,
        prenom: estContact ? contact.prenom : (info.prenom || ''),
        nom:    estContact ? contact.nom    : (info.nom || ''),
        medical: info.medical || '',
        champs: info.perso || {},
      }
    })
    return liste
  }

  // ── Soumission ────────────────────────────────────────────────────────────
  async function handleSubmit() {
    setError('')
    if (!validate()) { setError('Veuillez remplir tous les champs obligatoires (*).'); return }
    if (total > 0 && !mode) { setError('Choisissez un mode de paiement.'); return }
    setSending(true)
    const participants = construireParticipants()
    // Communication structurée (virement) générée si payant
    let communication = ''
    if (total > 0 && mode === 'virement') {
      const base = baseDepuisInscription(hashCourt(event.id), Date.now() % 1000000)
      communication = communicationStructuree(base)
      setComm(communication)
    }
    try {
      await supabase.from('inscriptions_evenements').insert({
        evenement_id:    event.id,
        evenement_titre: event.titre_fr,
        participants,
        contact,
        montant_total:   total,
        mode_paiement:   total === 0 ? 'gratuit' : mode,
        statut:          total === 0 ? 'confirme' : mode === 'virement' ? 'en_attente_paiement' : 'en_attente_payconiq',
        statut_paiement: total === 0 ? 'paye' : 'en_attente',
        communication_structuree: communication || null,
        champs_globaux:  globaux,
        email_contact:   contact.email,
        langue:          lang,
      })
    } catch (e) {
      console.warn('DB insert error (table manquante?):', e)
    }
    {
      const { data:_cfg } = await _sb.from('formulaires_config').select('titre,destinataires').eq('cle','evenement').maybeSingle()
      notifFormulaire('evenement', _cfg?.titre || 'Inscription événement', _cfg?.destinataires || ['coord_benevoles'], `${participants[0]?.prenom||''} ${participants[0]?.nom||''} (${participants.length} pers.)`.trim())
    }
    setSent(true)
    setSending(false)
  }

  // ── Écrans ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:40, height:40, border:'3px solid #E6F7FA', borderTopColor:'#1BB0CE', borderRadius:'50%', animation:'spin .8s linear infinite', margin:'0 auto 14px' }}/>
        <div style={{ color:'#7A7470', fontSize:14 }}>Chargement de l'événement…</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  if (!event) return (
    <div style={{ minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ textAlign:'center', padding:40 }}>
        <div style={{ fontSize:'3rem', marginBottom:14 }}>😕</div>
        <p style={{ color:'#7A7470', marginBottom:20, fontSize:15 }}>Événement introuvable.</p>
        <Link to="/evenements" style={{ color:'#1BB0CE', fontWeight:600, textDecoration:'none' }}>← Retour aux événements</Link>
      </div>
    </div>
  )

  const titre   = event[`titre_${lang}`] || event.titre_fr
  const dateStr = new Date(event.date_debut).toLocaleDateString('fr-BE', { weekday:'long', day:'numeric', month:'long', year:'numeric' })

  if (sent) return <Confirmation event={event} titre={titre} dateStr={dateStr} participants={construireParticipants()} total={total} mode={mode} lang={lang} comm={comm} />

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS}</style>

      {/* Hero */}
      <section className="ie-hero">
        {event.image_url && <div className="ie-hero-bg" style={{ backgroundImage:`url(${event.image_url})` }}/>}
        <div className="ie-hero-overlay"/>
        <div className="ie-hero-inner">
          <Link to="/evenements" className="ie-back">← Retour aux événements</Link>
          <div className="ie-tag">📝 Inscription</div>
          <h1 className="ie-h1">{titre}</h1>
          <div className="ie-meta">
            <span>📅 {dateStr}</span>
            {event.heure && <span>🕐 {event.heure}</span>}
            {event.lieu  && <span>📍 {event.lieu.split(',')[0]}</span>}
          </div>
        </div>
      </section>

      <section style={{ padding:'52px 20px 80px', background:'#FDFAF6' }}>
        <div className="ie-layout">

          {/* ── FORMULAIRE ── */}
          <div>
            <h2 className="ie-form-title">Votre inscription</h2>

            {/* Choix des formules avec compteurs */}
            <div style={{ marginBottom:22 }}>
              <div className="ie-section-title">Formules</div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {event.tarifs.map((t, idx) => {
                  const n = quantites[idx] || 0
                  return (
                    <div key={idx} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'12px 14px', background:'white', border:`1px solid ${n>0?'#1BB0CE':'rgba(27,176,206,.15)'}`, borderRadius:12 }}>
                      <div>
                        <div style={{ fontSize:14, fontWeight:600, color:'#1A1514' }}>{t.label}</div>
                        <div style={{ fontSize:13, color:'#1BB0CE', fontWeight:500 }}>{t.prix === 0 ? 'Gratuit' : `${t.prix} €`}</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <button type="button" onClick={()=>dec(idx)} disabled={n===0}
                          style={{ width:32, height:32, borderRadius:8, border:'1px solid rgba(27,176,206,.3)', background:'white', color:'#1BB0CE', fontSize:18, fontWeight:700, cursor:n===0?'not-allowed':'pointer', opacity:n===0?.4:1 }}>−</button>
                        <span style={{ minWidth:24, textAlign:'center', fontSize:15, fontWeight:700, color:'#1A1514' }}>{n}</span>
                        <button type="button" onClick={()=>inc(idx)}
                          style={{ width:32, height:32, borderRadius:8, border:'none', background:'#1BB0CE', color:'white', fontSize:18, fontWeight:700, cursor:'pointer' }}>+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              {totalPlaces > 0 && (
                <div style={{ marginTop:10, fontSize:13, color:'#7A7470' }}>
                  {totalPlaces} inscription{totalPlaces>1?'s':''} au total
                </div>
              )}
            </div>

            {/* Coordonnées du contact principal */}
            <div style={{ marginBottom:22 }}>
              <div className="ie-section-title">{totalPlaces > 1 ? 'Personne de contact' : 'Vos coordonnées'}</div>
              <div className="ie-row-2">
                <F label="Prénom *" val={contact.prenom} set={v=>setC('prenom',v)} />
                <F label="Nom *"    val={contact.nom}    set={v=>setC('nom',v)} />
              </div>
              <F label="Email * (confirmation envoyée ici)" val={contact.email} set={v=>setC('email',v)} type="email" style={{ marginTop:10 }} />
              <F label="Téléphone" val={contact.tel} set={v=>setC('tel',v)} type="tel" style={{ marginTop:10 }} />
            </div>

            {/* Participants : nom (si plusieurs), médical, champs perso participant */}
            {totalPlaces > 0 && (
              <div style={{ marginBottom:22 }}>
                <div className="ie-section-title">{totalPlaces > 1 ? 'Détail des participants' : 'Informations participant'}</div>
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  {noms.map((nm, i) => (
                    <div key={i} style={{ background:'white', border:'1px solid rgba(27,176,206,.15)', borderRadius:12, padding:'14px 16px' }}>
                      {totalPlaces > 1 && i === 0 && (
                        <div style={{ fontSize:12.5, fontWeight:600, color:'#1BB0CE', marginBottom:8 }}>
                          Participant 1 — vous ({contact.prenom || '…'} {contact.nom || ''})
                        </div>
                      )}
                      {totalPlaces > 1 && i > 0 && (
                        <>
                          <div style={{ fontSize:12.5, fontWeight:600, color:'#1BB0CE', marginBottom:8 }}>Participant {i+1}</div>
                          <div className="ie-row-2">
                            <F label="Prénom *" val={nm.prenom} set={v=>setNom(i,'prenom',v)} />
                            <F label="Nom *"    val={nm.nom}    set={v=>setNom(i,'nom',v)} />
                          </div>
                        </>
                      )}
                      {/* Champs perso par participant */}
                      {champsParticipant.map(ch => (
                        <div key={ch.id} style={{ marginTop:10 }}>
                          <ChampPerso ch={ch} val={nm.perso?.[ch.id]||''} set={v=>setNomPerso(i,ch.id,v)} />
                        </div>
                      ))}
                      {/* Médical par participant */}
                      <div style={{ marginTop:10 }}>
                        <label style={{ fontSize:12.5, fontWeight:500, color:'#7A5512', display:'block', marginBottom:5 }}>⚕️ Pathologies / infos médicales (confidentiel — équipes de secours)</label>
                        <textarea value={nm.medical||''} onChange={e=>setNom(i,'medical',e.target.value)} rows={2}
                          placeholder="Diabète, allergie sévère, mobilité réduite… (vide si rien)"
                          style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(186,117,23,.3)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", resize:'vertical', background:'#FFFBF2' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Champs personnalisés globaux */}
            {champsGlobaux.length > 0 && (
              <div style={{ marginBottom:22 }}>
                <div className="ie-section-title">Informations complémentaires</div>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {champsGlobaux.map(ch => (
                    <ChampPerso key={ch.id} ch={ch} val={globaux[ch.id]||''} set={v=>setGlobaux(g=>({...g,[ch.id]:v}))} />
                  ))}
                </div>
              </div>
            )}

            {/* Mode paiement */}
            {total > 0 && (
              <div style={{ marginBottom:22 }}>
                <div className="ie-section-title">Mode de paiement</div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {(event.paiement_virement !== false) && (
                    <PayOption val="virement" sel={mode} set={setMode}
                      icon="🏦" title="Virement bancaire"
                      desc="Communication structurée générée automatiquement après validation" />
                  )}
                  {event.paiement_payconiq && (
                    <PayOption val="payconiq" sel={mode} set={setMode}
                      icon="📱" title="Payconiq"
                      desc="Paiement mobile rapide" />
                  )}
                </div>
              </div>
            )}

            {event.note && (
              <div className="ie-note">✓ {event.note}</div>
            )}

            {error && <div className="ie-error">{error}</div>}

            <button onClick={handleSubmit} disabled={sending} className={`ie-submit-btn ${sending ? 'disabled' : ''}`}>
              {sending
                ? '⏳ Enregistrement…'
                : total === 0
                  ? '✓ Confirmer mon inscription (gratuit)'
                  : `✓ S'inscrire — ${total.toFixed(2)} €`
              }
            </button>
          </div>

          {/* ── RÉCAP ÉVÉNEMENT ── */}
          <div>
            <div className="ie-recap">
              {event.image_url && <img src={event.image_url} alt={titre} className="ie-recap-img" loading="lazy" />}
              <div className="ie-recap-body">
                <h3 className="ie-recap-title">{titre}</h3>
                <div className="ie-recap-infos">
                  <div>📅 {dateStr}</div>
                  {event.heure && <div>🕐 {event.heure}</div>}
                  {event.lieu  && <div>📍 {event.lieu}</div>}
                </div>

                {event.note && <div className="ie-note" style={{ margin:'14px 0 0' }}>✓ {event.note}</div>}

                {/* Tarifs dispo */}
                <div className="ie-recap-tarifs">
                  <div className="ie-section-title" style={{ marginBottom:8 }}>Formules disponibles</div>
                  {event.tarifs.map(t => (
                    <div key={t.id} style={{ display:'flex', justifyContent:'space-between', fontSize:13.5, color:'#1A1514', marginBottom:5, padding:'4px 0', borderBottom:'1px solid rgba(27,176,206,.06)' }}>
                      <span>{t.label}</span>
                      <strong style={{ color: t.prix === 0 ? '#3B6D11' : '#1BB0CE' }}>
                        {t.prix === 0 ? 'Gratuit' : `${t.prix} €`}
                      </strong>
                    </div>
                  ))}
                </div>

                {/* Total */}
                {totalPlaces > 0 && (
                  <div style={{ borderTop:'2px solid rgba(27,176,206,.12)', paddingTop:12, marginTop:8 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:13, color:'#7A7470' }}>
                        Total ({totalPlaces} place{totalPlaces>1?'s':''})
                      </span>
                      <span style={{ fontSize:18, fontWeight:700, color: total === 0 ? '#3B6D11' : '#1BB0CE' }}>
                        {total === 0 ? 'Gratuit' : `${total.toFixed(2)} €`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </section>
    </div>
  )
}

// ── Composants helpers ────────────────────────────────────────────────────────

function ChampPerso({ ch, val, set }) {
  const label = ch.label + (ch.requis ? ' *' : '')
  if (ch.type === 'textarea') {
    return (
      <div>
        <label style={{ fontSize:12.5, fontWeight:500, color:'#7A7470', display:'block', marginBottom:4 }}>{label}</label>
        <textarea value={val} onChange={e=>set(e.target.value)} rows={3}
          style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", resize:'vertical' }} />
      </div>
    )
  }
  return <F label={label} val={val} set={set} type={ch.type === 'number' ? 'number' : ch.type === 'date' ? 'date' : ch.type === 'tel' ? 'tel' : 'text'} />
}

function F({ label, val, set, type='text', style }) {
  return (
    <div style={style}>
      <label style={{ fontSize:12.5, fontWeight:500, color:'#7A7470', display:'block', marginBottom:4 }}>{label}</label>
      <input type={type} value={val} onChange={e=>set(e.target.value)}
        style={{ width:'100%', padding:'9px 12px', border:'1px solid rgba(0,0,0,.1)', borderRadius:8, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", outline:'none', transition:'border-color .12s' }}
        onFocus={e=>e.target.style.borderColor='#1BB0CE'}
        onBlur={e=>e.target.style.borderColor='rgba(0,0,0,.1)'} />
    </div>
  )
}

function PayOption({ val, sel, set, icon, title, desc, disabled, note }) {
  return (
    <label style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'14px 16px', borderRadius:11, border:`1.5px solid ${sel===val?'#1BB0CE':'rgba(0,0,0,.1)'}`, background:sel===val?'#E6F7FA':'white', cursor:disabled?'not-allowed':'pointer', opacity:disabled?.6:1, transition:'all .12s' }}>
      <input type="radio" value={val} checked={sel===val} onChange={()=>!disabled&&set(val)} disabled={disabled} style={{ marginTop:3, accentColor:'#1BB0CE' }}/>
      <div>
        <div style={{ fontSize:14, fontWeight:600, color:sel===val?'#1BB0CE':'#1A1514' }}>{icon} {title}</div>
        <div style={{ fontSize:12.5, color:'#7A7470', marginTop:2 }}>{desc}</div>
        {note && <div style={{ fontSize:12, color:'#BA7517', marginTop:4, background:'#FDF6E3', padding:'3px 8px', borderRadius:6, display:'inline-block' }}>⚠️ {note}</div>}
      </div>
    </label>
  )
}

function Confirmation({ event, titre, dateStr, participants, total, mode, lang, comm }) {
  const iban = event.iban || 'BE45 0689 3611 4489'
  return (
    <div style={{ minHeight:'70vh', display:'flex', alignItems:'center', justifyContent:'center', padding:40, background:'#FDFAF6', fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ maxWidth:560, width:'100%' }}>
        <div style={{ background:'white', border:'1px solid rgba(27,176,206,.15)', borderRadius:20, padding:'2.5rem', boxShadow:'0 4px 24px rgba(27,176,206,.08)' }}>
          <div style={{ textAlign:'center', marginBottom:24 }}>
            <div style={{ fontSize:'4rem', marginBottom:12 }}>{total === 0 ? '🎉' : '📩'}</div>
            <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.8rem', fontWeight:500, color:'#1A1514', marginBottom:8 }}>
              {total === 0 ? 'Inscription confirmée !' : 'Inscription reçue !'}
            </h2>
            <p style={{ fontSize:14.5, color:'#4A4340', lineHeight:1.75 }}>
              {total === 0
                ? `Votre inscription à "${titre}" est confirmée. À bientôt le ${dateStr} !`
                : `Votre inscription à "${titre}" a bien été enregistrée.`}
            </p>
          </div>

          {total > 0 && mode === 'virement' && (
            <div style={{ background:'#E6F7FA', border:'1px solid rgba(27,176,206,.2)', borderRadius:12, padding:'18px 20px', marginBottom:22 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#0E4A5A', marginBottom:10 }}>🏦 Virement à effectuer</div>
              <div style={{ fontSize:13.5, color:'#0E4A5A', lineHeight:2 }}>
                Bénéficiaire : <strong>Heart's Angels ASBL</strong><br/>
                IBAN : <strong>{iban}</strong><br/>
                BIC : <strong>GKCCBEBB</strong><br/>
                Montant : <strong style={{ fontSize:17, color:'#1BB0CE' }}>{total.toFixed(2)} €</strong><br/>
                Communication structurée :{' '}
                <strong style={{ fontSize:16, color:'#0E7A93', letterSpacing:'.02em' }}>{comm || `${titre} — ${participants[0].nom}`}</strong>
              </div>
              {comm && <div style={{ marginTop:10, fontSize:12, color:'#0E4A5A', background:'white', borderRadius:8, padding:'8px 11px' }}>
                ⚠️ Indiquez bien la <strong>communication structurée</strong> exacte : elle permet de rattacher automatiquement votre paiement à votre inscription.
              </div>}
            </div>
          )}

          {total > 0 && mode === 'payconiq' && (
            <div style={{ background:'#FDF0F8', border:'1px solid rgba(200,67,150,.2)', borderRadius:12, padding:'18px 20px', marginBottom:22 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#A8266F', marginBottom:10 }}>📱 Paiement Payconiq</div>
              <div style={{ fontSize:13.5, color:'#7A2456', lineHeight:1.9 }}>
                Montant : <strong style={{ fontSize:17 }}>{total.toFixed(2)} €</strong><br/>
                {event.payconiq_lien
                  ? <>Payez via ce lien : <a href={event.payconiq_lien} target="_blank" rel="noreferrer" style={{ color:'#A8266F', fontWeight:600 }}>Ouvrir Payconiq</a></>
                  : <>Vous recevrez les instructions Payconiq par e-mail.</>}
                <br/>Référence : <strong>{comm || titre}</strong>
              </div>
            </div>
          )}

          {/* Récap participants */}
          <div style={{ marginBottom:22 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'#7A7470', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:8 }}>
              {participants.length} participant{participants.length > 1 ? 's' : ''}
            </div>
            {participants.map((p, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13.5, padding:'6px 0', borderBottom:'1px solid rgba(27,176,206,.07)', color:'#1A1514' }}>
                <span>{p.prenom} {p.nom}</span>
                <span style={{ color:'#1BB0CE', fontWeight:500 }}>{event.tarifs.find(t=>t.id===p.tarif)?.label}</span>
              </div>
            ))}
          </div>

          <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
            <Link to="/evenements" style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'10px 20px', background:'#1BB0CE', color:'white', borderRadius:9, textDecoration:'none', fontSize:13.5, fontWeight:600 }}>
              ← Autres événements
            </Link>
            <Link to="/" style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'10px 18px', background:'#F0F9FB', color:'#1BB0CE', borderRadius:9, textDecoration:'none', fontSize:13.5 }}>
              Accueil
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
.ie-hero{background:linear-gradient(135deg,#0A1E2D,#0E4A5A);padding:60px 20px;position:relative;overflow:hidden;}
.ie-hero-bg{position:absolute;inset:0;background-size:cover;background-position:center;}
.ie-hero-overlay{position:absolute;inset:0;background:linear-gradient(135deg,rgba(10,30,45,.88),rgba(14,74,90,.7));}
.ie-hero-inner{position:relative;z-index:1;max-width:1280px;margin:0 auto;}
.ie-back{display:inline-flex;align-items:center;gap:6px;color:rgba(255,255,255,.6);text-decoration:none;font-size:13px;margin-bottom:16px;}
.ie-tag{display:inline-flex;background:rgba(27,176,206,.25);border:1px solid rgba(27,176,206,.4);border-radius:99px;padding:4px 12px;font-size:11px;font-weight:500;color:#7DE4F5;letter-spacing:.04em;text-transform:uppercase;margin-bottom:12px;}
.ie-h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(1.8rem,4vw,3rem);font-weight:500;color:white;line-height:1.2;margin-bottom:10px;}
.ie-meta{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:rgba(255,255,255,.7);}
/* Layout */
.ie-layout{max-width:1000px;margin:0 auto;display:grid;grid-template-columns:1.5fr 1fr;gap:40px;align-items:start;}
/* Formulaire */
.ie-form-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.5rem;font-weight:500;color:#1A1514;margin-bottom:18px;}
.ie-participant{background:white;border:1px solid rgba(27,176,206,.12);border-radius:14px;padding:20px;margin-bottom:14px;box-shadow:0 1px 6px rgba(27,176,206,.05);}
.ie-participant-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.ie-remove-btn{background:none;border:none;cursor:pointer;color:#C8435A;font-size:13px;font-family:'DM Sans',sans-serif;}
.ie-row-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.ie-label{font-size:12.5px;font-weight:500;color:#7A7470;display:block;margin-bottom:6px;}
/* Tarifs */
.ie-tarifs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;}
.ie-tarif-card{border:1.5px solid rgba(27,176,206,.15);border-radius:10px;padding:12px;cursor:pointer;position:relative;transition:all .12s;background:white;text-align:center;}
.ie-tarif-card:hover{border-color:#1BB0CE;background:#F0F9FB;}
.ie-tarif-card.selected{border-color:#1BB0CE;background:#E6F7FA;}
.ie-tarif-label{font-size:13px;font-weight:500;color:#1A1514;margin-bottom:5px;line-height:1.3;}
.ie-tarif-prix{font-size:16px;font-weight:700;color:#1BB0CE;}
.ie-tarif-card.selected .ie-tarif-label{color:#0E4A5A;font-weight:600;}
.ie-tarif-check{position:absolute;top:7px;right:9px;color:#1BB0CE;font-size:14px;font-weight:700;}
/* Boutons */
.ie-add-btn{display:flex;align-items:center;justify-content:center;gap:7px;width:100%;padding:11px;background:#F0F9FB;border:1.5px dashed rgba(27,176,206,.35);border-radius:10px;cursor:pointer;font-size:13.5px;color:#1BB0CE;font-family:'DM Sans',sans-serif;margin-bottom:22px;transition:all .12s;}
.ie-add-btn:hover{background:#E6F7FA;border-color:#1BB0CE;}
.ie-section-title{font-size:13px;font-weight:600;color:#1A1514;letter-spacing:.02em;margin-bottom:10px;}
.ie-note{background:#EAF3DE;border:1px solid rgba(59,109,17,.15);border-radius:9px;padding:10px 14px;font-size:13px;color:#3B6D11;margin-bottom:16px;}
.ie-error{background:#FEF2F2;border:1px solid #FCD5D5;border-radius:8px;padding:9px 12px;font-size:13px;color:#991B1B;margin-bottom:14px;}
.ie-submit-btn{width:100%;padding:14px;background:#1BB0CE;color:white;border:none;border-radius:11px;font-size:15px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;box-shadow:0 3px 14px rgba(27,176,206,.3);transition:all .15s;}
.ie-submit-btn:hover:not(.disabled){background:#0E7A93;transform:translateY(-1px);}
.ie-submit-btn.disabled{background:rgba(27,176,206,.4);cursor:not-allowed;}
/* Récap */
.ie-recap{background:white;border:1px solid rgba(27,176,206,.12);border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(27,176,206,.06);position:sticky;top:90px;}
.ie-recap-img{width:100%;height:160px;object-fit:cover;display:block;}
.ie-recap-body{padding:18px;}
.ie-recap-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.2rem;font-weight:500;color:#1A1514;margin-bottom:10px;line-height:1.3;}
.ie-recap-infos{font-size:13px;color:#7A7470;display:flex;flex-direction:column;gap:5px;margin-bottom:14px;}
.ie-recap-tarifs{margin-top:14px;padding-top:14px;border-top:1px solid rgba(27,176,206,.08);}
/* Responsive */
@media(max-width:800px){.ie-layout{grid-template-columns:1fr !important;} .ie-recap{position:static;} }
@media(max-width:500px){.ie-row-2{grid-template-columns:1fr;} .ie-tarifs-grid{grid-template-columns:1fr 1fr;}}
`