import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth, PHASES_RECOLTEUR } from '@/hooks/useAuth'
import MonProfil from '@/modules/profil/MonProfil'
import { useNotifications } from '@/hooks/useNotifications'
import styles from './layout.module.css'

// Logo de l'ASBL (même source que la navbar publique)
const LOGO = 'https://www.heartsangels.be/wp-content/uploads/2026/03/cropped-logo-hearts-angels-vectorise-scaled-1.png'

// ── Navigation items ──────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/app/dashboard',       icon: <GridIcon />,     label: 'Tableau de bord',  perm: 'nav.dashboard' },
  { to: '/app/disponibilites',  icon: <CalIcon />,      label: 'Disponibilités',   perm: 'nav.disponibilites' },
  { to: '/app/souhaits',        icon: <HeartNavIcon />, label: 'Souhaits',         perm: 'nav.souhaits' },
  { to: '/app/defraiements',    icon: <ReceiptIcon />,  label: 'Défraiements',     perm: 'nav.defraiements' },
  { to: '/app/volontaires',     icon: <UsersIcon />,    label: 'Volontaires',      perm: 'nav.volontaires' },
  { to: '/app/annuaire',        icon: <UsersIcon />,    label: 'Annuaire',         perm: 'nav.annuaire' },
  { to: '/app/vente',           icon: <CartIcon />,     label: 'Vente événements', perm: 'nav.vente' },
  { to: '/app/comptabilite',    icon: <ChartIcon />,    label: 'Comptabilité',     perm: 'nav.comptabilite' },
  { to: '/app/stock',           icon: <BoxIcon />,      label: 'Stock matériel',   perm: 'nav.stock' },
  { to: '/app/contenu',         icon: <EditIcon />,     label: 'Contenu du site',  perm: 'nav.contenu' },
  { to: '/app/organigramme',    icon: <OrgIcon />,      label: 'Organigramme',     perm: 'nav.organigramme' },
  { to: '/app/acces',           icon: <OrgIcon />,      label: 'Gestion des accès', perm: 'nav.acces' },
]

