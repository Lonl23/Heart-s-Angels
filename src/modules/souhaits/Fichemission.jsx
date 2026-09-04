import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Btn, fmtAdresse } from '@/components/ui'
import { CHECKLISTS, itemsChecklistTous } from './missionSchema'
import { personneEstMedicale } from '@/modules/fiche/ficheSchema'
import { debitLabel } from './medCalc'

const dt = v => v ? new Date(v).toLocaleString('fr-BE', { dateStyle:'short', timeStyle:'short' }).replace(' ', ' · ') : ''
const d = v => v ? new Date(v).toLocaleDateString('fr-BE') : ''

export default function FicheMission({ souhaitId, onClose }) {
  const [s, setS] = useState(null)
  const [meds, setMeds] = useState([])
  const [equipe, setEquipe] = useState([])
  const ficheRef = useRef(null)

  useEffect(() => { (async () => {
    const { data: so } = await supabase.from('souhaits').select('*').eq('id', souhaitId).single()
    setS(so)
    const { data: ints } = await supabase.from('souhait_medicaments').select('*').eq('souhait_id', souhaitId)
    let all = ints || []
    const { data: dem } = await supabase.from('demandes_souhaits').select('id').eq('souhait_id', souhaitId).limit(1)
    if (dem?.[0]) { const { data: pm } = await supabase.from('souhait_medicaments').select('*').eq('demande_id', dem[0].id); all = [...all, ...(pm || [])] }
    setMeds(all)
    const { data: eq } = await supabase.from('souhait_personnel').select('*, profiles(prenom,nom,role,fiche)').eq('souhait_id', souhaitId)
    setEquipe(eq || [])
  })() }, [souhaitId])

  if (!s) return <div style={{ padding:24 }}>Chargement…</div>
  const m = s.mission || {}
  const vecteurs = m.vecteurs || []
  // une fiche par vecteur ; à défaut, une fiche maîtresse (coordination) complète
  function imprimer() {
    const html = ficheRef.current ? ficheRef.current.innerHTML : ''
    const doc = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Fiche de mission</title><style>' + printStyles + '</style></head><body>' + html + '</body></html>'
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    document.body.appendChild(iframe)
    const idoc = iframe.contentWindow.document
    idoc.open(); idoc.write(doc); idoc.close()
    setTimeout(() => {
      try { iframe.contentWindow.focus(); iframe.contentWindow.print() } catch (e) {}
      setTimeout(() => { try { document.body.removeChild(iframe) } catch (e) {} }, 1500)
    }, 350)
  }

  const fiches = vecteurs.length
    ? vecteurs.map((v, i) => ({ v, i, crew: equipe.filter(e => e.vecteur_id === v.id) }))
    : [{ v:null, i:0, crew: equipe }]

  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh' }}>
      <div className="no-print" style={{ display:'flex', gap:10, padding:'14px 16px', position:'sticky', top:0, background:'var(--surface)', borderBottom:'1px solid var(--border)', zIndex:5 }}>
        <Btn kind="soft" onClick={onClose}>← Retour</Btn>
        <Btn onClick={imprimer}>🖨 Imprimer / PDF (A4 recto-verso)</Btn>
        <span style={{ alignSelf:'center', fontSize:12.5, color:'var(--text-muted)' }}>{fiches.length} fiche{fiches.length>1?'s':''} · une par vecteur</span>
      </div>

      <div className="fiche" ref={ficheRef}>
        {fiches.map((f, idx) => {
          const med = f.v ? f.crew.some(c => personneEstMedicale(c)) : true
          return <FicheVecteur key={idx} s={s} m={m} f={f} med={med} meds={meds} total={fiches.length} first={idx===0} />
        })}
      </div>

      <style>{styles}</style>
    </div>
  )
}

