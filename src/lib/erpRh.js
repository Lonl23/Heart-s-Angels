// Helpers ERP RH — validités & onboarding (fiche JSONB).

const JOUR = 24 * 60 * 60 * 1000

function parseDate(s) {
  if (!s) return null
  const d = new Date(s + (String(s).length <= 10 ? 'T12:00:00' : ''))
  return Number.isNaN(d.getTime()) ? null : d
}

function joursRestants(iso) {
  const d = parseDate(iso)
  if (!d) return null
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  return Math.round((d - today) / JOUR)
}

/**
 * Alertes de validité réglementaire / permis.
 * level: 'expire' | 'bientot' | 'manque'
 */
export function validitesFiche(fiche = {}) {
  const f = fiche || {}
  const out = []
  const push = (id, label, date, { obligatoire = false } = {}) => {
    if (!date) {
      if (obligatoire) out.push({ id, label, level: 'manque', date: null, jours: null })
      return
    }
    const j = joursRestants(date)
    if (j == null) return
    if (j < 0) out.push({ id, label, level: 'expire', date, jours: j })
    else if (j <= 30) out.push({ id, label, level: 'bientot', date, jours: j })
  }

  const ambu = f.ambulancier || {}
  const quals = f.qualifications || []
  if (quals.includes('ambulancier') || ambu.visa_atnup) {
    push('atnup', 'Visa ATNUP', ambu.visa_atnup_validite, { obligatoire: !!ambu.visa_atnup })
  }
  if (ambu.badge_112) {
    push('badge112', 'Badge 112', ambu.badge_112_validite)
  }
  const inf = f.infirmier || {}
  if (quals.includes('infirmier') || inf.visa) {
    push('visa_inf', 'Visa infirmier', inf.visa_validite, { obligatoire: !!inf.visa })
  }
  const permis = f.permis || {}
  if (permis.selection_medicale) {
    push('selection', 'Sélection médicale', permis.selection_validite, { obligatoire: true })
  }
  return out
}

export function libelleValidite(a) {
  if (a.level === 'manque') return `${a.label} : date manquante`
  if (a.level === 'expire') return `${a.label} : expiré`
  if (a.jours === 0) return `${a.label} : expire aujourd’hui`
  return `${a.label} : expire dans ${a.jours} j`
}

export const ONBOARDING_CASES = [
  { id: 'photo', l: 'Photo' },
  { id: 'telephone', l: 'Téléphone' },
  { id: 'type', l: 'Type de bénévole' },
  { id: 'quals', l: 'Qualification(s)' },
  { id: 'urgence', l: 'Contact d’urgence' },
]

export function onboardingScore(fiche = {}) {
  const f = fiche || {}
  const checks = [
    { id: 'photo', ok: !!f.photo_url },
    { id: 'telephone', ok: !!(f.telephone && String(f.telephone).trim()) },
    { id: 'type', ok: !!f.type_benevole },
    { id: 'quals', ok: Array.isArray(f.qualifications) && f.qualifications.length > 0 },
    { id: 'urgence', ok: (f.contacts_urgence || []).some(c => c?.telephone && String(c.telephone).trim()) },
  ]
  const done = checks.filter(c => c.ok).length
  return {
    checks,
    done,
    total: checks.length,
    pct: Math.round((100 * done) / checks.length),
  }
}