export default function Layout() {
  const { profile, can, hasRole, signOut, simMode, toggleSimMode, isCoordInfo, simProfil, arreterSimulation } = useAuth()
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const navigate  = useNavigate()
  const location  = useLocation()

  const [sidebarOpen, setSidebarOpen]       = useState(false)
  const [profilOpen, setProfilOpen]         = useState(false)
  const [notifOpen, setNotifOpen]           = useState(false)
  const [userMenuOpen, setUserMenuOpen]     = useState(false)
  const notifRef = useRef(null)
  const userRef  = useRef(null)

  // Fermer les menus au clic extérieur
  useEffect(() => {
    function handleClick(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (userRef.current  && !userRef.current.contains(e.target))  setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Fermer sidebar mobile au changement de route
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const filteredNav = NAV_ITEMS.filter(item => can(item.perm))

  const roleLabel = {
    admin:                 'Administrateur',
    president:             'Président(e)',
    coordinateur:          'Coordinateur(rice)',
    tresorier:             'Trésorier(e)',
    secretaire:            'Secrétaire',
    ambulancier:           'Ambulancier',
    infirmier:             'Infirmier(e)',
    medecin:               'Médecin',
    volontaire_non_medical:'Bénévole',
    volontaire_medical:    'Bénévole médical',
    vice_president:        'Vice-Président(e)',
    tresorier_adjoint:     'Trésorier(e) adjoint(e)',
    logistique:            'Responsable logistique',
    logistique_adjoint:    'Logistique adjoint(e)',
    recolteur_souhaits:    'Récolteur(trice) de souhaits',
    informatique:          'Responsable informatique',
    kinesitherapeute:      'Kinésithérapeute',
    aide_soignant:         'Aide-soignant(e)',
    psychologue:           'Psychologue',
    photographe:           'Photographe',
    communication:         'Responsable communication',
  }[profile?.role] || profile?.role || ''

  const avatarInitials = profile
    ? (profile.prenom?.[0] || '') + (profile.nom?.[0] || '')
    : '?'
  const photoUrl = profile?.photo_url || null
  const avatarImgStyle = { width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%', display:'block' }

  return (
    <div className={styles.root} style={simProfil ? { paddingTop: 'calc(42px + env(safe-area-inset-top))' } : undefined}>

      {/* Bannière de simulation (visible partout) */}
      {simProfil && (
        <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:1000, background:'#BA7517', color:'white', padding:'calc(8px + env(safe-area-inset-top)) 16px 8px', display:'flex', justifyContent:'center', alignItems:'center', gap:14, fontSize:13.5, fontFamily:"'DM Sans',sans-serif", boxShadow:'0 2px 8px rgba(0,0,0,.2)', flexWrap:'wrap' }}>
          <span>👁️ Vous voyez l'application comme <strong>{simProfil._label}</strong></span>
          <button onClick={arreterSimulation} style={{ padding:'4px 12px', background:'white', color:'#BA7517', border:'none', borderRadius:7, fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>Quitter la simulation</button>
        </div>
      )}

      {/* ── Sidebar ─────────────────────────────────────────── */}
      {sidebarOpen && (
        <div className={styles.sidebarOverlay} onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        {/* Logo */}
        <div className={styles.sidebarLogo}>
          <div className={styles.sidebarLogoIcon} style={{ background:'transparent', overflow:'hidden', padding:0 }}>
            <img src={LOGO} alt="Heart's Angels" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} />
          </div>
          <div>
            <div className={styles.sidebarLogoName}>Heart's Angels</div>
            <div className={styles.sidebarLogoSub}>Gestion interne</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          <div className={styles.navGroup}>
            {filteredNav.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
                }
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
                {/* Badge notifications pour souhaits/défraiements */}
                {item.to === '/defraiements' && unreadCount > 0 && (
                  <span className={styles.navBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Profil utilisateur (bas de sidebar) */}
        <div className={styles.sidebarUser} onClick={() => setProfilOpen(true)} style={{ cursor:'pointer' }} title="Mon profil">
          <div className={styles.sidebarUserAvatar}>{photoUrl ? <img src={photoUrl} alt="" style={avatarImgStyle} onError={e=>{ e.currentTarget.style.display='none' }} /> : avatarInitials}</div>
          <div className={styles.sidebarUserInfo}>
            <div className={styles.sidebarUserName}>
              {profile?.prenom} {profile?.nom}
            </div>
            <div className={styles.sidebarUserRole}>{roleLabel}</div>
          </div>
        </div>
      </aside>

      {/* ── Zone principale ──────────────────────────────────── */}
      <div className={styles.main}>

        {/* Topbar */}
        <header className={styles.topbar}>
          {/* Burger mobile */}
          <button
            className={styles.burgerBtn}
            onClick={() => setSidebarOpen(v => !v)}
            aria-label="Menu"
          >
            <BurgerIcon />
          </button>

          {/* Titre de la page courant */}
          <div className={styles.topbarTitle}>
            {filteredNav.find(n => {
              if (n.to === '/app/dashboard') return location.pathname === '/app/dashboard' || location.pathname === '/app'
              return location.pathname.startsWith(n.to)
            })?.label || "Heart's Angels"}
          </div>

          <div className={styles.topbarRight}>
            {/* Notifications */}
            <div className={styles.notifWrap} ref={notifRef}>
              <button
                className={`${styles.topbarBtn} ${unreadCount > 0 ? styles.topbarBtnAlert : ''}`}
                onClick={() => setNotifOpen(v => !v)}
                aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} non lues)` : ''}`}
              >
                <BellIcon />
                {unreadCount > 0 && (
                  <span className={styles.notifDot}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>

              {notifOpen && (
                <div className={styles.notifPanel}>
                  <div className={styles.notifHeader}>
                    <span className={styles.notifHeaderTitle}>Notifications</span>
                    {unreadCount > 0 && (
                      <button className={styles.notifMarkAll} onClick={markAllAsRead}>
                        Tout marquer lu
                      </button>
                    )}
                  </div>

                  <div className={styles.notifList}>
                    {notifications.length === 0 ? (
                      <div className={styles.notifEmpty}>
                        <BellOffIcon />
                        <span>Aucune notification</span>
                      </div>
                    ) : (
                      notifications.slice(0, 15).map(n => (
                        <div
                          key={n.id}
                          className={`${styles.notifItem} ${!n.lu ? styles.notifUnread : ''} ${n.priorite === 'critique' ? styles.notifCritique : ''}`}
                          onClick={() => {
                            markAsRead(n.id)
                            if (n.lien) { navigate(n.lien); setNotifOpen(false) }
                          }}
                        >
                          <div className={`${styles.notifItemDot} ${getPriorityClass(n.priorite, styles)}`} />
                          <div className={styles.notifItemContent}>
                            <div className={styles.notifItemTitle}>{n.titre}</div>
                            {n.message && (
                              <div className={styles.notifItemMsg}>{n.message}</div>
                            )}
                            <div className={styles.notifItemTime}>
                              {formatTimeAgo(n.created_at)}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Menu utilisateur */}
            <div className={styles.userMenuWrap} ref={userRef}>
              <button
                className={styles.userAvatarBtn}
                onClick={() => setUserMenuOpen(v => !v)}
                aria-label="Menu utilisateur"
              >
                {photoUrl
                  ? <img src={photoUrl} alt="" style={avatarImgStyle} onError={e=>{ e.currentTarget.style.display='none' }} />
                  : <span className={styles.userAvatarText}>{avatarInitials}</span>}
              </button>

              {userMenuOpen && (
                <div className={styles.userMenu}>
                  <div className={styles.userMenuHeader}>
                    <div className={styles.userMenuName}>
                      {profile?.prenom} {profile?.nom}
                    </div>
                    <div className={styles.userMenuEmail}>{profile?.email}</div>
                    <div className={styles.userMenuRole}>{roleLabel}</div>
                  </div>
                  <div className={styles.userMenuDivider} />
                  <button className={styles.userMenuItem} onClick={() => { setProfilOpen(true); setUserMenuOpen(false) }}>
                    <UserIcon /> Mon profil
                  </button>
                  <button className={styles.userMenuItem} onClick={() => { navigate('/reset-password'); setUserMenuOpen(false) }}>
                    <LockIcon /> Changer le mot de passe
                  </button>
                  {can.admin && (
                    <>
                      <div className={styles.userMenuDivider} />
                      <button className={styles.userMenuItem} onClick={() => { navigate('/admin'); setUserMenuOpen(false) }}>
                        <SettingsIcon /> Administration
                      </button>
                    </>
                  )}
                  <div className={styles.userMenuDivider} />
                  <button
                    className={`${styles.userMenuItem} ${styles.userMenuItemDanger}`}
                    onClick={handleSignOut}
                  >
                    <LogoutIcon /> Se déconnecter
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Contenu de la page */}
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
      {profilOpen && <MonProfil onClose={()=>setProfilOpen(false)} />}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getPriorityClass(priorite, styles) {
  if (priorite === 'critique') return styles.dotCritique
  if (priorite === 'haute')    return styles.dotHaute
  return styles.dotNormale
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'À l\'instant'
  if (mins < 60)  return `Il y a ${mins} min`
  if (hours < 24) return `Il y a ${hours}h`
  if (days < 7)   return `Il y a ${days}j`
  return new Date(dateStr).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })
}

// ── Icônes ────────────────────────────────────────────────────────────────────
function HeartLogoIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
}
function HeartNavIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
}
function GridIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
}
function CalIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function ReceiptIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M4 2v20l3-3 2 3 3-3 2 3 3-3 3 3V2l-3 3-2-3-3 3-2-3-3 3Z"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
}
function UsersIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function CartIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
}
function ChartIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
}
function EditIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
}
function BoxIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
}
function OrgIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><rect x="8" y="2" width="8" height="4" rx="1"/><rect x="1" y="15" width="6" height="4" rx="1"/><rect x="9" y="15" width="6" height="4" rx="1"/><rect x="17" y="15" width="6" height="4" rx="1"/><path d="M4 15v-3a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><line x1="12" y1="6" x2="12" y2="10"/></svg>
}
function BellIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
}
function BellOffIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="28" height="28"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.9 17.9 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
}
function BurgerIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
}
function UserIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
}
function LockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
}
function SettingsIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
}
function LogoutIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
}