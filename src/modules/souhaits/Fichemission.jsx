import { useState } from 'react'

// Génère un PDF via la fenêtre print du navigateur (sans dépendance jsPDF)
export default function FicheMission({ souhait, dates, personnel, onClose }) {
  const [generating, setGenerating] = useState(false)

  const s = souhait || {}
  const dateConfirmee = dates?.find(d => d.confirmee) || dates?.[0]

  const NIVEAU_LABEL = { stable:'Stable', douleur_moderee:'Douleur modérée', douleur_forte:'Douleur forte', inconfort:'Inconfort / Agitation' }
  const POSITION_LABEL = { assis:'Assis(e)', semi_assis:'Semi-assis(e)', allonge:'Allongé(e)', brancard:'Brancard', fauteuil_roulant:'Fauteuil roulant' }
  const MOBILITE_LABEL = { autonome:'Autonome', fauteuil_roulant:'Fauteuil roulant', brancard:'Brancard', lit_medicalise:'Lit médicalisé' }

  function printFiche() {
    setGenerating(true)
    const w = window.open('', '_blank', 'width=900,height=1200')
    w.document.write(generateHTML())
    w.document.close()
    setTimeout(() => { w.print(); setGenerating(false) }, 500)
  }

  function generateHTML() {
    const nom = `${s.patient_prenom || ''} ${s.patient_nom || ''}`
    const dob = s.patient_ddn ? new Date(s.patient_ddn).toLocaleDateString('fr-BE') : '—'
    const dateMission = dateConfirmee?.date_proposee ? new Date(dateConfirmee.date_proposee).toLocaleDateString('fr-BE', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) : '—'
    const heureDep = dateConfirmee?.heure_depart || '—'
    const heureRet = dateConfirmee?.heure_retour_estimee || '—'
    const vehiculesHTML = (s.vehicules||[]).map(v =>
      `<tr><td><strong>${v.type?.toUpperCase()}</strong></td><td>${v.immatriculation||'—'}</td><td>${v.conducteur||'—'}</td><td>${v.note||''}</td></tr>`
    ).join('') || '<tr><td colspan="4" style="color:#999;font-style:italic">Aucun véhicule encodé</td></tr>'

    const personnelHTML = (personnel||[]).map(p =>
      `<div class="badge badge-${p.role}">${p.prenom} ${p.nom} (${p.role?.replace('_',' ')})</div>`
    ).join('') || '<em style="color:#999">Non encore défini</em>'

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Fiche de mission — ${nom} — ${dateMission}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1A1514;background:white;padding:16px;}
  .header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1BB0CE;padding-bottom:12px;margin-bottom:16px;}
  .header h1{font-size:20px;color:#0E4A5A;font-weight:700;}
  .header .date{font-size:13px;color:#555;text-align:right;}
  .logo-text{font-size:24px;font-weight:800;color:#1BB0CE;letter-spacing:-1px;}
  .logo-sub{font-size:10px;color:#7A7470;text-transform:uppercase;letter-spacing:.1em;}
  .section{margin-bottom:14px;page-break-inside:avoid;}
  .section-title{font-size:13px;font-weight:700;color:white;padding:5px 10px;border-radius:5px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em;}
  .bg-blue{background:#1BB0CE;} .bg-red{background:#C8435A;} .bg-green{background:#3B6D11;}
  .bg-orange{background:#BA7517;} .bg-purple{background:#534AB7;} .bg-dark{background:#0A1E2D;}
  .row{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;margin-bottom:4px;}
  .row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;}
  .field{margin-bottom:6px;}
  .field label{font-size:10px;font-weight:600;color:#7A7470;text-transform:uppercase;letter-spacing:.04em;display:block;margin-bottom:1px;}
  .field .val{font-size:12.5px;color:#1A1514;}
  .field .val.big{font-size:14px;font-weight:700;}
  .alert{background:#FEF2F2;border:2px solid #C8435A;border-radius:6px;padding:8px 12px;margin-bottom:10px;}
  .alert-title{font-size:13px;font-weight:800;color:#C8435A;margin-bottom:4px;}
  .alert p{font-size:12px;color:#1A1514;line-height:1.5;}
  .warn{background:#FAEEDA;border:1.5px solid #BA7517;border-radius:6px;padding:8px 12px;margin-bottom:10px;}
  .warn-title{font-size:12px;font-weight:700;color:#BA7517;margin-bottom:3px;}
  .ok{background:#EAF3DE;border:1.5px solid #3B6D11;border-radius:6px;padding:8px 12px;margin-bottom:10px;}
  .ok-title{font-size:12px;font-weight:700;color:#3B6D11;margin-bottom:3px;}
  table{width:100%;border-collapse:collapse;font-size:12px;}
  th{background:#F0F9FB;padding:5px 8px;text-align:left;font-size:10px;font-weight:700;color:#7A7470;text-transform:uppercase;border-bottom:1px solid #ddd;}
  td{padding:5px 8px;border-bottom:1px solid #f0f0f0;}
  .badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;margin:2px;}
  .badge-infirmier{background:#EAF3DE;color:#3B6D11;}
  .badge-ambulancier{background:#E6F7FA;color:#1BB0CE;}
  .badge-medecin{background:#FBEAF0;color:#C8435A;}
  .badge-default{background:#F0EFED;color:#7A7470;}
  .consentements{display:flex;flex-wrap:wrap;gap:6px;}
  .consent-ok{background:#EAF3DE;color:#3B6D11;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;}
  .consent-no{background:#F0EFED;color:#7A7470;padding:3px 10px;border-radius:99px;font-size:11px;}
  .footer{margin-top:20px;padding-top:10px;border-top:2px solid #1BB0CE;display:flex;justify-content:space-between;font-size:10px;color:#7A7470;}
  .page-break{page-break-before:always;}
  @media print{body{padding:8px;} .no-print{display:none;}}
  .sign-box{border:1px solid #ddd;border-radius:6px;height:50px;margin-top:4px;}
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo-text">❤️ Heart's Angels</div>
    <div class="logo-sub">Fiche de mission — Confidentiel</div>
  </div>
  <div class="date">
    <strong>Mission du ${dateMission}</strong><br>
    Départ : ${heureDep} — Retour estimé : ${heureRet}<br>
    Généré le ${new Date().toLocaleDateString('fr-BE',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})}
  </div>
</div>

<!-- PATIENT -->
<div class="section">
  <div class="section-title bg-dark">👤 Patient</div>
  <div class="row">
    <div class="field"><label>Nom complet</label><div class="val big">${nom}</div></div>
    <div class="field"><label>Date de naissance</label><div class="val">${dob}</div></div>
    <div class="field"><label>Établissement d'origine</label><div class="val">${s.etablissement||'—'}</div></div>
    <div class="field"><label>Infirmier(ère) référent(e)</label><div class="val">${s.infirmier_referent_etablissement||'—'}</div></div>
    <div class="field"><label>Médecin traitant</label><div class="val">${s.medecin_referent||'—'}</div></div>
    <div class="field"><label>Tél. médecin</label><div class="val">${s.telephone_medecin||'—'}</div></div>
    <div class="field"><label>Contact d'urgence</label><div class="val">${s.contact_urgence_nom||'—'}</div></div>
    <div class="field"><label>Tél. urgence</label><div class="val">${s.contact_urgence_tel||'—'}</div></div>
  </div>
</div>

<!-- CONSIGNES RÉANIMATION — EN ROUGE EN TÊTE -->
<div class="alert">
  <div class="alert-title">⚕️ CONSIGNES DE RÉANIMATION</div>
  <p>${s.consignes_reanimation || 'Non spécifié — vérifier avant la mission'}</p>
  <p style="margin-top:6px"><strong>Massage cardiaque (CPR) :</strong> <span style="font-size:14px;font-weight:800;color:${s.cpr_autorise?'#3B6D11':'#C8435A'}">${s.cpr_autorise ? '✅ AUTORISÉ' : '❌ NON AUTORISÉ'}</span></p>
</div>

<!-- PATHOLOGIES -->
<div class="section">
  <div class="section-title bg-red">🏥 Pathologies & État médical</div>
  <div class="field"><label>Description des pathologies</label><div class="val" style="white-space:pre-wrap;line-height:1.6">${s.pathologies || '—'}</div></div>
  <div class="row" style="margin-top:8px">
    <div class="field"><label>Niveau de douleur / État général</label><div class="val">${NIVEAU_LABEL[s.niveau_douleur] || s.niveau_douleur || '—'}</div></div>
    <div class="field"><label>Position de transport</label><div class="val">${POSITION_LABEL[s.position_transport] || s.position_transport || '—'}</div></div>
    <div class="field"><label>Mobilité</label><div class="val">${MOBILITE_LABEL[s.mobilite] || s.mobilite || '—'}</div></div>
    <div class="field"><label>Allergies médicamenteuses</label><div class="val">${s.allergies_medicaments || 'Aucune connue'}</div></div>
  </div>
  <div class="field" style="margin-top:6px"><label>Traitement actuel</label><div class="val" style="white-space:pre-wrap">${s.traitement_actuel || '—'}</div></div>
</div>

<!-- MATÉRIEL -->
<div class="section">
  <div class="section-title bg-orange">🧰 Matériel à prévoir</div>
  <div class="row">
    <div>
      <div class="field"><label>Matériel médical</label><div class="val" style="white-space:pre-wrap">${s.materiel_medical || 'Aucun spécifié'}</div></div>
      <div class="field" style="margin-top:6px"><label>Matériel spécifique / Équipement adapté</label><div class="val" style="white-space:pre-wrap">${s.materiel_specifique || 'Aucun'}</div></div>
    </div>
    <div>
      ${s.oxygene_requis ? `<div class="warn"><div class="warn-title">💨 OXYGÈNE REQUIS</div><div>Débit : <strong>${s.debit_oxygene || 'à définir'}</strong></div></div>` : '<div class="ok"><div class="ok-title">Pas d\'oxygène nécessaire</div></div>'}
    </div>
  </div>
</div>

<!-- LOGISTIQUE -->
<div class="section">
  <div class="section-title bg-blue">🗺️ Logistique & Déplacement</div>
  <div class="row3">
    <div class="field"><label>📍 Prise en charge</label><div class="val">${s.lieu_prise_en_charge||'—'}</div><div class="val" style="font-size:11px;color:#555">${s.adresse_prise_en_charge||''}</div></div>
    <div class="field"><label>🎯 Destination</label><div class="val">${s.lieu_destination||'—'}</div><div class="val" style="font-size:11px;color:#555">${s.adresse_destination||''}</div></div>
    <div class="field"><label>🔄 Retour</label><div class="val">${s.lieu_retour||s.lieu_prise_en_charge||'—'}</div></div>
  </div>
  <div style="margin-top:8px"><label style="font-size:10px;font-weight:700;color:#7A7470;text-transform:uppercase;letter-spacing:.04em">Véhicules</label>
  <table style="margin-top:4px"><thead><tr><th>Type</th><th>Immatriculation</th><th>Conducteur</th><th>Note</th></tr></thead>
  <tbody>${vehiculesHTML}</tbody></table></div>
</div>

<!-- SOUHAIT & CONSENTEMENTS -->
<div class="section">
  <div class="section-title bg-purple">❤️ Le souhait & Consentements</div>
  <div class="field"><label>Description du souhait</label><div class="val" style="white-space:pre-wrap;font-size:13px;font-style:italic">"${s.souhait_description||'—'}"</div></div>
  <div style="margin-top:8px"><label style="font-size:10px;font-weight:700;color:#7A7470;text-transform:uppercase;letter-spacing:.04em">Consentements</label>
  <div class="consentements" style="margin-top:4px">
    <span class="${s.consentement_photo?'consent-ok':'consent-no'}">📸 Photos : ${s.consentement_photo?'OUI':'NON'}</span>
    <span class="${s.consentement_video?'consent-ok':'consent-no'}">🎥 Vidéos : ${s.consentement_video?'OUI':'NON'}</span>
    <span class="${s.consentement_publication?'consent-ok':'consent-no'}">📢 Publication : ${s.consentement_publication?'OUI':'NON'}</span>
    <span class="${s.consentement_signe?'consent-ok':'consent-no'}">✅ Signé : ${s.consentement_signe?'OUI':'NON'}</span>
  </div></div>
</div>

<!-- ÉQUIPE -->
<div class="section">
  <div class="section-title bg-green">👥 Équipe de mission</div>
  <div>${personnelHTML}</div>
</div>

<!-- CONTACT FAMILLE -->
<div class="section">
  <div class="section-title bg-dark">📞 Contact famille présent</div>
  <div class="row">
    <div class="field"><label>Nom</label><div class="val">${s.contact_prenom||''} ${s.contact_nom||''} (${s.contact_relation||'—'})</div></div>
    <div class="field"><label>Téléphone</label><div class="val">${s.contact_telephone||'—'}</div></div>
  </div>
</div>

<!-- SIGNATURES -->
<div class="section page-break">
  <div class="section-title bg-dark">✍️ Signatures</div>
  <div class="row3">
    <div class="field"><label>Responsable de mission</label><div class="sign-box"></div></div>
    <div class="field"><label>Coordinateur médical</label><div class="sign-box"></div></div>
    <div class="field"><label>Bénéficiaire / Représentant</label><div class="sign-box"></div></div>
  </div>
</div>

<div class="footer">
  <span>Heart's Angels ASBL — Rue des Awirs 249, 4400 Flémalle — info@heartsangels.be</span>
  <span>CONFIDENTIEL — Document à usage interne uniquement</span>
</div>
</body></html>`
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'white', borderRadius:18, width:'100%', maxWidth:520, padding:'28px', fontFamily:"'DM Sans',sans-serif" }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h2 style={{ fontFamily:"'Cormorant Garamond',Georgia,serif", fontSize:'1.5rem', fontWeight:500, color:'#1A1514' }}>📄 Fiche de mission</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, color:'#7A7470' }}>✕</button>
        </div>

        <div style={{ background:'#F0F9FB', border:'1px solid rgba(27,176,206,.15)', borderRadius:12, padding:'14px 16px', marginBottom:20 }}>
          <div style={{ fontSize:14, fontWeight:600, color:'#0E4A5A', marginBottom:6 }}>
            {souhait?.patient_prenom} {souhait?.patient_nom}
          </div>
          <div style={{ fontSize:13, color:'#7A7470' }}>
            Mission : {dateConfirmee?.date_proposee ? new Date(dateConfirmee.date_proposee).toLocaleDateString('fr-BE',{weekday:'long',day:'numeric',month:'long',year:'numeric'}) : 'Date non confirmée'}
          </div>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
          {[
            ['✅','Consignes de réanimation', !!souhait?.consignes_reanimation],
            ['✅','Pathologies décrites', !!souhait?.pathologies],
            ['✅','Matériel à prévoir', !!souhait?.materiel_medical],
            ['✅','Lieu de prise en charge', !!souhait?.lieu_prise_en_charge],
            ['✅','Lieu de destination', !!souhait?.lieu_destination],
            ['✅','Véhicules encodés', (souhait?.vehicules||[]).length > 0],
            ['✅','Consentement signé', !!souhait?.consentement_signe],
          ].map(([icon, label, ok], i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, fontSize:13 }}>
              <span style={{ color: ok ? '#3B6D11' : '#A8A39D', fontSize:16 }}>{ok ? '✅' : '○'}</span>
              <span style={{ color: ok ? '#1A1514' : '#A8A39D' }}>{label}</span>
            </div>
          ))}
        </div>

        {!souhait?.vehicules?.length && (
          <div style={{ background:'#FAEEDA', border:'1px solid rgba(186,117,23,.2)', borderRadius:9, padding:'9px 12px', fontSize:12.5, color:'#BA7517', marginBottom:14 }}>
            ⚠️ Aucun véhicule encodé. Demandez au coordinateur médical de compléter les plaques.
          </div>
        )}

        <button onClick={printFiche} disabled={generating} style={{ width:'100%', padding:13, background:'#1BB0CE', color:'white', border:'none', borderRadius:10, fontSize:14.5, fontWeight:700, cursor:generating?'wait':'pointer', fontFamily:"'DM Sans',sans-serif" }}>
          {generating ? '⏳ Génération…' : '🖨️ Générer et imprimer la fiche'}
        </button>
        <p style={{ fontSize:11.5, color:'#7A7470', textAlign:'center', marginTop:8 }}>Une fenêtre d'impression s'ouvrira. Vous pouvez aussi sauvegarder en PDF.</p>
      </div>
    </div>
  )
}