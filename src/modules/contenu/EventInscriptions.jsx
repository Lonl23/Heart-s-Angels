// src/modules/contenu/EventInscriptions.jsx
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function EventInscriptions({ event, onBack }) {
  const [inscriptions, setInscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [printMode, setPrintMode] = useState(false)

  useEffect(() => { load() }, [event?.id])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('inscriptions_evenements')
      .select('*').eq('evenement_id', event.id).order('created_at', { ascending: true })
    setInscriptions(data || [])
    setLoading(false)
  }

  // Met à jour le tableau participants d'une inscription
  async function majParticipants(insc, nouveauxParticipants) {
    await supabase.from('inscriptions_evenements').update({ participants: nouveauxParticipants }).eq('id', insc.id)
    setInscriptions(prev => prev.map(x => x.id === insc.id ? { ...x, participants: nouveauxParticipants } : x))
  }
  function togglePresence(insc, idx) {
    const arr = (insc.participants || []).map((p, i) => i === idx ? { ...p, present: !p.present } : p)
    majParticipants(insc, arr)
  }
  async function marquerPaye(insc, paye) {
    await supabase.from('inscriptions_evenements').update({
      statut_paiement: paye ? 'paye' : 'en_attente',
      paye_le: paye ? new Date().toISOString() : null,
    }).eq('id', insc.id)
    setInscriptions(prev => prev.map(x => x.id === insc.id ? { ...x, statut_paiement: paye ? 'paye' : 'en_attente', paye_le: paye ? new Date().toISOString() : null } : x))
  }

  // KPIs
  const tousParticipants = inscriptions.flatMap(i => i.participants || [])
  const totalInscrits = tousParticipants.length
  const totalPresents = tousParticipants.filter(p => p.present).length
  const totalEncaisse = inscriptions.filter(i => i.statut_paiement === 'paye').reduce((s, i) => s + (i.montant_total || 0), 0)
  const totalAttendu = inscriptions.reduce((s, i) => s + (i.montant_total || 0), 0)

  // Champs perso définis sur l'événement
  const champsParticipant = (event.champs_perso || []).filter(c => c.portee === 'participant')
  const champsGlobaux     = (event.champs_perso || []).filter(c => c.portee === 'global')

  if (printMode) return <FicheAmbulance event={event} inscriptions={inscriptions} champsParticipant={champsParticipant} onClose={() => setPrintMode(false)} />

  return (
    <div style={{ padding: '28px 24px', fontFamily: "'DM Sans',sans-serif", maxWidth: 1150 }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#1BB0CE', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', marginBottom: 14, padding: 0 }}>← Retour aux événements</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: '1.7rem', fontWeight: 500, color: '#1A1514' }}>Inscriptions — {event.titre_fr}</h1>
          <p style={{ fontSize: 13, color: '#7A7470' }}>{new Date(event.date_debut).toLocaleDateString('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <button onClick={() => setPrintMode(true)} style={{ padding: '9px 16px', background: '#C8435A', color: 'white', border: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
          🚑 Fiche médicale ambulance
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 22 }}>
        {[
          { label: 'Inscrits', val: totalInscrits, color: '#0E7A93', bg: '#E6F7FA' },
          { label: 'Présents', val: `${totalPresents}/${totalInscrits}`, color: '#3B6D11', bg: '#EAF3DE' },
          { label: 'Encaissé', val: totalEncaisse.toFixed(2) + ' €', color: '#3B6D11', bg: '#EAF3DE' },
          { label: 'Attendu (total)', val: totalAttendu.toFixed(2) + ' €', color: '#BA7517', bg: '#FAEEDA' },
        ].map((k, i) => (
          <div key={i} style={{ background: k.bg, borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: k.color }}>{k.val}</div>
            <div style={{ fontSize: 12, color: '#7A7470', marginTop: 3 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {loading ? <p style={{ color: '#7A7470' }}>Chargement…</p> : inscriptions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#7A7470' }}><div style={{ fontSize: '2rem', marginBottom: 10 }}>📭</div>Aucune inscription pour le moment.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {inscriptions.map(insc => (
            <div key={insc.id} style={{ background: 'white', border: '1px solid rgba(27,176,206,.12)', borderRadius: 14, padding: '16px 18px' }}>
              {/* En-tête inscription */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(27,176,206,.08)' }}>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: '#1A1514' }}>{insc.contact?.prenom || insc.participants?.[0]?.prenom} {insc.contact?.nom || insc.participants?.[0]?.nom}</div>
                  <div style={{ fontSize: 12.5, color: '#7A7470' }}>{insc.email_contact} {insc.contact?.tel ? `· ${insc.contact.tel}` : ''}</div>
                  <div style={{ fontSize: 11.5, color: '#A8A39D', marginTop: 2 }}>Inscrit le {new Date(insc.created_at).toLocaleDateString('fr-BE')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1BB0CE' }}>{(insc.montant_total || 0).toFixed(2)} €</div>
                  <PaiementBadge insc={insc} onPaye={marquerPaye} />
                </div>
              </div>

              {/* Référence de paiement */}
              {insc.montant_total > 0 && (
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: '#4A4340', marginBottom: 12 }}>
                  <span>Mode : <strong>{insc.mode_paiement === 'virement' ? '🏦 Virement' : insc.mode_paiement === 'payconiq' ? '📱 Payconiq' : insc.mode_paiement}</strong></span>
                  {insc.communication_structuree && <span>Référence : <strong style={{ color: '#0E7A93', fontFamily: 'monospace' }}>{insc.communication_structuree}</strong></span>}
                </div>
              )}

              {/* Participants */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(insc.participants || []).map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: p.present ? '#F0FAF0' : '#FAFAF8', borderRadius: 9, padding: '9px 12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, fontWeight: 500, color: '#4A4340', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" checked={!!p.present} onChange={() => togglePresence(insc, idx)} style={{ accentColor: '#3B6D11', width: 16, height: 16 }} />
                      Présent
                    </label>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#1A1514' }}>{p.prenom} {p.nom} <span style={{ fontWeight: 400, color: '#7A7470' }}>— {p.tarif_label || p.tarif}</span></div>
                      {/* Champs perso participant */}
                      {champsParticipant.map(ch => p.champs?.[ch.id] && (
                        <div key={ch.id} style={{ fontSize: 12.5, color: '#4A4340' }}>{ch.label} : <strong>{p.champs[ch.id]}</strong></div>
                      ))}
                      {/* Médical */}
                      {p.medical && <div style={{ fontSize: 12.5, color: '#A32D2D', marginTop: 2 }}>⚕️ {p.medical}</div>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Champs globaux */}
              {champsGlobaux.length > 0 && insc.champs_globaux && Object.keys(insc.champs_globaux).length > 0 && (
                <div style={{ marginTop: 10, fontSize: 12.5, color: '#4A4340' }}>
                  {champsGlobaux.map(ch => insc.champs_globaux[ch.id] && (
                    <span key={ch.id} style={{ marginRight: 14 }}>{ch.label} : <strong>{insc.champs_globaux[ch.id]}</strong></span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PaiementBadge({ insc, onPaye }) {
  if (insc.montant_total === 0) return <span style={{ fontSize: 11.5, color: '#3B6D11', fontWeight: 600 }}>Gratuit</span>
  const paye = insc.statut_paiement === 'paye'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, marginTop: 4 }}>
      <span style={{ background: paye ? '#EAF3DE' : '#FAEEDA', color: paye ? '#3B6D11' : '#BA7517', padding: '2px 9px', borderRadius: 99, fontSize: 11.5, fontWeight: 600 }}>
        {paye ? '✓ Payé' : 'En attente'}
      </span>
      <button onClick={() => onPaye(insc, !paye)} style={{ padding: '3px 10px', background: paye ? '#FCEBEB' : '#1BB0CE', color: paye ? '#C8435A' : 'white', border: 'none', borderRadius: 7, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>
        {paye ? 'Annuler' : 'Marquer payé'}
      </button>
    </div>
  )
}

// ── Fiche médicale imprimable pour l'ambulance ────────────────────────────────
function FicheAmbulance({ event, inscriptions, champsParticipant, onClose }) {
  const lignes = inscriptions.flatMap(insc =>
    (insc.participants || []).map(p => ({
      nom: `${p.prenom || ''} ${p.nom || ''}`.trim(),
      tarif: p.tarif_label || p.tarif,
      medical: p.medical || '',
      champs: p.champs || {},
      contact: `${insc.contact?.prenom || ''} ${insc.contact?.nom || ''}`.trim(),
      tel: insc.contact?.tel || '',
    }))
  )
  const avecMedical = lignes.filter(l => l.medical)

  return (
    <div style={{ padding: '28px 24px', fontFamily: "'DM Sans',sans-serif", maxWidth: 900 }}>
      <div className="no-print" style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <button onClick={onClose} style={{ padding: '8px 16px', background: 'none', border: '1px solid rgba(0,0,0,.15)', borderRadius: 9, fontSize: 13.5, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>← Retour</button>
        <button onClick={() => window.print()} style={{ padding: '8px 16px', background: '#1BB0CE', color: 'white', border: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>🖨 Imprimer</button>
      </div>

      <div style={{ border: '2px solid #C8435A', borderRadius: 12, padding: '20px 24px' }}>
        <h2 style={{ fontSize: '1.3rem', color: '#A32D2D', marginBottom: 4 }}>🚑 Fiche médicale — équipes de secours</h2>
        <p style={{ fontSize: 13, color: '#4A4340', marginBottom: 4 }}><strong>{event.titre_fr}</strong> — {new Date(event.date_debut).toLocaleDateString('fr-BE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <p style={{ fontSize: 12, color: '#7A7470', marginBottom: 18 }}>Document confidentiel — usage médical uniquement. {avecMedical.length} participant(s) avec information médicale sur {lignes.length} inscrits.</p>

        {avecMedical.length === 0 ? (
          <p style={{ fontSize: 13.5, color: '#7A7470' }}>Aucune information médicale signalée par les participants.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#FCEBEB' }}>{['Participant', 'Formule', 'Information médicale', 'Contact / Tél.'].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 11.5, fontWeight: 700, color: '#A32D2D', border: '1px solid #F0D5D5' }}>{h}</th>)}</tr></thead>
            <tbody>
              {avecMedical.map((l, i) => (
                <tr key={i}>
                  <td style={{ padding: '8px 10px', border: '1px solid #F0D5D5', fontWeight: 600 }}>{l.nom}</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #F0D5D5' }}>{l.tarif}</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #F0D5D5', color: '#A32D2D' }}>{l.medical}</td>
                  <td style={{ padding: '8px 10px', border: '1px solid #F0D5D5', fontSize: 12 }}>{l.contact}{l.tel ? ` · ${l.tel}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`@media print { .no-print { display:none !important; } body { background:white; } }`}</style>
    </div>
  )
}