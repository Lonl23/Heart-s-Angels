// src/public/pages/PolitiqueConf.jsx
export default function PolitiqueConf() {
  return (
    <div style={{ fontFamily: 'DM Sans,sans-serif', background: '#FDFAF6', minHeight: '80vh' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '64px 20px' }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(2rem,4vw,3rem)', fontWeight: 500, color: '#1A1514', marginBottom: 8 }}>Politique de confidentialité</h1>
        <p style={{ fontSize: 13, color: '#7A7470', marginBottom: 40 }}>Dernière mise à jour : janvier 2026 · Conformément au RGPD (UE) 2016/679</p>

        <div style={{ background: '#E6F1FB', border: '1px solid #B5D4F4', borderRadius: 12, padding: '16px 18px', marginBottom: 36, fontSize: 14, color: '#185FA5', lineHeight: 1.65 }}>
          🔒 <strong>En résumé :</strong> Vos données sont hébergées en Europe, utilisées uniquement pour la gestion des souhaits et de l'ASBL, jamais vendues à des tiers, et effacées conformément aux délais légaux.
        </div>

        {sections.map((s, i) => (
          <div key={i} style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: '1.4rem', fontWeight: 500, color: '#C8435A', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(200,67,90,.12)' }}>{s.title}</h2>
            <div style={{ fontSize: 14.5, color: '#4A4340', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{s.content}</div>
          </div>
        ))}

        <div style={{ background: '#FBEAF0', border: '1px solid rgba(200,67,90,.2)', borderRadius: 12, padding: '16px 18px', marginTop: 36, fontSize: 14, color: '#8C1F35', lineHeight: 1.65 }}>
          Pour exercer vos droits ou pour toute question relative à la protection de vos données, contactez-nous à : <a href="mailto:info@heartsangels.be" style={{ color: '#C8435A', fontWeight: 600 }}>info@heartsangels.be</a>
        </div>
      </div>
    </div>
  )
}

const sections = [
  { title: '1. Responsable du traitement',
    content: `Heart's Angels ASBL (BCE 0537.416.028)
Rue des Awirs 249, 4400 Flémalle, Belgique
Email : info@heartsangels.be` },
  { title: '2. Données collectées',
    content: `Nous collectons uniquement les données nécessaires à notre mission :

• Formulaire de demande de souhait : nom, prénom, date de naissance du patient, coordonnées du contact, description du souhait, informations médicales nécessaires à la sécurité de la mission.
• Formulaire de contact et de candidature bénévole : nom, prénom, email, téléphone, motivation.
• Formulaire d'inscription aux événements : nom, prénom, email, téléphone, nombre de participants.
• Données de comptabilité : informations liées aux transactions financières de l'ASBL.

Aucune donnée de santé n'est collectée sans le consentement explicite du patient ou de son représentant légal.` },
  { title: '3. Base légale des traitements',
    content: `• Consentement explicite (Art. 6.1.a et Art. 9.2.a RGPD) pour les données de santé.
• Intérêt légitime de l'ASBL (Art. 6.1.f RGPD) pour la gestion administrative.
• Exécution d'une mission d'intérêt public (Art. 6.1.e RGPD) pour la réalisation des souhaits.` },
  { title: '4. Hébergement et sécurité',
    content: `Toutes les données sont hébergées sur Supabase (PostgreSQL), région Europe — Frankfurt, Allemagne. Ce prestataire est certifié SOC 2 Type II et conforme au RGPD.

Mesures de sécurité techniques :
• Chiffrement en transit (TLS 1.3)
• Accès par rôle (Row Level Security)
• Authentification sécurisée (PKCE)
• Audit logs sur toutes les actions sensibles
• Sauvegardes quotidiennes automatiques` },
  { title: '5. Durée de conservation',
    content: `• Données des souhaits et bénéficiaires : 5 ans après la réalisation ou l'annulation, puis suppression définitive.
• Données des bénévoles inactifs : anonymisation après 5 ans d'inactivité.
• Logs d'audit : 3 ans.
• Données comptables : 7 ans (obligation légale belge).
• Candidatures bénévoles non retenues : 1 an.` },
  { title: '6. Vos droits',
    content: `Conformément au RGPD, vous disposez des droits suivants :
• Droit d'accès à vos données
• Droit de rectification
• Droit à l'effacement ("droit à l'oubli")
• Droit à la limitation du traitement
• Droit à la portabilité
• Droit d'opposition

Pour exercer ces droits, contactez : info@heartsangels.be
Vous pouvez également introduire une réclamation auprès de l'Autorité de Protection des Données (APD) belge : apd-gba.be` },
  { title: '7. Cookies',
    content: `Ce site utilise uniquement des cookies techniques strictement nécessaires à son fonctionnement (session d'authentification). Aucun cookie publicitaire ou de tracking n'est utilisé.` },
  { title: '8. Partage des données',
    content: `Vos données ne sont jamais vendues ni partagées avec des tiers à des fins commerciales. Elles peuvent être partagées avec :
• Les membres autorisés de l'ASBL (sur base du rôle et besoin-d'en-connaître)
• Supabase (hébergeur, sous contrat DPA conforme RGPD)
• Firebase (hébergement du site, Google LLC — seul le code de l'application est hébergé, pas les données personnelles)` },
]
