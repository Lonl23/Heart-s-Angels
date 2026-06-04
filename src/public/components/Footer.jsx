import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.jsx'

const LOGO = 'https://www.heartsangels.be/wp-content/uploads/2026/03/logo-hearts-angels-vectorise-scaled.png'

export default function Footer() {
  const { t } = useI18n()
  return (
    <footer style={{ background: '#1A0A0D', color: 'rgba(255,255,255,0.6)', fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '52px 24px 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1fr 1fr', gap: 40, marginBottom: 44 }}>
          {/* Colonne marque */}
          <div>
            <img src={LOGO} alt="Heart's Angels" style={{ height: 60, width: 'auto', objectFit: 'contain', marginBottom: 16 }} />
            <p style={{ fontSize: 12.5, lineHeight: 1.75, marginBottom: 18, maxWidth: 280 }}>
              ASBL dédiée à la réalisation des souhaits de patients en soins palliatifs, entourés de leurs proches et d'une équipe médicale bénévole.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              {[
                { icon: '📍', text: 'Rue des Awirs 249, 4400 Flémalle' },
                { icon: '✉️', text: 'info@heartsangels.be', href: 'mailto:info@heartsangels.be' },
                { icon: '📞', text: '+32 493 19 14 78', href: 'tel:+32493191478' },
              ].map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 13 }}>{c.icon}</span>
                  {c.href
                    ? <a href={c.href} style={{ color: 'rgba(255,255,255,0.65)', textDecoration: 'none' }}>{c.text}</a>
                    : <span style={{ color: 'rgba(255,255,255,0.55)' }}>{c.text}</span>
                  }
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {[
                { href: 'https://www.facebook.com/heartsangels', label: 'Facebook', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg> },
                { href: 'https://www.instagram.com/heartsangels/', label: 'Instagram', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg> },
              ].map((s, i) => (
                <a key={i} href={s.href} target="_blank" rel="noopener" aria-label={s.label} style={{ width: 32, height: 32, borderRadius: 7, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#1BB0CE'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Liens utiles */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16 }}>{t('footer.useful')}</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: t('footer.legal'), to: '/mentions-legales' },
                { label: t('footer.volunteer'), to: '/devenir-benevole' },
                { label: t('footer.support'), to: '/nous-soutenir' },
                { label: t('footer.contact'), to: '/contact' },
              ].map((l, i) => (
                <li key={i}>
                  <Link to={l.to} style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', textDecoration: 'none', transition: 'color .12s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#1BB0CE'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                  >{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Les souhaits */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16 }}>{t('nav.wishes')}</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: t('nav.wishHeart'), to: '/les-souhaits' },
                { label: t('nav.wishForm'), to: '/demande-de-souhait' },
                { label: t('nav.photos'), to: '/photos' },
              ].map((l, i) => (
                <li key={i}>
                  <Link to={l.to} style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', textDecoration: 'none', transition: 'color .12s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#1BB0CE'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                  >{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Nous soutenir */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16 }}>{t('nav.support')}</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: t('nav.donations'), to: '/dons' },
                { label: t('nav.becomeVolunteer'), to: '/devenir-benevole' },
                { label: t('nav.shop'), to: '/boutique' },
                { label: t('nav.news'), to: '/actualites' },
              ].map((l, i) => (
                <li key={i}>
                  <Link to={l.to} style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', textDecoration: 'none', transition: 'color .12s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#1BB0CE'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                  >{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* IBAN */}
        <div style={{ background: 'rgba(27,176,206,0.1)', border: '1px solid rgba(27,176,206,0.2)', borderRadius: 10, padding: '14px 20px', marginBottom: 24, fontSize: 13, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18 }}>🏦</span>
          <div>
            <div style={{ fontWeight: 600, color: 'white', marginBottom: 2 }}>Compte bancaire</div>
            <div>IBAN : <strong style={{ color: '#1BB0CE' }}>BE45 0689 3611 4489</strong> · BIC : GKCCBEBB</div>
          </div>
        </div>

        {/* Bottom */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, fontSize: 11.5 }}>
          <div style={{ color: 'rgba(255,255,255,0.3)' }}>
            © 2026 Heart's Angels ASBL ·{' '}
            <Link to="/mentions-legales" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Mentions légales</Link>
            {' · BCE : '}
            <a href="https://kbopub.economie.fgov.be/kbopub/toonondernemingps.html?ondernemingsnummer=537416028" target="_blank" rel="noopener" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>0537.416.028</a>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11 }}>
            Design React · Firebase Hosting · Supabase (EU-Frankfurt)
          </div>
        </div>
      </div>

      <style>{`
        @media(max-width:900px) { footer [style*='grid-template-columns: 2.5fr'] { grid-template-columns: 1fr 1fr !important; } }
        @media(max-width:500px) { footer [style*='grid-template-columns: 2.5fr'] { grid-template-columns: 1fr !important; } }
      `}</style>
    </footer>
  )
}