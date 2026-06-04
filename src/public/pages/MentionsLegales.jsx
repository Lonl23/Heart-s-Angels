// src/public/pages/MentionsLegales.jsx
export default function MentionsLegales() {
  return (
    <div style={{ fontFamily: 'DM Sans,sans-serif', background: '#FDFAF6', minHeight: '80vh' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '64px 20px' }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: 'clamp(2rem,4vw,3rem)', fontWeight: 500, color: '#1A1514', marginBottom: 8 }}>Mentions légales</h1>
        <p style={{ fontSize: 13, color: '#7A7470', marginBottom: 40 }}>Dernière mise à jour : janvier 2026</p>

        {sections.map((s, i) => (
          <div key={i} style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: "'Cormorant Garamond',Georgia,serif", fontSize: '1.4rem', fontWeight: 500, color: '#C8435A', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(200,67,90,.12)' }}>{s.title}</h2>
            <div style={{ fontSize: 14.5, color: '#4A4340', lineHeight: 1.8, whiteSpace: 'pre-line' }}>{s.content}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const sections = [
  { title: '1. Identification de l\'ASBL',
    content: `Dénomination sociale : Heart's Angels ASBL
Numéro d'entreprise (BCE) : 0537.416.028
Siège social : Rue des Awirs 249, 4400 Flémalle, Belgique
Email : info@heartsangels.be
Téléphone : +32 493 19 14 78
Compte bancaire : BE45 0689 3611 4489 (BIC : GKCCBEBB)` },
  { title: '2. Objet social',
    content: `Heart's Angels est une association sans but lucratif (ASBL) de droit belge dont l'objet social est la réalisation gratuite de souhaits pour des patients en soins palliatifs, accompagnés de leur famille et d'une équipe médicale bénévole.` },
  { title: '3. Responsable de la publication',
    content: `Le responsable de la publication du présent site est le Président de l'ASBL Heart's Angels.` },
  { title: '4. Hébergement',
    content: `Ce site est hébergé par Firebase Hosting (Google LLC), 1600 Amphitheatre Parkway, Mountain View, CA 94043, États-Unis. Les données personnelles collectées via les formulaires sont stockées sur Supabase, hébergé dans la région Europe (Frankfurt, Allemagne), conformément au RGPD.` },
  { title: '5. Propriété intellectuelle',
    content: `L'ensemble du contenu de ce site (textes, images, logos, graphismes) est la propriété exclusive de Heart's Angels ASBL ou de ses partenaires. Toute reproduction, distribution ou utilisation sans autorisation écrite préalable est strictement interdite.` },
  { title: '6. Limitation de responsabilité',
    content: `Heart's Angels ASBL s'efforce d'assurer l'exactitude des informations publiées sur ce site, mais ne peut garantir leur exhaustivité ou leur actualité. L'ASBL décline toute responsabilité pour tout dommage direct ou indirect résultant de l'utilisation de ce site.` },
  { title: '7. Droit applicable',
    content: `Le présent site et ses mentions légales sont soumis au droit belge. Tout litige relatif à ce site relève de la compétence exclusive des tribunaux de Liège, Belgique.` },
]
