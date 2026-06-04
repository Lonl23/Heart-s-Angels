import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '../i18n/index.jsx'

const LOGO = 'https://www.heartsangels.be/wp-content/uploads/2026/03/cropped-logo-hearts-angels-vectorise-scaled-1.png'

export default function Navbar() {
  const { t, lang, setLang, langs } = useI18n()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openMenu, setOpenMenu] = useState(null)  // clé du sous-menu ouvert
  const [langOpen, setLangOpen] = useState(false)
  const navRef = useRef(null)

  useEffect(() => { setMobileOpen(false); setOpenMenu(null) }, [location.pathname])

  useEffect(() => {
    function handleClick(e) {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenMenu(null); setLangOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const navItems = [
    { key: 'home', label: t('nav.home'), to: '/' },
    { key: 'about', label: t('nav.about'), sub: [
        { label: t('nav.history'), to: '/historique' },
        { label: t('nav.photos'), to: '/photos' },
      ]
    },
    { key: 'wishes', label: t('nav.wishes'), sub: [
        { label: t('nav.wishHeart'), to: '/les-souhaits' },
        { label: t('nav.wishForm'), to: '/demande-de-souhait' },
      ]
    },
    { key: 'support', label: t('nav.support'), sub: [
        { label: t('nav.donations'), to: '/dons' },
        { label: t('nav.volunteers'), to: '/benevoles' },
        { label: t('nav.becomeVolunteer'), to: '/devenir-benevole' },
        { label: t('nav.partners'), to: '/partenaires' },
      ]
    },
    { key: 'shop',     label: t('nav.shop'),  to: '/boutique' },
    { key: 'news', label: t('nav.news'), sub: [
        { label: t('nav.blog'), to: '/actualites' },
        { label: t('nav.activities'), to: '/activites' },
        { label: t('nav.press'), to: '/presse' },
        { label: t('nav.downloads'), to: '/telechargement' },
      ]
    },
    { key: 'contact', label: t('nav.contact'), to: '/contact' },
  ]

  return (
    <>
      <style>{CSS}</style>

      {/* Top bar */}
      <div className="ha-topbar">
        <div className="ha-topbar-inner">
          <div className="ha-topbar-left">
            <span className="ha-topbar-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              {t('topbar.address')}
            </span>
            <span className="ha-topbar-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              info@heartsangels.be
            </span>
            <span className="ha-topbar-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.6 4.9 2 2 0 0 1 3.57 2.69h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.09a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.43 17.5l-.51-.58z"/></svg>
              +32 493 19 14 78
            </span>
          </div>
          <div className="ha-topbar-right">
            <Link to="/dons" className="ha-topbar-donate">{t('topbar.donate')}</Link>
            <a href="https://www.facebook.com/heartsangels" target="_blank" rel="noopener" className="ha-topbar-social" aria-label="Facebook">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
            </a>
            <a href="https://www.instagram.com/heartsangels/" target="_blank" rel="noopener" className="ha-topbar-social" aria-label="Instagram">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
            </a>
          </div>
        </div>
      </div>

      {/* Nav principale */}
      <header className="ha-header" ref={navRef}>
        <div className="ha-nav-inner">
          <Link to="/" className="ha-logo">
            <img src={LOGO} alt="Heart's Angels" className="ha-logo-img" />
          </Link>

          {/* Desktop nav */}
          <nav className="ha-nav-desktop">
            {navItems.map(item => (
              <div key={item.key} className="ha-nav-item-wrap"
                onMouseEnter={() => item.sub && setOpenMenu(item.key)}
                onMouseLeave={() => setOpenMenu(null)}
              >
                {item.to ? (
                  <Link to={item.to} className={`ha-nav-link ${location.pathname === item.to ? 'active' : ''}`}>
                    {item.label}
                  </Link>
                ) : (
                  <button className={`ha-nav-link ha-nav-btn ${openMenu === item.key ? 'active' : ''}`} onClick={() => setOpenMenu(openMenu === item.key ? null : item.key)}>
                    {item.label}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 4 }}><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                )}
                {item.sub && openMenu === item.key && (
                  <div className="ha-dropdown">
                    {item.sub.map(s => (
                      <Link key={s.to} to={s.to} className="ha-dropdown-item" onClick={() => setOpenMenu(null)}>
                        {s.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="ha-nav-actions">
            {/* Sélecteur de langue */}
            <div className="ha-lang-wrap" style={{ position: 'relative' }}>
              <button className="ha-lang-btn" onClick={() => setLangOpen(!langOpen)}>
                <span className="ha-lang-flag">{langFlag(lang)}</span>
                <span className="ha-lang-code">{lang.toUpperCase()}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {langOpen && (
                <div className="ha-lang-dropdown">
                  {Object.entries(langs).map(([code, name]) => (
                    <button key={code} className={`ha-lang-option ${lang === code ? 'active' : ''}`} onClick={() => { setLang(code); setLangOpen(false) }}>
                      <span>{langFlag(code)}</span> {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Link to="/app" className="ha-btn-login">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              {t('nav.login')}
            </Link>

            {/* Burger */}
            <button className="ha-burger" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
              {mobileOpen
                ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              }
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="ha-mobile-menu">
            {navItems.map(item => (
              <div key={item.key}>
                {item.to ? (
                  <Link to={item.to} className="ha-mobile-link" onClick={() => setMobileOpen(false)}>{item.label}</Link>
                ) : (
                  <>
                    <button className="ha-mobile-link ha-mobile-parent" onClick={() => setOpenMenu(openMenu === item.key ? null : item.key)}>
                      {item.label}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: openMenu === item.key ? 'rotate(180deg)' : '', transition: 'transform .2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {openMenu === item.key && (
                      <div className="ha-mobile-sub">
                        {item.sub.map(s => (
                          <Link key={s.to} to={s.to} className="ha-mobile-sub-link" onClick={() => setMobileOpen(false)}>{s.label}</Link>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            {/* Langues mobile */}
            <div className="ha-mobile-langs">
              {Object.entries(langs).map(([code, name]) => (
                <button key={code} className={`ha-mobile-lang ${lang === code ? 'active' : ''}`} onClick={() => { setLang(code); setMobileOpen(false) }}>
                  {langFlag(code)} {code.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>
    </>
  )
}

function langFlag(code) {
  const flags = { fr: '🇫🇷', nl: '🇧🇪', en: '🇬🇧', de: '🇩🇪' }
  return flags[code] || '🌐'
}

const CSS = `
:root {
  --blue: #1BB0CE;
  --blue-dark: #0E7A93;
  --blue-light: #E6F7FA;
  --text: #1A1514;
  --text-2: #4A4340;
  --muted: #7A7470;
  --border: rgba(27,176,206,0.15);
}
/* ── Topbar ── */
.ha-topbar { background: #1A1514; color: rgba(255,255,255,0.75); font-size: 12px; padding: 6px 20px; }
.ha-topbar-inner { max-width: 1280px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.ha-topbar-left { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.ha-topbar-item { display: flex; align-items: center; gap: 5px; }
.ha-topbar-item svg { opacity: 0.6; flex-shrink: 0; }
.ha-topbar-right { display: flex; align-items: center; gap: 10px; }
.ha-topbar-donate { background: var(--blue); color: white; border-radius: 4px; padding: 3px 10px; font-size: 11.5px; font-weight: 600; text-decoration: none; transition: background .15s; }
.ha-topbar-donate:hover { background: var(--blue-dark); }
.ha-topbar-social { width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; transition: background .15s; text-decoration: none; }
.ha-topbar-social:hover { background: var(--blue); }
/* ── Header ── */
.ha-header { background: #FFFCF8; border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 16px rgba(27,176,206,0.08); }
.ha-nav-inner { max-width: 1280px; margin: 0 auto; padding: 0 20px; display: flex; align-items: center; gap: 8px; height: 70px; }
.ha-logo { flex-shrink: 0; display: flex; align-items: center; }
.ha-logo-img { height: 52px; width: auto; object-fit: contain; }
/* ── Desktop nav ── */
.ha-nav-desktop { display: flex; align-items: center; gap: 2px; margin-left: 20px; flex: 1; }
.ha-nav-item-wrap { position: relative; }
.ha-nav-link { font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600; color: var(--text-2); text-decoration: none; padding: 8px 10px; border-radius: 4px; letter-spacing: .04em; text-transform: uppercase; transition: all .12s; white-space: nowrap; background: none; border: none; cursor: pointer; display: flex; align-items: center; }
.ha-nav-link:hover, .ha-nav-link.active { color: var(--blue); background: var(--blue-light); }
.ha-nav-btn { gap: 2px; }
/* ── Dropdown ── */
.ha-dropdown { position: absolute; top: 100%; left: 0; background: white; border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 28px rgba(27,176,206,0.12); min-width: 220px; padding: 6px; z-index: 200; animation: fadeDown .15s ease; }
@keyframes fadeDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
.ha-dropdown-item { display: block; padding: 8px 12px; font-size: 12.5px; font-weight: 500; color: var(--text-2); text-decoration: none; border-radius: 5px; transition: all .1s; white-space: nowrap; }
.ha-dropdown-item:hover { background: var(--blue-light); color: var(--blue); }
/* ── Actions ── */
.ha-nav-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.ha-btn-login { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; background: var(--blue); color: white; border-radius: 6px; font-size: 12px; font-weight: 600; text-decoration: none; letter-spacing: .03em; white-space: nowrap; transition: all .15s; box-shadow: 0 2px 8px rgba(27,176,206,0.3); }
.ha-btn-login:hover { background: var(--blue-dark); }
/* ── Langue ── */
.ha-lang-btn { display: flex; align-items: center; gap: 4px; padding: 6px 10px; background: none; border: 1px solid var(--border); border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; color: var(--text-2); font-family: 'DM Sans', sans-serif; transition: all .12s; }
.ha-lang-btn:hover { border-color: var(--blue); color: var(--blue); }
.ha-lang-code { letter-spacing: .04em; }
.ha-lang-dropdown { position: absolute; top: calc(100% + 6px); right: 0; background: white; border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 24px rgba(27,176,206,0.12); padding: 5px; min-width: 150px; z-index: 200; animation: fadeDown .15s ease; }
.ha-lang-option { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; background: none; border: none; cursor: pointer; font-size: 13px; font-family: 'DM Sans', sans-serif; color: var(--text-2); border-radius: 5px; transition: all .1s; text-align: left; }
.ha-lang-option:hover { background: var(--blue-light); color: var(--blue); }
.ha-lang-option.active { color: var(--blue); font-weight: 600; }
/* ── Burger ── */
.ha-burger { display: none; background: none; border: none; cursor: pointer; color: var(--text-2); padding: 6px; border-radius: 6px; }
/* ── Mobile menu ── */
.ha-mobile-menu { background: white; border-top: 1px solid var(--border); padding: 10px 20px 20px; display: none; max-height: 80vh; overflow-y: auto; }
.ha-mobile-link { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 12px 0; font-size: 13px; font-weight: 600; color: var(--text-2); text-decoration: none; border-bottom: 1px solid rgba(27,176,206,0.08); background: none; border-left: none; border-right: none; border-top: none; cursor: pointer; font-family: 'DM Sans', sans-serif; letter-spacing: .03em; text-transform: uppercase; }
.ha-mobile-link:hover { color: var(--blue); }
.ha-mobile-parent { width: 100%; text-align: left; }
.ha-mobile-sub { background: var(--blue-light); border-radius: 8px; margin: 4px 0 8px; padding: 4px 0; }
.ha-mobile-sub-link { display: block; padding: 9px 16px; font-size: 12.5px; color: var(--text-2); text-decoration: none; }
.ha-mobile-sub-link:hover { color: var(--blue); }
.ha-mobile-langs { display: flex; gap: 8px; flex-wrap: wrap; padding-top: 14px; }
.ha-mobile-lang { padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border); background: white; font-size: 12.5px; cursor: pointer; font-family: 'DM Sans', sans-serif; color: var(--text-2); transition: all .12s; }
.ha-mobile-lang.active { background: var(--blue); color: white; border-color: var(--blue); }
/* ── Responsive ── */
@media (max-width: 1100px) { .ha-nav-desktop { display: none; } .ha-burger { display: flex; } .ha-mobile-menu { display: block; } .ha-btn-login span { display: none; } }
@media (max-width: 600px) { .ha-topbar-left { display: none; } .ha-logo-img { height: 40px; } }
`