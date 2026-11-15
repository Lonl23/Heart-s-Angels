import { Page } from '@/components/ui'

const MESSAGE_DEFAUT =
  'L’équipe informatique réaménage cet endroit pour le plus grand confort des volontaires. Elle reviendra très vite.'

export default function PageMaintenance({ titre, message }) {
  return (
    <Page title={titre || 'Bientôt de retour'}>
      <div
        style={{
          maxWidth: 520,
          margin: '28px auto',
          padding: '28px 24px',
          textAlign: 'center',
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden>🛠️</div>
        <h2 style={{ margin: '0 0 12px', fontSize: '1.35rem', color: 'var(--heading)', fontWeight: 700 }}>
          Mise à jour en cours
        </h2>
        <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.55, color: 'var(--text)' }}>
          {message || MESSAGE_DEFAUT}
        </p>
      </div>
    </Page>
  )
}

export { MESSAGE_DEFAUT as MESSAGE_MAINTENANCE_DEFAUT }
