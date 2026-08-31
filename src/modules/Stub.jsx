import { Empty } from '@/components/ui'

export default function Stub({ nom }) {
  return (
    <div style={{ padding:'clamp(16px,3vw,28px)', width:'100%', boxSizing:'border-box' }}>
      <h1 style={{ fontSize:'1.6rem', color:'var(--heading)', marginBottom:8 }}>{nom}</h1>
      <Empty
        title="Module bientôt disponible"
        hint="La navigation et les droits sont déjà en place. Cet écran sera branché à l'étape suivante, sans rien perdre de vos données."
      />
    </div>
  )
}
