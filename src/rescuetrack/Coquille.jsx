import { COPYRIGHT } from '@/copyright'
import { Logo } from '@/components/ui'
import { useRtAuth } from './auth'

export default function Coquille({ children }) {
  const { profile, signOut } = useRtAuth()
  return (
    <div className="rt">
      <header className="rt-bar">
        <a className="rt-brand" href="/app">
          <Logo size={40} />
          <span>
            <strong>RescueTrack</strong>
            <small>Heart's Angels</small>
          </span>
        </a>
        <div className="rt-bar-actions">
          {profile?.prenom && <span className="rt-qui">{profile.prenom}</span>}
          <button type="button" className="rt-textbtn" onClick={signOut}>Déconnexion</button>
        </div>
      </header>
      <main className="rt-main">{children}</main>
      <footer className="rt-foot">{COPYRIGHT}</footer>
    </div>
  )
}