function FicheVecteur({ s, m, f, med, meds, total, first }) {
  const v = f.v
  const pecAdr = m.pec_type === 'Domicile du patient' ? m.patient_adresse : m.pec_adresse
  const vecteurLabel = v ? `Vecteur ${f.i + 1} — ${v.nom || '—'}${v.type_transport ? ` · ${v.type_transport}` : ''}${v.plaque ? ` · ${v.plaque}` : ''}` : 'Toutes affectations'
  const Wm = () => <div className={'wm ' + (med ? 'med' : 'conf')}><span>{med ? 'CONFIDENTIEL\nSECRET MÉDICAL' : 'CONFIDENTIEL'}</span></div>

  return (
    <div className={'fiche-block' + (first ? '' : ' brk')}>
      {/* ═══ RECTO ═══ */}
      <div className="page recto">
        <Wm />
        <div className="content">
          <Masthead s={s} face="RECTO" vecteurLabel={vecteurLabel} med={med} />
          <Sec t="Administratif">
            <Fld l="Registre national" v={m.registre_national} />
            <Fld l="Récolteur de souhait" v={m.recolteur} />
            <Fld l="Priorité élevée" v={m.priorite_elevee ? 'Oui' : ''} />
            <Fld l="Date de rencontre" v={dt(m.date_rencontre)} />
            <Fld l="Consentement" v={m.consentement ? 'Oui' : ''} />
            <Fld l="Autorisation photos" v={m.autorisation_photos ? 'Oui' : ''} />
            <Fld l="Adresse du domicile du patient" v={fmtAdresse(m.patient_adresse)} wide />
          </Sec>
          <Sec t="🏁 Base">
            <Fld l="Base" v={m.base_nom} />
            <Fld l="Adresse" v={fmtAdresse(m.base_adresse)} />
            <Fld l="Rendez-vous" v={dt(m.rdv_base)} />
            <Fld l="Départ" v={dt(m.depart_base)} />
          </Sec>
          <Sec t="🧑‍🦽 Prise en charge">
            <Fld l="Lieu" v={m.pec_type} />
            <Fld l="Institution" v={m.pec_institution} />
            <Fld l="Adresse" v={fmtAdresse(pecAdr)} wide />
            <Fld l="Service" v={m.pec_service} third />
            <Fld l="Étage" v={m.pec_etage} third />
            <Fld l="Aile / route" v={m.pec_aile} third />
            <Fld l="Chambre" v={m.pec_chambre} third />
            <Fld l="PEC souhaitée" v={dt(m.arrivee_pec)} third />
            <Fld l="Départ souhaité" v={dt(m.depart_pec)} third />
            <Fld l="Précisions" v={m.pec_precisions} wide />
          </Sec>
          <Sec t="📍 Destination">
            <Fld l="Adresse" v={fmtAdresse(m.dest_adresse)} wide />
            <Fld l="Précisions" v={m.dest_precisions} wide />
            <Fld l="Heure souhaitée sur place" v={dt(m.arrivee_destination)} />
          </Sec>
          <Sec t="↩︎ Retour">
            <Fld l="Type de retour" v={m.retour_type} />
            <Fld l="Heure attendue" v={dt(m.retour_heure)} />
            <Fld l="Précisions" v={m.retour_precisions} wide />
          </Sec>
          <Sec t="🚐 Équipage" plain>
            {v && <div className="vec"><div className="vh">{vecteurLabel}</div>
              <div className="crew">{f.crew.length ? f.crew.map(c => `${c.profiles?.prenom||''} ${c.profiles?.nom||''}${c.role_mission?` (${c.role_mission})`:''}`).join(' · ') : <span className="muted">équipage à compléter</span>}</div>
            </div>}
            {!v && (m.vecteurs || []).map((vv, i) => <div key={vv.id} className="vec"><div className="vh">Vecteur {i+1} — {vv.nom||'—'}</div></div>)}
          </Sec>
        </div>
      </div>

      {/* ═══ VERSO ═══ */}
      <div className="page">
        <Wm />
        <div className="content">
          <Masthead s={s} face="VERSO" vecteurLabel={vecteurLabel} med={med} />

          {med && (
            <>
              <Sec t="⚕️ Infos médicales">
                <Fld l="Allergies" v={m.allergies} wide alert />
                <Fld l="Ne pas réanimer" v={m.ne_pas_reanimer ? 'OUI' : ''} alert />
                <Fld l="Douleurs" v={m.douleurs} />
                <Fld l="Pathologies" v={m.pathologies} wide />
                <Fld l="Antécédents" v={m.antecedents} wide />
                <Fld l="Voie d'accès" v={m.voie_acces} />
                <Fld l="Mobilisations" v={m.mobilisations} />
                <Fld l="Communication" v={m.communication} />
                <Fld l="Déglutition" v={m.deglutition} />
                <Fld l="Alimentation" v={m.alimentation} />
                <Fld l="Continence urinaire" v={m.continence_urinaire} />
                <Fld l="Continence fécale" v={m.continence_fecale} />
                <Fld l="Précisions continences" v={m.precisions_continences} wide />
              </Sec>
              <Sec t="📊 Paramètres">
                <Fld l="Cible SpO₂" v={m.cible_saturation_o2} third />
                <Fld l="Débit O₂" v={m.debit_o2} third />
                <Fld l="Apport O₂" v={m.apport_o2} third />
                <Fld l="Cible TA" v={m.cible_ta} third />
                <Fld l="Cible FC" v={m.cible_fc} third />
              </Sec>
              <Sec t="💊 Médicaments" plain>
                {meds.length === 0 ? <div className="muted">Aucun.</div> : (
                  <table className="tbl">
                    <thead><tr><th>Médicament</th><th>Dosage</th><th>Voie</th><th>Débit</th><th>Horaires</th></tr></thead>
                    <tbody>
                      {meds.map(md => (
                        <tr key={md.id}>
                          <td>{md.medicament}</td><td>{md.dosage}</td><td>{md.voie}</td><td>{debitLabel(md) || '—'}</td>
                          <td>{md.type_admin==='si_necessaire' ? `Si besoin${md.posologie_max?` (max ${md.posologie_max})`:''}` : (Array.isArray(md.horaires)?md.horaires.join(' · '):'')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Sec>
            </>
          )}

          <Sec t="✅ Checklist véhicule — à cocher" plain>
            <div className="muted" style={{ marginBottom:8 }}>Au départ : scanner chaque bouteille d’O₂ et chaque sac (QR). Puis cocher :</div>
            {v ? ['base','retour_base'].map(sec => (
              <div key={sec} className="cl-wrap">
                <div className="cl-title">{CHECKLISTS[sec].titre}</div>
                {itemsChecklistTous(sec, m).map(it => <div key={it} className="cl-item"><span className="cl-box" />{it}</div>)}
              </div>
            )) : <div className="muted">Définissez des vecteurs pour la checklist véhicule.</div>}
          </Sec>

          {med && (
            <Sec t="✅ Checklists prise en charge — à cocher" plain>
              {['pec','retour_pec'].map(sec => (
                <div key={sec} className="cl-wrap">
                  <div className="cl-title">{CHECKLISTS[sec].titre}</div>
                  {itemsChecklistTous(sec, m).map(it => <div key={it} className="cl-item"><span className="cl-box" />{it}</div>)}
                </div>
              ))}
            </Sec>
          )}

          <Sec t="📝 Rapport de mission / observations" plain>
            <div className="rline" /><div className="rline" /><div className="rline" />
          </Sec>
        </div>
      </div>
    </div>
  )
}

function Masthead({ s, face, vecteurLabel, med }) {
  return (
    <div className="masthead">
      <div>
        <div className="kicker">Heart's Angels · Fiche de mission</div>
        <div className="name">{s.beneficiaire_prenom} {s.beneficiaire_nom}{s.beneficiaire_ddn && <small> — né(e) le {d(s.beneficiaire_ddn)}</small>}</div>
        {s.description && <div className="wish">« {s.description} »</div>}
        <div className="vlabel">{vecteurLabel} · {med ? 'équipage médical' : 'équipage non médical'}</div>
      </div>
      <div className="badge"><span className="face">{face}</span>{s.date_souhaitee && <div className="date">🗓 {d(s.date_souhaitee)}</div>}</div>
    </div>
  )
}
function Sec({ t, plain, children }) {
  return (
    <div className="sec">
      <div className="sec-h"><span className="t">{t}</span></div>
      {plain ? children : <div className="grid">{children}</div>}
    </div>
  )
}
function Fld({ l, v, wide, third, alert }) {
  if (!v) return null
  const cls = 'f' + (wide?' wide':'') + (third?' third':'')
  return <span className={cls}><span className="l">{l}</span><span className={'v'+(alert?' alert':'')}>{v}</span></span>
}

const styles = `
  .fiche { color:#243033; }
  .fiche-block { }
  .page { position:relative; background:#fff; color:#243033; width:210mm; min-height:297mm; margin:16px auto; padding:14mm; border:1px solid #E3EBEC; border-radius:8px; font-family:'Karla','Helvetica Neue',Arial,sans-serif; font-size:11.5px; overflow:hidden; }
  .page > .content { position:relative; z-index:1; }
  .wm { position:absolute; inset:0; z-index:0; display:flex; align-items:center; justify-content:center; pointer-events:none; }
  .wm span { transform:rotate(-45deg); font-size:58px; font-weight:800; letter-spacing:8px; white-space:pre; text-align:center; line-height:1.35; }
  .wm.med span { color:rgba(178,59,59,0.09); }
  .wm.conf span { color:rgba(14,74,90,0.07); }
  .masthead { background:#0E4A5A; color:#fff; border-radius:12px; padding:15px 20px; display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; }
  .masthead .kicker { font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:#8FCAD6; font-weight:700; }
  .masthead .name { font-family:'Newsreader',Georgia,serif; font-size:21px; margin-top:3px; font-weight:600; }
  .masthead .name small { font-weight:400; font-size:12px; color:#B9DCE3; font-family:'Karla',sans-serif; }
  .masthead .wish { font-style:italic; color:#CFE6EB; margin-top:4px; font-size:11.5px; max-width:480px; }
  .masthead .vlabel { margin-top:6px; font-size:10px; color:#8FCAD6; font-weight:700; text-transform:uppercase; letter-spacing:1px; }
  .masthead .badge { text-align:right; white-space:nowrap; }
  .masthead .face { display:inline-block; background:#178FA6; color:#fff; padding:3px 12px; border-radius:99px; font-size:11px; font-weight:700; letter-spacing:1.5px; }
  .masthead .date { margin-top:7px; font-size:10.5px; color:#CFE6EB; }
  .sec { margin-bottom:9px; }
  .sec-h { background:#EDF4F5; border-left:4px solid #7E9B76; padding:5px 11px; border-radius:5px; margin-bottom:7px; }
  .sec-h .t { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.2px; color:#0E4A5A; }
  .f { display:inline-block; width:49%; vertical-align:top; padding:1px 10px 3px 0; }
  .f.wide { width:100%; } .f.third { width:32.5%; }
  .f .l { font-size:8px; text-transform:uppercase; letter-spacing:.7px; color:#8CA0A3; font-weight:700; display:block; }
  .f .v { font-size:11px; color:#243033; font-weight:600; line-height:1.25; }
  .f .v.alert { color:#B23B3B; }
  table.tbl { width:100%; border-collapse:collapse; border-radius:7px; overflow:hidden; box-shadow:0 0 0 1px #E3EBEC; }
  table.tbl th { background:#0E4A5A; color:#fff; font-size:9px; text-transform:uppercase; letter-spacing:.6px; padding:6px 8px; text-align:left; font-weight:700; }
  table.tbl td { padding:5px 8px; font-size:10.5px; border-bottom:1px solid #EAF0F1; }
  table.tbl tr:nth-child(even) td { background:#F6FAFB; }
  table.tbl tr:last-child td { border-bottom:none; }
  .vec { border:1px solid #E7EEF0; border-left:4px solid #178FA6; border-radius:7px; padding:7px 11px; margin-bottom:6px; }
  .vec .vh { font-weight:700; color:#0E4A5A; font-size:11.5px; }
  .vec .crew { margin-top:3px; color:#39494C; font-size:10.5px; }
  .cl-wrap { display:inline-block; width:49%; vertical-align:top; padding-right:12px; }
  .cl-title { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; color:#178FA6; margin:2px 0 4px; }
  .cl-item { padding:2.5px 0; font-size:10.5px; color:#39494C; }
  .cl-box { display:inline-block; width:11px; height:11px; border:1.4px solid #9DB0B3; border-radius:3px; margin-right:7px; vertical-align:-1px; }
  .vec-cl { margin-bottom:8px; }
  .rline { border-bottom:1px solid #C7D3D5; height:19px; }
  .muted { color:#8CA0A3; }
  @media print {
    .no-print { display:none !important; }
    @page { size:A4; margin:10mm; }
    .page { border:none; border-radius:0; margin:0; max-width:none; padding:0; }
    .page.recto { page-break-after:always; }
    .fiche-block.brk { page-break-before:always; }
  }
`


// Feuille de style dédiée à l'impression : document isolé, A4, pagination
// naturelle (aucune troncature), sans le fond de l'application.
const printStyles = `
  * { box-sizing:border-box; }
  html, body { margin:0; padding:0; background:#fff; }
  body { font-family:'Karla','Helvetica Neue',Arial,sans-serif; color:#243033; font-size:11.5px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  @page { size:A4; margin:12mm; }
  .page { position:relative; background:#fff; min-height:271mm; padding:0; }
  .page.recto { page-break-after:always; }
  .fiche-block.brk { page-break-before:always; }
  .content { position:relative; z-index:1; }
  .wm { position:absolute; inset:0; z-index:0; display:flex; align-items:center; justify-content:center; }
  .wm span { transform:rotate(-45deg); font-size:58px; font-weight:800; letter-spacing:8px; white-space:pre; text-align:center; line-height:1.35; }
  .wm.med span { color:rgba(178,59,59,0.09); }
  .wm.conf span { color:rgba(14,74,90,0.07); }
  .masthead { background:#0E4A5A !important; color:#fff; border-radius:12px; padding:15px 20px; display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; }
  .masthead .kicker { font-size:9px; letter-spacing:2.5px; text-transform:uppercase; color:#8FCAD6; font-weight:700; }
  .masthead .name { font-family:'Newsreader',Georgia,serif; font-size:21px; margin-top:3px; font-weight:600; }
  .masthead .name small { font-weight:400; font-size:12px; color:#B9DCE3; }
  .masthead .wish { font-style:italic; color:#CFE6EB; margin-top:4px; font-size:11.5px; max-width:480px; }
  .masthead .vlabel { margin-top:6px; font-size:10px; color:#8FCAD6; font-weight:700; text-transform:uppercase; letter-spacing:1px; }
  .masthead .badge { text-align:right; white-space:nowrap; }
  .masthead .face { display:inline-block; background:#178FA6; color:#fff; padding:3px 12px; border-radius:99px; font-size:11px; font-weight:700; letter-spacing:1.5px; }
  .masthead .date { margin-top:7px; font-size:10.5px; color:#CFE6EB; }
  .sec { margin-bottom:9px; page-break-inside:avoid; }
  .sec-h { background:#EDF4F5; border-left:4px solid #7E9B76; padding:5px 11px; border-radius:5px; margin-bottom:7px; }
  .sec-h .t { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.2px; color:#0E4A5A; }
  .f { display:inline-block; width:49%; vertical-align:top; padding:1px 10px 3px 0; }
  .f.wide { width:100%; } .f.third { width:32.5%; }
  .f .l { font-size:8px; text-transform:uppercase; letter-spacing:.7px; color:#8CA0A3; font-weight:700; display:block; }
  .f .v { font-size:11px; color:#243033; font-weight:600; line-height:1.25; }
  .f .v.alert { color:#B23B3B; }
  table.tbl { width:100%; border-collapse:collapse; }
  table.tbl th { background:#0E4A5A !important; color:#fff; font-size:9px; text-transform:uppercase; letter-spacing:.6px; padding:6px 8px; text-align:left; font-weight:700; }
  table.tbl td { padding:5px 8px; font-size:10.5px; border-bottom:1px solid #EAF0F1; }
  table.tbl tr:nth-child(even) td { background:#F6FAFB; }
  .vec { border:1px solid #E7EEF0; border-left:4px solid #178FA6; border-radius:7px; padding:7px 11px; margin-bottom:6px; page-break-inside:avoid; }
  .vec .vh { font-weight:700; color:#0E4A5A; font-size:11.5px; }
  .vec .crew { margin-top:3px; color:#39494C; font-size:10.5px; }
  .cl-wrap { display:inline-block; width:49%; vertical-align:top; padding-right:12px; }
  .cl-title { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.6px; color:#178FA6; margin:2px 0 4px; }
  .cl-item { padding:2.5px 0; font-size:10.5px; color:#39494C; }
  .cl-box { display:inline-block; width:11px; height:11px; border:1.4px solid #9DB0B3; border-radius:3px; margin-right:7px; vertical-align:-1px; }
  .vec-cl { margin-bottom:8px; }
  .rline { border-bottom:1px solid #C7D3D5; height:19px; }
  .muted { color:#8CA0A3; }
`
