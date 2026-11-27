import { supabase } from '@/lib/supabase'
import config from '@/app.config'
import { origineAutorisee } from '@/lib/environnement'

function origineCourante() {
  if (typeof window === 'undefined') return ''
  return origineAutorisee(window.location.origin)
}

async function jetonFrais() {
  const { data: refreshed } = await supabase.auth.refreshSession()
  if (refreshed?.session?.access_token) return refreshed.session.access_token
  const { data: sess } = await supabase.auth.getSession()
  return sess?.session?.access_token || ''
}

async function invokeEnvoyerInvitation(body) {
  const token = await jetonFrais()
  if (!token) {
    return { data: null, error: { message: 'Session expirée. Déconnecte-toi, reconnecte-toi, puis réessaie.' } }
  }
  const url = `${String(config.supabase.url).replace(/\/$/, '')}/functions/v1/envoyer-invitation`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.supabase.anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ...body, origine: origineCourante() }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { data, error: { message: data?.error || data?.message || 'Envoi impossible.' } }
  }
  return { data, error: null }
}

async function lireErreur(data, error) {
  const msg = data?.error || data?.message || error?.message || 'Envoi impossible.'
  if (msg === 'Non authentifié.' || msg === 'Non authentifié') {
    return 'Session expirée. Déconnecte-toi, reconnecte-toi, puis réessaie.'
  }
  return msg
}

/** Envoie l’invitation (From app@heartsangels.be, lien vers app.heartsangels.be). */
export async function envoyerInvitationEmail(code) {
  const c = String(code || '').trim()
  if (!c) return { ok: false, error: 'Code d’invitation manquant.' }
  const { data, error } = await invokeEnvoyerInvitation({ code: c })
  if (data?.ok) return { ok: true, email: data.email }
  return { ok: false, error: await lireErreur(data, error) }
}

/** Code à 6 chiffres pour la connexion en deux étapes. Jamais renvoyé au navigateur. */
export async function demanderCodeEmail() {
  const { data, error } = await invokeEnvoyerInvitation({ action: 'code_2fa' })
  if (data?.ok) return { ok: true }
  return { ok: false, error: await lireErreur(data, error) }
}

/** Mail « ton compte est prêt » avec le bouton Accéder à l’application. */
export async function envoyerMailBienvenue() {
  const { data, error } = await invokeEnvoyerInvitation({ action: 'bienvenue' })
  if (data?.ok) return { ok: true }
  return { ok: false, error: await lireErreur(data, error) }
}

/** Bug helpdesk → mail prioritaire à laurent@ avec captures en PJ. */
export async function envoyerMailBugHelpdesk(ticketId) {
  const id = String(ticketId || '').trim()
  if (!id) return { ok: false, error: 'Ticket manquant.' }
  const { data, error } = await invokeEnvoyerInvitation({
    action: 'helpdesk_bug',
    ticket_id: id,
  })
  if (data?.ok) return { ok: true, pieces: data.pieces || 0 }
  return { ok: false, error: await lireErreur(data, error) }
}

/** Consentement / droit à l’image en PDF (souvent sans signature, pour signature manuscrite). */
export async function envoyerDocumentRencontre({
  souhaitId, email, destinatairePrenom, destinataireNom, sujet, pdfBase64, nomFichier, mode,
}) {
  const adresse = String(email || '').trim()
  const prenom = String(destinatairePrenom || '').trim()
  const nom = String(destinataireNom || '').trim()
  if (!souhaitId) return { ok: false, error: 'Souhait manquant.' }
  if (!adresse.includes('@')) return { ok: false, error: 'Adresse e-mail manquante.' }
  if (!pdfBase64) return { ok: false, error: 'PDF manquant.' }
  const { data, error } = await invokeEnvoyerInvitation({
    action: 'document_rencontre',
    souhait_id: souhaitId,
    email: adresse,
    destinataire_prenom: prenom || undefined,
    destinataire_nom: nom || undefined,
    sujet: String(sujet || '').trim() || undefined,
    mode: mode || 'consentement',
    pdf_base64: pdfBase64,
    nom_fichier: nomFichier || 'document.pdf',
  })
  if (data?.ok) return { ok: true }
  return { ok: false, error: await lireErreur(data, error) }
}

/** Rapport médical uniquement. Objet dynamique (bénéficiaire + date), sans copie cachée.
 *  `pieces` optionnel : [{ nom_fichier, pdf_base64 }] (ex. registre stupéfiants). */
export async function envoyerRapportMedical({
  souhaitId, email, destinatairePrenom, destinataireNom, html, texte, sujet, pieces,
}) {
  const adresse = String(email || '').trim()
  const prenom = String(destinatairePrenom || '').trim()
  const nom = String(destinataireNom || '').trim()
  if (!souhaitId) return { ok: false, error: 'Souhait manquant.' }
  if (!adresse.includes('@')) return { ok: false, error: 'Adresse e-mail manquante.' }
  if (!prenom || !nom) return { ok: false, error: 'Indiquez le prénom et le nom du destinataire.' }
  const { data, error } = await invokeEnvoyerInvitation({
    action: 'rapport_medical',
    souhait_id: souhaitId,
    email: adresse,
    destinataire_prenom: prenom,
    destinataire_nom: nom,
    sujet: String(sujet || '').trim() || undefined,
    html,
    texte,
    pieces: Array.isArray(pieces) && pieces.length ? pieces : undefined,
  })
  if (data?.ok) return { ok: true }
  return { ok: false, error: await lireErreur(data, error) }
}

/** Demande un lien de réinitialisation (sans session). Toujours le même message côté écran. */
export async function demanderResetMotDePasse(email) {
  const adresse = String(email || '').trim()
  if (!adresse) return { ok: false, error: 'Indique ton adresse e-mail.' }
  const url = `${String(config.supabase.url).replace(/\/$/, '')}/functions/v1/envoyer-invitation`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.supabase.anonKey,
      Authorization: `Bearer ${config.supabase.anonKey}`,
    },
    body: JSON.stringify({ action: 'mot_de_passe_oublie', email: adresse, origine: origineCourante() }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { ok: false, error: data?.error || data?.message || 'Envoi impossible.' }
  }
  return { ok: true }
}
